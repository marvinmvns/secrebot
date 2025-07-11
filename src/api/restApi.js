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
import FlowService from '../services/flowService.js';
import Utils from '../utils/index.js';
import { CONFIG, COMMANDS, CONFIG_DESCRIPTIONS, CONFIG_ENV_MAP, CONFIG_EXAMPLES, WHISPER_MODELS_LIST } from '../config/index.js';
import logger from '../utils/logger.js';
import { exportFullConfig, importFullConfig } from '../services/configExportImportService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ API REST ============
class RestAPI {
  constructor(bot, configService, flowExecutionService) {
    if (!bot) {
        throw new Error('Instância do Bot não fornecida para RestAPI.');
    }
    this.bot = bot;
    this.configService = configService;
    this.app = express();
    this.googleService = new GoogleCalendarService();
    this.flowService = new FlowService(this.bot.getScheduler().db);
    this.flowExecutionService = flowExecutionService;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }

  async initializeServices() {
    try {
      await this.flowService.init();
      
      if (this.flowExecutionService) {
        await this.flowExecutionService.init(this.flowService);
      }
    } catch (error) {
      logger.error('Erro ao inicializar serviços da API:', error);
    }
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    
    this.app.use(methodOverride('_method'));
    this.app.use(expressLayouts);
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));
    // Serve static files from public folder
    this.app.use(express.static(path.join(__dirname, '../public')));
    // Serve React build files
    this.app.use(express.static(path.join(__dirname, '../../admin-dashboard/build')));
    this.app.use((req, res, next) => {
      if (req.method === 'POST' && req.path === '/config') {
        logger.info('📝 Recebendo solicitação POST /config');
      }
      next();
    });
  }

  setupRoutes() {
    logger.info('🔧 Configurando rotas da API...');
    console.log('🔧 CONSOLE: Configurando rotas da API...');
    
    // ===== CONFIG ROUTES =====
    this.app.post('/config', async (req, res, next) => {
      try {
        logger.info('📝 Processando salvamento de configuração');
        
        // Verificar se configService está disponível
        if (!this.configService) {
          logger.error('❌ ConfigService não está disponível!');
          return res.redirect('/config?error=ConfigService não disponível');
        }
        
        // Obter configuração atual do banco
        let currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          currentConfig = await this.configService.init();
        }

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

      // Processar campos do formulário
      let processedFields = 0;
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
          val = val === 'true' || val === true || val === '1' || val === 1;
        } else if (cfgPath === 'featureToggles.features' && typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch (e) {
            val = {};
          }
        }
        setNested(currentConfig, cfgPath, val);
        processedFields++;
      }
      logger.info(`✅ Processados ${processedFields} campos do formulário`);


      // Validar configuração do Piper se habilitado
      if (currentConfig.piper?.enabled) {
        try {
          await fs.access(currentConfig.piper.executable, fs.constants.X_OK);
          await fs.access(currentConfig.piper.model, fs.constants.R_OK);
        } catch (error) {
          logger.warn('⚠️ Piper habilitado mas arquivos não encontrados, desabilitando automaticamente:', error.message);
          currentConfig.piper.enabled = false;
        }
      }

        // Salvar configuração no MongoDB
        logger.info('💾 Salvando configuração no MongoDB...');
        await this.configService.setConfig(currentConfig);
        
        // Verificar se foi realmente salvo
        const savedConfig = await this.configService.getConfig();
        if (savedConfig) {
          logger.info('✅ Configuração salva com sucesso');
          res.redirect('/config?success=1');
        } else {
          throw new Error('Falha ao verificar configuração salva');
        }
      } catch (error) {
        logger.error('❌ Erro ao salvar configuração:', error);
        res.redirect('/config?error=' + encodeURIComponent(error.message));
      }

    });
    
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

    // API endpoint for chat (returns JSON)
    this.app.post('/api/chat', async (req, res) => {
      const message = req.body.message || '';
      if (!message.trim()) {
        return res.status(400).json({ 
          success: false,
          error: 'Mensagem vazia.' 
        });
      }
      try {
        const answer = await this.bot.llmService.getAssistantResponse('web', message);
        res.json({ 
          success: true,
          result: answer 
        });
      } catch (err) {
        logger.error('Erro em /api/chat', err);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao processar mensagem.' 
        });
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

    // ===== LINKEDIN ROUTES =====
    this.app.get('/linkedin', async (req, res) => {
      try {
        const credentialStatus = await this.getCredentialStatus();
        res.render('linkedin', { 
          analysis: null, 
          url: '', 
          analysisType: 'structured', 
          credentialStatus,
          error: null,
          requestNewLogin: false
        });
      } catch (error) {
        logger.error('Erro ao carregar a página do LinkedIn:', error);
        res.render('linkedin', { 
          analysis: null, 
          url: '', 
          analysisType: 'structured', 
          credentialStatus: { hasCredentials: false, status: 'Credenciais Ausentes', message: 'Nenhuma credencial do LinkedIn foi configurada. Por favor, adicione-as abaixo.' },
          error: null,
          requestNewLogin: false
        });
      }
    });
    
    this.app.post('/linkedin/analyze', async (req, res) => {
      const { url, analysisType } = req.body;
      try {
        const result = await this.analyzeLinkedInProfile(url, analysisType);
        const credentialStatus = await this.getCredentialStatus();
        res.render('linkedin', { analysis: result, url, analysisType, credentialStatus, error: null, requestNewLogin: false });
      } catch (error) {
        logger.error(`❌ Erro na análise do LinkedIn para ${url}:`, error);
        
        const credentialStatus = await this.getCredentialStatus();
        const errorMessage = error.message || 'Ocorreu um erro desconhecido.';
        
        // Verifica se o erro indica a necessidade de um novo login
        const needsLogin = errorMessage.includes('Sessão inválida') || 
                           errorMessage.includes('re-autenticação automática falhou');

        res.render('linkedin', { 
          error: errorMessage, 
          url, 
          analysisType,
          credentialStatus,
          analysis: null,
          requestNewLogin: needsLogin 
        });
      }
    });

    this.app.post('/linkedin/re-login-and-analyze', async (req, res) => {
        const { url, analysisType, linkedinEmail, linkedinPassword } = req.body;
        
        const renderError = async (message) => {
            res.render('linkedin', {
                error: message,
                url,
                analysisType,
                credentialStatus: await this.getCredentialStatus(),
                analysis: null,
                requestNewLogin: true
            });
        };

        if (!linkedinEmail || !linkedinPassword) {
            return await renderError('Email e senha são obrigatórios para tentar o login.');
        }
        
        try {
            // 1. Tenta o login com as credenciais fornecidas
            const { loginAndGetLiAt } = await import('../services/linkedinScraper.js');
            const newLiAt = await loginAndGetLiAt(linkedinEmail, linkedinPassword);
            
            // 2. Salva o novo cookie e as credenciais
            logger.info('✅ Login manual via UI bem-sucedido. Salvando novas credenciais...');
            const newConfig = { 
                linkedin: { 
                    liAt: newLiAt,
                    user: linkedinEmail,
                    pass: linkedinPassword // Salva a senha para futuras re-autenticações
                } 
            };
            await this.configService.setConfig(newConfig);
            Object.assign(CONFIG.linkedin, newConfig.linkedin); // Atualiza a configuração em tempo de execução

            // 3. Tenta a análise novamente com o novo cookie
            logger.info(`🔁 Tentando a análise para ${url} com o novo cookie...`);
            const result = await this.analyzeLinkedInProfile(url, analysisType);

            // 4. Renderiza o resultado
            res.render('linkedin', {
                analysis: result,
                url,
                analysisType,
                credentialStatus: await this.getCredentialStatus(),
                error: null,
                requestNewLogin: false
            });

        } catch (error) {
            logger.error(`❌ Falha no fluxo de re-login para ${url}:`, error);
            await renderError(`A tentativa de login falhou: ${error.message}. Verifique suas credenciais.`);
        }
    });

    // API para verificar status das credenciais
    this.app.get('/api/linkedin/status', async (req, res) => {
      try {
        const savedConfig = await this.configService.getConfig();
        const hasCredentials = !!(savedConfig?.linkedin?.liAt || CONFIG.linkedin.liAt);
        
        res.json({
          success: true,
          hasCredentials,
          hasUser: !!(savedConfig?.linkedin?.user || CONFIG.linkedin.user)
        });
      } catch (error) {
        logger.error('❌ Erro ao verificar status LinkedIn:', error);
        res.json({
          success: false,
          hasCredentials: false,
          error: error.message
        });
      }
    });

    // API para testar conexão com LinkedIn
    this.app.post('/api/linkedin/test', async (req, res) => {
      try {
        const savedConfig = await this.configService.getConfig();
        const liAt = savedConfig?.linkedin?.liAt || CONFIG.linkedin.liAt;
        
        if (!liAt) {
          return res.json({
            success: false,
            error: 'Credenciais do LinkedIn não configuradas'
          });
        }
        
        // Testar com um perfil público conhecido
        const testUrl = 'https://www.linkedin.com/in/williamhgates/';
        const { fetchProfileStructured } = await import('../services/linkedinScraper.js');
        
        const result = await fetchProfileStructured(testUrl, {
          liAt,
          timeoutMs: 15000,
          retries: 1
        });
        
        if (result.success) {
          res.json({
            success: true,
            message: 'Conexão com LinkedIn funcionando',
            dataQuality: result.dataQuality
          });
        } else {
          res.json({
            success: false,
            error: result.error || 'Falha ao acessar perfil de teste'
          });
        }
        
      } catch (error) {
        logger.error('❌ Erro ao testar LinkedIn:', error);
        res.json({
          success: false,
          error: error.message
        });
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

    // ===== FLOW BUILDER ROUTES =====
    this.app.get('/flow-builder', (req, res) => {
      res.render('flow-builder');
    });

    // Rota para o gerenciador de fluxos
    this.app.get('/flow-manager', (req, res) => {
      res.render('flow-manager');
    });

    // ===== FLOW BUILDER APIs COMPLETAS =====
    
    // API para salvar fluxo
    this.app.post('/api/flow/save', async (req, res) => {
      try {
        const result = await this.flowService.saveFlow(req.body);
        
        if (result.success) {
          // Sincronizar com FlowExecutionService
          if (this.flowExecutionService) {
            await this.flowExecutionService.reloadFlow(result.flowId);
          }
          res.json(result);
        } else {
          res.status(400).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao salvar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para listar todos os fluxos
    this.app.get('/api/flow/list', async (req, res) => {
      try {
        const result = await this.flowService.listFlows();
        res.json(result);
        
      } catch (error) {
        logger.error('❌ Erro ao listar fluxos:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para carregar fluxo específico
    this.app.get('/api/flow/:id', async (req, res) => {
      try {
        const result = await this.flowService.loadFlow(req.params.id);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(404).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao carregar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para testar fluxo
    this.app.post('/api/flow/test', async (req, res) => {
      try {
        const flowData = req.body;
        const validation = this.flowService.validateFlow(flowData);
        
        if (!validation.valid) {
          return res.status(400).json({ 
            success: false, 
            error: validation.error 
          });
        }

        // TODO: Integrar com FlowExecutionService para teste real
        logger.info(`🧪 Testando fluxo: ${flowData.name}`);
        
        res.json({ 
          success: true, 
          message: 'Fluxo validado com sucesso. Teste iniciado!',
          validation: validation
        });
        
      } catch (error) {
        logger.error('❌ Erro ao testar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para excluir fluxo
    this.app.delete('/api/flow/:id', async (req, res) => {
      try {
        const result = await this.flowService.deleteFlow(req.params.id);
        
        if (result.success) {
          // Remover do FlowExecutionService
          if (this.flowExecutionService) {
            this.flowExecutionService.unloadFlow(req.params.id);
          }
          res.json(result);
        } else {
          res.status(404).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao excluir fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para duplicar fluxo
    this.app.post('/api/flow/:id/duplicate', async (req, res) => {
      try {
        const { newName } = req.body;
        const result = await this.flowService.duplicateFlow(req.params.id, newName);
        
        if (result.success) {
          // Carregar o novo flow no FlowExecutionService
          if (this.flowExecutionService) {
            await this.flowExecutionService.reloadFlow(result.flowId);
          }
          res.json(result);
        } else {
          res.status(400).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao duplicar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para exportar fluxo
    this.app.get('/api/flow/:id/export', async (req, res) => {
      try {
        const result = await this.flowService.exportFlow(req.params.id);
        
        if (result.success) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
          res.json(result.data);
        } else {
          res.status(404).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao exportar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para importar fluxo
    this.app.post('/api/flow/import', upload.single('flowFile'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'Arquivo de fluxo não fornecido'
          });
        }

        const flowData = JSON.parse(req.file.buffer.toString());
        const result = await this.flowService.importFlow(flowData);
        
        if (result.success) {
          // Carregar o flow importado no FlowExecutionService
          if (this.flowExecutionService) {
            await this.flowExecutionService.reloadFlow(result.flowId);
          }
          res.json(result);
        } else {
          res.status(400).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao importar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Erro ao processar arquivo de fluxo' 
        });
      }
    });

    // API para buscar fluxos
    this.app.get('/api/flow/search', async (req, res) => {
      try {
        const { q } = req.query;
        const result = await this.flowService.searchFlows(q);
        res.json(result);
        
      } catch (error) {
        logger.error('❌ Erro na busca de fluxos:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para obter estatísticas dos fluxos
    this.app.get('/api/flow/stats', async (req, res) => {
      try {
        const stats = this.flowService.getStats();
        res.json({ 
          success: true, 
          stats: stats 
        });
        
      } catch (error) {
        logger.error('❌ Erro ao obter estatísticas:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para validar fluxo
    this.app.post('/api/flow/validate', async (req, res) => {
      try {
        const validation = this.flowService.validateFlow(req.body);
        res.json({
          success: true,
          validation: validation
        });
        
      } catch (error) {
        logger.error('❌ Erro ao validar fluxo:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // ===== DASHBOARD APIs =====
    
    // API para estatísticas do dashboard
    this.app.get('/api/dashboard/stats', async (req, res) => {
      try {
        const schedCollection = this.bot.getScheduler().schedCollection;
        const stats = await this.bot.getScheduler().getStats();
        
        // Buscar mensagens para estatísticas
        const messages = await schedCollection.find({}).toArray();
        const now = new Date();
        
        // Calcular estatísticas
        const total = messages.length;
        const pending = messages.filter(m => new Date(m.scheduledTime) > now && m.status !== 'sent').length;
        const sent = messages.filter(m => m.status === 'sent').length;
        const failed = messages.filter(m => m.status === 'failed').length;
        
        // Próximos agendamentos (próximas 24h)
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const upcoming = messages
          .filter(m => {
            const schedTime = new Date(m.scheduledTime);
            return schedTime > now && schedTime <= tomorrow && m.status !== 'sent';
          })
          .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
          .slice(0, 10)
          .map(m => ({
            id: m._id,
            message: m.message.substring(0, 50) + (m.message.length > 50 ? '...' : ''),
            scheduledTime: m.scheduledTime,
            recipient: m.recipient,
            status: m.status
          }));
        
        res.json({
          success: true,
          total,
          pending,
          sent,
          failed,
          upcoming,
          systemStats: stats
        });
        
      } catch (error) {
        logger.error('Erro em /api/dashboard/stats', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter estatísticas do dashboard'
        });
      }
    });

    // API para recursos do sistema
    this.app.get('/api/system/resources', async (req, res) => {
      try {
        const si = await import('systeminformation');
        
        const [cpu, mem, load, disk] = await Promise.all([
          si.currentLoad(),
          si.mem(),
          si.currentLoad(),
          si.fsSize()
        ]);
        
        const systemInfo = {
          cpu: {
            usage: Math.round(cpu.currentLoad),
            cores: cpu.cpus?.length || 1
          },
          memory: {
            total: mem.total,
            used: mem.used,
            free: mem.free,
            usage: Math.round((mem.used / mem.total) * 100)
          },
          disk: disk.map(d => ({
            filesystem: d.fs,
            size: d.size,
            used: d.used,
            available: d.available,
            usage: Math.round((d.used / d.size) * 100),
            mount: d.mount
          })).filter(d => d.size > 0)
        };
        
        res.json({
          success: true,
          data: systemInfo
        });
        
      } catch (error) {
        logger.error('Erro em /api/system/resources', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter recursos do sistema'
        });
      }
    });

    // ===== SCHEDULER APIs =====
    
    // API para listar mensagens agendadas
    this.app.get('/api/scheduled-messages', async (req, res) => {
      try {
        const schedCollection = this.bot.getScheduler().schedCollection;
        const messages = await schedCollection.find({}).sort({ scheduledTime: 1 }).toArray();
        
        res.json({
          success: true,
          data: messages
        });
        
      } catch (error) {
        logger.error('Erro em /api/scheduled-messages', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao listar mensagens agendadas'
        });
      }
    });

    // API para criar/atualizar mensagem agendada
    this.app.post('/api/scheduled-messages', async (req, res) => {
      try {
        const schedCollection = this.bot.getScheduler().schedCollection;
        const { message, recipient, scheduledTime } = req.body;
        
        if (!message || !recipient || !scheduledTime) {
          return res.status(400).json({
            success: false,
            error: 'Campos obrigatórios: message, recipient, scheduledTime'
          });
        }
        
        const messageData = {
          message,
          recipient,
          scheduledTime: new Date(scheduledTime),
          status: 'pending',
          createdAt: new Date()
        };
        
        const result = await schedCollection.insertOne(messageData);
        
        res.json({
          success: true,
          data: { ...messageData, _id: result.insertedId }
        });
        
      } catch (error) {
        logger.error('Erro em /api/scheduled-messages POST', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao criar mensagem agendada'
        });
      }
    });

    // API para atualizar mensagem agendada
    this.app.put('/api/scheduled-messages', async (req, res) => {
      try {
        const schedCollection = this.bot.getScheduler().schedCollection;
        const { _id, message, recipient, scheduledTime } = req.body;
        
        if (!_id) {
          return res.status(400).json({
            success: false,
            error: 'ID da mensagem é obrigatório'
          });
        }
        
        const updateData = {
          message,
          recipient,
          scheduledTime: new Date(scheduledTime),
          updatedAt: new Date()
        };
        
        const result = await schedCollection.updateOne(
          { _id: new ObjectId(_id) },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).json({
            success: false,
            error: 'Mensagem não encontrada'
          });
        }
        
        res.json({
          success: true,
          data: { _id, ...updateData }
        });
        
      } catch (error) {
        logger.error('Erro em /api/scheduled-messages PUT', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao atualizar mensagem agendada'
        });
      }
    });

    // API para excluir mensagem agendada
    this.app.delete('/api/scheduled-messages/:id', async (req, res) => {
      try {
        const schedCollection = this.bot.getScheduler().schedCollection;
        const { id } = req.params;
        
        const result = await schedCollection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
          return res.status(404).json({
            success: false,
            error: 'Mensagem não encontrada'
          });
        }
        
        res.json({
          success: true,
          message: 'Mensagem excluída com sucesso'
        });
        
      } catch (error) {
        logger.error('Erro em /api/scheduled-messages DELETE', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao excluir mensagem agendada'
        });
      }
    });

    // ===== CONFIG APIs =====
    
    // API para obter configurações
    this.app.get('/api/configs', async (req, res) => {
      try {
        const config = await this.configService.getConfig();
        
        res.json({
          success: true,
          data: config
        });
        
      } catch (error) {
        logger.error('Erro em /api/configs GET', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter configurações'
        });
      }
    });

    // API para atualizar configurações
    this.app.put('/api/configs', async (req, res) => {
      try {
        const configData = req.body;
        
        await this.configService.setConfig(configData);
        
        res.json({
          success: true,
          data: configData,
          message: 'Configurações atualizadas com sucesso'
        });
        
      } catch (error) {
        logger.error('Erro em /api/configs PUT', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao atualizar configurações'
        });
      }
    });

    // API para resetar configurações
    this.app.post('/api/configs/reset', async (req, res) => {
      try {
        const defaultConfig = await this.configService.init();
        
        res.json({
          success: true,
          data: defaultConfig,
          message: 'Configurações resetadas para padrão'
        });
        
      } catch (error) {
        logger.error('Erro em /api/configs/reset', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao resetar configurações'
        });
      }
    });

    // API para criar fluxo a partir de template
    this.app.post('/api/flow/create-from-template', async (req, res) => {
      try {
        const { templateName, flowName } = req.body;
        
        if (!templateName) {
          return res.status(400).json({
            success: false,
            error: 'Nome do template é obrigatório'
          });
        }

        const result = await this.flowService.createFromTemplate(templateName, flowName);
        
        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
        
      } catch (error) {
        logger.error('❌ Erro ao criar fluxo do template:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    // API para listar templates disponíveis
    this.app.get('/api/flow/templates', async (req, res) => {
      try {
        const result = await this.flowService.listAvailableTemplates();
        res.json(result);
        
      } catch (error) {
        logger.error('❌ Erro ao listar templates:', error);
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });

    this.app.post('/toggle-voice', (req, res) => {
      const enabled = this.bot.toggleVoicePreference('web');
      res.json({ enabled });
    });

    this.app.get('/config', async (req, res, next) => {
      try {
        // Obter configuração atual do banco de dados
        let currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          logger.info('⚠️ Configuração não encontrada, inicializando...');
          currentConfig = await this.configService.init();
        }

        const getNested = (obj, pathStr) =>
          pathStr.split('.').reduce((o, k) => (o || {})[k], obj);

        const env = {};
        const descriptions = {};
        const examples = {};
        
        // Mapear todos os campos da configuração para o formato esperado pelo frontend
        for (const [cfgPath, envVar] of Object.entries(CONFIG_ENV_MAP)) {
          const savedValue = getNested(currentConfig, cfgPath);
          const defaultValue = getNested(CONFIG, cfgPath);
          
          // Usar valor salvo se existir, senão usar valor padrão
          if (savedValue !== undefined) {
            if (typeof defaultValue === 'boolean') {
              env[envVar] = savedValue === true || savedValue === 'true' || savedValue === '1' || savedValue === 1;
            } else {
              env[envVar] = savedValue;
            }
          } else {
            // Usar valor padrão se não houver valor salvo
            if (typeof defaultValue === 'boolean') {
              env[envVar] = false;
            } else {
              env[envVar] = defaultValue !== undefined ? defaultValue : '';
            }
          }
          
          descriptions[envVar] = CONFIG_DESCRIPTIONS[cfgPath];
          examples[envVar] = CONFIG_EXAMPLES[cfgPath];
        }


        // Buscar modelos disponíveis no Ollama
        let availableModels = [];
        let whisperModels = WHISPER_MODELS_LIST || [];
        try {
          const ollamaHost = currentConfig.llm?.host || CONFIG.llm.host;
          const response = await fetch(`${ollamaHost}/api/tags`);
          if (response.ok) {
            const data = await response.json();
            availableModels = data.models?.map(m => m.name) || [];
          }
        } catch (error) {
          logger.warn('Não foi possível buscar modelos do Ollama:', error.message);
        }

        // Renderizar página de configuração usando o template configs.ejs
        res.render('configs', {
          config: currentConfig,
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

    // Nova rota para exibir todas as configurações da base de dados
    this.app.get('/configs', async (req, res, next) => {
      try {
        const currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          logger.info('⚠️ Configuração não encontrada, inicializando...');
          currentConfig = await this.configService.init();
        }

        res.render('configs', {
          config: currentConfig
        });
      } catch (error) {
        logger.error('Erro ao obter configurações:', error);
        next(error);
      }
    });

    // API endpoint para obter todas as configurações
    this.app.get('/api/configs', async (req, res) => {
      try {
        const currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          return res.status(404).json({ error: 'Configuração não encontrada' });
        }
        res.json(currentConfig);
      } catch (error) {
        logger.error('Erro ao obter configurações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    });

    // API endpoint para atualizar configurações
    this.app.put('/api/configs', async (req, res) => {
      try {
        const updatedConfig = req.body;
        await this.configService.setConfig(updatedConfig);
        
        // Reiniciar a solução
        logger.info('Configurações atualizadas, reiniciando solução...');
        
        res.json({ success: true, message: 'Configurações atualizadas com sucesso' });
        
        // Reiniciar processo após um pequeno delay para permitir que a resposta seja enviada
        setTimeout(() => {
          logger.info('🔄 Reiniciando aplicação devido a mudanças na configuração...');
          process.exit(0);
        }, 1000);
        
      } catch (error) {
        logger.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
      }
    });

    // API endpoint para resetar configurações para valores padrão
    this.app.post('/api/configs/reset', async (req, res) => {
      try {
        // Reinicializar configuração com valores padrão
        const defaultConfig = await this.configService.init();
        await this.configService.setConfig(defaultConfig);
        
        logger.info('Configurações resetadas para valores padrão');
        res.json(defaultConfig);
        
      } catch (error) {
        logger.error('Erro ao resetar configurações:', error);
        res.status(500).json({ error: 'Erro ao resetar configurações' });
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

    this.app.get('/config-test', (req, res) => {
      res.render('config-test');
    });

    // Catch-all route for React Router (must be last)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../../admin-dashboard/build', 'index.html'));
    });

    // ===== ANALYTICS ROUTES =====
    
    // Endpoint para obter resumo de analytics
    this.app.get('/api/analytics/summary', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        const summary = await analyticsService.default.getAnalyticsSummary();
        
        res.json({
          success: true,
          data: summary
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/summary', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter resumo de analytics'
        });
      }
    });

    // Endpoint para registrar interação
    this.app.post('/api/analytics/interaction', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        await analyticsService.default.recordInteraction(req.body);
        
        res.json({
          success: true,
          message: 'Interação registrada com sucesso'
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/interaction', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao registrar interação'
        });
      }
    });

    // Endpoint para obter estatísticas por plataforma
    this.app.get('/api/analytics/platform-stats', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        const stats = await analyticsService.default.getPlatformStats();
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/platform-stats', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter estatísticas por plataforma'
        });
      }
    });

    // Endpoint para obter estatísticas de tipos de mensagem
    this.app.get('/api/analytics/message-types', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        const stats = await analyticsService.default.getMessageTypeStats();
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/message-types', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter estatísticas de tipos de mensagem'
        });
      }
    });

    // Endpoint para obter estatísticas diárias
    this.app.get('/api/analytics/daily-stats', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        const days = parseInt(req.query.days) || 30;
        const stats = await analyticsService.default.getDailyStats(days);
        
        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/daily-stats', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter estatísticas diárias'
        });
      }
    });

    // Endpoint para obter interações de um usuário específico
    this.app.get('/api/analytics/user/:phoneNumber', async (req, res) => {
      try {
        const analyticsService = await import('../services/analyticsService.js');
        const { phoneNumber } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        const interactions = await analyticsService.default.getUserInteractions(phoneNumber, limit, offset);
        
        res.json({
          success: true,
          data: interactions
        });
      } catch (error) {
        logger.error('Erro em /api/analytics/user', error);
        res.status(500).json({
          success: false,
          error: 'Erro ao obter interações do usuário'
        });
      }
    });

    // Middleware de tratamento de erros
    this.app.use((err, req, res, next) => {
        logger.error('Erro inesperado na API', err);
        res.status(500).json({ error: '❌ Erro interno do servidor' });
    });
    
    logger.info('✅ SETUP ROUTES CONCLUÍDO - Todas as rotas registradas');
  }

  async getCredentialStatus() {
    // Esta função pode ser expandida para checar mais detalhes
    const { liAt, user, pass } = CONFIG.linkedin;
    const hasLiAt = !!liAt;
    const hasUserPass = !!user && !!pass;

    if (hasLiAt) {
      return { hasCredentials: true, status: 'Pronto para Análise', message: 'Um cookie de sessão (li_at) está configurado e pronto para ser usado.' };
    }
    if (hasUserPass) {
      return { hasCredentials: true, status: 'Pronto para Login', message: 'Credenciais de usuário e senha estão salvas. O login será feito na primeira análise.' };
    }
    return { hasCredentials: false, status: 'Credenciais Ausentes', message: 'Nenhuma credencial do LinkedIn foi configurada. Por favor, adicione-as abaixo.' };
  }

  async analyzeLinkedInProfile(url, analysisType = 'structured') {
    const { fetchProfileStructured, fetchProfileRaw, loginAndGetLiAt } = await import('../services/linkedinScraper.js');
    let liAt = CONFIG.linkedin.liAt;

    const performScraping = async (currentLiAt) => {
      if (analysisType === 'raw') {
        return await fetchProfileRaw(url, { liAt: currentLiAt, timeoutMs: CONFIG.linkedin.rawTimeoutMs });
      }
      return await fetchProfileStructured(url, { liAt: currentLiAt, timeoutMs: CONFIG.linkedin.structuredTimeoutMs, retries: 2 });
    };

    let result = await performScraping(liAt);

    // Lógica de recuperação automática
    if (result.error === 'REDIRECT_LOOP' || result.error === 'INVALID_COOKIE') {
      logger.warn(`⚠️ Loop de redirecionamento ou cookie inválido detectado para ${url}. Tentando re-autenticação automática...`);
      
      const { user, pass } = CONFIG.linkedin;
      if (!user || !pass) {
        throw new Error('Sessão inválida e nenhuma credencial salva para tentar o login automático. Por favor, configure suas credenciais.');
      }

      const newLiAt = await loginAndGetLiAt(user, pass);
      if (!newLiAt) {
        throw new Error('A re-autenticação automática falhou. Verifique suas credenciais salvas na página de configuração.');
      }

      logger.info('✅ Re-autenticação bem-sucedida. Salvando novo cookie de sessão...');
      await this.configService.setConfig({ linkedin: { liAt: newLiAt } });
      CONFIG.linkedin.liAt = newLiAt; // Atualiza a configuração em tempo de execução

      // Tenta o scraping novamente com o novo cookie
      logger.info('🔁 Tentando a análise novamente com o novo cookie...');
      result = await performScraping(newLiAt);
    }
    
    if (!result.success) {
      throw new Error(`A análise falhou após todas as tentativas. Erro final: ${result.error}`);
    }

    return result;
  }

  async processStructuredLinkedInData(data, quality, options = {}) {
    const { generateSummary = true } = options;
    const { detailed = true, includeSkills = true, includeEducation = true } = options;
    
    let analysis = `🔗 **ANÁLISE DETALHADA DO PERFIL LINKEDIN**\n\n`;
    
    // Informações básicas
    if (data.name) {
      analysis += `👤 **Nome:** ${data.name}\n`;
    }
    
    if (data.headline) {
      analysis += `💼 **Cargo:** ${data.headline}\n`;
    }
    
    if (data.location) {
      analysis += `📍 **Localização:** ${data.location}\n`;
    }
    
    if (data.connections) {
      analysis += `🔗 **Conexões:** ${data.connections}\n`;
    }
    
    analysis += `\n📊 **Qualidade dos Dados:** ${quality.percentage}% (${quality.score}/${quality.maxScore} campos)\n\n`;
    
    // Sobre
    if (data.about && detailed) {
      analysis += `📝 **SOBRE:**\n${data.about}\n\n`;
    }
    
    // Experiência profissional
    if (data.experience && data.experience.length > 0) {
      analysis += `💼 **EXPERIÊNCIA PROFISSIONAL:**\n`;
      data.experience.slice(0, detailed ? 10 : 5).forEach((exp, index) => {
        analysis += `${index + 1}. **${exp.title || 'Cargo não especificado'}**\n`;
        analysis += `   🏢 ${exp.company || 'Empresa não especificada'}\n`;
        if (exp.duration) {
          analysis += `   ⏰ ${exp.duration}\n`;
        }
        analysis += '\n';
      });
    }
    
    // Educação
    if (includeEducation && data.education && data.education.length > 0) {
      analysis += `🎓 **EDUCAÇÃO:**\n`;
      data.education.slice(0, detailed ? 5 : 3).forEach((edu, index) => {
        analysis += `${index + 1}. **${edu.degree || 'Curso não especificado'}**\n`;
        analysis += `   🏫 ${edu.school || 'Instituição não especificada'}\n`;
        if (edu.years) {
          analysis += `   📅 ${edu.years}\n`;
        }
        analysis += '\n';
      });
    }
    
    // Skills
    if (includeSkills && data.skills && data.skills.length > 0) {
      analysis += `🛠️ **PRINCIPAIS HABILIDADES:**\n`;
      const topSkills = data.skills.slice(0, detailed ? 20 : 10);
      analysis += topSkills.join(' • ') + '\n\n';
    }
    
    // Resumo profissional gerado por IA
    if (generateSummary) {
      try {
        const summary = await this.bot.llmService.getAssistantResponse('web', 
          `Com base nos dados extraídos do LinkedIn, crie um resumo profissional conciso e bem estruturado:\n\n${analysis}`
        );
        
        analysis += `🤖 **RESUMO PROFISSIONAL:**\n${summary}\n\n`;
      } catch (error) {
        logger.warn('⚠️ Erro ao gerar resumo com IA:', error.message);
      }
    }
    
    analysis += `\n⏰ **Análise realizada em:** ${new Date().toLocaleString('pt-BR')}`;
    
    return analysis;
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

