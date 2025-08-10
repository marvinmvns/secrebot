import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs/promises';
import path from 'path';
import { Ollama } from 'ollama';
import si from 'systeminformation';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}
import mammoth from 'mammoth';

import Utils from '../utils/index.js';
import logger from '../utils/logger.js';
import {
  CONFIG,
  COMMANDS,
  NUMERIC_SHORTCUTS,
  CHAT_MODES,
  NAVIGATION_STATES,
  WHISPER_MODELS_LIST,
  MENU_MESSAGE,
  SUBMENU_MESSAGES,
  MODE_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  HELP_GUIDE,
  PROMPTS,
  __dirname
} from '../config/index.js';

// Importar o serviço TTS
import TtsService from '../services/ttsService.js';
import CalorieService from '../services/calorieService.js';
import { loginAndGetLiAt } from '../services/linkedinScraper.js';
import YouTubeService from '../services/youtubeService.js';
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
  }

  getClient() {
    return this.client;
  }

  getScheduler() {
    return this.scheduler;
  }

  // --- Métodos de Preferência do Usuário ---
  getUserPreference(contactId, key, defaultValue = false) {
    const prefs = this.userPreferences.get(contactId) || {};
    return prefs[key] === undefined ? defaultValue : prefs[key];
  }

  setUserPreference(contactId, key, value) {
    const prefs = this.userPreferences.get(contactId) || {};
    prefs[key] = value;
    this.userPreferences.set(contactId, prefs);
    logger.log(`🔧 Preferência [${key}=${value}] definida para ${contactId}`);
  }

  toggleVoicePreference(contactId) {
    const currentValue = this.getUserPreference(contactId, 'voiceResponse', false);
    this.setUserPreference(contactId, 'voiceResponse', !currentValue);
    return !currentValue; // Retorna o novo valor
  }
  // --- Fim Métodos de Preferência ---

  // --- Métodos Auxiliares para Handlers ---
  getMenuMessage() {
    return MENU_MESSAGE;
  }

  async parsePdfBuffer(buffer) {
    return await parsePdfBuffer(buffer);
  }

  async processDeepMessage(contactId, text) {
    // Delegate to the original deep processing logic
    const msg = { from: contactId, body: text, type: 'chat' };
    return await this.processMessageByMode(contactId, text, msg);
  }

  isMainCommand(lowerText) {
    return lowerText.startsWith('!') && (
      Object.values(COMMANDS).includes(lowerText) ||
      lowerText.startsWith('!flow ') ||
      lowerText.startsWith('!crypto ') ||
      lowerText.startsWith('!whisper_silent ')
    );
  }
  // --- Fim Métodos Auxiliares ---

  // --- Métodos de Flow ---
  setFlowExecutionService(flowExecutionService) {
    this.flowExecutionService = flowExecutionService;
    logger.info('🔄 FlowExecutionService configurado no WhatsAppBot');
  }

  setFlowService(flowService) {
    this.flowService = flowService;
    logger.info('🔄 FlowService configurado no WhatsAppBot');
  }

  setCryptoMLService(cryptoMLService) {
    this.cryptoMLService = cryptoMLService;
    logger.info('🤖 CryptoMLService configurado no WhatsAppBot');
  }

  async hasActiveFlow(contactId) {
    return this.flowExecutionService && this.flowExecutionService.hasActiveFlow(contactId);
  }

  async processFlowMessage(contactId, text) {
    if (!this.flowExecutionService) {
      return false;
    }
    return await this.flowExecutionService.processUserInput(contactId, text);
  }

  async startFlow(contactId, flowId, initialMessage = '') {
    if (!this.flowExecutionService) {
      return false;
    }
    
    try {
      return await this.flowExecutionService.startFlowExecution(contactId, flowId, 'manual', { initialMessage });
    } catch (error) {
      // Se o flow não foi encontrado, tentar recarregar da base de dados
      if (error.message.includes('não encontrado')) {
        logger.info(`🔄 Tentando recarregar flow '${flowId}' da base de dados...`);
        const reloaded = await this.flowExecutionService.reloadFlow(flowId);
        if (reloaded) {
          return await this.flowExecutionService.startFlowExecution(contactId, flowId, 'manual', { initialMessage });
        }
      }
      throw error;
    }
  }

  async stopFlow(contactId) {
    if (!this.flowExecutionService) {
      return false;
    }
    return await this.flowExecutionService.stopFlowExecution(contactId);
  }
  // --- Fim Métodos de Flow ---


  setupEvents() {
    this.client.on('qr', qr => {
      qrcode.generate(qr, { small: true });
      logger.info('📱 QR Code gerado. Escaneie para login.');
    });

    this.client.on('loading_screen', (percent, message) => {
      logger.info(`📲 Carregando WhatsApp: ${percent}% - ${message}`);
    });

    this.client.on('ready', () => {
      logger.info('✅ Cliente WhatsApp pronto!');
      this.startScheduler();
      this.startCryptoAlertsTimer();
    });

    this.client.on('authenticated', () => logger.info('🔐 WhatsApp autenticado.'));
    
    this.client.on('auth_failure', msg => {
      logger.error('❌ Falha na autenticação', msg);
      logger.info('🔄 Tentando reconectar em 5 segundos...');
      setTimeout(() => {
        this.client.initialize();
      }, 5000);
    });

    this.client.on('disconnected', reason => {
      logger.error('🔌 WhatsApp desconectado', reason);
      if (reason === 'LOGOUT') {
        logger.info('📱 Logout detectado - será necessário escanear QR code novamente');
      } else {
        logger.info('🔄 Tentando reconectar em 10 segundos...');
        setTimeout(() => {
          this.client.initialize();
        }, 10000);
      }
    });

    this.client.on('message', async msg => {
      try {
        // if (msg.isStatus || msg.from.includes('@g.us')) return; // Opcional: Ignorar status/grupos
        await this.handleMessage(msg);
      } catch (err) {
        logger.error('❌ Erro ao processar mensagem', err);
        if (this.client.info) {
            await this.sendResponse(msg.from, ERROR_MESSAGES.GENERIC);
        }
      }
    });
  }

  startScheduler() {
    this.scheduler.processScheduledMessages(this.client);
    setInterval(
      () => this.scheduler.processScheduledMessages(this.client),
      CONFIG.scheduler.interval
    );
    logger.info(`⏰ Scheduler iniciado com intervalo de ${CONFIG.scheduler.interval / 1000}s.`);
  }

  async initialize() {
    try {
      await this.client.initialize();
      await this.loadActiveSessions();
      
      // Verificar se foi um restart solicitado por usuário
      setTimeout(() => {
        this.checkForRestartNotification();
      }, 5000); // Aguardar 5 segundos após inicialização
      
    } catch (err) {
      logger.error('❌ Erro na inicialização do WhatsApp', err);
      throw err;
    }
  }

  async loadActiveSessions() {
    try {
      const activeSessions = await this.sessionService.getActiveSessions(7);
      logger.info(`📱 Carregando ${activeSessions.length} sessões ativas`);
      
      for (const session of activeSessions) {
        if (session.chatMode) {
          this.chatModes.set(session.phoneNumber, session.chatMode);
        }
      }
      
      logger.info(`✅ Sessões ativas carregadas no cache local`);
    } catch (error) {
      logger.error('❌ Erro ao carregar sessões ativas:', error);
    }
  }

  async checkForRestartNotification() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const restartFile = path.join(process.cwd(), '.restart-info.json');
      
      // Verificar se arquivo de restart existe
      try {
        const restartData = await fs.readFile(restartFile, 'utf8');
        const restartInfo = JSON.parse(restartData);
        
        if (restartInfo && restartInfo.requestedBy) {
          logger.flow(`📱 Notificando usuário ${restartInfo.requestedBy} sobre restart concluído`);
          
          const restartTime = new Date(restartInfo.requestedAt).toLocaleString('pt-BR');
          let message = `✅ *APLICAÇÃO REINICIADA COM SUCESSO!*\n\n`;
          message += `🔄 **Reinício solicitado em:** ${restartTime}\n`;
          message += `🎯 **Motivo:** ${restartInfo.reason === 'ollama_restart' ? 'Limpeza do Ollama' : 'Reinicialização geral'}\n\n`;
          message += `📊 **Sistema atualizado:**\n`;
          message += `• ✅ Aplicação SecreBot reiniciada\n`;
          message += `• ✅ Modelos Ollama descarregados da memória\n`;
          message += `• ✅ Conexões e contextos limpos\n`;
          message += `• ✅ Configurações recarregadas\n\n`;
          message += `💡 **O sistema está pronto** para uso com configurações limpas.\n\n`;
          message += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
          
          // Enviar notificação para o usuário que solicitou
          await this.sendResponse(restartInfo.requestedBy, message);
        }
        
        // Remover arquivo após processamento
        await fs.unlink(restartFile);
        logger.file(`🗑️ Arquivo de restart removido: ${restartFile}`);
        
      } catch (fileErr) {
        // Arquivo não existe ou erro ao ler - normal se não houve restart
        if (fileErr.code !== 'ENOENT') {
          logger.warn('⚠️ Erro ao verificar arquivo de restart', { message: fileErr.message });
        }
      }
      
    } catch (err) {
      logger.error('❌ Erro ao verificar notificação de restart', err);
    }
  }

  isMainCommand(text) {
    const lower = text.toLowerCase();
    const commands = Object.values(COMMANDS).sort((a, b) => b.length - a.length);
    
    // Check regular commands
    if (commands.some(cmd => lower.startsWith(cmd))) {
      return true;
    }
    
    // Check WhisperSilent commands
    const wsCommands = [
      'ws_health_check', 'ws_health_detailed', 'ws_status',
      'ws_transcriptions_list', 'ws_transcriptions_search', 'ws_transcriptions_stats',
      'ws_aggregation_status', 'ws_aggregation_texts',
      'ws_control_toggle_api', 'ws_control_start', 'ws_control_stop',
      'ws_send_unsent', 'ws_export_data'
    ];
    
    return wsCommands.some(cmd => lower.startsWith(cmd));
  }

  async getCurrentMode(contactId) {
    // Tenta cache local primeiro
    if (this.chatModes.has(contactId)) {
      return this.chatModes.get(contactId);
    }
    
    // Busca na sessão persistida
    const session = await this.sessionService.getSession(contactId);
    if (session && session.chatMode) {
      this.chatModes.set(contactId, session.chatMode);
      return session.chatMode;
    }
    
    return null;
  }

  async setMode(contactId, mode) {
    if (mode) {
      this.chatModes.set(contactId, mode);
      await this.sessionService.setChatMode(contactId, mode);
      logger.log(`🔧 Modo para ${contactId} definido para: ${mode}`);
    } else {
      const currentMode = await this.getCurrentMode(contactId);
      if (currentMode) {
          await this.llmService.clearContext(contactId, currentMode);
          logger.service(`🧹 Contexto LLM para modo ${currentMode} de ${contactId} limpo.`);
      }
      this.chatModes.delete(contactId);
      await this.sessionService.setChatMode(contactId, null);
      logger.log(`🔧 Modo para ${contactId} removido.`);
    }
  }

  // Métodos para navegação hierárquica
  async getNavigationState(contactId) {
    // Tenta cache local primeiro
    if (this.navigationStates.has(contactId)) {
      return this.navigationStates.get(contactId);
    }
    
    // Busca na sessão persistida
    const session = await this.sessionService.getSession(contactId);
    if (session && session.navigationState) {
      this.navigationStates.set(contactId, session.navigationState);
      return session.navigationState;
    }
    
    return NAVIGATION_STATES.MAIN_MENU;
  }

  async setNavigationState(contactId, state) {
    if (state === NAVIGATION_STATES.MAIN_MENU) {
      this.navigationStates.delete(contactId);
      await this.sessionService.setNavigationState(contactId, 'MAIN_MENU');
      logger.log(`📍 Estado de navegação para ${contactId} resetado para menu principal.`);
    } else {
      this.navigationStates.set(contactId, state);
      await this.sessionService.setNavigationState(contactId, state);
      logger.log(`📍 Estado de navegação para ${contactId} definido para: ${state}`);
    }
  }

  async handleHierarchicalNavigation(msg, contactId, text, navigationState) {
    const numericInput = text.trim();
    
    // No menu principal (1-6)
    if (navigationState === NAVIGATION_STATES.MAIN_MENU) {
      switch (numericInput) {
        case '1':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_AGENDA);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.agenda);
          return true;
        case '2':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_IA);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.ia);
          return true;
        case '3':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_MIDIA);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.midia);
          return true;
        case '4':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_PROFISSIONAL);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.profissional);
          return true;
        case '5':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_CONFIG);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.config);
          return true;
        case '6':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_SUPORTE);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.suporte);
          return true;
        case '7':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_WHISPERSILENT);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.whispersilent);
          return true;
        case '8':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_STATUS_APIS);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.status_apis);
          return true;
        case '9':
          this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_CRYPTO);
          await this.sendResponse(contactId, SUBMENU_MESSAGES.crypto);
          return true;
        case '0':
          await this.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    }

    // Nos submenus
    return await this.handleSubmenuNavigation(msg, contactId, numericInput, navigationState);
  }

  async handleSubmenuNavigation(msg, contactId, numericInput, navigationState) {
    switch (navigationState) {
      case NAVIGATION_STATES.SUBMENU_AGENDA:
        return await this.scheduleHandler.handleAgendaSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_IA:
        return await this.handleIASubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_MIDIA:
        return await this.handleMidiaSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_PROFISSIONAL:
        return await this.handleProfissionalSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_CONFIG:
        return await this.handleConfigSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_SUPORTE:
        return await this.handleSuporteSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_VIDEO:
        return await this.videoSummaryHandler.handleVideoSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_STATUS_APIS:
        return await this.apiStatusHandler.handleStatusApisSubmenu(msg, contactId, numericInput);
      case NAVIGATION_STATES.SUBMENU_CRYPTO:
        return await this.handleCryptoSubmenu(msg, contactId, numericInput);
      default:
        return false;
    }
  }


  async handleIASubmenu(msg, contactId, input) {
    switch (input) {
      case '2.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.DEEP });
        return true;
      case '2.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.RESUMIR });
        return true;
      case '2.3':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_VIDEO);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.video);
        return true;
      case '2.4':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.FOTO });
        return true;
      case '2.5':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.TRANSCREVER_RESUMIR });
        return true;
      case '2.6':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.CHOOSE_MODEL });
        return true;
      case '2.6.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: 'trocar_modelo_especifico' });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
  }

  async handleMidiaSubmenu(msg, contactId, input) {
    switch (input) {
      case '3.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.TRANSCREVER });
        return true;
      case '3.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.VOZ });
        return true;
      case '3.3':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.CALORIAS });
        return true;
      case '3.4':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.CHOOSE_WHISPER_ENDPOINT });
        return true;
      case '3.4.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: 'trocar_endpoint_whisper_especifico' });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
  }

  async handleProfissionalSubmenu(msg, contactId, input) {
    switch (input) {
      case '4.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.LINKEDIN });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
  }

  async handleConfigSubmenu(msg, contactId, input) {
    switch (input) {
      case '5.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.VOZ });
        return true;
      case '5.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.TTS_CONFIG });
        return true;
      case '5.3':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.LISTAR_ENDPOINTS_WHISPER });
        return true;
      case '5.4':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.LISTAR_ENDPOINTS_OLLAMA });
        return true;
      case '5.5':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.STATUS_ENDPOINTS });
        return true;
      case '5.6':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.RECURSO });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
  }

  async handleSuporteSubmenu(msg, contactId, input) {
    switch (input) {
      case '6.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.AJUDA });
        return true;
      case '6.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.RECURSO });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
  }




  async showSubmenu(contactId, submenuType) {
    switch (submenuType) {
      case 'submenu_agenda':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_AGENDA);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.agenda);
        break;
      case 'submenu_ia':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_IA);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.ia);
        break;
      case 'submenu_midia':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_MIDIA);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.midia);
        break;
      case 'submenu_profissional':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_PROFISSIONAL);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.profissional);
        break;
      case 'submenu_config':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_CONFIG);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.config);
        break;
      case 'submenu_suporte':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_SUPORTE);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.suporte);
        break;
      case 'submenu_video':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_VIDEO);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.video);
        break;
      case 'submenu_whispersilent':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_WHISPERSILENT);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.whispersilent);
        break;
      case 'submenu_status_apis':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_STATUS_APIS);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.status_apis);
        break;
      case 'submenu_crypto':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_CRYPTO);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.crypto);
        break;
      case 'submenu_crypto_ml':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_CRYPTO_ML);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.crypto_ml);
        break;
      default:
        await this.sendResponse(contactId, MENU_MESSAGE);
    }
  }

  // Métodos auxiliares para navegação por áudio
  getCommandDescription(command) {
    const descriptions = {
      [COMMANDS.AJUDA]: 'Exibir Ajuda',
      [COMMANDS.DEEP]: 'Chat com IA',
      [COMMANDS.AGENDA]: 'Criar Agendamento',
      [COMMANDS.TRANSCREVER]: 'Transcrever Áudio',
      [COMMANDS.TRANSCREVER_RESUMIR]: 'Transcrever e Resumir',
      [COMMANDS.FOTO]: 'Analisar Imagem',
      [COMMANDS.CALORIAS]: 'Calcular Calorias',
      [COMMANDS.LISTAR]: 'Listar Compromissos',
      [COMMANDS.LINKEDIN]: 'Analisar LinkedIn',
      [COMMANDS.DELETAR]: 'Deletar Compromisso',
      [COMMANDS.VOZ]: 'Alternar Voz/Texto',
      [COMMANDS.TTS_CONFIG]: 'Configurar TTS',
      [COMMANDS.RECURSO]: 'Recursos do Sistema',
      [COMMANDS.RESUMIR]: 'Resumir Documento',
      [COMMANDS.RESUMIRVIDEO]: 'Resumir Vídeo',
      [COMMANDS.MENU]: 'Menu Principal',
      [COMMANDS.VOLTAR]: 'Voltar'
    };
    return descriptions[command] || command;
  }

  getSubmenuDescription(submenu) {
    const descriptions = {
      'submenu_agenda': 'Agenda & Lembretes',
      'submenu_ia': 'Inteligência Artificial',
      'submenu_midia': 'Mídia & Conteúdo',
      'submenu_profissional': 'Análise Profissional',
      'submenu_config': 'Configurações',
      'submenu_suporte': 'Suporte & Sistema',
      'submenu_whispersilent': 'WhisperSilent API'
    };
    return descriptions[submenu] || submenu;
  }

  async trySubmenuNavigation(transcription, navigationState) {
    const submenuMapping = {
      // Palavras-chave para navegação de submenu
      'agenda': 'submenu_agenda',
      'lembrete': 'submenu_agenda',
      'compromisso': 'submenu_agenda',
      'agendamento': 'submenu_agenda',
      'ia': 'submenu_ia',
      'inteligencia': 'submenu_ia',
      'artificial': 'submenu_ia',
      'chat': 'submenu_ia',
      'conversa': 'submenu_ia',
      'midia': 'submenu_midia',
      'audio': 'submenu_midia',
      'som': 'submenu_midia',
      'voz': 'submenu_midia',
      'profissional': 'submenu_profissional',
      'linkedin': 'submenu_profissional',
      'perfil': 'submenu_profissional',
      'analisar': 'submenu_profissional',
      'analise': 'submenu_profissional',
      'config': 'submenu_config',
      'configuracao': 'submenu_config',
      'configurar': 'submenu_config',
      'ajuste': 'submenu_config',
      'suporte': 'submenu_suporte',
      'ajuda': 'submenu_suporte',
      'sistema': 'submenu_suporte',
      'recurso': 'submenu_suporte'
    };

    const lowerTranscription = transcription.toLowerCase();
    
    for (const [keyword, submenu] of Object.entries(submenuMapping)) {
      if (lowerTranscription.includes(keyword)) {
        return submenu;
      }
    }
    
    return null;
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
    const lowerText = text.toLowerCase();

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
      try {
        // Limpar a preferência primeiro
        this.setUserPreference(contactId, 'awaitingSummarizationResponse', null);
        
        await this.sendResponse(contactId, '🧠 Gerando resumo do áudio...', true);
        const result = await this.transcriber.transcribeAndSummarize(awaitingSummarization.audioBuffer);
        await this.sendResponse(contactId, result.combined);
        await this.sendResponse(contactId, `✅ *Resumo Concluído!*\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
        return;
      } catch (err) {
        logger.error(`❌ Erro ao gerar resumo de áudio para ${contactId}`, err);
        await this.sendErrorMessage(contactId, `❌ Erro ao gerar resumo: ${err.message || 'Tente novamente.'}`);
        return;
      }
    } else if (awaitingSummarization && text !== '1') {
      // Usuário enviou uma resposta diferente de '1', limpar a sugestão de resumo
      this.setUserPreference(contactId, 'awaitingSummarizationResponse', null);
    }

    // Verificar se o usuário está respondendo a uma sugestão de resumo no modo transcrição (3.1)
    const awaitingTranscriptionSummarization = this.getUserPreference(contactId, 'awaitingTranscriptionSummarization', null);
    if (awaitingTranscriptionSummarization && text === '1') {
      try {
        // Limpar a preferência primeiro
        this.setUserPreference(contactId, 'awaitingTranscriptionSummarization', null);
        
        await this.sendResponse(contactId, '🧠 Gerando resumo da transcrição...', true);
        const result = await this.transcriber.transcribeAndSummarize(awaitingTranscriptionSummarization.audioBuffer);
        await this.sendResponse(contactId, result.combined);
        await this.sendResponse(contactId, `✅ *Resumo da Transcrição Concluído!*\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
        return;
      } catch (err) {
        logger.error(`❌ Erro ao gerar resumo da transcrição para ${contactId}`, err);
        await this.sendErrorMessage(contactId, `❌ Erro ao gerar resumo: ${err.message || 'Tente novamente.'}`);
        return;
      }
    } else if (awaitingTranscriptionSummarization && text !== '1') {
      // Usuário enviou uma resposta diferente de '1', limpar a sugestão de resumo
      this.setUserPreference(contactId, 'awaitingTranscriptionSummarization', null);
    }

    // Verificar se o usuário tem fluxo ativo
    if (await this.hasActiveFlow(contactId)) {
      // Comandos específicos para controle de flow
      if (lowerText.startsWith('!flow')) {
        const parts = text.split(' ');
        const command = parts[1]?.toLowerCase();
        
        // Permitir comandos de controle de flow
        if (command === 'stop' || command === 'sair' || command === 'status' || command === 'restart' || command === 'voltar') {
          await this.flowManagementHandler.handleFlowCommand(msg, contactId, text);
          return;
        } else {
          // Informar sobre comandos disponíveis durante flow ativo
          await this.sendResponse(contactId, '⚠️ Durante um flow ativo, use:\n\n🔄 !flow restart - Reiniciar flow\n↩️ !flow voltar - Voltar ao início\n🛑 !flow stop - Encerrar flow\n📊 !flow status - Ver status');
          return;
        }
      }
      
      // Comandos de navegação universais sempre disponíveis
      if (lowerText === 'voltar' || lowerText === 'voltar menu' || lowerText === 'menu' || lowerText === 'início' || lowerText === 'inicio') {
        // Permitir acesso ao menu principal mesmo durante flow
        await this.sendResponse(contactId, `📋 *MENU PRINCIPAL* (Flow ativo: ${this.flowExecutionService.getActiveFlowInfo(contactId)?.flowName || 'Desconhecido'})\n\n${MENU_MESSAGE}\n\n🔄 Para voltar ao flow: envie qualquer mensagem\n🛑 Para encerrar flow: !flow stop`);
        return;
      }
      
      // Bloquear comandos do sistema durante flow ativo
      if (lowerText.startsWith('!') && !lowerText.startsWith('!flow')) {
        await this.sendResponse(contactId, `⚠️ *Comando bloqueado durante flow ativo*\n\nComando: "${text}"\n\n🛑 Para usar comandos do sistema, primeiro pare o flow:\n\n🛑 !flow stop - Encerrar flow\n🔄 !flow restart - Reiniciar flow\n📊 !flow status - Ver status\n\n💡 Ou continue interagindo com o flow ativo.`);
        return;
      }
      
      // Permitir comando de ajuda durante flow
      if (lowerText === '!ajuda' || lowerText === 'ajuda' || lowerText === 'help') {
        await this.sendResponse(contactId, '🆘 *AJUDA DURANTE FLOW ATIVO*\n\n🔄 !flow restart - Reiniciar do início\n↩️ !flow voltar - Voltar ao passo anterior\n🛑 !flow stop - Encerrar flow\n📊 !flow status - Ver informações\n📋 menu - Ver menu principal\n\n💡 Qualquer outra mensagem será processada pelo flow ativo.');
        return;
      }
      
      // Tentar processar como entrada do flow
      const handled = await this.processFlowMessage(contactId, text);
      if (handled) {
        return;
      }
      
      // Se não foi processado pelo flow, orientar usuário sem sair do flow
      const flowInfo = this.flowExecutionService.getActiveFlowInfo(contactId);
      await this.sendResponse(contactId, 
        `🤖 *Flow Ativo:* ${flowInfo?.flowName || 'Desconhecido'}\n\n` +
        `❓ *Comando não reconhecido:* "${text}"\n\n` +
        `💡 *Opções disponíveis:*\n` +
        `🔄 Digite "CONTINUAR" para prosseguir\n` +
        `🏠 Digite "MENU" para voltar ao menu\n` +
        `🎁 Digite "EXPERIMENTAL" para agendar aula\n` +
        `📞 Digite "CONTATO" para falar com atendente\n\n` +
        `🔧 *Comandos de controle:*\n` +
        `🔄 !flow restart - Reiniciar flow\n` +
        `🛑 !flow stop - Sair do flow\n\n` +
        `💬 *Ou continue a conversa normalmente...*`
      );
      return;
    }

    // Verificar comando !flow (apenas quando não há flow ativo)
    if (lowerText.startsWith('!flow')) {
      await this.flowManagementHandler.handleFlowCommand(msg, contactId, text);
      return;
    }

    if (this.awaitingLinkedinCreds.get(contactId)) {
      const [user, pass] = text.split(/[:\s]+/);
      if (!user || !pass) {
        await this.sendResponse(contactId, '❌ Formato inválido. Envie no formato: usuario@email.com:senha');
        return;
      }
      
      this.awaitingLinkedinCreds.delete(contactId);
      await this.sendResponse(contactId, '🔑 Tentando fazer login no LinkedIn... Isso pode levar um minuto.');

      try {
        const { loginAndGetLiAt } = await import('../services/linkedinScraper.js');
        const cookie = await loginAndGetLiAt(user, pass, CONFIG.linkedin.timeoutMs);

        if (cookie) {
          // Salvar na sessão atual
          this.linkedinSessions.set(contactId, cookie);
          await this.sendResponse(contactId, '✅ Login bem-sucedido! O acesso foi salvo para esta sessão.');

          // Salvar no banco de dados para uso futuro
          try {
            const { configService } = await import('../services/configService.js');
            await configService.setConfig({ linkedin: { liAt: cookie } });
            CONFIG.linkedin.liAt = cookie; // Atualiza a configuração em tempo de execução
            await this.sendResponse(contactId, '💾 As credenciais foram salvas permanentemente. Você não precisará fazer login novamente.');
          } catch (dbError) {
            logger.error('❌ Falha ao salvar o cookie do LinkedIn no DB:', dbError);
            await this.sendResponse(contactId, '⚠️ Não foi possível salvar suas credenciais permanentemente. O acesso funcionará apenas nesta sessão.');
          }
        } else {
          await this.sendResponse(contactId, '❌ Falha ao obter o cookie de acesso (li_at). Verifique suas credenciais.');
        }
      } catch (err) {
        logger.error(`❌ Erro no login do LinkedIn para ${contactId}:`, err);
        await this.sendResponse(contactId, `❌ Erro no login: ${err.message}`);
      }
      return;
    }

    if (Utils.isVoltarCommand(text)) {
      await this.setMode(contactId, null);
      await this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
      await this.sendResponse(contactId, MENU_MESSAGE);
      return;
    }

    const currentMode = await this.getCurrentMode(contactId);
    const navigationState = await this.getNavigationState(contactId);

    // Lógica de navegação hierárquica
    if (!currentMode && await this.handleHierarchicalNavigation(msg, contactId, text, navigationState)) {
      return;
    }

    if (!currentMode && NUMERIC_SHORTCUTS[text]) {
      const command = NUMERIC_SHORTCUTS[text];
      logger.log(`🔢 Atalho numérico ${text} mapeado para ${command}`);
      
      // Se for um submenu, mostrar o submenu
      if (command.startsWith('submenu_')) {
        await this.showSubmenu(contactId, command);
        return;
      }
      
      await this.handleMessage({ ...msg, body: command });
      return;
    }

    if (this.isMainCommand(lowerText)) {
        await this.handleCommand(msg, contactId, lowerText, text);
        return;
    }

    if (msg.hasMedia) {
        if (msg.type === 'image') {
            await this.handleImageMessage(msg, contactId, lowerText);
            return;
        } else if (msg.type === 'audio' || msg.type === 'ptt') {
            await this.audioTranscriptionHandler.handleAudioMessage(msg, contactId);
            return;
        }
    }

    if (currentMode) {
        await this.processMessageByMode(contactId, text, msg);
        return;
    }

    // Tentativa de interpretar comandos em linguagem natural no menu
    await this.processTextNavigation(msg, contactId, text, navigationState);
  }

  async handleCommand(msg, contactId, lowerText, originalText) {
      const commandHandlers = {
          [COMMANDS.MENU]: async () => {
              await this.setMode(contactId, null);
              await this.sendResponse(contactId, MENU_MESSAGE);
          },
          [COMMANDS.AJUDA]: async () => {
              await this.setMode(contactId, null);
              await this.sendResponse(contactId, HELP_GUIDE);
          },
          [COMMANDS.DEEP]: () => this.handleDeepCommand(contactId, originalText),
          [COMMANDS.CHOOSE_MODEL]: () => this.modelManagementHandler.handleChooseModelCommand(contactId),
          'trocar_modelo_especifico': () => this.modelManagementHandler.handleChangeSpecificModelCommand(contactId),
          [COMMANDS.CHOOSE_WHISPER_ENDPOINT]: () => this.endpointHandler.handleChooseWhisperEndpointCommand(contactId),
          'trocar_endpoint_whisper_especifico': () => this.modelManagementHandler.handleChangeSpecificWhisperEndpointCommand(contactId),
          [COMMANDS.AGENDA]: () => this.scheduleHandler.handleAgendabotCommand(contactId, originalText),
          [COMMANDS.TRANSCREVER]: () => this.audioTranscriptionHandler.handleTranscreverCommand(contactId),
          [COMMANDS.TRANSCREVER_RESUMIR]: () => this.audioTranscriptionHandler.handleTranscreverResumir(contactId),
          [COMMANDS.LINKEDIN]: () => this.linkedinHandler.handleLinkedinCommand(contactId, originalText),
          [COMMANDS.LISTAR]: () => this.scheduleHandler.handleListarCommand(contactId),
          [COMMANDS.DELETAR]: () => this.scheduleHandler.handleDeletarCommand(contactId),
          [COMMANDS.VOZ]: () => this.handleVozCommand(contactId),
          [COMMANDS.TTS_CONFIG]: () => this.handleTTSConfigCommand(contactId),
          [COMMANDS.RECURSO]: () => this.handleRecursoCommand(contactId),
          [COMMANDS.RESUMIR]: () => this.documentHandler.handleResumirCommand(msg, contactId),
          [COMMANDS.RESUMIRVIDEO]: () => this.videoSummaryHandler.handleResumirVideoCommand(msg, contactId),
          [COMMANDS.RESUMIRVIDEO2]: () => this.videoSummaryHandler.handleResumirVideo2Command(msg, contactId),
          [COMMANDS.IMPORTAR_AGENDA]: () => this.scheduleHandler.handleImportarAgendaCommand(msg, contactId),
          [COMMANDS.CRYPTO_MONITOR]: () => this.handleCryptoQuotes(contactId),
          [COMMANDS.CRYPTO_START]: () => this.handleCryptoStartMonitoring(contactId),
          [COMMANDS.CRYPTO_STOP]: () => this.handleCryptoStopMonitoring(contactId),
          [COMMANDS.CRYPTO_STATUS]: () => this.handleCryptoStatus(contactId),
          [COMMANDS.CRYPTO_CONFIG]: () => this.handleCryptoConfig(contactId, originalText),
          [COMMANDS.CRYPTO_PREFERENCES]: () => this.handleCryptoPreferences(contactId),
          [COMMANDS.CRYPTO_LIST_COINS]: () => this.handleCryptoListCoins(contactId),
          [COMMANDS.CRYPTO_SELECT_COINS]: () => this.handleCryptoSelectCoins(contactId),
          [COMMANDS.CRYPTO_AUTO_TRADING]: () => this.handleCryptoAutoTrading(contactId),
          [COMMANDS.FOTO]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.CALORIAS]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.LISTAR_ENDPOINTS_WHISPER]: () => this.endpointHandler.handleListarEndpointsWhisperCommand(contactId),
          [COMMANDS.LISTAR_ENDPOINTS_OLLAMA]: () => this.endpointHandler.handleListarEndpointsOllamaCommand(contactId),
          [COMMANDS.STATUS_ENDPOINTS]: () => this.apiStatusHandler.handleStatusEndpointsCommand(contactId),
          [COMMANDS.WHISPERSILENT]: () => this.audioTranscriptionHandler.handleWhisperSilentConfigCommand(contactId),
          
          // WhisperSilent API Commands
          'ws_health_check': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'health'),
          'ws_health_detailed': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'health_detailed'),
          'ws_status': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'status'),
          'ws_transcriptions_list': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'transcriptions_list'),
          'ws_transcriptions_search': () => this.audioTranscriptionHandler.handleWhisperSilentSearchCommand(contactId),
          'ws_transcriptions_stats': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'transcriptions_stats'),
          'ws_aggregation_status': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'aggregation_status'),
          'ws_aggregation_texts': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'aggregation_texts'),
          'ws_control_toggle_api': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'control_toggle_api'),
          'ws_control_start': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'control_start'),
          'ws_control_stop': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'control_stop'),
          'ws_send_unsent': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'send_unsent'),
          'ws_export_data': () => this.audioTranscriptionHandler.handleWhisperSilentCommand(contactId, 'export_data')
      };

      const sortedHandlers = Object.entries(commandHandlers).sort((a, b) => b[0].length - a[0].length);
      for (const [command, handler] of sortedHandlers) {
          if (lowerText.startsWith(command)) {
              logger.log(`⚙️ Executando comando ${command} para ${contactId}`);
              await handler();
              return;
          }
      }

      logger.warn(`⚠️ Comando ${lowerText} não encontrado nos handlers.`);
      await this.sendResponse(contactId, MENU_MESSAGE);
  }

  async handleDeepCommand(contactId, originalText) {
    // Ativar modo assistente para conversar com a IA
    await this.setMode(contactId, CHAT_MODES.ASSISTANT);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.ASSISTANT]);
  }



  async handleRecursoCommand(contactId) {
    // Mostrar recursos do sistema
    try {
      await this.handleRecursoDetalhadoCommand(contactId);
    } catch (error) {
      logger.error(`❌ Erro ao mostrar recursos para ${contactId}:`, error);
      await this.sendResponse(contactId, '❌ Erro ao obter informações do sistema. Tente novamente.');
    }
  }


  async handleVozCommand(contactId) {
      const voiceEnabled = this.toggleVoicePreference(contactId);
      const message = voiceEnabled ? SUCCESS_MESSAGES.VOICE_ENABLED : SUCCESS_MESSAGES.VOICE_DISABLED;
      // Enviar confirmação sempre em texto para clareza
      await this.sendResponse(contactId, message, true);
  }

  async handleTTSConfigCommand(contactId) {
      const configUrl = `${CONFIG.app.webUrl || 'http://localhost:3000'}/tts-config`;
      const message = `🔊 *Configuração de Text-to-Speech*

Para configurar o TTS (ElevenLabs ou Piper), acesse:
${configUrl}

*Funcionalidades Disponíveis:*
• ⚙️ Configuração de ElevenLabs
• 🖥️ Configuração de Piper TTS local
• 🔊 Controles globais de ativação
• 🎤 Testes de funcionalidade
• 📊 Carregamento automático de vozes

*Configurações Atuais:*
• TTS Global: ${CONFIG.tts?.enabled ? '✅ Ativo' : '❌ Inativo'}
• ElevenLabs: ${CONFIG.elevenlabs?.apiKey ? '✅ Configurado' : '❌ Não configurado'}
• Piper: ${CONFIG.piper?.enabled ? '✅ Ativo' : '❌ Inativo'}
• Telegram TTS: ${CONFIG.telegram?.enableTTS ? '✅ Ativo' : '❌ Inativo'}

Use o link acima para configurar todos os parâmetros de TTS.`;

      await this.sendResponse(contactId, message, true);
  }


