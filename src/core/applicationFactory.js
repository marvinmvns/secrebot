import Scheduler from '../services/scheduler.js';
import LLMService from '../services/llmService.js';
import AudioTranscriber from '../services/audioTranscriber.js';
import TtsService from '../services/ttsService.js';
import WhisperSilentService from '../services/whisperSilentService.js';
import CryptoService from '../services/cryptoService.js';
import CryptoMLService from '../services/cryptoMLService.js';
import WhatsAppBot from './whatsAppBot.js';
import { TelegramBotService } from './telegramBot.js';
import RestAPI from '../api/restApi.js';
import ConfigService from '../services/configService.js';
import SessionService from '../services/sessionService.js';
import FlowService from '../services/flowService.js';
import FlowExecutionService from '../services/flowExecutionService.js';
import YouTubeService from '../services/youtubeService.js';
import { config, applyConfig } from '../config/config.js';
import logger from '../utils/logger.js';
import { handleError, setupGlobalErrorHandlers, gracefulShutdown } from '../utils/errorHandler.js';

export class ApplicationFactory {
  constructor(appConfig = config) {
    this.config = appConfig;
    this.services = new Map();
    this.isInitialized = false;
  }

  async createScheduler() {
    if (this.services.has('scheduler')) {
      return this.services.get('scheduler');
    }

    try {
      const scheduler = new Scheduler();
      await scheduler.connect();
      this.services.set('scheduler', scheduler);
      logger.info('Scheduler service initialized');
      return scheduler;
    } catch (error) {
      throw handleError(error, 'Scheduler initialization');
    }
  }

  async createConfigService(scheduler) {
    if (this.services.has('configService')) {
      return this.services.get('configService');
    }

    try {
      const configService = new ConfigService(scheduler.db);
      const dbConfig = await configService.init();
      applyConfig(dbConfig);
      
      this.services.set('configService', configService);
      logger.info('Configuration service initialized');
      return configService;
    } catch (error) {
      throw handleError(error, 'ConfigService initialization');
    }
  }

  async createSessionService(scheduler) {
    if (this.services.has('sessionService')) {
      return this.services.get('sessionService');
    }

    try {
      const sessionService = new SessionService(scheduler.db);
      await sessionService.init();
      this.services.set('sessionService', sessionService);
      logger.info('Session service initialized');
      return sessionService;
    } catch (error) {
      throw handleError(error, 'SessionService initialization');
    }
  }


  createLLMService(configService = null, sessionService = null) {
    if (this.services.has('llmService')) {
      return this.services.get('llmService');
    }

    const llmService = new LLMService(configService, sessionService);
    this.services.set('llmService', llmService);
    logger.info('LLM service initialized');
    return llmService;
  }

  createAudioTranscriber(configService, llmService) {
    if (this.services.has('audioTranscriber')) {
      return this.services.get('audioTranscriber');
    }

    const transcriber = new AudioTranscriber(configService, llmService);
    this.services.set('audioTranscriber', transcriber);
    logger.info('Audio transcriber service initialized with configService and llmService');
    return transcriber;
  }

  async createTtsService() {
    if (this.services.has('ttsService')) {
      return this.services.get('ttsService');
    }

    const ttsService = new TtsService(this.config);
    await ttsService.initialize(); // Initialize with loaded config
    this.services.set('ttsService', ttsService);
    logger.info('TTS service initialized');
    return ttsService;
  }

  createWhisperSilentService() {
    if (this.services.has('whisperSilentService')) {
      return this.services.get('whisperSilentService');
    }

    const whisperSilentService = new WhisperSilentService();
    this.services.set('whisperSilentService', whisperSilentService);
    logger.info('WhisperSilent service initialized');
    return whisperSilentService;
  }

  createCryptoService(llmService) {
    if (this.services.has('cryptoService')) {
      return this.services.get('cryptoService');
    }

    const cryptoService = new CryptoService(llmService);
    this.services.set('cryptoService', cryptoService);
    logger.info('Crypto service initialized');
    return cryptoService;
  }

  createCryptoMLService(cryptoService) {
    if (this.services.has('cryptoMLService')) {
      return this.services.get('cryptoMLService');
    }

    const cryptoMLService = new CryptoMLService(cryptoService);
    this.services.set('cryptoMLService', cryptoMLService);
    logger.info('Crypto ML service initialized');
    return cryptoMLService;
  }

