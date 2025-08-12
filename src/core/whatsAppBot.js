import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';

import Utils from '../utils/index.js';
import logger from '../utils/logger.js';
import {
  CONFIG,
  COMMANDS,
  NUMERIC_SHORTCUTS,
  CHAT_MODES,
  NAVIGATION_STATES,
  MENU_MESSAGE,
  ERROR_MESSAGES,
  HELP_GUIDE,
  __dirname
} from '../config/index.js';

import { getMetricsService } from '../services/metricsService.js';

// Import handlers for modular architecture
import CommandHandler from '../handlers/commandHandler.js';
import MessageProcessor from '../handlers/messageProcessor.js';
import MenuNavigationHandler from '../handlers/menuNavigationHandler.js';
import FlowHandler from '../handlers/flowHandler.js';
import CryptoHandler from '../handlers/cryptoHandler.js';
import AudioTranscriptionHandler from '../handlers/audioTranscriptionHandler.js';
import VideoSummaryHandler from '../handlers/videoSummaryHandler.js';
import ScheduleHandler from '../handlers/scheduleHandler.js';
import LinkedInHandler from '../handlers/linkedinHandler.js';
import ModelManagementHandler from '../handlers/modelManagementHandler.js';
import DocumentHandler from '../handlers/documentHandler.js';
import ApiStatusHandler from '../handlers/apiStatusHandler.js';
import EndpointHandler from '../handlers/endpointHandler.js';
import FlowManagementHandler from '../handlers/flowManagementHandler.js';
import UtilityHandler from '../handlers/utilityHandler.js';
import AISubmenuHandler from '../handlers/aiSubmenuHandler.js';
import ImageHandler from '../handlers/imageHandler.js';
import SystemHandler from '../handlers/systemHandler.js';