async handleRecursoCommand(contactId) {
  try {
    await this.sendResponse(contactId, '🔍 Coletando informações detalhadas do sistema...', true);
    
    // Coleta paralela de todas as informações
    const [
      cpu,
      cpuTemp,
      cpuSpeed,
      mem,
      osInfo,
      load,
      diskLayout,
      fsSize,
      networkInterfaces,
      networkStats,
      processes,
      graphics,
      system,
      time,
      dockerInfo,
      services
    ] = await Promise.all([
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

    // Formatação de memória
    const formatBytes = (bytes) => {
      const gb = bytes / 1024 / 1024 / 1024;
      return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
    };

    // Formatação de uptime
    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    // CPU detalhada
    const cpuInfo = [
      `🖥️ *CPU:* ${cpu.manufacturer} ${cpu.brand}`,
      `⚙️ *Arquitetura:* ${cpu.arch} | *Núcleos:* ${cpu.physicalCores} físicos, ${cpu.cores} lógicos`,
      `🔢 *Velocidade:* ${cpuSpeed.avg ? `${cpuSpeed.avg.toFixed(2)} GHz` : 'N/A'}`,
      cpuTemp.main ? `🌡️ *Temperatura:* ${cpuTemp.main.toFixed(1)}°C` : '',
      `📊 *Uso atual:* ${load.currentLoad.toFixed(1)}%`,
      `📈 *Carga média:* ${load.avgLoad ? load.avgLoad.toFixed(2) : 'N/A'}`
    ].filter(Boolean).join('\n');

    // Memória detalhada
    const memInfo = [
      `\n💾 *MEMÓRIA*`,
      `🧠 *RAM:* ${formatBytes(mem.used)} / ${formatBytes(mem.total)} (${((mem.used / mem.total) * 100).toFixed(1)}%)`,
      `📦 *Disponível:* ${formatBytes(mem.available)}`,
      `💱 *Swap:* ${formatBytes(mem.swapused)} / ${formatBytes(mem.swaptotal)}`,
      `🎯 *Cache:* ${formatBytes(mem.cached)}`,
      `🔄 *Buffer:* ${formatBytes(mem.buffers)}`
    ].join('\n');

    // Disco detalhado
    const diskInfo = [];
    diskInfo.push('\n💿 *ARMAZENAMENTO*');
    
    // Informações físicas dos discos
    diskLayout.forEach(disk => {
      if (disk.size > 0) {
        diskInfo.push(`📀 ${disk.name}: ${formatBytes(disk.size)} (${disk.type || 'Unknown'})`);
      }
    });

    // Uso do sistema de arquivos
    fsSize.forEach(fs => {
      if (fs.size > 0 && !fs.mount.includes('docker') && !fs.mount.includes('snap')) {
        const usePercent = ((fs.used / fs.size) * 100).toFixed(1);
        diskInfo.push(`  └ ${fs.fs}: ${formatBytes(fs.used)}/${formatBytes(fs.size)} (${usePercent}%) em ${fs.mount}`);
      }
    });

    // Rede detalhada
    const netInfo = ['\n🌐 *REDE*'];
    const activeInterfaces = networkInterfaces.filter(iface => 
      iface.ip4 && iface.operstate === 'up' && !iface.internal
    );
    
    activeInterfaces.forEach(iface => {
      netInfo.push(`🔌 ${iface.iface}: ${iface.ip4} (${iface.mac})`);
      const stats = networkStats.find(s => s.iface === iface.iface);
      if (stats) {
        netInfo.push(`  ↓ RX: ${formatBytes(stats.rx_bytes)} | ↑ TX: ${formatBytes(stats.tx_bytes)}`);
      }
    });

    // Sistema e processos
    const systemInfo = [
      `\n🖥️ *SISTEMA*`,
      `🏢 *Host:* ${system.manufacturer} ${system.model}`,
      `🔧 *OS:* ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
      `🏷️ *Kernel:* ${osInfo.kernel}`,
      `⏱️ *Uptime:* ${formatUptime(time.uptime)}`,
      `🚀 *Boot:* ${new Date(Date.now() - time.uptime * 1000).toLocaleString('pt-BR')}`
    ].join('\n');

    // Processos
    const processInfo = [
      `\n📊 *PROCESSOS*`,
      `🔢 *Total:* ${processes.all}`,
      `✅ *Rodando:* ${processes.running}`,
      `😴 *Dormindo:* ${processes.sleeping}`,
      `🛑 *Parados:* ${processes.stopped}`,
      `❌ *Zumbis:* ${processes.zombie}`
    ].join('\n');

    // GPU (se disponível)
    let gpuInfo = '';
    if (graphics.controllers && graphics.controllers.length > 0) {
      gpuInfo = '\n🎮 *GPU*\n';
      graphics.controllers.forEach((gpu, index) => {
        gpuInfo += `${index + 1}. ${gpu.vendor} ${gpu.model}`;
        if (gpu.vram) gpuInfo += ` (${gpu.vram} MB VRAM)`;
        gpuInfo += '\n';
      });
    }

    // Docker (se disponível)
    let dockerStr = '';
    if (dockerInfo.containers > 0) {
      dockerStr = `\n🐳 *Docker:* ${dockerInfo.containersRunning}/${dockerInfo.containers} containers rodando`;
    }

    // Serviços importantes
    const importantServices = ['mysql', 'postgresql', 'nginx', 'apache', 'redis', 'mongodb', 'docker'];
    const runningServices = services.filter(s => 
      importantServices.some(name => s.name.toLowerCase().includes(name)) && s.running
    );
    
    let servicesStr = '';
    if (runningServices.length > 0) {
      servicesStr = '\n🔧 *Serviços Ativos:* ' + runningServices.map(s => s.name).join(', ');
    }

    // Montagem da mensagem final
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

    await this.sendResponse(contactId, message);
    
  } catch (err) {
    logger.error('❌ Erro ao obter recursos detalhados do sistema', err);
    await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
  }
}


  checkCircuitBreaker(contactId) {
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


  async handleImageMessage(msg, contactId, lowerText) {
    logger.verbose(`🖼️ Recebida imagem de ${contactId}`);
    let media = await Utils.downloadMediaWithRetry(msg);
    if (!media) {
      await this.sendErrorMessage(contactId, '❌ Não foi possível baixar a imagem.');
      return;
    }
    const buffer = Buffer.from(media.data, 'base64');
    const timestamp = Date.now();
    const imagePath = path.join(__dirname, `image_${timestamp}.jpg`);
    try {
      await fs.writeFile(imagePath, buffer);
      logger.file(`💾 Imagem salva temporariamente em ${imagePath}`);
      let prompt;
      let processingMessage;
      let mode;
      if (lowerText.startsWith(COMMANDS.FOTO)) {
        prompt = PROMPTS.imageDescription;
        processingMessage = '📸 Descrevendo imagem...';
        mode = 'description';
      } else if (lowerText.startsWith(COMMANDS.CALORIAS)) {
        prompt = PROMPTS.calorieEstimation;
        processingMessage = '🍎 Calculando calorias...';
        mode = 'calories';
      } else {
        prompt = PROMPTS.imageDescription;
        processingMessage = '🔍 Analisando imagem...';
        mode = 'description';
      }
      await this.sendResponse(contactId, processingMessage, true); // Status sempre em texto
      
      let description;
      try {
        description = await this.llmService.generateImageAnalysis(prompt, imagePath);
      } catch (error) {
        logger.error('❌ Erro na análise de imagem via LLMService, tentando fallback:', error);
        // Fallback to direct Ollama call
        const { Ollama } = await import('ollama');
        description = await this.llmService.generateImageAnalysis(prompt, imagePath);
      }
      logger.verbose(`🤖 Resposta da análise de imagem (${mode}): ${description.substring(0, 100)}...`);

      if (mode === 'calories') {
        let foods = [];
        try {
          const jsonText = Utils.extractJSON(description);
          const obj = JSON.parse(jsonText);
          foods = Array.isArray(obj.foods) ? obj.foods : [];
        } catch (e) {
          logger.error('❌ Erro ao analisar JSON de alimentos', e);
        }

        if (!foods.length) {
          await this.sendResponse(contactId, description);
        } else {
          const results = [];
          for (const food of foods) {
            const cal = await CalorieService.getCalories(food);
            if (cal) {
              results.push(`🍽️ ${food}: ${cal} kcal`);
            } else {
              results.push(`🍽️ ${food}: N/A`);
            }
          }
          const finalText = results.join('\n');
          await this.sendResponse(contactId, finalText);
        }
      } else {
        await this.sendResponse(contactId, description);
      }
    } catch (err) {
        logger.error(`❌ Erro ao processar imagem de ${contactId}`, err);
        
        if (err.message?.includes('falhou após') && err.message?.includes('tentativas')) {
          await this.sendErrorMessage(contactId, '⏱️ A análise da imagem demorou mais que o esperado. O sistema tentou por até 1 hora, mas não conseguiu completar. Tente novamente mais tarde ou com uma imagem menor.');
        } else {
          await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
        }
    } finally {
      await Utils.cleanupFile(imagePath);
      logger.file(`🗑️ Arquivo de imagem temporário ${imagePath} removido.`);
    }
  }

  async handleDeepCommand(contactId, text) {
    this.setMode(contactId, CHAT_MODES.ASSISTANT);
    const query = text.substring(COMMANDS.DEEP.length).trim();
    if (!query) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.ASSISTANT]);
      return;
    }
    await this.sendResponse(contactId, '🤔 Pensando...', true); // Status sempre em texto
    const response = await this.llmService.getAssistantResponse(contactId, query);
    await this.sendResponse(contactId, response);
  }



  async processAudioNavigation(msg, contactId, transcription, navigationState) {
    logger.flow(`🎤 Processando navegação por áudio. Estado: ${navigationState}, Transcrição: "${transcription}"`);
    await this.sendResponse(contactId, '🤔 Interpretando comando de áudio...', true);
    
    // Primeiro, tentar navegação hierárquica por áudio
    if (await this.handleHierarchicalNavigation(msg, contactId, transcription, navigationState)) {
      return;
    }
    
    // Depois, tentar mapear para comando direto
    const commandPrompt = PROMPTS.audioCommandMapping(transcription);
    let mappedCommand = 'INVALIDO';
    
    // Mapeamento direto para comandos comuns
    const directMapping = {
      'linkedin': COMMANDS.LINKEDIN,
      'analisar linkedin': COMMANDS.LINKEDIN,
      'perfil linkedin': COMMANDS.LINKEDIN,
      'analisar perfil': COMMANDS.LINKEDIN,
      'linkedin login': `${COMMANDS.LINKEDIN} login`,
      'linkedin test': `${COMMANDS.LINKEDIN} test`,
      'testar linkedin': `${COMMANDS.LINKEDIN} test`
    };
    
    const lowerTranscription = transcription.toLowerCase();
    for (const [keyword, command] of Object.entries(directMapping)) {
      if (lowerTranscription.includes(keyword)) {
        mappedCommand = command;
        logger.api(`🎯 Mapeamento direto de áudio para: ${mappedCommand}`);
        break;
      }
    }
    
    // Se não encontrou mapeamento direto, usar LLM
    if (mappedCommand === 'INVALIDO') {
      try {
        mappedCommand = await this.llmService.generateText(commandPrompt, 0.2);
        logger.api(`🤖 LLM mapeou áudio para: ${mappedCommand}`);
      } catch (error) {
        logger.error('❌ Erro ao mapear comando de áudio via LLM:', error);
        // Fallback: tentar navegação por submenu diretamente
        logger.flow('🔄 Tentando fallback para navegação por submenu');
      }
    }
    
    if (mappedCommand !== 'INVALIDO' && Object.values(COMMANDS).includes(mappedCommand)) {
        await this.sendResponse(contactId, `✅ Comando de áudio interpretado: *${this.getCommandDescription(mappedCommand)}*`, true);
        await this.handleMessage({ ...msg, body: mappedCommand });
    } else {
        // Se não conseguiu mapear diretamente, tentar navegar por submenu
        const submenuCommand = await this.trySubmenuNavigation(transcription, navigationState);
        
        if (submenuCommand) {
            logger.flow(`🎤 Áudio mapeado para navegação de submenu: ${submenuCommand}`);
            await this.sendResponse(contactId, `✅ Navegando para: *${this.getSubmenuDescription(submenuCommand)}*`, true);
            await this.showSubmenu(contactId, submenuCommand);
        } else {
            const currentMenuText = this.getCurrentMenuText(navigationState);
            await this.sendResponse(contactId, `😕 Desculpe, não entendi o comando de áudio "${transcription}". 

💡 *Tente falar algo como:*
• "criar lembrete" • "conversar com IA" 
• "transcrever áudio" • "analisar imagem"
• "ver compromissos" • "ajuda"

${currentMenuText}`);
        }
    }
  }

  async processTextNavigation(msg, contactId, text, navigationState) {
    logger.flow(`⌨️ Processando navegação por texto. Estado: ${navigationState}, Texto: "${text}"`);

    // Primeiro, tentar navegação hierárquica por texto
    if (await this.handleHierarchicalNavigation(msg, contactId, text, navigationState)) {
      return;
    }

    // Depois, tentar mapear para comando direto ou via LLM
    const commandPrompt = PROMPTS.audioCommandMapping(text);
    let mappedCommand = 'INVALIDO';

    const directMapping = {
      'linkedin': COMMANDS.LINKEDIN,
      'analisar linkedin': COMMANDS.LINKEDIN,
      'perfil linkedin': COMMANDS.LINKEDIN,
      'analisar perfil': COMMANDS.LINKEDIN,
      'linkedin login': `${COMMANDS.LINKEDIN} login`,
      'linkedin test': `${COMMANDS.LINKEDIN} test`,
      'testar linkedin': `${COMMANDS.LINKEDIN} test`
    };

    const lowerText = text.toLowerCase();
    for (const [keyword, command] of Object.entries(directMapping)) {
      if (lowerText.includes(keyword)) {
        mappedCommand = command;
        logger.api(`🎯 Mapeamento direto de texto para: ${mappedCommand}`);
        break;
      }
    }

    if (mappedCommand === 'INVALIDO') {
      try {
        mappedCommand = await this.llmService.generateText(commandPrompt, 0.2);
        logger.api(`🤖 LLM mapeou texto para: ${mappedCommand}`);
      } catch (error) {
        logger.error('❌ Erro ao mapear comando de texto via LLM:', error);
        logger.flow('🔄 Tentando fallback para navegação por submenu');
      }
    }

    if (mappedCommand !== 'INVALIDO' && Object.values(COMMANDS).includes(mappedCommand)) {
        await this.sendResponse(contactId, `✅ Comando interpretado: *${this.getCommandDescription(mappedCommand)}*`, true);
        await this.handleMessage({ ...msg, body: mappedCommand });
    } else {
        const submenuCommand = await this.trySubmenuNavigation(text, navigationState);

        if (submenuCommand) {
            logger.flow(`⌨️ Texto mapeado para navegação de submenu: ${submenuCommand}`);
            await this.sendResponse(contactId, `✅ Navegando para: *${this.getSubmenuDescription(submenuCommand)}*`, true);
            await this.showSubmenu(contactId, submenuCommand);
        } else {
            const currentMenuText = this.getCurrentMenuText(navigationState);
            await this.sendResponse(contactId, `😕 Desculpe, não entendi a mensagem "${text}".

💡 *Tente algo como:*\n• "criar lembrete" • "conversar com IA"\n• "transcrever áudio" • "analisar imagem"\n• "ver compromissos" • "ajuda"\n\n${currentMenuText}`);
        }
    }
  }

  getCurrentMenuText(navigationState) {
    switch (navigationState) {
      case NAVIGATION_STATES.SUBMENU_AGENDA:
        return SUBMENU_MESSAGES.agenda;
      case NAVIGATION_STATES.SUBMENU_IA:
        return SUBMENU_MESSAGES.ia;
      case NAVIGATION_STATES.SUBMENU_MIDIA:
        return SUBMENU_MESSAGES.midia;
      case NAVIGATION_STATES.SUBMENU_PROFISSIONAL:
        return SUBMENU_MESSAGES.profissional;
      case NAVIGATION_STATES.SUBMENU_CONFIG:
        return SUBMENU_MESSAGES.config;
      case NAVIGATION_STATES.SUBMENU_SUPORTE:
        return SUBMENU_MESSAGES.suporte;
      case NAVIGATION_STATES.SUBMENU_VIDEO:
        return SUBMENU_MESSAGES.video;
      default:
        return MENU_MESSAGE;
    }
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
        await this.processCryptoCoinSelectionMessage(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_LLM_ANALYSIS:
        await this.handleCryptoLLMAnalysisMode(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_ML_TRAINING:
        await this.handleCryptoMLTraining(contactId, text);
        break;
      case CHAT_MODES.CRYPTO_ML_MODEL_SELECTION:
        await this.handleCryptoMLModelSelection(contactId, text);
        break;
      case 'CRYPTO_TECHNICAL_ANALYSIS':
        await this.handleCryptoTechnicalAnalysisInput(contactId, text);
        break;
      default:
          logger.warn(`⚠️ Modo desconhecido encontrado: ${currentMode}`);
          this.setMode(contactId, null);
          await this.sendResponse(contactId, MENU_MESSAGE);
          break;
    }
  }


  async processAgendabotMessage(contactId, text) {
    try {
      await this.sendResponse(contactId, '📅 Processando agendamento...', true);
      const responseText = await this.llmService.getChatGPTResponse(contactId, text);
      
      let scheduleDataRaw;
      try {
        scheduleDataRaw = JSON.parse(responseText);
      } catch (parseError) {
        logger.verbose('LLM não retornou JSON válido, tentando novamente com prompt mais restritivo...');
        
        // Tentar novamente com prompt mais restritivo
        const restrictivePrompt = `CRITICAL: Responda APENAS com JSON válido. Nenhum texto adicional. Use esta estrutura:
{
  "message": "Texto do lembrete extraído da mensagem do usuário",
  "status": "approved",
  "scheduledTime": { "$date": "DATA_EM_ISO8601_UTC" },
  "expiryTime": { "$date": "DATA_EM_ISO8601_UTC" },
  "sentAt": null,
  "attempts": 0,
  "lastAttemptAt": null
}

Mensagem do usuário: ${text}`;
        
        try {
          const retryResponse = await this.llmService.chat(contactId, restrictivePrompt, CHAT_MODES.AGENDABOT);
          scheduleDataRaw = JSON.parse(retryResponse);
        } catch (retryError) {
          logger.error('Falha ao obter JSON válido mesmo após tentativa restritiva:', retryError);
          await this.sendResponse(contactId, `❌ **Erro de processamento**\n\nNão consegui processar seu agendamento. Tente ser mais específico com data, hora e mensagem.\n\n**Exemplo:**\n"Lembrar de reunião amanhã às 14h"\n\n**Resposta original do sistema:**\n${responseText}`);
          return;
        }
      }

      const scheduleResult = await this.scheduleHandler.createSchedule(contactId, scheduleDataRaw);
      if (!scheduleResult.success) {
        await this.sendResponse(contactId, `❌ Erro ao criar agendamento: ${scheduleResult.error}`);
        return;
      }
      await this.sendResponse(contactId, SUCCESS_MESSAGES.SCHEDULE_CREATED);
      this.llmService.clearContext(contactId, CHAT_MODES.AGENDABOT);
      
    } catch (err) {
      logger.error(`❌ Erro ao processar mensagem Agendabot para ${contactId}`, err);
      await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
    }
  }



  isImageModel(modelName) {
    // Detectar se é modelo de imagem baseado no nome
    const imageModelNames = ['llava', 'bakllava', 'moondream', 'vision'];
    return imageModelNames.some(name => modelName.toLowerCase().includes(name));
  }



  // DEPRECATED: Função removida do menu 5.4 - funcionalidade não incluída na nova versão
  async handleReiniciarOllamaCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🔄 *REINICIAR APLICAÇÃO (OLLAMA)*\n\n⚠️ **ATENÇÃO:** Esta operação irá:\n• Reiniciar toda a aplicação SecreBot\n• Descarregar todos os modelos Ollama\n• Limpar todas as conexões ativas\n• Recarregar configurações\n\n⏳ A aplicação será reiniciada em 10 segundos...\n\n📱 **Você receberá uma confirmação** quando o sistema voltar online.', true);
      
      logger.flow(`🔄 REINÍCIO DA APLICAÇÃO solicitado por ${contactId}`);
      logger.flow(`⚠️ A aplicação será reiniciada em 10 segundos para permitir limpeza do Ollama`);
      
      // Salvar informação do usuário que solicitou restart para notificar depois
      const restartInfo = {
        requestedBy: contactId,
        requestedAt: new Date().toISOString(),
        reason: 'ollama_restart'
      };
      
      // Salvar em arquivo temporário para recuperar após restart
      const fs = await import('fs/promises');
      const path = await import('path');
      const restartFile = path.join(process.cwd(), '.restart-info.json');
      
      try {
        await fs.writeFile(restartFile, JSON.stringify(restartInfo, null, 2));
        logger.file(`💾 Informações de restart salvas em ${restartFile}`);
      } catch (err) {
        logger.warn('⚠️ Não foi possível salvar informações de restart', { message: err.message });
      }
      
      // Aguardar 10 segundos para dar tempo da mensagem chegar
      setTimeout(async () => {
        logger.flow('🔄 Iniciando reinício da aplicação...');
        
        try {
          // Tentar descarregar modelos rapidamente antes do restart
          const models = await ollamaClient.list();
          if (models && models.models) {
            logger.flow(`📊 Tentando descarregar ${models.models.length} modelos antes do restart...`);
            for (const model of models.models.slice(0, 3)) { // Apenas os 3 primeiros para não demorar
              try {
                await this.unloadModel(model.name);
                logger.success(`✅ Modelo ${model.name} descarregado`);
              } catch (err) {
                logger.warn(`⚠️ Erro ao descarregar ${model.name}`, { message: err.message });
              }
            }
          }
        } catch (err) {
          logger.warn('⚠️ Erro ao descarregar modelos pre-restart', { message: err.message });
        }
        
        // Detectar ambiente e executar restart apropriado
        if (process.env.PM2_HOME || process.env.name || process.env.PM_ID || process.env.pm_id || process.env.PM2_JSON_PROCESSING) {
          // Executando via PM2
          logger.flow('🔄 Executando restart via PM2...');
          logger.verbose(`📊 PM2 vars: PM2_HOME=${process.env.PM2_HOME}, name=${process.env.name}, PM_ID=${process.env.PM_ID}`);
          process.exit(0); // PM2 irá reiniciar automaticamente
        } else if (process.env.DOCKER_CONTAINER) {
          // Executando em container Docker
          logger.flow('🔄 Executando restart em container Docker...');
          process.exit(0); // Docker restart policy irá reiniciar
        } else {
          // Executando diretamente - tentar restart gracioso
          logger.flow('🔄 Executando restart direto...');
          
          // Tentar usar processo pai se disponível
          if (process.send) {
            process.send('restart');
          }
          
          // Forçar saída para restart manual
          setTimeout(() => {
            process.exit(0);
          }, 1000);
        }
        
      }, 10000); // 10 segundos de delay
      
    } catch (err) {
      logger.error(`❌ Erro ao preparar reinício para ${contactId}`, err);
      await this.sendResponse(contactId, `❌ *ERRO AO REINICIAR APLICAÇÃO*\n\n🚫 **Erro:** ${err.message}\n\n⚠️ **Recomendação:** Tente reiniciar manualmente usando PM2 ou Docker.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
    }
  }

 
  
  async showCryptoConfig(contactId) {
    try {
      const currentConfig = this.cryptoService.getUserConfig(contactId);
      
      let message = `⚙️ *CONFIGURAÇÃO DE CRIPTOMOEDAS* ⚙️\n\n`;
      
      if (currentConfig) {
        message += `📊 *Configurações Atuais:*\n`;
        message += `🎯 Threshold: ${currentConfig.thresholdPercentage}%\n`;
        message += `⏱️ Timeframe: ${currentConfig.timeframe}\n`;
        message += `💰 Moedas: ${currentConfig.coins.join(', ')}\n`;
        message += `📈 Alertar alta: ${currentConfig.alertOnRise ? '✅' : '❌'}\n`;
        message += `📉 Alertar queda: ${currentConfig.alertOnFall ? '✅' : '❌'}\n`;
        message += `⏰ Cooldown: ${currentConfig.cooldownMinutes} min\n\n`;
        
        message += `📝 *Para Alterar:*\n`;
        message += `• "${COMMANDS.CRYPTO_CONFIG} threshold 2.5" - Define threshold para 2.5%\n`;
        message += `• "${COMMANDS.CRYPTO_CONFIG} timeframe 5m" - Define timeframe para 5 minutos\n`;
        message += `• "${COMMANDS.CRYPTO_CONFIG} cooldown 30" - Define cooldown para 30 minutos\n`;
        message += `• "${COMMANDS.CRYPTO_CONFIG} alta off" - Desativa alertas de alta\n`;
        message += `• "${COMMANDS.CRYPTO_CONFIG} queda off" - Desativa alertas de queda\n\n`;
      } else {
        message += `❌ *Monitoramento não está ativo*\n\n`;
        message += `💡 Use 9.2 para ativar primeiro e depois configure os parâmetros.\n\n`;
      }
      
      message += `📋 *Opções Disponíveis:*\n`;
      message += `🎯 Threshold: 0.1% a 50%\n`;
      message += `⏱️ Timeframes: 1m, 5m, 15m, 1h\n`;
      message += `⏰ Cooldown: 1 a 120 minutos\n`;
      message += `💰 Moedas: bitcoin, ethereum, cardano, polkadot, polygon\n\n`;
      
      message += `💡 _Exemplo: ${COMMANDS.CRYPTO_CONFIG} threshold 1.5_`;

      await this.sendResponse(contactId, message);
    } catch (error) {
      logger.error(`Erro ao mostrar configuração crypto para ${contactId}:`, error);
      await this.sendResponse(contactId, `❌ Erro ao acessar configurações: ${error.message}`);
    }
  }

  // Método para verificar e enviar alertas pendentes (chamado periodicamente)
  async checkAndSendCryptoAlerts() {
    try {
      const pendingAlerts = this.cryptoService.getPendingAlerts();
      
      for (const alert of pendingAlerts) {
        await this.sendResponse(alert.userId, alert.message);
        logger.info(`Alerta crypto enviado para ${alert.userId}`);
      }
    } catch (error) {
      logger.error('Erro ao enviar alertas crypto:', error);
    }
  }

  // Inicia timer para verificar alertas crypto
  startCryptoAlertsTimer() {
    // Verificar alertas a cada 30 segundos
    this.cryptoAlertsTimer = setInterval(async () => {
      await this.checkAndSendCryptoAlerts();
    }, 30000);
    
    logger.info('⏰ Timer de alertas crypto iniciado (30s)');
  }

  // Novos métodos de preferências crypto



  async processCryptoCoinSelectionMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      // Allow cancellation
      if (lowerText === 'cancelar' || lowerText === 'sair' || lowerText === 'voltar') {
        this.setMode(contactId, null);
        await this.sendResponse(contactId, '❌ Seleção de moedas cancelada.\n\n📋 Para voltar ao menu crypto: digite 9');
        return;
      }
      
      // Parse the coin symbols
      const symbols = text.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
      
      if (symbols.length === 0) {
        await this.sendResponse(contactId, '❌ Nenhuma moeda foi identificada.\n\n💡 Digite os símbolos separados por vírgula:\nExemplo: BTC, ETH, ADA\n\n❌ Digite "cancelar" para sair.');
        return;
      }
      
      // Validate symbols against available coins
      const top20 = this.cryptoService.top20Cryptos;
      const availableSymbols = top20.map(coin => coin.symbol.toUpperCase());
      const validSymbols = [];
      const invalidSymbols = [];
      
      symbols.forEach(symbol => {
        if (availableSymbols.includes(symbol)) {
          validSymbols.push(symbol);
        } else {
          invalidSymbols.push(symbol);
        }
      });
      
      if (validSymbols.length === 0) {
        let message = `❌ Nenhuma moeda válida encontrada.\n\n`;
        message += `🚫 Símbolos inválidos: ${invalidSymbols.join(', ')}\n\n`;
        message += `📋 *Símbolos disponíveis:*\n${availableSymbols.join(', ')}\n\n`;
        message += `💡 Tente novamente ou digite "cancelar" para sair.`;
        
        await this.sendResponse(contactId, message);
        return;
      }
      
      // Convert symbols to coin IDs
      const selectedCoins = top20
        .filter(coin => validSymbols.includes(coin.symbol.toUpperCase()))
        .map(coin => coin.id);
      
      // Save user preferences
      await this.sendResponse(contactId, '💾 Salvando suas preferências...', true);
      
      try {
        await this.cryptoService.saveUserPreferences(contactId, selectedCoins);
        
        // Exit selection mode
        this.setMode(contactId, null);
        
        let message = `✅ *Preferências salvas com sucesso!*\n\n`;
        message += `🎯 *Moedas selecionadas (${validSymbols.length}):*\n`;
        
        validSymbols.forEach((symbol, index) => {
          const coin = top20.find(c => c.symbol.toUpperCase() === symbol);
          message += `${index + 1}. ${symbol} - ${coin.name}\n`;
        });
        
        if (invalidSymbols.length > 0) {
          message += `\n⚠️ *Símbolos ignorados:* ${invalidSymbols.join(', ')}\n`;
        }
        
        message += `\n💡 *Próximos passos:*\n`;
        message += `📊 9.1 - Ver cotações das suas moedas\n`;
        message += `🎯 9.6 - Ver suas preferências\n`;
        message += `🔔 9.2 - Ativar alertas automáticos`;
        
        await this.sendResponse(contactId, message);
        
      } catch (error) {
        logger.error(`Erro ao salvar preferências crypto para ${contactId}:`, error);
        await this.sendResponse(contactId, `❌ Erro ao salvar preferências: ${error.message}\n\n💡 Tente novamente ou use a interface web:\nhttp://localhost:3000/crypto-preferences`);
      }
      
    } catch (error) {
      logger.error(`Erro ao processar seleção crypto para ${contactId}:`, error);
      this.setMode(contactId, null);
      await this.sendResponse(contactId, `❌ Erro interno. Seleção cancelada.\n\n📋 Para voltar ao menu crypto: digite 9`);
    }
  }




}

export default WhatsAppBot;