  async createWhatsAppBot(scheduler, llmService, transcriber, ttsService, whisperSilentService, cryptoService, sessionService, configService) {
    if (this.services.has('whatsAppBot')) {
      return this.services.get('whatsAppBot');
    }

    try {
      const bot = new WhatsAppBot(scheduler, llmService, transcriber, ttsService, whisperSilentService, cryptoService, sessionService, configService);
      await bot.initialize();
      
      // Criar e configurar FlowService  
      const flowService = new FlowService(scheduler.db);
      await flowService.init();
      bot.setFlowService(flowService);
      
      // Criar e configurar FlowExecutionService
      const flowExecutionService = new FlowExecutionService(bot, llmService);
      await flowExecutionService.init(flowService);
      bot.setFlowExecutionService(flowExecutionService);
      
      this.services.set('whatsAppBot', bot);
      this.services.set('flowService', flowService);
      this.services.set('flowExecutionService', flowExecutionService);
      logger.info('WhatsApp bot initialized with FlowService, FlowExecutionService and SessionService');
      return bot;
    } catch (error) {
      logger.warn('WhatsApp bot não pôde ser inicializado, mas outros serviços continuam funcionando', {
        error: error.message
      });
      // Criar um bot mock para manter a aplicação funcionando
      const mockBot = {
        getClient: () => null,
        getScheduler: () => scheduler,
        llmService,
        transcriber,
        ttsService,
        whisperSilentService,
        toggleVoicePreference: () => false,
        setFlowService: () => {},
        setFlowExecutionService: () => {},
        setCryptoMLService: () => {}
      };
      
      // Criar FlowService e FlowExecutionService mesmo com bot mock
      try {
        const flowService = new FlowService(scheduler.db);
        await flowService.init();
        
        const flowExecutionService = new FlowExecutionService(mockBot, llmService);
        await flowExecutionService.init(flowService);
        
        this.services.set('flowService', flowService);
        this.services.set('flowExecutionService', flowExecutionService);
        logger.info('FlowService e FlowExecutionService inicializados com bot mock');
      } catch (flowError) {
        logger.error('Erro ao inicializar FlowService com bot mock:', flowError);
      }
      
      this.services.set('whatsAppBot', mockBot);
      return mockBot;
    }
  }

  async createTelegramBot(llmService = null) {
    if (this.services.has('telegramBot')) {
      return this.services.get('telegramBot');
    }

    try {
      if (!config.telegram?.botToken) {
        logger.info('Telegram bot token não configurado. Bot do Telegram será omitido.');
        return null;
      }

      // Validate token format
      if (!this.isValidTelegramToken(config.telegram.botToken)) {
        logger.error('Token do Telegram inválido. Formato esperado: nnnnnnnnnn:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', {
          tokenProvided: config.telegram.botToken !== 'seu_token_aqui' ? 'SIM' : 'NÃO (placeholder)'
        });
        return null;
      }

      const telegramBot = new TelegramBotService(llmService);
      
      // Wait for initialization to complete
      try {
        await telegramBot.waitForInitialization();
        
        if (!telegramBot.isActive()) {
          throw new Error('Bot do Telegram falhou ao inicializar - verifique o token e conectividade');
        }
      } catch (initError) {
        // Se a inicialização falhar, registre o erro e relance
        logger.error('Erro durante inicialização do Telegram bot:', initError);
        throw initError;
      }

      this.services.set('telegramBot', telegramBot);
      logger.info('Telegram bot initialized');
      return telegramBot;
    } catch (error) {
      logger.error('Erro ao inicializar bot do Telegram:', {
        error: error.message,
        stack: error.stack,
        token: config.telegram?.botToken ? 'CONFIGURADO' : 'NÃO CONFIGURADO',
        tokenValid: config.telegram?.botToken ? this.isValidTelegramToken(config.telegram.botToken) : false
      });
      throw new Error(`Falha na inicialização do bot Telegram: ${error.message}`);
    }
  }

  isValidTelegramToken(token) {
    // Telegram bot tokens follow the format: nnnnnnnnnn:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    const telegramTokenRegex = /^\d{8,10}:[a-zA-Z0-9_-]{35}$/;
    return telegramTokenRegex.test(token);
  }

  // Inicialização assíncrona do Telegram (não bloqueia outros serviços)
  async initializeJobQueue(transcriber, llmService) {
    try {
      logger.info('Inicializando fila de jobs...');
      
      const { getJobQueueWrapper } = await import('../services/jobQueueWrapper.js');
      const jobQueueWrapper = getJobQueueWrapper();
      
      // Process any pending jobs from previous runs
      await jobQueueWrapper.processPendingJobs(transcriber, llmService);
      
      this.services.set('jobQueueWrapper', jobQueueWrapper);
      logger.info('🎯 Fila de jobs inicializada e jobs pendentes processados');
    } catch (error) {
      logger.warn('Fila de jobs não pôde ser inicializada, mas outros serviços continuam funcionando', {
        error: error.message
      });
    }
  }