// ============ Bot do WhatsApp ============
class WhatsAppBot {
  // CORREÇÃO: Adicionar ttsService ao construtor e atribuí-lo
  constructor(scheduler, llmService, transcriber, ttsService, whisperSilentService, cryptoService, sessionService, configService) {
    this.scheduler = scheduler;
    this.llmService = llmService;
    this.transcriber = transcriber;
    this.ttsService = ttsService; // CORREÇÃO: Atribuir o serviço TTS
    this.whisperSilentService = whisperSilentService;
    this.cryptoService = cryptoService;
    this.sessionService = sessionService;
    this.configService = configService;
    this.metricsService = getMetricsService();
    this.chatModes = new Map(); // Mantém cache local para performance
    this.navigationStates = new Map(); // Para navegação hierárquica
    this.userPreferences = new Map(); // Para armazenar preferências (ex: { voiceResponse: true/false })
    this.linkedinSessions = new Map(); // contato -> li_at
    this.awaitingLinkedinCreds = new Map();
    this.sessions = new Map(); // Para armazenar sessões de usuário (endpoint específico, etc.)
    this.flowExecutionService = null; // Será definido pelo ApplicationFactory
    
    // Initialize handlers
    this.commandHandler = new CommandHandler(this);
    this.messageProcessor = new MessageProcessor(this);
    this.menuNavigationHandler = new MenuNavigationHandler(this);
    this.flowHandler = new FlowHandler(this);
    this.cryptoHandler = new CryptoHandler(this);
    this.audioTranscriptionHandler = new AudioTranscriptionHandler(this);
    this.videoSummaryHandler = new VideoSummaryHandler(this);
    this.scheduleHandler = new ScheduleHandler(this);
    this.linkedinHandler = new LinkedInHandler(this);
    this.modelManagementHandler = new ModelManagementHandler(this);
    this.documentHandler = new DocumentHandler(this);
    this.apiStatusHandler = new ApiStatusHandler(this);
    this.endpointHandler = new EndpointHandler(this);
    this.flowManagementHandler = new FlowManagementHandler(this);
    this.utilityHandler = new UtilityHandler(this);
    this.aiSubmenuHandler = new AISubmenuHandler(this);
    this.imageHandler = new ImageHandler(this);
    this.systemHandler = new SystemHandler(this);
    
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth/'
      }),
      puppeteer: {
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      },
      // ffmpegPath: '/usr/bin/ffmpeg', // Descomentar se necessário para áudio opus
    });
    this.setupEvents();
    
    // Inicializar alertas crypto se disponível
    if (this.cryptoService) {
      this.cryptoHandler.startCryptoAlertsTimer();
    }
  }

  setupEvents() {
    // Setup all WhatsApp client events
    this.client.on('qr', qr => {
      logger.info('🔍 QR Code gerado. Escaneie com o WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', () => {
      logger.success('✅ WhatsApp Client está pronto!');
      logger.success('🤖 SecreBot está funcionando!');
    });

    this.client.on('message_create', msg => {
      if (!msg.fromMe) {
        this.handleMessage(msg);
      }
    });

    this.client.on('auth_failure', msg => {
      logger.error('❌ Falha na autenticação', msg);
    });

    this.client.on('disconnected', (reason) => {
      logger.warn('📱 Cliente desconectado:', reason);
    });
  }

  async processDeepMessage(contactId, text) {
    try {
      // Delegate to LLM service
      await this.sendResponse(contactId, '🤔 Pensando...', true);
      const response = await this.llmService.getAssistantResponse(contactId, text);
      await this.sendResponse(contactId, response);
    } catch (error) {
      logger.error('❌ Erro no processamento deep:', error);
      await this.sendErrorMessage(contactId, 'Erro ao processar mensagem com IA.');
    }
  }

  // Flow management methods (delegated to flowHandler)
  async hasActiveFlow(contactId) {
    return await this.flowHandler.hasActiveFlow(contactId);
  }

  async processFlowMessage(contactId, text) {
    return await this.flowHandler.processFlowMessage(contactId, text);
  }

  async startFlow(contactId, flowId, initialMessage = '') {
    return await this.flowHandler.startFlow(contactId, flowId, initialMessage);
  }

  async stopFlow(contactId) {
    return await this.flowHandler.stopFlow(contactId);
  }

  async initialize() {
    try {
      logger.info('🚀 Inicializando WhatsApp Client...');
      await this.client.initialize();
      
      // Load active sessions after initialization
      await this.loadActiveSessions();
      
      // Check for restart notification
      await this.checkForRestartNotification();
      
    } catch (error) {
      logger.error('❌ Erro ao inicializar WhatsApp Client:', error);
      throw error;
    }
  }

  async loadActiveSessions() {
    try {
      // Load active chat modes from session service
      const sessions = await this.sessionService?.loadActiveSessions?.() || [];
      sessions.forEach(session => {
        this.chatModes.set(session.contactId, session.mode);
        this.navigationStates.set(session.contactId, session.navigationState);
      });
      logger.info(`📊 ${sessions.length} sessões ativas carregadas`);
    } catch (error) {
      logger.warn('⚠️ Erro ao carregar sessões ativas:', error);
    }
  }

  async checkForRestartNotification() {
    // Check for restart notification file
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const restartFile = path.join(process.cwd(), '.restart-info.json');
      
      const restartInfo = JSON.parse(await fs.readFile(restartFile, 'utf8'));
      
      // Send restart notification
      if (restartInfo.requestedBy) {
        setTimeout(async () => {
          await this.sendResponse(restartInfo.requestedBy, 
            '✅ *APLICAÇÃO REINICIADA COM SUCESSO!*\n\n' +
            '🔄 **Status:** Aplicação completamente reinicializada\n' +
            '📅 **Horário:** ' + new Date().toLocaleString('pt-BR') + '\n' +
            '⚡ **Ollama:** Modelos foram descarregados e sistema limpo\n' +
            '🔗 **Conexões:** Todas as conexões foram renovadas\n\n' +
            '🎯 **O sistema está funcionando normalmente!**', true);
        }, 5000);
      }
      
      // Delete restart info file
      await fs.unlink(restartFile);
      logger.success('✅ Notificação de restart enviada');
      
    } catch (error) {
      // File doesn't exist or error reading it - normal case
      if (error.code !== 'ENOENT') {
        logger.warn('⚠️ Erro ao verificar restart info:', error.message);
      }
    }
  }

  // Session and state management
  async getCurrentMode(contactId) {
    try {
      // Try from cache first
      if (this.chatModes.has(contactId)) {
        return this.chatModes.get(contactId);
      }
      
      // Load from session service
      const session = await this.sessionService?.getSession?.(contactId);
      if (session?.mode) {
        this.chatModes.set(contactId, session.mode);
        return session.mode;
      }
      
      return null;
    } catch (error) {
      logger.warn(`⚠️ Erro ao obter modo atual para ${contactId}:`, error);
      return null;
    }
  }

  async setMode(contactId, mode) {
    try {
      // Update cache
      if (mode === null) {
        this.chatModes.delete(contactId);
      } else {
        this.chatModes.set(contactId, mode);
      }
      
      // Persist to session service
      await this.sessionService?.setSession?.(contactId, { mode });
      
      logger.debug(`🔄 Modo alterado para ${contactId}: ${mode || 'null'}`);
    } catch (error) {
      logger.warn(`⚠️ Erro ao definir modo para ${contactId}:`, error);
    }
  }

  async getNavigationState(contactId) {
    try {
      // Try from cache first
      if (this.navigationStates.has(contactId)) {
        return this.navigationStates.get(contactId);
      }
      
      // Load from session service
      const session = await this.sessionService?.getSession?.(contactId);
      if (session?.navigationState) {
        this.navigationStates.set(contactId, session.navigationState);
        return session.navigationState;
      }
      
      return null;
    } catch (error) {
      logger.warn(`⚠️ Erro ao obter estado de navegação para ${contactId}:`, error);
      return null;
    }
  }

  async setNavigationState(contactId, state) {
    try {
      // Update cache
      if (state === null) {
        this.navigationStates.delete(contactId);
      } else {
        this.navigationStates.set(contactId, state);
      }
      
      // Persist to session service
      await this.sessionService?.setSession?.(contactId, { navigationState: state });
      
      logger.debug(`🧭 Estado de navegação alterado para ${contactId}:`, state);
    } catch (error) {
      logger.warn(`⚠️ Erro ao definir estado de navegação para ${contactId}:`, error);
    }
  }

  // Navigation delegation methods
  async handleHierarchicalNavigation(msg, contactId, text, navigationState) {
    return await this.menuNavigationHandler.handleHierarchicalNavigation(msg, contactId, text, navigationState);
  }

  async handleSubmenuNavigation(msg, contactId, numericInput, navigationState) {
    return await this.menuNavigationHandler.handleSubmenuNavigation(msg, contactId, numericInput, navigationState);
  }

  async handleIASubmenu(msg, contactId, input) {
    // Delegate to AI submenu handler
    return await this.aiSubmenuHandler.handleIASubmenu(msg, contactId, input);
  }

  async handleMidiaSubmenu(msg, contactId, input) {
    // Delegate to AI submenu handler
    return await this.aiSubmenuHandler.handleMidiaSubmenu(msg, contactId, input);
  }

  async handleProfissionalSubmenu(msg, contactId, input) {
    // Delegate to AI submenu handler
    return await this.aiSubmenuHandler.handleProfissionalSubmenu(msg, contactId, input);
  }

  async handleConfigSubmenu(msg, contactId, input) {
    // Delegate to AI submenu handler
    return await this.aiSubmenuHandler.handleConfigSubmenu(msg, contactId, input);
  }

  async handleSuporteSubmenu(msg, contactId, input) {
    // Delegate to AI submenu handler
    return await this.aiSubmenuHandler.handleSuporteSubmenu(msg, contactId, input);
  }

  async handleCryptoSubmenu(msg, contactId, input) {
    // Delegate to crypto handler
    return await this.cryptoHandler.handleCryptoSubmenu(msg, contactId, input);
  }

  async showSubmenu(contactId, submenuType) {
    // Delegate to menu navigation handler
    return await this.menuNavigationHandler.showSubmenu(contactId, submenuType);
  }

  // Métodos auxiliares para navegação por áudio - delegados ao handler
  getCommandDescription(command) {
    return this.menuNavigationHandler.getCommandDescription(command);
  }

  getSubmenuDescription(submenu) {
    return this.menuNavigationHandler.getSubmenuDescription(submenu);
  }

  async trySubmenuNavigation(transcription, navigationState) {
    return await this.menuNavigationHandler.trySubmenuNavigation(transcription, navigationState);
  }

  // Método unificado para enviar respostas (texto ou voz)
  async sendResponse(contactId, textContent, forceText = false) {
    const useVoice = this.getUserPreference(contactId, 'voiceResponse', false) && !forceText;

    logger.debug(`[sendResponse] contactId: ${contactId}, useVoice: ${useVoice}, forceText: ${forceText}`);
    logger.debug(`[sendResponse] ttsService available: ${!!this.ttsService}, ttsService.client: ${!!this.ttsService?.client}, ttsService.piperEnabled: ${!!this.ttsService?.piperEnabled}`);

    if (useVoice && this.ttsService && (this.ttsService.client || this.ttsService.piperEnabled)) { // Verifica também Piper
      try {
        logger.service(`🗣️ Gerando resposta em áudio para ${contactId}...`);
        const audioBuffer = await this.ttsService.generateAudio(textContent);
        const audioBase64 = audioBuffer.toString('base64');
        // Tentar enviar como audio/ogg (opus) primeiro, pode ser mais compatível
        const media = new MessageMedia('audio/ogg; codecs=opus', audioBase64, 'response.ogg');
        await this.client.sendMessage(contactId, media, { sendAudioAsVoice: true });
        logger.success(`✅ Áudio enviado para ${contactId}`);
      } catch (ttsError) {
        logger.error(`❌ Erro ao gerar/enviar áudio TTS para ${contactId}`, ttsError);
        // Fallback para texto se TTS falhar
        await this.client.sendMessage(contactId, ERROR_MESSAGES.TTS_FAILED); // Envia erro em texto
        await this.client.sendMessage(contactId, textContent); // Envia conteúdo original em texto
      }
    } else {
      // Enviar como texto se a preferência for texto, se TTS falhou na inicialização, ou se forçado
      logger.debug(`[sendResponse] Enviando como texto para ${contactId}. useVoice: ${useVoice}, ttsService: ${!!this.ttsService}`);
      await this.client.sendMessage(contactId, textContent);
    }
  }

  // Método para enviar mensagens de erro (usa sendResponse)
  async sendErrorMessage(contactId, message, forceText = false) {
      await this.sendResponse(contactId, message, forceText);
  }

  async handleMessage(msg) {
    const contactId = msg.from;
    const text = msg.body?.trim() || '';

    logger.verbose(`💬 Mensagem de ${contactId}: ${text || '[Mídia]'}`);

    // Record user activity metrics
    if (this.metricsService.enabled) {
      this.metricsService.recordWhatsAppMessage(contactId, msg.type || 'text', text?.startsWith('!'));
    }

    // Delegate to MessageProcessor for modular handling
    const processed = await this.messageProcessor.processMessage(msg);
    if (processed) {
      return;
    }

    // Check if user has navigation state - if so, avoid legacy processing
    const navigationState = await this.getNavigationState(contactId);
    if (navigationState) {
      // Already processed by MessageProcessor, avoid duplicate processing
      return;
    }

    // Fallback to original handling for backward compatibility
    await this.handleMessageLegacy(msg);
  }

  async handleMessageLegacy(msg) {
    const contactId = msg.from;
    const text = msg.body?.trim() || '';
    const lowerText = text.toLowerCase();

    // Verificar se o usuário está respondendo a uma sugestão de resumo de áudio (modo geral)
    const awaitingSummarization = this.getUserPreference(contactId, 'awaitingSummarizationResponse', null);
    if (awaitingSummarization && text === '1') {
      // Usuário quer resumir o último áudio
      this.setUserPreference(contactId, 'awaitingSummarizationResponse', null);
      await this.sendResponse(contactId, '🤔 Analisando e resumindo o áudio...', true);
      try {
        const audioPath = awaitingSummarization.audioPath;
        const transcript = awaitingSummarization.transcript;
        
        // Resumir usando LLM
        const summary = await this.llmService.summarizeText(transcript);
        await this.sendResponse(contactId, `📝 *Resumo do áudio:*\n\n${summary}`);
        
        logger.success(`✅ Áudio resumido para ${contactId}`);
      } catch (error) {
        logger.error('❌ Erro ao resumir áudio:', error);
        await this.sendResponse(contactId, '❌ Erro ao resumir o áudio. Tente novamente.');
      }
      return;
    }

    // Verificar se user está em um flow ativo
    if (await this.hasActiveFlow(contactId)) {
      await this.processFlowMessage(contactId, text);
      return;
    }

    // Verificar modo atual antes de processar
    const currentMode = await this.getCurrentMode(contactId);
    
    // Se estiver em modo específico, processar por modo
    if (currentMode) {
      await this.processMessageByMode(contactId, text, msg);
      return;
    }

    // Verificar navegação hierárquica
    const navigationState = await this.getNavigationState(contactId);
    if (navigationState) {
      const handled = await this.menuNavigationHandler.handleNavigation(msg, contactId, text);
      if (handled) {
        return;
      }
    }

    // Se for comando (começa com !)
    if (text.startsWith('!')) {
      await this.handleCommand(msg, contactId, lowerText, text);
      return;
    }

    // Se for entrada numérica simples
    if (/^[0-9]+(\.[0-9]+)*$/.test(text)) {
      const handled = await this.handleHierarchicalNavigation(msg, contactId, text, navigationState);
      if (handled) {
        return;
      }
    }

    // Se for imagem
    if (msg.hasMedia && (msg.type === 'image' || (msg._data.mimetype && msg._data.mimetype.startsWith('image/')))) {
      await this.handleImageMessage(msg, contactId, lowerText);
      return;
    }

    // Se for áudio
    if (msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio' || (msg._data.mimetype && msg._data.mimetype.startsWith('audio/')))) {
      await this.audioTranscriptionHandler.handleAudioMessage(msg, contactId);
      return;
    }

    // Texto livre - processar como navegação por texto ou comando de IA
    if (text.length > 0) {
      // Tentar processar como navegação por texto primeiro
      if (navigationState) {
        const handled = await this.processTextNavigation(msg, contactId, text, navigationState);
        if (handled) {
          return;
        }
      }

      // Se não está em navegação, processar como comando de IA
      await this.processDeepMessage(contactId, text);
      return;
    }

    // Caso padrão - mostrar menu
    await this.sendResponse(contactId, MENU_MESSAGE);
  }

  async handleCommand(msg, contactId, lowerText, originalText) {
    try {
      // Map of commands to handler methods
      const commandMap = {
        [COMMANDS.MENU]: () => this.sendResponse(contactId, MENU_MESSAGE),
        [COMMANDS.AJUDA]: () => this.sendResponse(contactId, HELP_GUIDE),
        [COMMANDS.DEEP]: () => this.handleDeepCommand(contactId, originalText),
        [COMMANDS.AGENDA]: () => this.scheduleHandler.handleAgendaCommand(contactId),
        [COMMANDS.LISTAR]: () => this.scheduleHandler.handleListarCommand(contactId),
        [COMMANDS.DELETAR]: () => this.scheduleHandler.handleDeletarCommand(contactId),
        [COMMANDS.TRANSCREVER]: () => this.setMode(contactId, CHAT_MODES.TRANSCRICAO),
        [COMMANDS.TRANSCREVER_RESUMIR]: () => this.setMode(contactId, CHAT_MODES.TRANSCREVER_RESUMIR),
        [COMMANDS.RESUMIR]: () => this.setMode(contactId, CHAT_MODES.RESUMIR),
        [COMMANDS.RESUMIRVIDEO]: () => this.videoSummaryHandler.handleResumirvideo1Command(contactId),
        [COMMANDS.RESUMIRVIDEO + ' v2']: () => this.videoSummaryHandler.handleResumirvideo2Command(contactId),
        [COMMANDS.FOTO]: () => this.imageHandler.handleFotoCommand(contactId),
        [COMMANDS.CALORIAS]: () => this.setMode(contactId, CHAT_MODES.CALORIAS),
        [COMMANDS.LINKEDIN]: () => this.linkedinHandler.handleLinkedInCommand(contactId, originalText),
        [COMMANDS.CRYPTO]: () => this.cryptoHandler.handleCryptoCommand(contactId, originalText),
        [COMMANDS.VOZ]: () => this.handleVozCommand(contactId),
        [COMMANDS.TTS_CONFIG]: () => this.handleTTSConfigCommand(contactId),
        [COMMANDS.RECURSO]: () => this.handleRecursoCommand(contactId),
        [COMMANDS.CHOOSE_MODEL]: () => this.modelManagementHandler.handleChooseModelCommand(contactId),
        [COMMANDS.CHOOSE_WHISPER_ENDPOINT]: () => this.endpointHandler.handleChooseWhisperEndpointCommand(contactId),
        [COMMANDS.LISTAR_ENDPOINTS_WHISPER]: () => this.endpointHandler.handleListarEndpointsWhisperCommand(contactId),
        [COMMANDS.LISTAR_ENDPOINTS_OLLAMA]: () => this.endpointHandler.handleListarEndpointsOllamaCommand(contactId),
        [COMMANDS.STATUS_ENDPOINTS]: () => this.apiStatusHandler.handleStatusEndpointsCommand(contactId),
        [COMMANDS.FLOW]: () => this.flowHandler.handleFlowCommand(msg, contactId, originalText),
        [COMMANDS.VOLTAR]: () => this.menuNavigationHandler.handleBackCommand(contactId, null)
      };

      // Check for exact command match first
      if (commandMap[lowerText]) {
        await commandMap[lowerText]();
        return;
      }

      // Check for parameterized commands
      for (const [command, handler] of Object.entries(commandMap)) {
        if (lowerText.startsWith(command + ' ')) {
          await handler();
          return;
        }
      }

      logger.warn(`⚠️ Comando ${lowerText} não encontrado nos handlers.`);
      await this.sendResponse(contactId, MENU_MESSAGE);
    } catch (error) {
      logger.error(`❌ Erro ao processar comando ${lowerText}:`, error);
      await this.sendErrorMessage(contactId, 'Erro ao processar comando.');
    }
  }

  async handleDeepCommand(contactId, originalText) {
    // Delegate to utility handler
    return await this.utilityHandler.handleDeepCommand(contactId, originalText);
  }

  async handleRecursoCommand(contactId) {
    // Delegate to utility handler
    return await this.utilityHandler.handleRecursoCommand(contactId);
  }

  async handleVozCommand(contactId) {
    // Delegate to system handler
    return await this.systemHandler.handleVozCommand(contactId);
  }

  async handleTTSConfigCommand(contactId) {
    // Delegate to system handler
    return await this.systemHandler.handleTTSConfigCommand(contactId);
  }

  async handleImageMessage(msg, contactId, lowerText) {
    // Delegate to image handler
    return await this.imageHandler.handleImageMessage(msg, contactId, lowerText);
  }

  async processAudioNavigation(msg, contactId, transcription, navigationState) {
    // Delegate to menu navigation handler
    return await this.menuNavigationHandler.processAudioNavigation(msg, contactId, transcription, navigationState);
  }

  async processTextNavigation(msg, contactId, text, navigationState) {
    // Delegate to menu navigation handler
    return await this.menuNavigationHandler.processTextNavigation(msg, contactId, text, navigationState);
  }

  async processMessageByMode(contactId, text, msg) {
    const currentMode = await this.getCurrentMode(contactId);
    logger.flow(`🔄 Processando mensagem no modo ${currentMode} para ${contactId}`);
    if (!currentMode) {
      await this.sendResponse(contactId, MENU_MESSAGE);
      return;
    }
    switch (currentMode) {
      case CHAT_MODES.ASSISTANT:
        await this.sendResponse(contactId, '🤔 Pensando...', true);
        const assistantResponse = await this.llmService.getAssistantResponse(contactId, text);
        await this.sendResponse(contactId, assistantResponse);
        break;
      case CHAT_MODES.TRANSCRICAO:
        await this.sendResponse(contactId, ERROR_MESSAGES.AUDIO_REQUIRED);
        break;
      case CHAT_MODES.TRANSCREVER_RESUMIR:
        await this.sendResponse(contactId, ERROR_MESSAGES.AUDIO_REQUIRED);
        break;
      case CHAT_MODES.LINKEDIN:
        await this.linkedinHandler.processLinkedInMessage(contactId, text);
        break;
      case CHAT_MODES.DELETAR:
      case 'DELETE_SCHEDULE':
        await this.scheduleHandler.processDeleteScheduleMessage(contactId, text);
        break;
      case 'CONFIRM_DELETE_SCHEDULE':
        await this.scheduleHandler.processConfirmDeleteScheduleMessage(contactId, text);
        break;
      case 'IMPORT_CALENDAR':
        await this.scheduleHandler.processImportCalendarMessage(msg, contactId);
        break;
      case 'VIDEO_SUMMARY':
        await this.videoSummaryHandler.processVideoSummaryMessage(contactId, text, 'v1');
        break;
      case 'VIDEO_SUMMARY_V2':
        await this.videoSummaryHandler.processVideoSummaryMessage(contactId, text, 'v2');
        break;
      case CHAT_MODES.SCHEDULER:
        await this.scheduleHandler.processSchedulerMessage(contactId, text);
        break;
      case CHAT_MODES.TRANSCRIBE:
      case CHAT_MODES.TRANSCRICAO:
        // Audio mode handled in audioTranscriptionHandler.handleAudioMessage
        await this.sendResponse(contactId, '🎤 Aguardando áudio para transcrever...');
        break;
      case CHAT_MODES.TRANSCRIBE_SUMMARIZE:
      case CHAT_MODES.TRANSCREVER_RESUMIR:
        // Audio mode handled in audioTranscriptionHandler.handleAudioMessage  
        await this.sendResponse(contactId, '🎤 Aguardando áudio para transcrever e resumir...');
        break;
      case CHAT_MODES.AGENDABOT:
        await this.processAgendabotMessage(contactId, text);
        break;
      case CHAT_MODES.RESUMIR:
        await this.documentHandler.processResumarMessage(contactId, text, msg);
        break;
      case CHAT_MODES.TROCAR_MODELO:
        await this.modelManagementHandler.processTrocarModeloMessage(contactId, text);
        break;
      case CHAT_MODES.TROCAR_MODELO_WHISPER:
        await this.modelManagementHandler.processTrocarModeloWhisperMessage(contactId, text);
        break;
      case CHAT_MODES.CHOOSE_SPECIFIC_MODEL:
        await this.modelManagementHandler.processChooseSpecificModelMessage(contactId, text);
        break;
      case CHAT_MODES.CHANGE_SPECIFIC_MODEL:
        await this.modelManagementHandler.processChangeSpecificModelMessage(contactId, text);
        break;
      case CHAT_MODES.ASSISTANT_WITH_SPECIFIC_MODEL:
        await this.modelManagementHandler.processAssistantWithSpecificModelMessage(contactId, text);
        break;
      case CHAT_MODES.CHOOSE_SPECIFIC_WHISPER_ENDPOINT:
        await this.endpointHandler.processChooseSpecificWhisperEndpointMessage(contactId, text);
        break;
      case CHAT_MODES.CHANGE_SPECIFIC_WHISPER_ENDPOINT:
        await this.endpointHandler.processChangeSpecificWhisperEndpointMessage(contactId, text);
        break;
      case CHAT_MODES.TRANSCRIBE_WITH_SPECIFIC_ENDPOINT:
        await this.endpointHandler.processTranscribeWithSpecificEndpointMessage(contactId, msg);
        break;
      case CHAT_MODES.WHISPERSILENT_CONFIG:
      case 'WHISPER_SILENT_CONFIG':
        await this.audioTranscriptionHandler.processWhisperSilentConfigMessage(contactId, text);
        break;
      case 'whispersilent_search':
      case 'WHISPER_SILENT_SEARCH':
        await this.audioTranscriptionHandler.processWhisperSilentSearchMessage(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_COIN_SELECTION:
        await this.cryptoHandler.processCryptoCoinSelectionMessage(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_LLM_ANALYSIS:
        await this.cryptoHandler.handleCryptoLLMAnalysisMode(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_ML_TRAINING:
        await this.cryptoHandler.handleCryptoMLTraining(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_ML_MODEL_SELECTION:
        await this.cryptoHandler.handleCryptoMLModelSelection(contactId, text);
        break;
      case 'CRYPTO_TECHNICAL_ANALYSIS':
        await this.cryptoHandler.handleCryptoTechnicalAnalysisInput(contactId, text);
        break;
      default:
          logger.warn(`⚠️ Modo desconhecido encontrado: ${currentMode}`);
          this.setMode(contactId, null);
          await this.sendResponse(contactId, MENU_MESSAGE);
          break;
    }
  }

  async processAgendabotMessage(contactId, text) {
    // Delegate to schedule handler
    return await this.scheduleHandler.processAgendabotMessage(contactId, text);
  }

  isImageModel(modelName) {
    // Delegate to system handler
    return this.systemHandler.isImageModel(modelName);
  }

  // DEPRECATED: Função removida do menu 5.4 - funcionalidade não incluída na nova versão
  async handleReiniciarOllamaCommand(contactId) {
    // Delegate to system handler
    return await this.systemHandler.handleReiniciarOllamaCommand(contactId);
  }

  // Utility methods that remain in main class
  toggleVoicePreference(contactId) {
    const current = this.getUserPreference(contactId, 'voiceResponse', false);
    const newValue = !current;
    this.setUserPreference(contactId, 'voiceResponse', newValue);
    return newValue;
  }

  getUserPreference(contactId, key, defaultValue) {
    const prefs = this.userPreferences.get(contactId) || {};
    return prefs[key] !== undefined ? prefs[key] : defaultValue;
  }

  setUserPreference(contactId, key, value) {
    const prefs = this.userPreferences.get(contactId) || {};
    prefs[key] = value;
    this.userPreferences.set(contactId, prefs);
  }

  checkCircuitBreaker() {
    const cb = this.getVideoProcessingCircuitBreaker();
    const now = Date.now();
    
    if (cb.isOpen && (now - cb.lastFailureTime) > cb.resetTimeoutMs) {
        logger.verbose('🔄 Circuit breaker reset - tentando novamente');
        cb.isOpen = false;
        cb.failures.clear();
        return true;
    }
    
    if (cb.isOpen) {
        logger.warn(`⚠️ Circuit breaker aberto para processamento de vídeo`);
        return false;
    }
    
    return true;
  }

  getVideoProcessingCircuitBreaker() {
    // Circuit breaker implementation for video processing
    if (!this._videoCircuitBreaker) {
      this._videoCircuitBreaker = {
        failures: new Map(),
        isOpen: false,
        failureThreshold: 3,
        resetTimeoutMs: 5 * 60 * 1000, // 5 minutes
        lastFailureTime: 0
      };
    }
    return this._videoCircuitBreaker;
  }

  getMenuMessage() {
    return MENU_MESSAGE;
  }
}

export default WhatsAppBot;