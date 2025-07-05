import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import fs from 'fs/promises';
import { Ollama } from 'ollama';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import si from 'systeminformation';
import YouTubeService from '../services/youtubeService.js';
import CalorieService from '../services/calorieService.js';
import GoogleCalendarService from '../services/googleCalendarService.js';
import Utils from '../utils/index.js';
import { CONFIG, COMMANDS, CONFIG_DESCRIPTIONS, CONFIG_ENV_MAP, CONFIG_EXAMPLES, WHISPER_MODELS_LIST } from '../config/index.js';
import logger from '../utils/logger.js';
import { exportFullConfig, importFullConfig } from '../services/configExportImportService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ API REST ============
class RestAPI {
  constructor(bot, configService) {
    if (!bot) {
        throw new Error('Instância do Bot não fornecida para RestAPI.');
    }
    this.bot = bot;
    this.configService = configService;
    this.app = express();
    this.googleService = new GoogleCalendarService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(methodOverride('_method'));
    this.app.use(expressLayouts);
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use((req, res, next) => {
      // Log simples de requisições
      logger.info(`🌐 ${req.method} ${req.path} - IP: ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Rota para enviar mensagem via API
    this.app.post('/send-message', async (req, res) => {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          error: 'Os campos "phone" e "message" são obrigatórios.'
        });
      }

      try {
        const client = this.bot.getClient();
        if (!client) {
          return res.status(503).json({
            error: '❌ WhatsApp bot não está disponível',
            details: 'O cliente WhatsApp não está conectado'
          });
        }

        const recipientId = Utils.formatRecipientId(phone);
        logger.info(`📲 Enviando mensagem via API para: ${recipientId}`);
        await client.sendMessage(recipientId, message);

        res.json({
          success: true,
          status: '✅ Mensagem enviada!',
          sentTo: phone,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        logger.error('❌ Erro ao enviar mensagem via API', err);
        res.status(500).json({
          error: '❌ Erro ao enviar mensagem',
          details: err.message || 'Erro desconhecido'
        });
      }
    });

    // Rota de Health Check
    this.app.get('/health', (req, res) => {
      // Poderia adicionar mais verificações aqui (e.g., status do bot, conexão DB)
      res.json({
        status: '✅ Online',
        uptime: process.uptime(), // Uptime do processo Node
        timestamp: new Date().toISOString(),
        message: 'API do Bot está operacional.',
        emoji: '🤖'
      });
    });


    // ===== Scheduler UI Routes =====
    const schedCollection = this.bot.getScheduler().schedCollection;

    // Página inicial com menu de dashboards
    this.app.get('/', (req, res) => {
      res.render('home');
    });

    // Dashboard de agendamentos
    this.app.get('/dashboard', async (req, res) => {
      const [messages, stats] = await Promise.all([
        schedCollection.find({}).toArray(),
        this.bot.getScheduler().getStats()
      ]);
      res.render('index', { messages, stats, commands: COMMANDS });
    });

    this.app.get('/messages/new', (req, res) => {
      res.render('new', { message: null });
    });

    this.app.post('/messages', async (req, res) => {
      const { recipient, message, scheduledTime, expiryTime, status } = req.body;
      await schedCollection.insertOne({
        recipient,
        message,
        status: status || 'approved',
        scheduledTime: new Date(scheduledTime),
        expiryTime: new Date(expiryTime),
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null
      });
      res.redirect('/');
    });

    this.app.get('/messages/:id/edit', async (req, res) => {
      const message = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!message) return res.status(404).send('Message not found');
      res.render('edit', { message });
    });

    this.app.put('/messages/:id', async (req, res) => {
      const { recipient, message, scheduledTime, expiryTime, status } = req.body;
      await schedCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: {
            recipient,
            message,
            scheduledTime: new Date(scheduledTime),
            expiryTime: new Date(expiryTime),
            sentAt: null,
            status
          } }
      );
      res.redirect('/');
    });

    this.app.delete('/messages/:id', async (req, res) => {
      await schedCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.redirect('/');
    });

    this.app.post('/messages/:id/duplicate', async (req, res) => {
      const original = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!original) return res.status(404).send('Message not found');
      const newMessage = {
        recipient: original.recipient,
        message: original.message,
        status: 'approved',
        scheduledTime: original.scheduledTime,
        expiryTime: original.expiryTime,
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null
      };
      await schedCollection.insertOne(newMessage);
      res.redirect('/');
    });

    const upload = multer();

    this.app.post('/import-ics', upload.single('icsfile'), async (req, res) => {
      if (!req.file) return res.redirect('/');
      const buffer = req.file.buffer;
      const { default: ICSImportService } = await import('../services/icsImportService.js');
      const icsService = new ICSImportService(this.bot.getScheduler());
      await icsService.importFromBuffer(buffer, 'web');
      res.redirect('/');
    });

    this.app.get('/auth/google', (req, res) => {
      const url = this.googleService.generateAuthUrl();
      res.redirect(url);
    });

    this.app.get('/oauth2callback', async (req, res) => {
      if (!req.query.code) return res.redirect('/');
      await this.googleService.setCredentials(req.query.code);
      const events = await this.googleService.listEvents();
      const scheduler = this.bot.getScheduler();
      for (const ev of events) {
        await scheduler.insertSchedule({
          recipient: 'web',
          message: ev.summary || 'Evento',
          status: 'approved',
          scheduledTime: new Date(ev.start.dateTime || ev.start.date),
          expiryTime: new Date(ev.end.dateTime || ev.start.date),
          sentAt: null,
          attempts: 0,
          lastAttemptAt: null
        });
      }
      res.redirect('/');
    });

    // ======== Features via Web ========

    this.app.get('/chat', (req, res) => {
      res.render('chat', { result: null, message: '' });
    });

    this.app.post('/chat', async (req, res) => {
      const message = req.body.message || '';
      if (!message.trim()) {
        return res.render('chat', { result: 'Mensagem vazia.', message });
      }
      try {
        const answer = await this.bot.llmService.getAssistantResponse('web', message);
        res.render('chat', { result: answer, message });
      } catch (err) {
        logger.error('Erro em /chat', err);
        res.render('chat', { result: 'Erro ao processar mensagem.', message });
      }
    });

    this.app.get('/transcribe', (req, res) => {
      res.render('transcribe', { result: null });
    });

    this.app.post('/transcribe', upload.single('audio'), async (req, res) => {
      if (!req.file) return res.render('transcribe', { result: 'Nenhum arquivo enviado.' });
      try {
        const text = await this.bot.transcriber.transcribe(req.file.buffer);
        res.render('transcribe', { result: text });
      } catch (err) {
        logger.error('Erro em /transcribe', err);
        res.render('transcribe', { result: 'Erro ao transcrever áudio.' });
      }
    });

    const ollamaClient = new Ollama({ host: CONFIG.llm.host });

    async function processImage(buffer, mode = 'description') {
      const imagePath = path.join(__dirname, `image_${Date.now()}.jpg`);
      await fs.writeFile(imagePath, buffer);
      try {
        const prompt = mode === 'calories' ? PROMPTS.calorieEstimation : PROMPTS.imageDescription;
        const resp = await ollamaClient.generate({ model: CONFIG.llm.imageModel, prompt, images: [imagePath], stream: false });
        const desc = resp.response.trim();
        if (mode !== 'calories') return desc;
        let foods = [];
        try {
          const jsonText = Utils.extractJSON(desc);
          const obj = JSON.parse(jsonText);
          foods = Array.isArray(obj.foods) ? obj.foods : [];
        } catch {}
        if (!foods.length) return desc;
        const results = [];
        for (const food of foods) {
          const cal = await CalorieService.getCalories(food);
          results.push(`🍽️ ${food}: ${cal ? cal : 'N/A'}${cal ? ' kcal' : ''}`);
        }
        return results.join('\n');
      } finally {
        await Utils.cleanupFile(imagePath);
      }
    }

    this.app.get('/describe', (req, res) => {
      res.render('describe', { result: null });
    });

    this.app.post('/describe', upload.single('image'), async (req, res) => {
      if (!req.file) return res.render('describe', { result: 'Nenhuma imagem enviada.' });
      try {
        const text = await processImage(req.file.buffer, 'description');
        res.render('describe', { result: text });
      } catch (err) {
        logger.error('Erro em /describe', err);
        res.render('describe', { result: 'Erro ao processar imagem.' });
      }
    });

    this.app.get('/calories', (req, res) => {
      res.render('calories', { result: null });
    });

    this.app.post('/calories', upload.single('image'), async (req, res) => {
      if (!req.file) return res.render('calories', { result: 'Nenhuma imagem enviada.' });
      try {
        const text = await processImage(req.file.buffer, 'calories');
        res.render('calories', { result: text });
      } catch (err) {
        logger.error('Erro em /calories', err);
        res.render('calories', { result: 'Erro ao processar imagem.' });
      }
    });

    this.app.get('/linkedin', (req, res) => {
      res.render('linkedin', { result: null, url: '' });
    });

    this.app.post('/linkedin', async (req, res) => {
      const url = req.body.url || '';
      if (!url.trim()) return res.render('linkedin', { result: 'URL inválida.', url });
      try {
        const liAt = CONFIG.linkedin.liAt;
        const response = await this.bot.llmService.getAssistantResponseLinkedin('web', url, liAt);
        res.render('linkedin', { result: response, url });
      } catch (err) {
        logger.error('Erro em /linkedin', err);
        res.render('linkedin', { result: 'Erro ao analisar perfil.', url });
      }
    });

    this.app.get('/summarize', (req, res) => {
      res.render('summarize', { result: null });
    });

    this.app.post('/summarize', upload.single('file'), async (req, res) => {
      let text = req.body.text || '';
      if (req.file) {
        const buffer = req.file.buffer;
        const filename = req.file.originalname.toLowerCase();
        const type = req.file.mimetype;
        try {
          if (type === 'application/pdf' || filename.endsWith('.pdf')) {
            const data = await pdfParse(buffer);
            text = data.text;
          } else if (type === 'text/plain' || filename.endsWith('.txt') || type === 'text/csv' || filename.endsWith('.csv')) {
            text = buffer.toString('utf8');
          } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || filename.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
          } else {
            return res.render('summarize', { result: 'Tipo de arquivo não suportado.' });
          }
        } catch (err) {
          logger.error('Erro ao ler arquivo', err);
          return res.render('summarize', { result: 'Erro ao ler arquivo.' });
        }
      }
      if (!text.trim()) return res.render('summarize', { result: 'Nenhum texto enviado.' });
      try {
        const truncated = text.trim().slice(0, 8000);
        const summary = await this.bot.llmService.getAssistantResponse('web', `Resuma em português o texto a seguir:\n\n${truncated}`);
        res.render('summarize', { result: summary });
      } catch (err) {
        logger.error('Erro em /summarize', err);
        res.render('summarize', { result: 'Erro ao resumir texto.' });
      }
    });

    this.app.get('/video', (req, res) => {
      res.render('video', { result: null, url: '' });
    });

    this.app.post('/video', async (req, res) => {
      const url = req.body.url || '';
      if (!url.trim()) return res.render('video', { result: 'Informe o link do vídeo.', url });
      try {
        const transcript = await YouTubeService.fetchTranscript(url);
        res.render('video', { result: transcript, url });
      } catch (err) {
        logger.error('Erro em /video', err);
        res.render('video', { result: 'Erro ao processar vídeo.', url });
      }
    });

    async function getSystemInfoText() {
      const [cpu, cpuTemp, cpuSpeed, mem, osInfo, load, diskLayout, fsSize, networkInterfaces, networkStats, processes, graphics, system, time, dockerInfo, services] = await Promise.all([
        si.cpu(),
        si.cpuTemperature().catch(() => ({ main: null })),
        si.cpuCurrentSpeed().catch(() => ({ avg: null })),
        si.mem(),
        si.osInfo(),
        si.currentLoad(),
        si.diskLayout(),
        si.fsSize(),
        si.networkInterfaces(),
        si.networkStats().catch(() => []),
        si.processes(),
        si.graphics().catch(() => ({ controllers: [] })),
        si.system(),
        si.time(),
        si.dockerInfo().catch(() => ({ containers: 0, containersRunning: 0 })),
        si.services('*').catch(() => [])
      ]);

      const formatBytes = (bytes) => {
        const gb = bytes / 1024 / 1024 / 1024;
        return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
      };
      const formatUptime = (seconds) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
      };

      const cpuInfo = [
        `🖥️ *CPU:* ${cpu.manufacturer} ${cpu.brand}`,
        `⚙️ *Arquitetura:* ${cpu.arch} | *Núcleos:* ${cpu.physicalCores} físicos, ${cpu.cores} lógicos`,
        `🔢 *Velocidade:* ${cpuSpeed.avg ? `${cpuSpeed.avg.toFixed(2)} GHz` : 'N/A'}`,
        cpuTemp.main ? `🌡️ *Temperatura:* ${cpuTemp.main.toFixed(1)}°C` : '',
        `📊 *Uso atual:* ${load.currentLoad.toFixed(1)}%`,
        `📈 *Carga média:* ${load.avgLoad ? load.avgLoad.toFixed(2) : 'N/A'}`
      ].filter(Boolean).join('\n');

      const memInfo = [
        `\n💾 *MEMÓRIA*`,
        `🧠 *RAM:* ${formatBytes(mem.used)} / ${formatBytes(mem.total)} (${((mem.used / mem.total) * 100).toFixed(1)}%)`,
        `📦 *Disponível:* ${formatBytes(mem.available)}`,
        `💱 *Swap:* ${formatBytes(mem.swapused)} / ${formatBytes(mem.swaptotal)}`,
        `🎯 *Cache:* ${formatBytes(mem.cached)}`,
        `🔄 *Buffer:* ${formatBytes(mem.buffers)}`
      ].join('\n');

      const diskInfo = [];
      diskInfo.push('\n💿 *ARMAZENAMENTO*');
      diskLayout.forEach(disk => {
        if (disk.size > 0) {
          diskInfo.push(`📀 ${disk.name}: ${formatBytes(disk.size)} (${disk.type || 'Unknown'})`);
        }
      });
      fsSize.forEach(fs => {
        if (fs.size > 0 && !fs.mount.includes('docker') && !fs.mount.includes('snap')) {
          const usePercent = ((fs.used / fs.size) * 100).toFixed(1);
          diskInfo.push(`  └ ${fs.fs}: ${formatBytes(fs.used)}/${formatBytes(fs.size)} (${usePercent}%) em ${fs.mount}`);
        }
      });

      const netInfo = ['\n🌐 *REDE*'];
      const activeInterfaces = networkInterfaces.filter(iface => iface.ip4 && iface.operstate === 'up' && !iface.internal);
      activeInterfaces.forEach(iface => {
        netInfo.push(`🔌 ${iface.iface}: ${iface.ip4} (${iface.mac})`);
        const stats = networkStats.find(s => s.iface === iface.iface);
        if (stats) {
          netInfo.push(`  ↓ RX: ${formatBytes(stats.rx_bytes)} | ↑ TX: ${formatBytes(stats.tx_bytes)}`);
        }
      });

      const systemInfo = [
        `\n🖥️ *SISTEMA*`,
        `🏢 *Host:* ${system.manufacturer} ${system.model}`,
        `🔧 *OS:* ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
        `🏷️ *Kernel:* ${osInfo.kernel}`,
        `⏱️ *Uptime:* ${formatUptime(time.uptime)}`,
        `🚀 *Boot:* ${new Date(Date.now() - time.uptime * 1000).toLocaleString('pt-BR')}`
      ].join('\n');

      const processInfo = [
        `\n📊 *PROCESSOS*`,
        `🔢 *Total:* ${processes.all}`,
        `✅ *Rodando:* ${processes.running}`,
        `😴 *Dormindo:* ${processes.sleeping}`,
        `🛑 *Parados:* ${processes.stopped}`,
        `❌ *Zumbis:* ${processes.zombie}`
      ].join('\n');

      let gpuInfo = '';
      if (graphics.controllers && graphics.controllers.length > 0) {
        gpuInfo = '\n🎮 *GPU*\n';
        graphics.controllers.forEach((gpu, index) => {
          gpuInfo += `${index + 1}. ${gpu.vendor} ${gpu.model}`;
          if (gpu.vram) gpuInfo += ` (${gpu.vram} MB VRAM)`;
          gpuInfo += '\n';
        });
      }

      let dockerStr = '';
      if (dockerInfo.containers > 0) {
        dockerStr = `\n🐳 *Docker:* ${dockerInfo.containersRunning}/${dockerInfo.containers} containers rodando`;
      }

      const importantServices = ['mysql', 'postgresql', 'nginx', 'apache', 'redis', 'mongodb', 'docker'];
      const runningServices = services.filter(s => importantServices.some(name => s.name.toLowerCase().includes(name)) && s.running);
      let servicesStr = '';
      if (runningServices.length > 0) {
        servicesStr = '\n🔧 *Serviços Ativos:* ' + runningServices.map(s => s.name).join(', ');
      }

      const message = [
        '💻 *RECURSOS DETALHADOS DO SISTEMA*\n',
        cpuInfo,
        memInfo,
        diskInfo.join('\n'),
        netInfo.join('\n'),
        systemInfo,
        processInfo,
        gpuInfo,
        dockerStr,
        servicesStr,
        `\n⏰ *Atualizado em:* ${new Date().toLocaleString('pt-BR')}`
      ].filter(Boolean).join('\n');

      return message;
    }

    this.app.get('/resources', async (req, res) => {
      try {
        const info = await getSystemInfoText();
        res.render('resources', { result: info });
      } catch (err) {
        logger.error('Erro em /resources', err);
        res.render('resources', { result: 'Erro ao coletar informações.' });
      }
    });

    this.app.post('/toggle-voice', (req, res) => {
      const enabled = this.bot.toggleVoicePreference('web');
      res.json({ enabled });
    });

    this.app.get('/config', async (req, res, next) => {
      try {
        // Garantir que a configuração seja inicializada primeiro
        let saved = await this.configService.getConfig();
        if (!saved) {
          saved = await this.configService.init();
        }

      const getNested = (obj, pathStr) =>
        pathStr.split('.').reduce((o, k) => (o || {})[k], obj);

      const env = {};
      const descriptions = {};
      const examples = {};
      for (const [cfgPath, envVar] of Object.entries(CONFIG_ENV_MAP)) {
        // Garante que todos os campos estejam presentes, mesmo se undefined
        const value = getNested(saved, cfgPath);
        const defaultVal = getNested(CONFIG, cfgPath);
        
        if (value === undefined) {
          // Se o valor é undefined, usar o valor padrão
          if (typeof defaultVal === 'boolean') {
            env[envVar] = false;
          } else {
            env[envVar] = defaultVal !== undefined ? defaultVal : '';
          }
        } else {
          // Garantir que valores booleanos são tratados corretamente
          if (typeof defaultVal === 'boolean') {
            env[envVar] = value === true || value === 'true' || value === '1' || value === 1;
          } else {
            env[envVar] = value;
          }
        }
        
        // Debug para checkboxes
        if (typeof defaultVal === 'boolean') {
          logger.debug(`🔄 Campo boolean ${envVar}: DB=${value} -> Frontend=${env[envVar]}`);
        }
        descriptions[envVar] = CONFIG_DESCRIPTIONS[cfgPath];
        examples[envVar] = CONFIG_EXAMPLES[cfgPath];
      }


      // Buscar modelos disponíveis no Ollama
      let availableModels = [];
      let whisperModels = WHISPER_MODELS_LIST || [];
      try {
        const response = await fetch(`${CONFIG.llm.host}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          availableModels = data.models?.map(m => m.name) || [];
        }
      } catch (error) {
        logger.warn('Não foi possível buscar modelos do Ollama:', error.message);
      }

        res.render('config', {
          env,
          descriptions,
          examples,
          availableModels,
          whisperModels
        });
      } catch (error) {
        logger.error('Erro ao obter configuração', error);
        next(error);
      }
    });

    this.app.post('/config', async (req, res, next) => {
      try {
        logger.info('📝 Recebendo requisição POST /config');
        
        // Verificar se configService está disponível
        if (!this.configService) {
          logger.error('❌ ConfigService não está disponível!');
          return res.redirect('/config?error=ConfigService não disponível');
        }
        
        let saved = await this.configService.getConfig();
        if (!saved) {
          saved = await this.configService.init();
        }
        logger.info('📋 Configuração atual carregada:', Object.keys(saved));

      const getNested = (obj, pathStr) =>
        pathStr.split('.').reduce((o, k) => (o || {})[k], obj);
      const setNested = (obj, pathStr, value) => {
        const keys = pathStr.split('.');
        let curr = obj;
        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i];
          curr[k] = curr[k] || {};
          curr = curr[k];
        }
        curr[keys[keys.length - 1]] = value;
      };

      // Processar campos normais
      logger.info('🔄 Processando campos do formulário...');
      for (const [cfgPath, envVar] of Object.entries(CONFIG_ENV_MAP)) {
        let val = req.body[envVar];
        
        // Para checkboxes que não foram enviados (não marcados), definir como false
        const currentVal = getNested(CONFIG, cfgPath);
        if (typeof currentVal === 'boolean' && val === undefined) {
          val = 'false';
        }
        
        if (val === undefined) continue;
        
        // Conversões de tipo
        if (typeof currentVal === 'number') {
          val = Number(val);
        } else if (typeof currentVal === 'boolean') {
          // Converte para boolean: true se for 'true', '1', 1, ou true
          val = val === 'true' || val === true || val === '1' || val === 1;
          logger.debug(`🔄 Convertendo checkbox ${envVar}: '${req.body[envVar]}' -> ${val}`);
        } else if (cfgPath === 'featureToggles.features' && typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch (e) {
            val = {};
          }
        }
        setNested(saved, cfgPath, val);
        logger.debug(`📝 Campo ${envVar} = ${val} (tipo: ${typeof val})`);
      }


      if (saved.piper?.enabled) {
        try {
          await fs.access(saved.piper.executable, fs.constants.X_OK);
          await fs.access(saved.piper.model, fs.constants.R_OK);
        } catch (error) {
          logger.warn('⚠️ Piper habilitado mas arquivos não encontrados, desabilitando automaticamente:', error.message);
          saved.piper.enabled = false;
        }
      }

        logger.info('💾 Salvando configuração no MongoDB...');
        logger.debug('📋 Dados a serem salvos:', JSON.stringify(saved, null, 2));
        await this.configService.setConfig(saved);
        logger.info('✅ Configuração salva com sucesso, redirecionando...');
        
        // Verificar se foi realmente salvo
        const savedConfig = await this.configService.getConfig();
        logger.info('🔍 Verificação: configuração após salvar:', Object.keys(savedConfig));
        
        res.redirect('/config?success=1');
      } catch (error) {
        logger.error('❌ Erro ao salvar configuração:', error);
        res.redirect('/config?error=' + encodeURIComponent(error.message));
      }
    });

    // Rotas de exportação/importação de configuração completa
    this.app.get('/api/config/export', async (req, res) => {
      try {
        const filePath = await exportFullConfig();
        res.download(filePath, 'config-export.json', (err) => {
          if (err) {
            res.redirect('/config?error=Erro ao exportar configuração');
          }
        });
      } catch (err) {
        res.redirect('/config?error=' + encodeURIComponent(err.message));
      }
    });

    const configUpload = multer({ storage: multer.memoryStorage() });
    this.app.post('/api/config/import', configUpload.single('configFile'), async (req, res) => {
      try {
        if (!req.file) {
          return res.redirect('/config?error=Arquivo não enviado');
        }
        const tempPath = './config-import.json';
        require('fs').writeFileSync(tempPath, req.file.buffer);
        await importFullConfig(tempPath);
        require('fs').unlinkSync(tempPath);
        res.redirect('/config?success=1');
      } catch (err) {
        res.redirect('/config?error=' + encodeURIComponent(err.message));
      }
    });

    // Rota catch-all para 404
    this.app.use((req, res) => {
        res.status(404).json({ error: '❌ Rota não encontrada' });
    });

    // Middleware de tratamento de erros
    this.app.use((err, req, res, next) => {
        logger.error('Erro inesperado na API', err);
        res.status(500).json({ error: '❌ Erro interno do servidor' });
    });
  }

  start() {
    this.app.listen(CONFIG.server.port, () => {
      logger.startup(`🌐 API REST iniciada e ouvindo na porta ${CONFIG.server.port}`);
      logger.info(`📊 Interface disponível em http://localhost:${CONFIG.server.port}/`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`⚠️ Porta ${CONFIG.server.port} já está em uso. Tentando porta alternativa...`);
          // Tentar porta alternativa
          const alternativePort = CONFIG.server.port + 1;
          this.app.listen(alternativePort, () => {
            logger.startup(`🌐 API REST iniciada na porta alternativa ${alternativePort}`);
            logger.info(`📊 Interface disponível em http://localhost:${alternativePort}/`);
          }).on('error', (altErr) => {
            logger.error(`❌ Falha ao iniciar servidor nas portas ${CONFIG.server.port} e ${alternativePort}`, altErr);
          });
        } else {
          logger.error(`❌ Falha ao iniciar servidor na porta ${CONFIG.server.port}`, err);
        }
    });
  }
}

export default RestAPI;