  async initializeTelegramAsync() {
    try {
      logger.info('Inicializando bot do Telegram em segundo plano...');
      const llmService = this.services.get('llmService');
      const telegramBot = await this.createTelegramBot(llmService);
      
      if (telegramBot && telegramBot.isActive()) {
        logger.info('Bot do Telegram ativo e pronto para uso');
      }
    } catch (error) {
      logger.warn('Bot do Telegram não pôde ser inicializado, mas outros serviços continuam funcionando', {
        error: error.message
      });
    }
  }

  createRestAPI(bot, configService) {
    if (this.services.has('restAPI')) {
      return this.services.get('restAPI');
    }

    const flowExecutionService = this.services.get('flowExecutionService');
    const api = new RestAPI(bot, configService, flowExecutionService);
    this.services.set('restAPI', api);
    logger.info('REST API initialized');
    return api;
  }

  async initializeApplication() {
    if (this.isInitialized) {
      return this.getServices();
    }

    try {
      logger.banner('WhatsApp Bot Assistant', 'Versão 2.1 - Com Voz');
      logger.startup('Inicializando aplicação...');

      setupGlobalErrorHandlers();

      const scheduler = await this.createScheduler();
      const configService = await this.createConfigService(scheduler);
      const sessionService = await this.createSessionService(scheduler);
      const llmService = this.createLLMService(configService, sessionService);
      const transcriber = this.createAudioTranscriber(configService, llmService);
      const ttsService = this.createTtsService();
      const whisperSilentService = this.createWhisperSilentService();
      const cryptoService = this.createCryptoService(llmService);
      const cryptoMLService = this.createCryptoMLService(cryptoService);
      
      // Configure YouTubeService to use the parametrized transcriber
      YouTubeService.setTranscriber(transcriber);
      logger.debug('🔧 YouTubeService configured with parametrized AudioTranscriber');
      const bot = await this.createWhatsAppBot(scheduler, llmService, transcriber, ttsService, whisperSilentService, cryptoService, sessionService, configService);
      bot.setCryptoMLService(cryptoMLService);
      const api = this.createRestAPI(bot, configService);

      // Initialize job queue and process pending jobs
      await this.initializeJobQueue(transcriber, llmService);

      // Start the REST API server
      await api.start();

      // Inicializar Telegram em paralelo (não bloqueia outros serviços)
      this.initializeTelegramAsync();

      this.setupGracefulShutdown();
      this.isInitialized = true;

      logger.success('Aplicação iniciada com sucesso!');
      logger.info('Escaneie o QR Code para conectar o WhatsApp (se necessário)');

      return this.getServices();
    } catch (error) {
      logger.error('Erro fatal na inicialização', error);
      throw error;
    }
  }

  getServices() {
    return {
      scheduler: this.services.get('scheduler'),
      configService: this.services.get('configService'),
      llmService: this.services.get('llmService'),
      audioTranscriber: this.services.get('audioTranscriber'),
      ttsService: this.services.get('ttsService'),
      whisperSilentService: this.services.get('whisperSilentService'),
      cryptoService: this.services.get('cryptoService'),
      cryptoMLService: this.services.get('cryptoMLService'),
      whatsAppBot: this.services.get('whatsAppBot'),
      telegramBot: this.services.get('telegramBot'),
      restAPI: this.services.get('restAPI'),
      flowExecutionService: this.services.get('flowExecutionService')
    };
  }

  setupGracefulShutdown() {
    const resources = Array.from(this.services.values()).filter(
      service => service && typeof service.disconnect === 'function'
    );

    process.on('SIGINT', () => gracefulShutdown('SIGINT', resources));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM', resources));
  }

  async startAPI() {
    const { restAPI } = this.getServices();
    if (restAPI && typeof restAPI.start === 'function') {
      restAPI.start();
      logger.info('REST API server started');
    }
  }

  async shutdown() {
    logger.info('Shutting down application...');
    
    const resources = Array.from(this.services.values()).filter(
      service => service && typeof service.disconnect === 'function'
    );

    await Promise.all(resources.map(async (resource) => {
      try {
        await resource.disconnect();
      } catch (error) {
        logger.error('Error disconnecting resource', error);
      }
    }));

    this.services.clear();
    this.isInitialized = false;
    logger.success('Application shutdown completed');
  }
}