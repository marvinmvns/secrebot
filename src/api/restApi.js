import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import fs from 'fs/promises';
// Ollama import removed - using LLMService instead
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
import { getMetricsService } from '../services/metricsService.js';

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
    this.app.use(express.static(path.join(__dirname, '../public')));
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

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      try {
        const metricsService = getMetricsService();
        
        if (!metricsService.enabled) {
          return res.status(503).send('Metrics collection is disabled');
        }

        const metrics = await metricsService.getMetrics();
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
      } catch (error) {
        logger.error('❌ Error generating metrics:', error);
        res.status(500).send('Error generating metrics');
      }
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

    // API para dados do sistema em tempo real
    this.app.get('/api/system/stats', async (req, res) => {
      try {
        const [cpu, mem, load, osInfo, time] = await Promise.all([
          si.cpu(),
          si.mem(),
          si.currentLoad(),
          si.osInfo(),
          si.time()
        ]);

        // Status dos endpoints com informações de processamento
        let whisperStatus = { active: 0, total: 0, processing: { totalQueue: 0, totalActiveRequests: 0 } };
        let ollamaStatus = { active: 0, total: 0, processing: { totalQueue: 0, totalActiveRequests: 0 } };

        try {
          if (this.bot.transcriber && this.bot.transcriber.whisperApiPool) {
            const whisperPoolStatus = await this.bot.transcriber.whisperApiPool.getPoolStatus();
            whisperStatus = {
              active: whisperPoolStatus.healthyEndpoints || 0,
              total: whisperPoolStatus.totalEndpoints || 0,
              processing: {
                totalQueue: whisperPoolStatus.endpoints?.reduce((sum, ep) => sum + (ep.queueLength || 0), 0) || 0,
                totalActiveRequests: whisperPoolStatus.endpoints?.reduce((sum, ep) => sum + (ep.activeRequests || 0), 0) || 0
              }
            };
          }
        } catch (error) {
          logger.warn('Erro ao obter status Whisper:', error.message);
        }

        try {
          if (this.bot.llmService && this.bot.llmService.ollamaApiPool) {
            const ollamaPoolStatus = await this.bot.llmService.ollamaApiPool.getPoolStatus();
            ollamaStatus = {
              active: ollamaPoolStatus.healthyEndpoints || 0,
              total: ollamaPoolStatus.totalEndpoints || 0,
              processing: {
                totalQueue: 0, // Ollama doesn't have queue concept, only active requests
                totalActiveRequests: ollamaPoolStatus.endpoints?.reduce((sum, ep) => sum + (ep.processing?.activeRequests || 0), 0) || 0
              }
            };
          }
        } catch (error) {
          logger.warn('Erro ao obter status Ollama:', error.message);
        }

        const systemStats = {
          cpu: {
            usage: Math.round(load.currentLoad || 0),
            cores: cpu.cores,
            manufacturer: cpu.manufacturer,
            brand: cpu.brand
          },
          memory: {
            total: Math.round(mem.total / 1024 / 1024 / 1024 * 100) / 100, // GB
            used: Math.round((mem.total - mem.available) / 1024 / 1024 / 1024 * 100) / 100, // GB (real usage)
            free: Math.round(mem.available / 1024 / 1024 / 1024 * 100) / 100, // GB (available)
            percentage: Math.round(((mem.total - mem.available) / mem.total) * 100),
            cached: Math.round(mem.cached / 1024 / 1024 / 1024 * 100) / 100, // GB
            buffers: Math.round(mem.buffers / 1024 / 1024 / 1024 * 100) / 100 // GB
          },
          system: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            uptime: Math.round(time.uptime / 3600), // hours
            hostname: osInfo.hostname
          },
          endpoints: {
            whisper: whisperStatus,
            ollama: ollamaStatus
          },
          timestamp: new Date().toISOString()
        };

        res.json(systemStats);
      } catch (error) {
        logger.error('Erro ao obter estatísticas do sistema:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    });

    // API para estatísticas detalhadas de processamento
    this.app.get('/api/processing/stats', async (req, res) => {
      try {
        let whisperProcessing = { queues: [], totalQueue: 0, totalActiveRequests: 0, totalProcessedToday: 0 };
        let ollamaProcessing = { queues: [], totalQueue: 0, totalActiveRequests: 0, totalProcessedToday: 0 };

        // Informações detalhadas do Whisper
        try {
          if (this.bot.transcriber && this.bot.transcriber.whisperApiPool) {
            const whisperPoolStatus = await this.bot.transcriber.whisperApiPool.getPoolStatus();
            if (whisperPoolStatus.endpoints) {
              whisperProcessing.queues = whisperPoolStatus.endpoints.map((ep, index) => ({
                id: index,
                url: ep.url || ep.baseURL || 'unknown',
                healthy: ep.healthy || false,
                priority: ep.priority || 0,
                queueLength: ep.queueLength || 0,
                activeRequests: ep.activeRequests || 0,
                avgProcessingTime: ep.avgProcessingTime || 0,
                totalProcessed: ep.totalProcessed || 0
              }));
              whisperProcessing.totalQueue = whisperProcessing.queues.reduce((sum, q) => sum + q.queueLength, 0);
              whisperProcessing.totalActiveRequests = whisperProcessing.queues.reduce((sum, q) => sum + q.activeRequests, 0);
              whisperProcessing.totalProcessedToday = whisperProcessing.queues.reduce((sum, q) => sum + q.totalProcessed, 0);
            }
          }
        } catch (error) {
          logger.warn('Erro ao obter estatísticas detalhadas Whisper:', error.message);
        }

        // Informações detalhadas do Ollama
        try {
          if (this.bot.llmService && this.bot.llmService.ollamaApiPool) {
            const ollamaPoolStatus = await this.bot.llmService.ollamaApiPool.getPoolStatus();
            if (ollamaPoolStatus.endpoints) {
              ollamaProcessing.queues = ollamaPoolStatus.endpoints.map((ep, index) => ({
                id: index,
                url: ep.url || 'unknown',
                healthy: ep.healthy || false,
                type: ep.type || 'Ollama',
                activeRequests: ep.processing?.activeRequests || 0,
                totalRequests: ep.processing?.totalRequests || 0,
                runningModels: ep.runningModels || 0,
                loadScore: ep.loadScore || 0,
                currentModel: ep.currentModel || null
              }));
              ollamaProcessing.totalActiveRequests = ollamaProcessing.queues.reduce((sum, q) => sum + q.activeRequests, 0);
              ollamaProcessing.totalProcessedToday = ollamaProcessing.queues.reduce((sum, q) => sum + q.totalRequests, 0);
            }
          }
        } catch (error) {
          logger.warn('Erro ao obter estatísticas detalhadas Ollama:', error.message);
        }

        res.json({
          whisper: whisperProcessing,
          ollama: ollamaProcessing,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Erro ao obter estatísticas de processamento:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
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
      res.render('chat', { result: null, message: '', usedEndpoint: null, usedModel: null });
    });

    this.app.post('/chat', upload.single('audio'), async (req, res) => {
      let message = req.body.message || '';
      const endpoint = req.body.endpoint || '';
      const model = req.body.model || '';
      const audioData = req.body.audioData || '';
      let usedEndpoint = null;
      let usedModel = null;

      try {
        // Processar áudio se fornecido
        if (audioData && !message.trim()) {
          try {
            const audioBuffer = Buffer.from(audioData, 'base64');
            const transcription = await this.bot.transcriber.transcribe(audioBuffer);
            message = transcription;
            logger.info(`Áudio transcrito para: ${message.substring(0, 100)}...`);
          } catch (audioErr) {
            logger.error('Erro ao transcrever áudio:', audioErr);
            return res.render('chat', { 
              result: 'Erro ao transcrever áudio: ' + audioErr.message, 
              message: '', 
              usedEndpoint: null,
              usedModel: null
            });
          }
        }

        if (!message.trim()) {
          return res.render('chat', { 
            result: 'Mensagem vazia.', 
            message, 
            usedEndpoint: null,
            usedModel: null
          });
        }

        let answer;
        
        // Usar endpoint específico se fornecido
        if (endpoint) {
          try {
            // Se modelo específico foi selecionado, usar com endpoint específico
            if (model) {
              answer = await this.bot.llmService.chatWithSpecificEndpointAndModel(sessionId, message, endpoint, model);
              usedModel = model;
            } else {
              answer = await this.bot.llmService.chatWithSpecificEndpoint(sessionId, message, endpoint);
            }
            usedEndpoint = endpoint;
            logger.info(`Resposta obtida do endpoint específico: ${endpoint}${model ? ` com modelo: ${model}` : ''}`);
          } catch (endpointErr) {
            logger.warn(`Erro no endpoint específico ${endpoint}, usando padrão:`, endpointErr);
            answer = await this.bot.llmService.getAssistantResponse(sessionId, message);
            usedEndpoint = 'Padrão (endpoint específico falhou)';
            usedModel = null;
          }
        } else {
          // Usar endpoint padrão
          answer = await this.bot.llmService.getAssistantResponse('web', message);
          usedEndpoint = 'Padrão';
          usedModel = null;
        }

        res.render('chat', { result: answer, message, usedEndpoint, usedModel });
      } catch (err) {
        logger.error('Erro em /chat', err);
        res.render('chat', { 
          result: 'Erro ao processar mensagem: ' + err.message, 
          message, 
          usedEndpoint: null,
          usedModel: null
        });
      }
    });

    // JSON API endpoint for chat (for AJAX)
    this.app.post('/api/chat', upload.single('audio'), async (req, res) => {
      let message = req.body.message || '';
      const endpoint = req.body.endpoint || '';
      const model = req.body.model || '';
      const audioData = req.body.audioData || '';
      let usedEndpoint = null;
      let usedModel = null;

      // Gerar ou recuperar session ID para contexto web
      let sessionId = req.body.sessionId;
      if (!sessionId) {
        // Gerar novo sessionId baseado em IP + User-Agent + timestamp
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const timestamp = Date.now();
        sessionId = `web_${Buffer.from(`${ip}-${userAgent}-${timestamp}`).toString('base64').substring(0, 16)}`;
        logger.info(`🆔 Novo sessionId criado para chat web: ${sessionId}`);
      }

      try {
        // Processar áudio se fornecido
        if (audioData && !message.trim()) {
          try {
            const audioBuffer = Buffer.from(audioData, 'base64');
            const transcription = await this.bot.transcriber.transcribe(audioBuffer);
            message = transcription;
            logger.info(`Áudio transcrito para: ${message.substring(0, 100)}...`);
          } catch (audioErr) {
            logger.error('Erro ao transcrever áudio:', audioErr);
            return res.json({ 
              success: false,
              error: 'Erro ao transcrever áudio: ' + audioErr.message
            });
          }
        }

        if (!message.trim()) {
          return res.json({ 
            success: false,
            error: 'Mensagem vazia.'
          });
        }

        let answer;
        
        // Usar endpoint específico se fornecido
        if (endpoint) {
          try {
            // Verificar se é endpoint ChatGPT
            const endpointType = req.body.endpointType || '';
            if (endpointType === 'chatgpt' || endpoint.includes('api.openai.com')) {
              // Usar ChatGPT API
              let openaiApiKey = process.env.OPENAI_API_KEY;
              
              // Buscar API key do MongoDB se não estiver nas env vars
              if (!openaiApiKey && this.configService) {
                try {
                  const mongoConfig = await this.configService.getConfig();
                  // Buscar API key em openai.apiKey ou nos endpoints ollamaApi do tipo chatgpt
                  openaiApiKey = mongoConfig?.openai?.apiKey;
                  
                  // Se não encontrou em openai.apiKey, buscar nos endpoints ChatGPT
                  if (!openaiApiKey && mongoConfig?.ollamaApi?.endpoints) {
                    const chatgptEndpoint = mongoConfig.ollamaApi.endpoints.find(ep => 
                      ep.type === 'chatgpt' && ep.enabled && ep.apikey
                    );
                    if (chatgptEndpoint) {
                      openaiApiKey = chatgptEndpoint.apikey;
                      logger.debug('Usando API key do endpoint ChatGPT para chat');
                    }
                  }
                } catch (error) {
                  logger.warn('Erro ao buscar configuração OpenAI do MongoDB para chat:', error.message);
                }
              }
              
              if (!openaiApiKey) {
                throw new Error('API Key da OpenAI não configurada (verifique configurações)');
              }

              // Usar LLMService para manter contexto (similar ao Ollama)
              if (model) {
                answer = await this.bot.llmService.chatWithSpecificEndpointAndModel(sessionId, message, endpoint, model);
                usedModel = model;
              } else {
                answer = await this.bot.llmService.chatWithSpecificEndpoint(sessionId, message, endpoint);
              }
              usedEndpoint = endpoint;
              
              logger.info(`Resposta obtida do ChatGPT: ${endpoint} com modelo: ${usedModel}`);
            } else {
              // Usar Ollama API (comportamento original)
              if (model) {
                answer = await this.bot.llmService.chatWithSpecificEndpointAndModel(sessionId, message, endpoint, model);
                usedModel = model;
              } else {
                answer = await this.bot.llmService.chatWithSpecificEndpoint(sessionId, message, endpoint);
              }
              usedEndpoint = endpoint;
              logger.info(`Resposta obtida do endpoint Ollama: ${endpoint}${model ? ` com modelo: ${model}` : ''}`);
            }
          } catch (endpointErr) {
            logger.warn(`Erro no endpoint específico ${endpoint}, usando padrão:`, endpointErr);
            answer = await this.bot.llmService.getAssistantResponse(sessionId, message);
            usedEndpoint = 'Padrão (endpoint específico falhou)';
            usedModel = null;
          }
        } else {
          // Usar endpoint padrão
          answer = await this.bot.llmService.getAssistantResponse('web', message);
          usedEndpoint = 'Padrão';
          usedModel = null;
        }

        res.json({ 
          success: true,
          result: answer, 
          usedEndpoint, 
          usedModel,
          sessionId  // Retornar sessionId para o frontend
        });
      } catch (err) {
        logger.error('Erro em /api/chat', err);
        res.json({ 
          success: false,
          error: 'Erro ao processar mensagem: ' + err.message
        });
      }
    });

    this.app.get('/transcribe', (req, res) => {
      res.render('transcribe');
    });

    // API for the new transcription UI with job queue integration
    this.app.post('/api/transcribe', upload.none(), async (req, res) => {
      const { audioData, endpoint, useJobQueue = true } = req.body;

      if (!audioData) {
        return res.status(400).json({ success: false, error: 'Nenhum dados de áudio enviado.' });
      }

      try {
        const audioBuffer = Buffer.from(audioData, 'base64');
        const options = endpoint ? { endpointUrl: endpoint } : {};

        // Use job queue if enabled (default behavior)
        if (useJobQueue) {
          const { getJobQueueWrapper } = await import('../services/jobQueueWrapper.js');
          const jobQueueWrapper = getJobQueueWrapper();
          
          const jobOptions = {
            priority: 'medium',
            userAgent: req.get('User-Agent'),
            clientIp: req.ip,
            sessionId: req.sessionID || req.get('X-Session-ID')
          };

          const result = await jobQueueWrapper.wrapWhisperTranscription(
            this.bot.transcriber, 
            audioBuffer, 
            { ...options, ...jobOptions }
          );
          
          res.json({ 
            success: true, 
            transcription: result.result,
            jobId: result.jobId,
            message: 'Transcrição processada via fila de jobs'
          });
        } else {
          // Fallback to direct processing (legacy behavior)
          const text = await this.bot.transcriber.transcribe(audioBuffer, options.inputFormat || 'ogg');
          res.json({ success: true, transcription: text });
        }
      } catch (err) {
        logger.error('Erro em /api/transcribe', err);
        
        if (err.jobId) {
          res.status(500).json({ 
            success: false, 
            error: 'Erro ao transcrever áudio: ' + err.error,
            jobId: err.jobId,
            canRetry: err.canRetry
          });
        } else {
          res.status(500).json({ success: false, error: 'Erro ao transcrever áudio: ' + err.message });
        }
      }
    });

    // API for real-time transcription start
    this.app.post('/api/transcribe/realtime/start', async (req, res) => {
      try {
        // Initialize real-time transcription session
        const sessionId = this.bot.transcriber.startRealtimeTranscription();
        res.json({ success: true, sessionId });
      } catch (err) {
        logger.error('Erro ao iniciar transcrição em tempo real:', err);
        res.status(500).json({ success: false, error: 'Erro ao iniciar transcrição em tempo real: ' + err.message });
      }
    });

    // API for real-time transcription chunk
    this.app.post('/api/transcribe/realtime/chunk', upload.none(), async (req, res) => {
      const { sessionId, audioData, isLastChunk } = req.body;

      if (!sessionId || !audioData) {
        return res.status(400).json({ success: false, error: 'Session ID e dados de áudio são obrigatórios.' });
      }

      try {
        const audioBuffer = Buffer.from(audioData, 'base64');
        const transcription = await this.bot.transcriber.processRealtimeChunk(sessionId, audioBuffer, isLastChunk === 'true');
        res.json({ success: true, transcription });
      } catch (err) {
        logger.error('Erro ao processar chunk de áudio em tempo real:', err);
        res.status(500).json({ success: false, error: 'Erro ao processar chunk de áudio em tempo real: ' + err.message });
      }
    });

    // Removed direct Ollama client - will use bot's LLMService instead

    const processImage = async (buffer, mode = 'description') => {
      const imagePath = path.join(__dirname, `image_${Date.now()}.jpg`);
      await fs.writeFile(imagePath, buffer);
      try {
        const prompt = mode === 'calories' ? PROMPTS.calorieEstimation : PROMPTS.imageDescription;
        // Use the bot's LLM service (which respects API/Local configuration)
        let resp;
        try {
          // Use the LLMService generateImageAnalysis method that handles API/local routing
          const response = await this.bot.llmService.generateImageAnalysis(prompt, imagePath);
          resp = { response }; // Wrap in expected format
        } catch (error) {
          logger.error('❌ Erro na análise de imagem via LLMService:', error);
          // Fallback to direct Ollama call
          resp = { response: await this.bot.llmService.generateImageAnalysis(prompt, imagePath) };
        }
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

    this.app.post('/api/video/summarize', async (req, res) => {
      const { url, method } = req.body;
      if (!url || !url.trim()) {
        return res.status(400).json({ success: false, error: 'URL do vídeo é obrigatória.' });
      }

      try {
        let transcript;
        if (method === 'whisper') {
          transcript = await YouTubeService.fetchTranscriptWhisperOnly(url);
        } else {
          transcript = await YouTubeService.fetchTranscript(url);
        }

        if (!transcript || transcript.trim().length === 0) {
          return res.status(400).json({ success: false, error: 'Não foi possível obter a transcrição do vídeo.' });
        }

        const truncatedTranscript = transcript.slice(0, 150000); // Truncate for LLM
        const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos, em até 30 linhas:\n\n${truncatedTranscript}`;
        const summary = await this.bot.llmService.getAssistantResponse('web', summaryPrompt);

        res.json({ success: true, transcript, summary });
      } catch (err) {
        logger.error('Erro em /api/video/summarize', err);
        res.status(500).json({ success: false, error: 'Erro ao processar vídeo: ' + err.message });
      }
    });

    // ===== RESUMIR VIDEO 2 ROUTES =====
    this.app.get('/resumirvideo2', (req, res) => {
      res.render('resumirvideo2');
    });

    this.app.get('/resumirvideo2/process', async (req, res) => {
      const url = req.query.url;
      
      if (!url || !url.trim()) {
        res.status(400).json({ error: 'URL é obrigatória' });
        return;
      }

      // Configurar SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Função para enviar eventos SSE
      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Função para enviar logs
      const sendLog = (level, message) => {
        sendEvent({ type: 'log', level, message });
        logger.info(`[ResumirVideo2] ${message}`);
      };

      // Função para enviar status
      const sendStatus = (message, level = 'processing', progress = null) => {
        sendEvent({ type: 'status', message, level, progress });
      };

      // Função para enviar progresso
      const sendProgress = (progress, message = null) => {
        sendEvent({ type: 'progress', progress, message });
      };

      try {
        sendLog('info', `Iniciando processamento do vídeo: ${url}`);
        sendStatus('Validando URL do YouTube...', 'processing', 5);

        // Validar URL do YouTube
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
          sendLog('error', 'URL inválida: deve ser um link do YouTube');
          sendEvent({ type: 'error', message: 'URL deve ser do YouTube' });
          res.end();
          return;
        }

        sendLog('success', 'URL validada com sucesso');
        sendStatus('Iniciando transcrição via Whisper...', 'processing', 10);

        const startTime = Date.now();
        let transcriptionTime = 0;
        let summaryTime = 0;

        // Primeira fase: Transcrição via Whisper
        sendLog('info', 'Baixando áudio do vídeo...');
        sendProgress(20, 'Baixando áudio...');

        const transcriptionStartTime = Date.now();
        let transcript;

        try {
          sendLog('info', 'Chamando YouTubeService.fetchTranscriptWhisperOnly...');
          transcript = await YouTubeService.fetchTranscriptWhisperOnly(url);
          transcriptionTime = Date.now() - transcriptionStartTime;
          
          sendLog('success', `Transcrição concluída em ${Math.round(transcriptionTime/1000)}s`);
          sendProgress(60, 'Transcrição concluída');
          
          const wordCount = transcript ? transcript.split(' ').length : 0;
          sendEvent({ 
            type: 'stats', 
            stats: { transcriptionTime, wordCount }
          });

        } catch (transcriptionError) {
          sendLog('error', `Erro na transcrição: ${transcriptionError.message}`);
          sendEvent({ type: 'error', message: `Falha na transcrição: ${transcriptionError.message}` });
          res.end();
          return;
        }

        if (!transcript || transcript.trim().length === 0) {
          sendLog('warning', 'Transcrição vazia ou inválida');
          sendEvent({ type: 'error', message: 'Não foi possível extrair conteúdo do vídeo' });
          res.end();
          return;
        }

        sendLog('info', `Transcrição obtida: ${transcript.length} caracteres`);
        sendStatus('Gerando resumo via LLM...', 'processing', 70);

        // Segunda fase: Resumo via LLM
        const summaryStartTime = Date.now();
        
        try {
          sendLog('info', 'Conectando ao serviço LLM...');
          sendProgress(75, 'Conectando ao LLM...');

          // Truncar transcrição se muito longa
          const maxLength = 15000;
          const truncatedTranscript = transcript.slice(0, maxLength);
          const wasTruncated = transcript.length > maxLength;
          
          if (wasTruncated) {
            sendLog('warning', `Transcrição truncada de ${transcript.length} para ${maxLength} caracteres`);
          }

          sendLog('info', 'Gerando resumo...');
          sendProgress(85, 'Gerando resumo...');

          const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos, em até 30 linhas:\n\n${truncatedTranscript}`;
          
          // Usar o LLMService parametrizado do bot
          const response = await this.bot.llmService.chatWithModel(summaryPrompt, CONFIG.llm.model);
          if (!response) {
            throw new Error('Resposta vazia do serviço LLM');
          }

          const summary = response.message.content;
          summaryTime = Date.now() - summaryStartTime;
          
          sendLog('success', `Resumo gerado em ${Math.round(summaryTime/1000)}s`);
          sendProgress(95, 'Resumo concluído');
          
          sendEvent({ 
            type: 'stats', 
            stats: { summaryTime }
          });

          // Enviar resultado final
          sendLog('success', 'Processamento concluído com sucesso');
          sendStatus('Processamento concluído', 'success', 100);
          
          sendEvent({ 
            type: 'result', 
            result: summary
          });

          sendEvent({ type: 'complete' });

        } catch (summaryError) {
          sendLog('error', `Erro ao gerar resumo: ${summaryError.message}`);
          sendEvent({ type: 'error', message: `Falha ao gerar resumo: ${summaryError.message}` });
          res.end();
          return;
        }

      } catch (error) {
        logger.error('Erro no processamento resumirvideo2:', error);
        sendLog('error', `Erro inesperado: ${error.message}`);
        sendEvent({ type: 'error', message: 'Erro interno do servidor' });
      } finally {
        res.end();
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

    // Rota para o testador de fluxos
    this.app.get('/flow-tester', (req, res) => {
      res.render('flow-tester');
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

    // === APIs de Status do Sistema ===
    
    // Status do OllamaAPIPool para flow builder
    this.app.get('/api/system/ollama-pool-status', async (req, res) => {
      try {
        const llmService = this.bot.llmService;
        if (!llmService || !llmService.ollamaApiPool) {
          return res.json({
            success: true,
            available: false,
            message: 'OllamaAPIPool não disponível'
          });
        }
        
        const pool = llmService.ollamaApiPool;
        const stats = await pool.getStats();
        const hasHealthy = pool.hasHealthyEndpoints();
        
        res.json({
          success: true,
          available: hasHealthy,
          stats: {
            totalEndpoints: stats.totalEndpoints,
            healthyEndpoints: stats.healthyEndpoints,
            strategy: stats.strategy,
            mode: stats.mode
          },
          endpoints: stats.endpoints.map(ep => ({
            url: ep.url,
            type: ep.type,
            healthy: ep.healthy,
            priority: ep.priority
          }))
        });
        
      } catch (error) {
        logger.error('❌ Erro ao obter status do OllamaAPIPool:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // === APIs de Teste de Flow ===
    
    // Iniciar sessão de teste de flow
    this.app.post('/api/flow/test/start', async (req, res) => {
      try {
        const { flowId } = req.body;
        
        if (!flowId) {
          return res.status(400).json({
            success: false,
            error: 'ID do flow é obrigatório'
          });
        }

        // Criar sessão de teste única
        const testSessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Iniciar flow no FlowExecutionService com captura de mensagens
        if (this.flowExecutionService) {
          try {
            logger.info(`🧪 [API] Iniciando teste de flow ${flowId} com sessão ${testSessionId}`);
            const result = await this.flowExecutionService.startFlowExecutionWithCapture(
              testSessionId, 
              flowId, 
              'manual', 
              { isTestSession: true }
            );
            
            if (result.started) {
              res.json({
                success: true,
                sessionId: testSessionId,
                message: 'Sessão de teste iniciada com sucesso',
                initialMessages: result.messages || [],
                sessionActive: result.sessionActive
              });
            } else {
              res.status(400).json({
                success: false,
                error: 'Não foi possível iniciar o flow para teste'
              });
            }
          } catch (error) {
            logger.error('❌ Erro ao iniciar execução do flow:', error);
            res.status(500).json({
              success: false,
              error: `Erro ao iniciar flow: ${error.message}`
            });
          }
        } else {
          res.status(500).json({
            success: false,
            error: 'FlowExecutionService não disponível'
          });
        }
        
      } catch (error) {
        logger.error('❌ Erro ao iniciar teste de flow:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Enviar mensagem de teste para o flow
    this.app.post('/api/flow/test/message', async (req, res) => {
      try {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
          return res.status(400).json({
            success: false,
            error: 'SessionId e message são obrigatórios'
          });
        }

        // Processar mensagem no flow
        if (this.flowExecutionService) {
          const response = await this.flowExecutionService.processFlowMessage(sessionId, message);
          
          res.json({
            success: true,
            response: response || null,
            sessionActive: await this.flowExecutionService.hasActiveFlow(sessionId)
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'FlowExecutionService não disponível'
          });
        }
        
      } catch (error) {
        logger.error('❌ Erro ao processar mensagem de teste:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Parar sessão de teste
    this.app.post('/api/flow/test/stop', async (req, res) => {
      try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'SessionId é obrigatório'
          });
        }

        // Parar flow
        if (this.flowExecutionService) {
          const stopped = await this.flowExecutionService.stopFlowExecution(sessionId);
          
          res.json({
            success: true,
            stopped: stopped,
            message: 'Sessão de teste finalizada'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'FlowExecutionService não disponível'
          });
        }
        
      } catch (error) {
        logger.error('❌ Erro ao parar teste de flow:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Status da sessão de teste
    this.app.get('/api/flow/test/status/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        
        if (this.flowExecutionService) {
          const hasActive = await this.flowExecutionService.hasActiveFlow(sessionId);
          const currentNode = await this.flowExecutionService.getCurrentFlowState(sessionId);
          
          res.json({
            success: true,
            sessionActive: hasActive,
            currentNode: currentNode || null
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'FlowExecutionService não disponível'
          });
        }
        
      } catch (error) {
        logger.error('❌ Erro ao verificar status de teste:', error);
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

    // Página de configuração do Whisper API
    this.app.get('/whisper-api-config', (req, res) => {
      res.render('whisper-api-config');
    });

    // API endpoint para status do Whisper API Pool
    this.app.get('/api/whisper-api/status', async (req, res) => {
      try {
        const audioTranscriber = this.bot.transcriber;
        const status = await audioTranscriber.getWhisperApiStatus();
        res.json(status);
      } catch (error) {
        logger.error('Erro ao obter status do Whisper API:', error);
        res.status(500).json({ 
          error: 'Erro ao obter status do Whisper API',
          details: error.message 
        });
      }
    });

    // API endpoint para testar conectividade de um endpoint Whisper
    this.app.post('/api/whisper-api/test', async (req, res) => {
      try {
        const { url } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL do endpoint é obrigatória' });
        }

        const WhisperAPIClient = (await import('../services/whisperApiClient.js')).default;
        const client = new WhisperAPIClient(url);
        
        const health = await client.getHealth();
        const formats = await client.getSupportedFormats();
        const queueEstimate = await client.getQueueEstimate();

        res.json({
          success: true,
          url,
          health,
          formats,
          queueEstimate,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Erro ao testar endpoint Whisper API:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao testar endpoint',
          details: error.message 
        });
      }
    });

    // API endpoint para listar endpoints Whisper ativos
    this.app.get('/api/whisper-api/endpoints', async (req, res) => {
      try {
        const audioTranscriber = this.bot.transcriber;
        const whisperPool = audioTranscriber?.whisperApiPool;
        
        if (!whisperPool) {
          return res.status(503).json({ 
            success: false, 
            error: 'Pool de APIs Whisper não disponível' 
          });
        }

        const endpoints = await whisperPool.getPoolStatus();
        
        res.json({
          success: true,
          endpoints: endpoints.endpoints || [],
          stats: {
            total: endpoints.totalEndpoints || 0,
            healthy: endpoints.healthyEndpoints || 0
          }
        });

      } catch (error) {
        logger.error('Erro ao listar endpoints Whisper API:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao obter endpoints Whisper',
          details: error.message 
        });
      }
    });

    // ============ TTS Routes ============
    
    // Página de configuração do TTS
    this.app.get('/tts-config', (req, res) => {
      res.render('tts-config');
    });

    // ============ Ollama API Routes ============
    
    // Página de configuração do Ollama API
    this.app.get('/ollama-api-config', (req, res) => {
      res.render('ollama-api-config');
    });

    // API endpoint para status do Ollama API Pool
    this.app.get('/api/ollama-api/status', async (req, res) => {
      try {
        const llmService = this.bot.llmService;
        const status = await llmService.getOllamaApiStatus();
        res.json(status);
      } catch (error) {
        logger.error('Erro ao obter status do Ollama API:', error);
        res.status(500).json({ 
          error: 'Erro ao obter status do Ollama API',
          details: error.message 
        });
      }
    });

    // API endpoint para status do Whisper
    this.app.get('/api/whisper/status', async (req, res) => {
      try {
        const transcriber = this.bot.transcriber;
        const available = transcriber && typeof transcriber.transcribe === 'function';
        
        let status = {
          available: available,
          service: 'Não disponível'
        };

        if (available) {
          // Verifica se é AudioTranscriber (que tem pools de API)
          if (transcriber.whisperApiPool) {
            const poolStatus = transcriber.whisperApiPool.getPoolStatus();
            status = {
              available: poolStatus.enabled && poolStatus.healthyEndpoints > 0,
              service: 'Whisper API Pool',
              endpoints: poolStatus.healthyEndpoints,
              totalEndpoints: poolStatus.totalEndpoints,
              details: poolStatus
            };
          } else {
            // Transcritor local ou outro tipo
            status = {
              available: true,
              service: 'Transcritor Local'
            };
          }
        }

        res.json(status);
      } catch (error) {
        logger.error('Erro ao obter status do Whisper:', error);
        res.status(500).json({ 
          error: 'Erro ao obter status do Whisper',
          details: error.message,
          available: false
        });
      }
    });

    // API endpoint para testar conectividade de um endpoint Ollama/RKLLama
    this.app.post('/api/ollama-api/test', async (req, res) => {
      try {
        const { url, type = 'ollama' } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL do endpoint é obrigatória' });
        }

        let client;
        if (type === 'rkllama') {
          const RKLlamaAPIClient = (await import('../services/rkllamaApiClient.js')).default;
          client = new RKLlamaAPIClient(url);
        } else {
          const OllamaAPIClient = (await import('../services/ollamaApiClient.js')).default;
          client = new OllamaAPIClient(url);
        }
        
        const health = await client.getHealth();
        const models = await client.listModels();
        const runningModels = await client.listRunningModels();
        
        if (type === 'rkllama') {
          const currentModel = await client.getCurrentModel();
          res.json({
            success: true,
            url,
            type: 'RKLLama',
            health,
            version: health.version,
            models: models.models,
            currentModel: currentModel.model_name,
            runningModels: runningModels.models,
            timestamp: new Date().toISOString()
          });
        } else {
          const version = await client.getVersion();
          res.json({
            success: true,
            url,
            type: 'Ollama',
            health,
            version: version.version,
            models: models.models,
            runningModels: runningModels.models,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        logger.error(`Erro ao testar endpoint ${type}:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao testar endpoint',
          details: error.message,
          type: req.body.type || 'ollama'
        });
      }
    });

    // API endpoint para listar modelos via Ollama API
    this.app.get('/api/ollama-api/models', async (req, res) => {
      try {
        const llmService = this.bot.llmService;
        const models = await llmService.listModels();
        res.json(models);
      } catch (error) {
        logger.error('Erro ao listar modelos Ollama:', error);
        res.status(500).json({ 
          error: 'Erro ao listar modelos',
          details: error.message 
        });
      }
    });

    // API endpoint para listar modelos locais do Ollama
    this.app.get('/api/ollama-local/models', async (req, res) => {
      try {
        const currentConfig = await this.configService.getConfig();
        const ollamaHost = currentConfig?.llm?.host || 'http://localhost:11434';
        
        const response = await fetch(`${ollamaHost}/api/tags`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const models = data.models || [];
        
        res.json({
          success: true,
          models: models.map(model => ({
            name: model.name,
            size: model.size,
            modified: model.modified_at,
            digest: model.digest,
            details: model.details
          })),
          host: ollamaHost,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error('Erro ao listar modelos locais Ollama:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao conectar com Ollama local',
          details: error.message 
        });
      }
    });

    // API endpoint para listar modelos de um endpoint específico
    this.app.post('/api/ollama-api/endpoint-models', async (req, res) => {
      try {
        const { url, type = 'ollama' } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL do endpoint é obrigatória' });
        }

        let client;
        if (type === 'rkllama') {
          const RKLlamaAPIClient = (await import('../services/rkllamaApiClient.js')).default;
          client = new RKLlamaAPIClient(url);
        } else {
          const OllamaAPIClient = (await import('../services/ollamaApiClient.js')).default;
          client = new OllamaAPIClient(url);
        }
        
        const models = await client.listModels();
        
        res.json({
          success: true,
          url,
          type,
          models: models.models || [],
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`Erro ao listar modelos do endpoint ${req.body.type}:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao listar modelos do endpoint',
          details: error.message,
          type: req.body.type || 'ollama'
        });
      }
    });

    // API endpoint para listar modelos ChatGPT/OpenAI
    this.app.post('/api/chatgpt/models', async (req, res) => {
      try {
        const { url, apikey: requestApiKey } = req.body;
        let apikey = requestApiKey || process.env.OPENAI_API_KEY;
        
        // Buscar API key do MongoDB se não estiver nas env vars e nem na requisição
        if (!apikey && this.configService) {
          try {
            const mongoConfig = await this.configService.getConfig();
            // Buscar API key em openai.apiKey ou nos endpoints ollamaApi do tipo chatgpt
            apikey = mongoConfig?.openai?.apiKey;
            
            // Se não encontrou em openai.apiKey, buscar nos endpoints ChatGPT
            if (!apikey && mongoConfig?.ollamaApi?.endpoints) {
              const chatgptEndpoint = mongoConfig.ollamaApi.endpoints.find(ep => 
                ep.type === 'chatgpt' && ep.enabled && ep.apikey
              );
              if (chatgptEndpoint) {
                apikey = chatgptEndpoint.apikey;
                logger.debug('Usando API key do endpoint ChatGPT para modelos');
              }
            }
          } catch (error) {
            logger.warn('Erro ao buscar configuração OpenAI do MongoDB para modelos:', error.message);
          }
        }
        
        if (!apikey) {
          return res.status(400).json({ 
            success: false,
            error: 'API Key da OpenAI não configurada (verifique configurações ou forneça na requisição)' 
          });
        }

        // Create ChatGPT client to list models
        const chatGPTModule = await import('../services/chatgptApiClient.js');
        const { ChatGPTAPIClient } = chatGPTModule;
        
        const client = new ChatGPTAPIClient(url || 'https://api.openai.com', apikey);
        const models = await client.listModels();
        
        res.json({
          success: true,
          url: url || 'https://api.openai.com',
          type: 'chatgpt',
          models: models.models || [],
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`Erro ao listar modelos ChatGPT:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao listar modelos ChatGPT',
          details: error.message,
          type: 'chatgpt'
        });
      }
    });

    // API endpoint para status do ChatGPT/OpenAI
    this.app.get('/api/chatgpt/status', async (req, res) => {
      try {
        // Verificar se há configurações de ChatGPT no MongoDB primeiro
        let openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (!openaiApiKey && this.configService) {
          try {
            const mongoConfig = await this.configService.getConfig();
            // Buscar API key em openai.apiKey ou nos endpoints ollamaApi do tipo chatgpt
            openaiApiKey = mongoConfig?.openai?.apiKey;
            
            // Se não encontrou em openai.apiKey, buscar nos endpoints ChatGPT
            if (!openaiApiKey && mongoConfig?.ollamaApi?.endpoints) {
              const chatgptEndpoint = mongoConfig.ollamaApi.endpoints.find(ep => 
                ep.type === 'chatgpt' && ep.enabled && ep.apikey
              );
              if (chatgptEndpoint) {
                openaiApiKey = chatgptEndpoint.apikey;
                logger.debug('Usando API key do endpoint ChatGPT configurado');
              }
            }
          } catch (error) {
            logger.warn('Erro ao buscar configuração OpenAI do MongoDB:', error.message);
          }
        }
        
        // Fallback para configuração estática
        if (!openaiApiKey) {
          const { config } = await import('../config/index.js');
          openaiApiKey = config?.openai?.apiKey;
        }
        
        if (!openaiApiKey) {
          return res.json({
            enabled: false,
            endpoints: [],
            message: 'API Key da OpenAI não configurada'
          });
        }

        // Criar client ChatGPT para testar conectividade
        const chatGPTModule = await import('../services/chatgptApiClient.js');
        const { ChatGPTAPIClient } = chatGPTModule;
        
        // Buscar base URL do MongoDB se disponível
        let baseURL = process.env.OPENAI_BASE_URL;
        if (!baseURL && this.configService) {
          try {
            const mongoConfig = await this.configService.getConfig();
            baseURL = mongoConfig?.openai?.baseURL;
          } catch (error) {
            logger.debug('Usando base URL padrão para ChatGPT');
          }
        }
        if (!baseURL) {
          const { config } = await import('../config/index.js');
          baseURL = config?.openai?.baseURL || 'https://api.openai.com';
        }
        const client = new ChatGPTAPIClient(baseURL, openaiApiKey);
        
        try {
          const health = await client.getHealth();
          const models = await client.listModels();
          
          res.json({
            enabled: true,
            endpoints: [{
              url: baseURL,
              type: 'chatgpt',
              healthy: true,
              currentModel: models.models?.[0]?.name || 'gpt-4',
              models: models.models || [],
              lastCheck: new Date().toISOString()
            }],
            message: 'ChatGPT API conectada com sucesso'
          });
        } catch (healthError) {
          res.json({
            enabled: true,
            endpoints: [{
              url: baseURL,
              type: 'chatgpt',
              healthy: false,
              error: healthError.message,
              lastCheck: new Date().toISOString()
            }],
            message: 'Erro de conectividade com ChatGPT API'
          });
        }
      } catch (error) {
        logger.error(`Erro ao verificar status ChatGPT:`, error);
        res.status(500).json({
          enabled: false,
          endpoints: [],
          error: 'Erro interno ao verificar ChatGPT',
          details: error.message
        });
      }
    });

    // API endpoint para chat com ChatGPT
    this.app.post('/api/chatgpt/chat', async (req, res) => {
      try {
        const { message, model = 'gpt-4' } = req.body;
        
        if (!message) {
          return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          return res.status(400).json({ error: 'API Key da OpenAI não configurada' });
        }

        const chatGPTModule = await import('../services/chatgptApiClient.js');
        const { ChatGPTAPIClient } = chatGPTModule;
        
        const baseURL = process.env.OPENAI_BASE_URL || config?.openai?.baseURL || 'https://api.openai.com';
        const client = new ChatGPTAPIClient(baseURL, openaiApiKey, { model });
        
        const messages = [{ role: 'user', content: message }];
        const response = await client.chat(messages, { model, stream: false });
        
        res.json({
          success: true,
          result: response.message.content,
          usedEndpoint: baseURL,
          usedModel: model,
          provider: 'chatgpt'
        });
      } catch (error) {
        logger.error(`Erro no chat ChatGPT:`, error);
        res.status(500).json({
          success: false,
          error: 'Erro ao processar chat com ChatGPT',
          details: error.message
        });
      }
    });

    // ============ TTS API Endpoints ============

    // API endpoint para testar TTS
    this.app.post('/api/tts/test', async (req, res) => {
      try {
        const { provider, text, config } = req.body;
        
        if (!provider || !text) {
          return res.status(400).json({ error: 'Provider e text são obrigatórios' });
        }

        if (provider === 'elevenlabs') {
          const { ElevenLabsClient } = await import('elevenlabs');
          const client = new ElevenLabsClient({ apiKey: config.apiKey });
          
          // Test voice synthesis
          await client.generate({
            voice: config.voiceId,
            model_id: config.modelId,
            text: text.substring(0, 100), // Limit test text
            voice_settings: {
              stability: config.stability,
              similarity_boost: config.similarityBoost
            }
          });
          
          res.json({
            success: true,
            message: 'Teste ElevenLabs realizado com sucesso',
            provider: 'elevenlabs'
          });
        } else {
          res.status(400).json({ error: 'Provider não suportado' });
        }

      } catch (error) {
        logger.error(`Erro no teste TTS:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro no teste TTS',
          details: error.message
        });
      }
    });

    // API endpoint para testar instalação do Piper
    this.app.post('/api/tts/test-piper', async (req, res) => {
      try {
        const { executable, model } = req.body;
        
        const { spawn } = await import('child_process');
        const fs = await import('fs');
        
        // Test if executable exists and is accessible
        try {
          fs.accessSync(executable || 'piper', fs.constants.X_OK);
        } catch {
          return res.json({
            success: false,
            error: 'Executável Piper não encontrado ou não executável'
          });
        }
        
        // Test if model exists (if provided)
        if (model && !model.startsWith('pt_BR-') && !model.startsWith('en_US-')) {
          try {
            fs.accessSync(model, fs.constants.R_OK);
          } catch {
            return res.json({
              success: false,
              error: 'Arquivo do modelo não encontrado'
            });
          }
        }
        
        res.json({
          success: true,
          message: 'Piper TTS está corretamente configurado',
          executable: executable || 'piper',
          model: model || 'Modelo não especificado'
        });

      } catch (error) {
        logger.error(`Erro no teste Piper:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro no teste Piper',
          details: error.message
        });
      }
    });

    // API endpoint para instalar Piper
    this.app.post('/api/tts/install-piper', async (req, res) => {
      try {
        const { spawn } = await import('child_process');
        
        // Try to run make install-piper
        const makeProcess = spawn('make', ['install-piper'], {
          cwd: process.cwd(),
          stdio: 'pipe'
        });
        
        let output = '';
        let errorOutput = '';
        
        makeProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        makeProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
        
        makeProcess.on('close', (code) => {
          if (code === 0) {
            res.json({
              success: true,
              message: 'Piper TTS instalado com sucesso',
              output: output
            });
          } else {
            res.json({
              success: false,
              error: 'Falha na instalação do Piper',
              details: errorOutput || output
            });
          }
        });
        
        // Timeout after 5 minutes
        setTimeout(() => {
          makeProcess.kill();
          res.json({
            success: false,
            error: 'Timeout na instalação do Piper'
          });
        }, 300000);

      } catch (error) {
        logger.error(`Erro na instalação Piper:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro na instalação Piper',
          details: error.message
        });
      }
    });

    // API endpoint para carregar vozes do ElevenLabs
    this.app.post('/api/tts/voices', async (req, res) => {
      try {
        const { apiKey } = req.body;
        
        if (!apiKey) {
          return res.status(400).json({ error: 'API Key é obrigatória' });
        }
        
        const { ElevenLabsClient } = await import('elevenlabs');
        const client = new ElevenLabsClient({ apiKey });
        
        const voices = await client.voices.getAll();
        
        res.json({
          success: true,
          voices: voices.voices || [],
          count: voices.voices?.length || 0
        });

      } catch (error) {
        logger.error(`Erro ao carregar vozes ElevenLabs:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao carregar vozes',
          details: error.message
        });
      }
    });

    // API endpoint para carregar modelo em endpoint RKLLama
    this.app.post('/api/ollama-api/load-model', async (req, res) => {
      try {
        const { url, model, type = 'rkllama' } = req.body;
        if (!url || !model) {
          return res.status(400).json({ error: 'URL e modelo são obrigatórios' });
        }

        if (type !== 'rkllama') {
          return res.status(400).json({ error: 'Load model só é suportado para RKLLama' });
        }

        const RKLlamaAPIClient = (await import('../services/rkllamaApiClient.js')).default;
        const client = new RKLlamaAPIClient(url);
        
        const result = await client.loadModel(model);
        
        res.json({
          success: true,
          url,
          model,
          result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error(`Erro ao carregar modelo ${req.body.model}:`, error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao carregar modelo',
          details: error.message
        });
      }
    });

    // API endpoint para fazer pull de um modelo via Ollama API
    this.app.post('/api/ollama-api/pull', async (req, res) => {
      try {
        const { model } = req.body;
        if (!model) {
          return res.status(400).json({ error: 'Nome do modelo é obrigatório' });
        }

        const llmService = this.bot.llmService;
        const result = await llmService.pullModel(model);
        res.json(result);
      } catch (error) {
        logger.error('Erro ao fazer pull do modelo:', error);
        res.status(500).json({ 
          error: 'Erro ao fazer pull do modelo',
          details: error.message 
        });
      }
    });

    // API endpoint para deletar um modelo via Ollama API
    this.app.delete('/api/ollama-api/models/:model', async (req, res) => {
      try {
        const { model } = req.params;
        const llmService = this.bot.llmService;
        const result = await llmService.deleteModel(model);
        res.json(result);
      } catch (error) {
        logger.error('Erro ao deletar modelo:', error);
        res.status(500).json({ 
          error: 'Erro ao deletar modelo',
          details: error.message 
        });
      }
    });

    // API endpoint para salvar modelo selecionado no banco
    this.app.post('/api/ollama-api/save-selected-model', async (req, res) => {
      try {
        const { endpointIndex, model, url, type } = req.body;
        
        if (endpointIndex === undefined || !model || !url) {
          return res.status(400).json({ 
            error: 'endpointIndex, model e url são obrigatórios' 
          });
        }

        // Obter configuração atual
        let currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          currentConfig = await this.configService.init();
        }

        // Garantir que a estrutura de endpoints existe
        if (!currentConfig.ollamaApi) {
          currentConfig.ollamaApi = {};
        }
        if (!currentConfig.ollamaApi.endpoints) {
          currentConfig.ollamaApi.endpoints = [];
        }

        // Expandir array se necessário
        while (currentConfig.ollamaApi.endpoints.length <= endpointIndex) {
          currentConfig.ollamaApi.endpoints.push({
            url: '',
            type: 'ollama',
            enabled: false,
            priority: currentConfig.ollamaApi.endpoints.length + 1,
            maxRetries: 2
          });
        }

        // Atualizar o endpoint com o modelo selecionado
        const endpoint = currentConfig.ollamaApi.endpoints[endpointIndex];
        endpoint.model = model;
        endpoint.url = url;
        endpoint.type = type || 'ollama';
        endpoint.lastSelectedAt = new Date().toISOString();

        // Salvar configuração
        await this.configService.setConfig(currentConfig);
        
        logger.info(`📝 Modelo selecionado salvo: ${model} para endpoint ${endpointIndex} (${url})`);
        
        res.json({
          success: true,
          message: 'Modelo selecionado salvo com sucesso',
          savedModel: model,
          endpointIndex,
          url,
          type
        });

      } catch (error) {
        logger.error('Erro ao salvar modelo selecionado:', error);
        res.status(500).json({ 
          error: 'Erro ao salvar modelo selecionado',
          details: error.message 
        });
      }
    });

    // API endpoint para obter modelos selecionados salvos
    this.app.get('/api/ollama-api/selected-models', async (req, res) => {
      try {
        const currentConfig = await this.configService.getConfig();
        const endpoints = currentConfig?.ollamaApi?.endpoints || [];
        
        const selectedModels = endpoints.map((endpoint, index) => ({
          endpointIndex: index,
          url: endpoint.url || '',
          type: endpoint.type || 'ollama',
          model: endpoint.model || null,
          enabled: endpoint.enabled || false,
          lastSelectedAt: endpoint.lastSelectedAt || null
        }));

        res.json({
          success: true,
          selectedModels
        });

      } catch (error) {
        logger.error('Erro ao obter modelos selecionados:', error);
        res.status(500).json({ 
          error: 'Erro ao obter modelos selecionados',
          details: error.message 
        });
      }
    });

    // API endpoint para salvar modelo local selecionado
    this.app.post('/api/ollama-local/save-model', async (req, res) => {
      try {
        const { model, port, protocol } = req.body;
        
        if (!model) {
          return res.status(400).json({ 
            success: false,
            error: 'Nome do modelo é obrigatório' 
          });
        }

        // Obter configuração atual
        let currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          currentConfig = await this.configService.init();
        }

        // Garantir que a estrutura existe
        if (!currentConfig.ollamaApi) {
          currentConfig.ollamaApi = {};
        }
        if (!currentConfig.llm) {
          currentConfig.llm = {};
        }

        // Salvar configuração local completa
        currentConfig.ollamaApi.localModel = model;
        currentConfig.ollamaApi.localPort = port || 11434;
        currentConfig.ollamaApi.localProtocol = protocol || 'ollama';
        currentConfig.ollamaApi.localModelLastSelected = new Date().toISOString();
        
        // Também atualizar o modelo e host principal para consistência
        currentConfig.llm.model = model;
        currentConfig.llm.host = `http://localhost:${currentConfig.ollamaApi.localPort}`;

        // Salvar configuração
        await this.configService.setConfig(currentConfig);
        
        logger.info(`📝 Configuração local salva: ${model} em localhost:${currentConfig.ollamaApi.localPort} (${protocol})`);
        
        res.json({
          success: true,
          message: 'Configuração local salva com sucesso',
          savedModel: model,
          savedPort: currentConfig.ollamaApi.localPort,
          savedProtocol: protocol,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Erro ao salvar configuração local:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao salvar configuração local',
          details: error.message 
        });
      }
    });

    // API endpoint para obter modelo local salvo
    this.app.get('/api/ollama-local/selected-model', async (req, res) => {
      try {
        const currentConfig = await this.configService.getConfig();
        const localModel = currentConfig?.ollamaApi?.localModel || currentConfig?.llm?.model;
        const localPort = currentConfig?.ollamaApi?.localPort || 11434;
        const localProtocol = currentConfig?.ollamaApi?.localProtocol || 'ollama';
        const lastSelected = currentConfig?.ollamaApi?.localModelLastSelected;
        
        res.json({
          success: true,
          model: localModel || null,
          port: localPort,
          protocol: localProtocol,
          lastSelectedAt: lastSelected || null
        });

      } catch (error) {
        logger.error('Erro ao obter configuração local:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro ao obter configuração local',
          details: error.message 
        });
      }
    });

    // API endpoint para diagnosticar problemas de conectividade Ollama
    this.app.post('/api/ollama-api/diagnose', async (req, res) => {
      try {
        const { url, type = 'ollama' } = req.body;
        
        if (!url) {
          return res.status(400).json({ 
            success: false,
            error: 'URL é obrigatória' 
          });
        }

        const diagnosis = {
          url: url,
          type: type,
          timestamp: new Date().toISOString(),
          tests: []
        };

        // Test 1: URL Format Validation
        let validatedURL = url;
        try {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            validatedURL = `http://${url}`;
          }
          new URL(validatedURL);
          diagnosis.tests.push({
            name: 'URL Format',
            status: 'PASS',
            message: `URL válida: ${validatedURL}`
          });
        } catch (error) {
          diagnosis.tests.push({
            name: 'URL Format',
            status: 'FAIL',
            message: `URL inválida: ${error.message}`,
            originalURL: url,
            validatedURL: validatedURL
          });
          return res.json({ success: true, diagnosis });
        }

        // Test 2: Network Connectivity
        try {
          const response = await fetch(validatedURL, { 
            method: 'HEAD', 
            signal: AbortSignal.timeout(5000) 
          });
          diagnosis.tests.push({
            name: 'Network Connectivity',
            status: 'PASS',
            message: `Conectividade OK (${response.status})`
          });
        } catch (error) {
          diagnosis.tests.push({
            name: 'Network Connectivity',
            status: 'FAIL',
            message: `Falha na conectividade: ${error.message}`,
            error: error.name
          });
        }

        // Test 3: API Endpoint Test
        try {
          let client;
          if (type === 'rkllama') {
            const RKLlamaAPIClient = (await import('../services/rkllamaApiClient.js')).default;
            client = new RKLlamaAPIClient(validatedURL);
          } else {
            const OllamaAPIClient = (await import('../services/ollamaApiClient.js')).default;
            client = new OllamaAPIClient(validatedURL);
          }
          
          const health = await client.getHealth();
          diagnosis.tests.push({
            name: 'API Endpoint',
            status: 'PASS',
            message: `API respondendo corretamente`,
            health: health
          });
        } catch (error) {
          diagnosis.tests.push({
            name: 'API Endpoint',
            status: 'FAIL',
            message: `API não responde: ${error.message}`,
            error: error.name
          });
        }

        // Overall status
        const failedTests = diagnosis.tests.filter(t => t.status === 'FAIL');
        diagnosis.overall = failedTests.length === 0 ? 'HEALTHY' : 'UNHEALTHY';
        diagnosis.summary = failedTests.length === 0 
          ? 'Todos os testes passaram'
          : `${failedTests.length} teste(s) falharam`;

        res.json({
          success: true,
          diagnosis
        });

      } catch (error) {
        logger.error('Erro no diagnóstico Ollama:', error);
        res.status(500).json({ 
          success: false,
          error: 'Erro interno no diagnóstico',
          details: error.message 
        });
      }
    });

    // ============ Observabilidade Routes ============
    
    // Página de Observabilidade
    this.app.get('/observabilidade', async (req, res) => {
      try {
        // Obter configuração atual
        const currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          logger.info('⚠️ Configuração não encontrada, inicializando...');
          currentConfig = await this.configService.init();
        }

        // Obter status dos serviços de monitoramento
        const metricsService = getMetricsService();
        const monitoringStatus = {
          grafanaEnabled: currentConfig?.monitoring?.grafanaEnabled || false,
          prometheusEnabled: currentConfig?.monitoring?.prometheusEnabled || false,
          alertmanagerEnabled: currentConfig?.monitoring?.alertmanagerEnabled || false,
          metricsCollectionEnabled: metricsService.enabled,
          scrapeInterval: currentConfig?.monitoring?.scrapeInterval || '15s',
          grafanaPort: currentConfig?.monitoring?.grafanaPort || 3001,
          prometheusPort: currentConfig?.monitoring?.prometheusPort || 9090,
          alertmanagerPort: currentConfig?.monitoring?.alertmanagerPort || 9093
        };

        res.render('observabilidade', {
          config: currentConfig,
          monitoringStatus
        });
      } catch (error) {
        logger.error('Erro ao carregar página de observabilidade:', error);
        res.status(500).render('error', { 
          error: 'Erro ao carregar observabilidade',
          details: error.message 
        });
      }
    });

    // API endpoint para obter status de monitoramento
    this.app.get('/api/observabilidade/status', async (req, res) => {
      try {
        const currentConfig = await this.configService.getConfig();
        const metricsService = getMetricsService();
        
        // Verificar se Docker Compose está rodando
        let dockerStatus = {
          grafana: false,
          prometheus: false,
          alertmanager: false
        };

        try {
          // Obter portas configuradas
          const grafanaPort = currentConfig?.monitoring?.grafanaPort || 3001;
          const prometheusPort = currentConfig?.monitoring?.prometheusPort || 9090;
          const alertmanagerPort = currentConfig?.monitoring?.alertmanagerPort || 9093;

          // Tentar conectar com os serviços usando portas configuradas
          const grafanaResponse = await fetch(`http://localhost:${grafanaPort}/api/health`, { 
            timeout: 3000 
          }).catch(() => null);
          dockerStatus.grafana = grafanaResponse?.ok || false;

          const prometheusResponse = await fetch(`http://localhost:${prometheusPort}/-/healthy`, { 
            timeout: 3000 
          }).catch(() => null);
          dockerStatus.prometheus = prometheusResponse?.ok || false;

          const alertmanagerResponse = await fetch(`http://localhost:${alertmanagerPort}/-/healthy`, { 
            timeout: 3000 
          }).catch(() => null);
          dockerStatus.alertmanager = alertmanagerResponse?.ok || false;
        } catch (error) {
          logger.debug('Erro ao verificar status dos serviços Docker:', error.message);
        }

        // Obter métricas se disponível
        let metrics = null;
        if (metricsService.enabled) {
          try {
            metrics = await metricsService.getMetricsSummary();
          } catch (error) {
            logger.warn('Erro ao obter resumo de métricas:', error.message);
          }
        }

        res.json({
          success: true,
          config: {
            grafanaEnabled: currentConfig?.monitoring?.grafanaEnabled || false,
            prometheusEnabled: currentConfig?.monitoring?.prometheusEnabled || false,
            alertmanagerEnabled: currentConfig?.monitoring?.alertmanagerEnabled || false,
            metricsCollectionEnabled: metricsService.enabled,
            scrapeInterval: currentConfig?.monitoring?.scrapeInterval || '15s',
            grafanaPort: currentConfig?.monitoring?.grafanaPort || 3001,
            prometheusPort: currentConfig?.monitoring?.prometheusPort || 9090,
            alertmanagerPort: currentConfig?.monitoring?.alertmanagerPort || 9093
          },
          dockerStatus,
          metrics
        });
      } catch (error) {
        logger.error('Erro ao obter status de observabilidade:', error);
        res.status(500).json({ 
          error: 'Erro ao obter status de observabilidade',
          details: error.message 
        });
      }
    });

    // API endpoint para atualizar configurações de monitoramento
    this.app.post('/api/observabilidade/config', async (req, res) => {
      try {
        const { 
          grafanaEnabled, 
          prometheusEnabled, 
          alertmanagerEnabled, 
          metricsCollectionEnabled,
          scrapeInterval,
          grafanaPort,
          prometheusPort,
          alertmanagerPort
        } = req.body;

        // Obter configuração atual
        let currentConfig = await this.configService.getConfig();
        if (!currentConfig) {
          currentConfig = await this.configService.init();
        }

        // Atualizar configurações de monitoramento
        if (!currentConfig.monitoring) {
          currentConfig.monitoring = {};
        }

        currentConfig.monitoring.grafanaEnabled = grafanaEnabled === true;
        currentConfig.monitoring.prometheusEnabled = prometheusEnabled === true;
        currentConfig.monitoring.alertmanagerEnabled = alertmanagerEnabled === true;
        currentConfig.monitoring.scrapeInterval = scrapeInterval || '15s';
        
        // Atualizar portas se fornecidas
        if (grafanaPort && grafanaPort >= 1024 && grafanaPort <= 65535) {
          currentConfig.monitoring.grafanaPort = grafanaPort;
        }
        if (prometheusPort && prometheusPort >= 1024 && prometheusPort <= 65535) {
          currentConfig.monitoring.prometheusPort = prometheusPort;
        }
        if (alertmanagerPort && alertmanagerPort >= 1024 && alertmanagerPort <= 65535) {
          currentConfig.monitoring.alertmanagerPort = alertmanagerPort;
        }

        // Salvar configuração
        await this.configService.setConfig(currentConfig);

        // Atualizar serviço de métricas se necessário
        const metricsService = getMetricsService();
        if (metricsCollectionEnabled !== undefined) {
          if (metricsCollectionEnabled && !metricsService.enabled) {
            await metricsService.enable();
          } else if (!metricsCollectionEnabled && metricsService.enabled) {
            await metricsService.disable();
          }
        }

        logger.info('✅ Configurações de observabilidade atualizadas');

        res.json({
          success: true,
          message: 'Configurações de observabilidade atualizadas com sucesso',
          config: {
            grafanaEnabled: currentConfig.monitoring.grafanaEnabled,
            prometheusEnabled: currentConfig.monitoring.prometheusEnabled,
            alertmanagerEnabled: currentConfig.monitoring.alertmanagerEnabled,
            metricsCollectionEnabled: metricsService.enabled,
            scrapeInterval: currentConfig.monitoring.scrapeInterval,
            grafanaPort: currentConfig.monitoring.grafanaPort || 3001,
            prometheusPort: currentConfig.monitoring.prometheusPort || 9090,
            alertmanagerPort: currentConfig.monitoring.alertmanagerPort || 9093
          }
        });
      } catch (error) {
        logger.error('Erro ao atualizar configurações de observabilidade:', error);
        res.status(500).json({ 
          error: 'Erro ao atualizar configurações de observabilidade',
          details: error.message 
        });
      }
    });

    // API endpoint para controlar Docker Compose de monitoramento
    this.app.post('/api/observabilidade/docker/:action', async (req, res) => {
      try {
        const { action } = req.params;
        const validActions = ['start', 'stop', 'restart'];
        
        if (!validActions.includes(action)) {
          return res.status(400).json({
            error: 'Ação inválida. Use: start, stop ou restart'
          });
        }

        // Obter configuração atual para portas
        const currentConfig = await this.configService.getConfig();
        const grafanaPort = currentConfig?.monitoring?.grafanaPort || 3001;
        const prometheusPort = currentConfig?.monitoring?.prometheusPort || 9090;
        const alertmanagerPort = currentConfig?.monitoring?.alertmanagerPort || 9093;

        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Definir variáveis de ambiente para as portas
        const env = {
          ...process.env,
          GRAFANA_PORT: grafanaPort.toString(),
          PROMETHEUS_PORT: prometheusPort.toString(),
          ALERTMANAGER_PORT: alertmanagerPort.toString()
        };

        let command;
        switch (action) {
          case 'start':
            command = 'docker-compose -f docker-compose.monitoring.yml up -d';
            break;
          case 'stop':
            command = 'docker-compose -f docker-compose.monitoring.yml down';
            break;
          case 'restart':
            command = 'docker-compose -f docker-compose.monitoring.yml restart';
            break;
        }

        const { stdout, stderr } = await execAsync(command, { env });
        
        logger.info(`✅ Docker Compose ${action} executado com sucesso`);
        
        res.json({
          success: true,
          message: `Stack de monitoramento ${action === 'start' ? 'iniciada' : action === 'stop' ? 'parada' : 'reiniciada'} com sucesso`,
          stdout,
          stderr
        });
      } catch (error) {
        logger.error(`Erro ao ${req.params.action} Docker Compose:`, error);
        res.status(500).json({ 
          error: `Erro ao ${req.params.action} stack de monitoramento`,
          details: error.message 
        });
      }
    });

    // ===== CRYPTO MONITORING ROUTES =====
    
    // Página principal de monitoramento de cripto
    this.app.get('/crypto-monitor', (req, res) => {
      res.render('crypto-monitor');
    });

    // Página de preferências de criptomoedas
    this.app.get('/crypto-preferences', (req, res) => {
      res.render('crypto-preferences');
    });

    // API para obter preços de criptomoedas
    this.app.get('/api/crypto/prices', async (req, res) => {
      try {
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        // Usar o CryptoService que já tem sistema de fallbacks múltiplos
        const cryptoData = await this.bot.cryptoService.getCurrentPrices();
        
        // Adicionar símbolos e nomes para compatibilidade
        const formatted = {
          bitcoin: { ...cryptoData.bitcoin, symbol: 'BTC', name: 'Bitcoin' },
          ethereum: { ...cryptoData.ethereum, symbol: 'ETH', name: 'Ethereum' },
          cardano: { ...cryptoData.cardano, symbol: 'ADA', name: 'Cardano' },
          polkadot: { ...cryptoData.polkadot, symbol: 'DOT', name: 'Polkadot' },
          polygon: { ...cryptoData.polygon, symbol: 'MATIC', name: 'Polygon' }
        };
        
        res.json({ success: true, data: formatted });
      } catch (error) {
        logger.error('❌ Erro ao buscar preços de cripto:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar preços' });
      }
    });

    // API para obter histórico de preços
    this.app.get('/api/crypto/history/:coinId', async (req, res) => {
      try {
        const { coinId } = req.params;
        const days = req.query.days || 7;
        
        // Tentar buscar do MongoDB primeiro
        if (this.bot.cryptoService) {
          const historicalData = await this.bot.cryptoService.getHistoricalDataFromDB(coinId, days);
          
          if (historicalData && historicalData.length > 0) {
            // Converter formato para compatibilidade com CoinGecko
            const prices = historicalData.map(item => [
              new Date(item.timestamp).getTime(),
              item.prices.usd
            ]);
            
            res.json({ success: true, data: { prices }, source: 'MongoDB' });
            return;
          }
        }
        
        // Fallback para CoinGecko API
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
        const data = await response.json();
        
        res.json({ success: true, data, source: 'CoinGecko' });
      } catch (error) {
        logger.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar histórico' });
      }
    });

    // API para análise comparativa
    this.app.get('/api/crypto/analysis/:symbol', async (req, res) => {
      try {
        const { symbol } = req.params;
        const days = req.query.days || 30;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        const analysis = await this.bot.cryptoService.getComparisonAnalysis(symbol, days);
        res.json({ success: true, analysis });
      } catch (error) {
        logger.error('❌ Erro ao gerar análise:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar análise' });
      }
    });

    // API para testar sistema de alertas (simular variação)
    this.app.post('/api/crypto/test-alert/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const { coin = 'bitcoin', variation = 5.0 } = req.body;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        // Simular alerta de variação
        const mockVariation = {
          current: 50000,
          previous: 47500,
          variation: variation,
          timestamp: new Date().toISOString(),
          timeframe: '1m',
          dataPoints: 1
        };
        
        const mockPrices = {
          [coin]: {
            usd: mockVariation.current,
            brl: mockVariation.current * 5.5
          }
        };
        
        const mockConfig = {
          thresholdPercentage: 1.0,
          alertOnRise: true,
          alertOnFall: true,
          cooldownMinutes: 0 // Desativar cooldown para teste
        };
        
        this.bot.cryptoService.sendVariationAlert(userId, coin, mockVariation, mockPrices, mockConfig);
        
        res.json({ 
          success: true, 
          message: `Alerta de teste enviado para ${userId}`,
          variation: variation,
          coin: coin
        });
      } catch (error) {
        logger.error('❌ Erro ao testar alerta:', error);
        res.status(500).json({ success: false, error: 'Erro ao testar alerta' });
      }
    });

    // API para verificar alertas pendentes
    this.app.get('/api/crypto/pending-alerts', async (req, res) => {
      try {
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        const pendingAlerts = this.bot.cryptoService.getPendingAlerts();
        res.json({ success: true, pendingAlerts, count: pendingAlerts.length });
      } catch (error) {
        logger.error('❌ Erro ao buscar alertas pendentes:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar alertas' });
      }
    });

    // API para ativar monitoramento de um usuário
    this.app.post('/api/crypto/monitor/activate/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const options = req.body || {};
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        const config = this.bot.cryptoService.activateMonitoring(userId, options);
        res.json({ 
          success: true, 
          message: 'Monitoramento ativado com sucesso',
          config: config
        });
      } catch (error) {
        logger.error('❌ Erro ao ativar monitoramento:', error);
        res.status(500).json({ success: false, error: 'Erro ao ativar monitoramento' });
      }
    });

    // API para desativar monitoramento de um usuário
    this.app.post('/api/crypto/monitor/deactivate/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        const result = this.bot.cryptoService.deactivateMonitoring(userId);
        res.json({ 
          success: true, 
          message: 'Monitoramento desativado com sucesso',
          result: result
        });
      } catch (error) {
        logger.error('❌ Erro ao desativar monitoramento:', error);
        res.status(500).json({ success: false, error: 'Erro ao desativar monitoramento' });
      }
    });

    // API para verificar status de monitoramento
    this.app.get('/api/crypto/monitor/status/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        const status = this.bot.cryptoService.getMonitoringStatus(userId);
        res.json({ success: true, status });
      } catch (error) {
        logger.error('❌ Erro ao verificar status:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar status' });
      }
    });

    // API para buscar histórico de múltiplas moedas de uma vez
    this.app.post('/api/crypto/history/multiple', async (req, res) => {
      try {
        const { coins = ['bitcoin'], days = 7 } = req.body;
        const results = {};
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        // Buscar histórico para cada moeda
        for (const coin of coins) {
          try {
            const historicalData = await this.bot.cryptoService.getHistoricalDataFromDB(coin, days);
            
            if (historicalData && historicalData.length > 0) {
              // Converter formato para compatibilidade com CoinGecko
              const prices = historicalData.map(item => [
                new Date(item.timestamp).getTime(),
                item.prices.usd
              ]);
              
              results[coin] = { prices };
            } else {
              // Fallback para CoinGecko API se não houver dados no MongoDB
              const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}`);
              const data = await response.json();
              results[coin] = data;
            }
          } catch (error) {
            logger.error(`❌ Erro ao buscar histórico de ${coin}:`, error);
            results[coin] = { error: `Erro ao buscar dados de ${coin}` };
          }
        }
        
        res.json({ success: true, data: results, source: 'MongoDB+CoinGecko' });
      } catch (error) {
        logger.error('❌ Erro ao buscar múltiplos históricos:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar históricos' });
      }
    });

    // API avançada para diferentes granularidades de tempo
    this.app.post('/api/crypto/history/advanced', async (req, res) => {
      try {
        const { coins = ['bitcoin'], interval = '1d', quantity = 7 } = req.body;
        const results = {};
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }
        
        // Converter parâmetros de intervalo para dias equivalentes
        const intervalToDays = (interval, quantity) => {
          const multipliers = {
            '1s': quantity / 86400, // segundos para dias
            '1m': quantity / 1440,  // minutos para dias
            '1h': quantity / 24,    // horas para dias
            '1d': quantity,         // dias
            '7d': quantity * 7,     // semanas para dias
            '1M': quantity * 30,    // meses para dias (aproximado)
            '1y': quantity * 365,   // anos para dias
            '10y': quantity * 3650  // décadas para dias
          };
          return Math.max(1, Math.ceil(multipliers[interval] || quantity));
        };
        
        const days = intervalToDays(interval, quantity);
        
        // Para intervalos muito pequenos (segundos/minutos), usar dados em tempo real ou sintéticos
        if (interval === '1s' || interval === '1m') {
          return await this.generateRealtimeData(coins, interval, quantity, res);
        }
        
        // Buscar histórico para cada moeda
        for (const coin of coins) {
          try {
            const historicalData = await this.bot.cryptoService.getHistoricalDataFromDB(coin, days);
            
            if (historicalData && historicalData.length > 0) {
              // Processar dados conforme granularidade solicitada
              const processedData = this.processDataByInterval(historicalData, interval, quantity);
              results[coin] = { prices: processedData };
            } else {
              // Fallback para CoinGecko API
              try {
                const coinGeckoInterval = this.mapIntervalToCoinGecko(interval);
                const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}&interval=${coinGeckoInterval}`);
                const data = await response.json();
                results[coin] = data;
              } catch (apiError) {
                logger.warn(`Fallback CoinGecko falhou para ${coin}:`, apiError.message);
                results[coin] = { error: `Dados não disponíveis para ${coin}` };
              }
            }
          } catch (error) {
            logger.error(`❌ Erro ao buscar histórico avançado de ${coin}:`, error);
            results[coin] = { error: `Erro ao buscar dados de ${coin}` };
          }
        }
        
        res.json({ 
          success: true, 
          data: results, 
          source: 'MongoDB+CoinGecko',
          interval: interval,
          quantity: quantity,
          totalDays: days
        });
      } catch (error) {
        logger.error('❌ Erro ao buscar históricos avançados:', error);
        res.status(500).json({ success: false, error: 'Erro ao buscar históricos avançados' });
      }
    });

    // =========================================================================
    //                    APIs PARA GERENCIAMENTO DE PREFERÊNCIAS CRYPTO
    // =========================================================================

    // API para obter lista das 20 criptomoedas mais atrativas
    this.app.get('/api/crypto/top20', (req, res) => {
      try {
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const top20 = this.bot.cryptoService.getTop20Cryptos();
        res.json({ success: true, data: top20 });
      } catch (error) {
        logger.error('❌ Erro ao obter top 20 cryptos:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter lista de criptomoedas' });
      }
    });

    // API para obter preferências de um usuário
    this.app.get('/api/crypto/user/:userId/preferences', async (req, res) => {
      try {
        const { userId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const preferences = await this.bot.cryptoService.getUserPreferences(userId);
        res.json({ success: true, data: preferences });
      } catch (error) {
        logger.error('❌ Erro ao obter preferências do usuário:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter preferências' });
      }
    });

    // API para salvar preferências de um usuário
    this.app.post('/api/crypto/user/:userId/preferences', async (req, res) => {
      try {
        const { userId } = req.params;
        const preferences = req.body;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const savedPrefs = await this.bot.cryptoService.setUserPreferences(userId, preferences);
        res.json({ success: true, data: savedPrefs });
      } catch (error) {
        logger.error('❌ Erro ao salvar preferências do usuário:', error);
        res.status(500).json({ success: false, error: 'Erro ao salvar preferências' });
      }
    });

    // API para adicionar moeda às preferências do usuário
    this.app.post('/api/crypto/user/:userId/coins/:coinId', async (req, res) => {
      try {
        const { userId, coinId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const added = await this.bot.cryptoService.addCoinToUser(userId, coinId);
        res.json({ 
          success: true, 
          added,
          message: added ? `Moeda ${coinId} adicionada` : `Moeda ${coinId} já estava na lista`
        });
      } catch (error) {
        logger.error('❌ Erro ao adicionar moeda:', error);
        res.status(500).json({ success: false, error: 'Erro ao adicionar moeda' });
      }
    });

    // API para remover moeda das preferências do usuário
    this.app.delete('/api/crypto/user/:userId/coins/:coinId', async (req, res) => {
      try {
        const { userId, coinId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const removed = await this.bot.cryptoService.removeCoinFromUser(userId, coinId);
        res.json({ 
          success: true, 
          removed,
          message: removed ? `Moeda ${coinId} removida` : `Moeda ${coinId} não estava na lista`
        });
      } catch (error) {
        logger.error('❌ Erro ao remover moeda:', error);
        res.status(500).json({ success: false, error: 'Erro ao remover moeda' });
      }
    });

    // API para definir lista de moedas do usuário
    this.app.put('/api/crypto/user/:userId/coins', async (req, res) => {
      try {
        const { userId } = req.params;
        const { coins } = req.body;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        if (!Array.isArray(coins)) {
          return res.status(400).json({ success: false, error: 'Lista de moedas deve ser um array' });
        }

        const preferences = await this.bot.cryptoService.setUserCoins(userId, coins);
        res.json({ success: true, data: preferences });
      } catch (error) {
        logger.error('❌ Erro ao definir moedas do usuário:', error);
        res.status(500).json({ success: false, error: 'Erro ao definir moedas' });
      }
    });

    // API para obter preços das moedas do usuário
    this.app.get('/api/crypto/user/:userId/prices', async (req, res) => {
      try {
        const { userId } = req.params;
        
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const userPrices = await this.bot.cryptoService.getUserCryptoPrices(userId);
        res.json({ success: true, data: userPrices });
      } catch (error) {
        logger.error('❌ Erro ao obter preços do usuário:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter preços personalizados' });
      }
    });

    // API para estatísticas de uso das moedas
    this.app.get('/api/crypto/stats/usage', async (req, res) => {
      try {
        if (!this.bot.cryptoService) {
          return res.status(503).json({ success: false, error: 'Serviço de crypto não disponível' });
        }

        const stats = await this.bot.cryptoService.getCoinUsageStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        logger.error('❌ Erro ao obter estatísticas de uso:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
      }
    });

    // Setup job queue routes synchronously
    this.setupJobQueueRoutesSync();
  }

  // Método auxiliar para gerar dados em tempo real
  async generateRealtimeData(coins, interval, quantity, res) {
    try {
      const results = {};
      const now = Date.now();
      const intervalMs = interval === '1s' ? 1000 : 60000; // 1s ou 1m em ms
      
      for (const coin of coins) {
        const prices = [];
        let basePrice = await this.getRandomBasePrice(coin);
        
        for (let i = quantity - 1; i >= 0; i--) {
          const timestamp = now - (i * intervalMs);
          // Adicionar volatilidade realística
          const volatility = 0.001; // 0.1% de variação
          const change = (Math.random() - 0.5) * volatility;
          basePrice = basePrice * (1 + change);
          
          prices.push([timestamp, basePrice]);
        }
        
        results[coin] = { prices };
      }
      
      res.json({
        success: true,
        data: results,
        source: 'Realtime-Synthetic',
        interval: interval,
        quantity: quantity
      });
    } catch (error) {
      logger.error('❌ Erro ao gerar dados em tempo real:', error);
      res.status(500).json({ success: false, error: 'Erro ao gerar dados em tempo real' });
    }
  }

  // Método auxiliar para obter preço base atual real
  async getRandomBasePrice(coin) {
    try {
      // Obter preço atual real do CryptoService
      const currentPrices = await this.bot.cryptoService.getCurrentPrices();
      
      if (currentPrices[coin] && currentPrices[coin].usd) {
        return currentPrices[coin].usd;
      }
      
      // Fallback para preços aproximados atualizados
      const fallbackPrices = {
        bitcoin: 118000,
        ethereum: 3800,
        cardano: 0.77,
        polkadot: 3.8,
        polygon: 0.9
      };
      return fallbackPrices[coin] || 1;
    } catch (error) {
      logger.warn(`⚠️ Erro ao obter preço atual para ${coin}, usando fallback:`, error.message);
      
      // Fallback para preços aproximados atualizados
      const fallbackPrices = {
        bitcoin: 118000,
        ethereum: 3800,
        cardano: 0.77,
        polkadot: 3.8,
        polygon: 0.9
      };
      return fallbackPrices[coin] || 1;
    }
  }

  // Método auxiliar para processar dados por intervalo
  processDataByInterval(historicalData, interval, quantity) {
    if (!historicalData.length) return [];
    
    // Para intervalos longos, fazer amostragem dos dados
    if (historicalData.length > quantity) {
      const step = Math.floor(historicalData.length / quantity);
      const sampled = [];
      
      for (let i = 0; i < quantity; i++) {
        const index = Math.min(i * step, historicalData.length - 1);
        const item = historicalData[index];
        sampled.push([
          new Date(item.timestamp).getTime(),
          item.prices.usd
        ]);
      }
      
      return sampled;
    }
    
    // Converter todos os dados disponíveis
    return historicalData.map(item => [
      new Date(item.timestamp).getTime(),
      item.prices.usd
    ]);
  }

  // Método auxiliar para mapear intervalos para CoinGecko
  mapIntervalToCoinGecko(interval) {
    const mapping = {
      '1h': 'hourly',
      '1d': 'daily',
      '7d': 'daily',
      '1M': 'daily',
      '1y': 'daily',
      '10y': 'daily'
    };
    return mapping[interval] || 'daily';
  }

  setupJobQueueRoutesSync() {
    try {
      logger.info('🔧 Setting up job queue routes...');
      
      // Job Queue Monitor page
      this.app.get('/monitorfila', (req, res) => {
        res.render('job-queue-monitor');
      });

      // Lazy load job queue monitor when needed
      const getJobQueueMonitorLazy = async () => {
        const { getJobQueueMonitor } = await import('../services/jobQueueMonitor.js');
        return getJobQueueMonitor();
      };

      // API endpoint para obter estatísticas da fila
      this.app.get('/api/job-queue/stats', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const stats = await jobQueueMonitor.getJobStats();
          res.json(stats);
        } catch (error) {
          logger.error('❌ Erro ao obter estatísticas da fila:', error);
          res.status(500).json({ success: false, error: 'Erro interno' });
        }
      });

      logger.info('✅ Job queue routes successfully set up');
    } catch (error) {
      logger.error('❌ Erro ao carregar job queue monitor:', error);
    }

    // Rota catch-all para 404
    this.app.use((req, res) => {
        res.status(404).json({ error: '❌ Rota não encontrada' });
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

  setupJobQueueRoutesSync() {
    try {
      logger.info('🔧 Setting up job queue routes...');
      
      // Job Queue Monitor page
      this.app.get('/monitorfila', (req, res) => {
        res.render('job-queue-monitor');
      });

      // Lazy load job queue monitor when needed
      const getJobQueueMonitorLazy = async () => {
        const { getJobQueueMonitor } = await import('../services/jobQueueMonitor.js');
        return getJobQueueMonitor();
      };

      // API endpoint para obter estatísticas da fila
      this.app.get('/api/job-queue/stats', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const stats = await jobQueueMonitor.getJobStats();
          res.json(stats);
        } catch (error) {
          logger.error('❌ Erro ao obter estatísticas da fila:', error);
          res.status(500).json({ 
            error: 'Erro ao obter estatísticas da fila',
            details: error.message 
          });
        }
      });

      // API endpoint para listar jobs
      this.app.get('/api/job-queue/jobs', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 20;
          const offset = (page - 1) * limit;
          
          const filter = {};
          if (req.query.status) filter.status = req.query.status;
          if (req.query.type) filter.type = req.query.type;

          const jobs = await jobQueueMonitor.getAllJobs(filter, limit, offset);
          
          // Get total count for pagination
          const totalJobs = await jobQueueMonitor.getAllJobs(filter, 10000, 0);
          const totalCount = totalJobs.length;
          const totalPages = Math.ceil(totalCount / limit);

          res.json({
            jobs,
            pagination: {
              currentPage: page,
              totalPages,
              totalCount,
              limit
            }
          });
        } catch (error) {
          logger.error('❌ Erro ao listar jobs:', error);
          res.status(500).json({ 
            error: 'Erro ao listar jobs',
            details: error.message 
          });
        }
      });

      // API endpoint para obter detalhes de um job específico
      this.app.get('/api/job-queue/jobs/:jobId', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const { jobId } = req.params;
          const job = await jobQueueMonitor.getJob(jobId);
          
          if (!job) {
            return res.status(404).json({ error: 'Job não encontrado' });
          }

          res.json(job);
        } catch (error) {
          logger.error(`❌ Erro ao obter job ${req.params.jobId}:`, error);
          res.status(500).json({ 
            error: 'Erro ao obter detalhes do job',
            details: error.message 
          });
        }
      });

      // API endpoint para reprocessar um job específico
      this.app.post('/api/job-queue/jobs/:jobId/retry', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const { jobId } = req.params;
          const job = await jobQueueMonitor.retryJob(jobId);
          res.json({ success: true, job });
        } catch (error) {
          logger.error(`❌ Erro ao reprocessar job ${req.params.jobId}:`, error);
          res.status(400).json({ 
            success: false,
            error: 'Erro ao reprocessar job',
            message: error.message 
          });
        }
      });

      // API endpoint para deletar um job específico
      this.app.delete('/api/job-queue/jobs/:jobId', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const { jobId } = req.params;
          await jobQueueMonitor.deleteJob(jobId);
          res.json({ success: true });
        } catch (error) {
          logger.error(`❌ Erro ao deletar job ${req.params.jobId}:`, error);
          res.status(500).json({ 
            success: false,
            error: 'Erro ao deletar job',
            details: error.message 
          });
        }
      });

      // API endpoint para reprocessar todos os jobs que falharam
      this.app.post('/api/job-queue/retry-failed', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const failedJobs = await jobQueueMonitor.getAllJobs({ status: 'failed' }, 1000, 0);
          let retriedCount = 0;

          for (const job of failedJobs) {
            try {
              if (job.attempts < job.maxAttempts) {
                await jobQueueMonitor.retryJob(job.jobId);
                retriedCount++;
              }
            } catch (error) {
              logger.warn(`⚠️ Erro ao reprocessar job ${job.jobId}:`, error.message);
            }
          }

          res.json({ success: true, retriedCount });
        } catch (error) {
          logger.error('❌ Erro ao reprocessar jobs que falharam:', error);
          res.status(500).json({ 
            success: false,
            error: 'Erro ao reprocessar jobs que falharam',
            details: error.message 
          });
        }
      });

      // API endpoint para limpar jobs concluídos antigos
      this.app.post('/api/job-queue/cleanup', async (req, res) => {
        try {
          const jobQueueMonitor = await getJobQueueMonitorLazy();
          const olderThanDays = parseInt(req.query.days) || 7;
          const cleanupResult = await jobQueueMonitor.cleanup(olderThanDays);
          
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
          
          res.json({ 
            success: true, 
            deletedCount: cleanupResult.totalCleanedCount,
            memoryCleanedCount: cleanupResult.memoryCleanedCount,
            databaseCleanedCount: cleanupResult.databaseCleanedCount,
            cutoffDate: cutoffDate.toISOString()
          });
        } catch (error) {
          logger.error('❌ Erro ao limpar jobs antigos:', error);
          res.status(500).json({ 
            success: false,
            error: 'Erro ao limpar jobs antigos',
            details: error.message 
          });
        }
      });
      
      logger.info('✅ Job queue routes successfully set up');
    } catch (error) {
      logger.error('❌ Erro ao carregar job queue monitor:', error);
    }
  }

  async setupJobQueueRoutes() {
    try {
      logger.info('🔧 Setting up job queue routes...');
      // Import job queue monitor
      const { getJobQueueMonitor } = await import('../services/jobQueueMonitor.js');
      const jobQueueMonitor = getJobQueueMonitor();

      // Job Queue Monitor page
      this.app.get('/monitorfila', (req, res) => {
        res.render('job-queue-monitor');
      });

      // API endpoint para obter estatísticas da fila
      this.app.get('/api/job-queue/stats', async (req, res) => {
        try {
          const stats = await jobQueueMonitor.getJobStats();
          res.json(stats);
        } catch (error) {
          logger.error('❌ Erro ao obter estatísticas da fila:', error);
          res.status(500).json({ 
            error: 'Erro ao obter estatísticas da fila',
            details: error.message 
          });
        }
      });

      // API endpoint para listar jobs
      this.app.get('/api/job-queue/jobs', async (req, res) => {
        try {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 20;
          const offset = (page - 1) * limit;
          
          const filter = {};
          if (req.query.status) filter.status = req.query.status;
          if (req.query.type) filter.type = req.query.type;

          const jobs = await jobQueueMonitor.getAllJobs(filter, limit, offset);
          
          // Get total count for pagination
          const totalJobs = await jobQueueMonitor.getAllJobs(filter, 10000, 0);
          const totalCount = totalJobs.length;
          const totalPages = Math.ceil(totalCount / limit);

          res.json({
            jobs,
            pagination: {
              currentPage: page,
              totalPages,
              totalCount,
              limit
            }
          });
        } catch (error) {
          logger.error('❌ Erro ao listar jobs:', error);
          res.status(500).json({ 
            error: 'Erro ao listar jobs',
            details: error.message 
          });
        }
      });

      // API endpoint para obter detalhes de um job específico
      this.app.get('/api/job-queue/jobs/:jobId', async (req, res) => {
        try {
          const { jobId } = req.params;
          const job = await jobQueueMonitor.getJob(jobId);
          
          if (!job) {
            return res.status(404).json({ error: 'Job não encontrado' });
          }

          res.json(job);
        } catch (error) {
          logger.error(`❌ Erro ao obter job ${req.params.jobId}:`, error);
          res.status(500).json({ 
            error: 'Erro ao obter detalhes do job',
            details: error.message 
          });
        }
      });

      // API endpoint para reprocessar um job específico
      this.app.post('/api/job-queue/jobs/:jobId/retry', async (req, res) => {
        try {
          const { jobId } = req.params;
          const job = await jobQueueMonitor.retryJob(jobId);
          res.json({ success: true, job });
        } catch (error) {
          logger.error(`❌ Erro ao reprocessar job ${req.params.jobId}:`, error);
          res.status(400).json({ 
            success: false,
            error: 'Erro ao reprocessar job',
            message: error.message 
          });
        }
      });

      // API endpoint para deletar um job específico
      this.app.delete('/api/job-queue/jobs/:jobId', async (req, res) => {
        try {
          const { jobId } = req.params;
          await jobQueueMonitor.deleteJob(jobId);
          res.json({ success: true });
        } catch (error) {
          logger.error(`❌ Erro ao deletar job ${req.params.jobId}:`, error);
          res.status(500).json({ 
            success: false,
            error: 'Erro ao deletar job',
            details: error.message 
          });
        }
      });

      // API endpoint para reprocessar todos os jobs que falharam
      this.app.post('/api/job-queue/retry-failed', async (req, res) => {
        try {
          const failedJobs = await jobQueueMonitor.getAllJobs({ status: 'failed' }, 1000, 0);
          let retriedCount = 0;

          for (const job of failedJobs) {
            try {
              if (job.attempts < job.maxAttempts) {
                await jobQueueMonitor.retryJob(job.jobId);
                retriedCount++;
              }
            } catch (error) {
              logger.warn(`⚠️ Erro ao reprocessar job ${job.jobId}:`, error.message);
            }
          }

          res.json({ success: true, retriedCount });
        } catch (error) {
          logger.error('❌ Erro ao reprocessar jobs que falharam:', error);
          res.status(500).json({ 
            success: false,
            error: 'Erro ao reprocessar jobs que falharam',
            details: error.message 
          });
        }
      });

      
      logger.info('✅ Job queue routes successfully set up');
    } catch (error) {
      logger.error('❌ Erro ao carregar job queue monitor:', error);
    }
  }

  async start() {
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

