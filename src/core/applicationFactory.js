import Scheduler from '../services/scheduler.js';
import LLMService from '../services/llmService.js';
import AudioTranscriber from '../services/audioTranscriber.js';
import TtsService from '../services/ttsService.js';
import WhatsAppBot from './whatsAppBot.js';
import { TelegramBotService } from './telegramBot.js';
import RestAPI from '../api/restApi.js';
import ConfigService from '../services/configService.js';
import { createFeatureToggleManager } from '../services/featureToggleService.js';
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

  async createFeatureToggleService(configService) {
    if (this.services.has('featureToggleService')) {
      return this.services.get('featureToggleService');
    }

    try {
      const featureToggleService = await createFeatureToggleManager(configService);
      this.services.set('featureToggleService', featureToggleService);
      logger.info('Feature Toggle service initialized');
      return featureToggleService;
    } catch (error) {
      throw handleError(error, 'FeatureToggleService initialization');
    }
  }

  createLLMService() {
    if (this.services.has('llmService')) {
      return this.services.get('llmService');
    }

    const llmService = new LLMService();
    this.services.set('llmService', llmService);
    logger.info('LLM service initialized');
    return llmService;
  }

  createAudioTranscriber() {
    if (this.services.has('audioTranscriber')) {
      return this.services.get('audioTranscriber');
    }

    const transcriber = new AudioTranscriber();
    this.services.set('audioTranscriber', transcriber);
    logger.info('Audio transcriber service initialized');
    return transcriber;
  }

  createTtsService() {
    if (this.services.has('ttsService')) {
      return this.services.get('ttsService');
    }

    const ttsService = new TtsService();
    this.services.set('ttsService', ttsService);
    logger.info('TTS service initialized');
    return ttsService;
  }

  async createWhatsAppBot(scheduler, llmService, transcriber, ttsService) {
    if (this.services.has('whatsAppBot')) {
      return this.services.get('whatsAppBot');
    }

    try {
      const bot = new WhatsAppBot(scheduler, llmService, transcriber, ttsService);
      await bot.initialize();
      
      this.services.set('whatsAppBot', bot);
      logger.info('WhatsApp bot initialized');
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
        toggleVoicePreference: () => false
      };
      this.services.set('whatsAppBot', mockBot);
      return mockBot;
    }
  }

  async createTelegramBot() {
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

      const telegramBot = new TelegramBotService();
      
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
  async initializeTelegramAsync() {
    try {
      logger.info('Inicializando bot do Telegram em segundo plano...');
      const telegramBot = await this.createTelegramBot();
      
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

    const api = new RestAPI(bot, configService);
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
      await this.createFeatureToggleService(configService);
      const llmService = this.createLLMService();
      const transcriber = this.createAudioTranscriber();
      const ttsService = this.createTtsService();
      const bot = await this.createWhatsAppBot(scheduler, llmService, transcriber, ttsService);
      this.createRestAPI(bot, configService);

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
      featureToggleService: this.services.get('featureToggleService'),
      llmService: this.services.get('llmService'),
      audioTranscriber: this.services.get('audioTranscriber'),
      ttsService: this.services.get('ttsService'),
      whatsAppBot: this.services.get('whatsAppBot'),
      telegramBot: this.services.get('telegramBot'),
      restAPI: this.services.get('restAPI')
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