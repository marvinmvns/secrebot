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
  PROMPTS,
  __dirname
} from '../config/index.js';
const ollamaClient = new Ollama({ host: CONFIG.llm.host });

// Importar o serviço TTS
import TtsService from '../services/ttsService.js';
import CalorieService from '../services/calorieService.js';
import { loginAndGetLiAt } from '../services/linkedinScraper.js';
import YouTubeService from '../services/youtubeService.js';

// ============ Bot do WhatsApp ============
class WhatsAppBot {
  // CORREÇÃO: Adicionar ttsService ao construtor e atribuí-lo
  constructor(scheduler, llmService, transcriber, ttsService) {
    this.scheduler = scheduler;
    this.llmService = llmService;
    this.transcriber = transcriber;
    this.ttsService = ttsService; // CORREÇÃO: Atribuir o serviço TTS
    this.chatModes = new Map();
    this.navigationStates = new Map(); // Para navegação hierárquica
    this.userPreferences = new Map(); // Para armazenar preferências (ex: { voiceResponse: true/false })
    this.linkedinSessions = new Map(); // contato -> li_at
    this.awaitingLinkedinCreds = new Map();
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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


  setupEvents() {
    this.client.on('qr', qr => {
      qrcode.generate(qr, { small: true });
      logger.info('📱 QR Code gerado. Escaneie para login.');
    });

    this.client.on('ready', () => {
      logger.info('✅ Cliente WhatsApp pronto!');
      this.startScheduler();
    });

    this.client.on('authenticated', () => logger.info('🔐 WhatsApp autenticado.'));
    this.client.on('auth_failure', msg => {
      logger.error('❌ Falha na autenticação', msg);
      process.exit(1);
    });

    this.client.on('disconnected', reason => {
      logger.error('🔌 WhatsApp desconectado', reason);
      process.exit(1);
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
      
      // Verificar se foi um restart solicitado por usuário
      setTimeout(() => {
        this.checkForRestartNotification();
      }, 5000); // Aguardar 5 segundos após inicialização
      
    } catch (err) {
      logger.error('❌ Erro na inicialização do WhatsApp', err);
      throw err;
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
    return commands.some(cmd => lower.startsWith(cmd));
  }

  getCurrentMode(contactId) {
    return this.chatModes.get(contactId) || null;
  }

  setMode(contactId, mode) {
    if (mode) {
      this.chatModes.set(contactId, mode);
      logger.log(`🔧 Modo para ${contactId} definido para: ${mode}`);
    } else {
      const currentMode = this.chatModes.get(contactId);
      if (currentMode) {
          this.llmService.clearContext(contactId, currentMode);
          logger.service(`🧹 Contexto LLM para modo ${currentMode} de ${contactId} limpo.`);
      }
      this.chatModes.delete(contactId);
      logger.log(`🔧 Modo para ${contactId} removido.`);
    }
  }

  // Métodos para navegação hierárquica
  getNavigationState(contactId) {
    return this.navigationStates.get(contactId) || NAVIGATION_STATES.MAIN_MENU;
  }

  setNavigationState(contactId, state) {
    if (state === NAVIGATION_STATES.MAIN_MENU) {
      this.navigationStates.delete(contactId);
      logger.log(`📍 Estado de navegação para ${contactId} resetado para menu principal.`);
    } else {
      this.navigationStates.set(contactId, state);
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
        return await this.handleAgendaSubmenu(msg, contactId, numericInput);
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
        return await this.handleVideoSubmenu(msg, contactId, numericInput);
      default:
        return false;
    }
  }

  async handleAgendaSubmenu(msg, contactId, input) {
    switch (input) {
      case '1.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.AGENDA });
        return true;
      case '1.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.LISTAR });
        return true;
      case '1.3':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.DELETAR });
        return true;
      case '1.4':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.IMPORTAR_AGENDA });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.sendResponse(contactId, MENU_MESSAGE);
        return true;
    }
    return false;
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
        await this.handleMessage({ ...msg, body: COMMANDS.RECURSO });
        return true;
      case '5.3':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.MODELOS });
        return true;
      case '5.4':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.TROCAR_MODELO });
        return true;
      case '5.5':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.MODELOS_WHISPER });
        return true;
      case '5.6':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.TROCAR_MODELO_WHISPER });
        return true;
      case '5.7':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.REINICIAR_OLLAMA });
        return true;
      case '5.8':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.REINICIAR_WHISPER });
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

  async handleVideoSubmenu(msg, contactId, input) {
    switch (input) {
      case '2.3.1':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.RESUMIRVIDEO });
        return true;
      case '2.3.2':
        this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
        await this.handleMessage({ ...msg, body: COMMANDS.RESUMIRVIDEO2 });
        return true;
      case '0':
        this.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_IA);
        await this.sendResponse(contactId, SUBMENU_MESSAGES.ia);
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
      'submenu_suporte': 'Suporte & Sistema'
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

    // CORREÇÃO: A verificação 'this.ttsService' garante que o serviço foi injetado
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

    if (this.awaitingLinkedinCreds.get(contactId)) {
      const [user, pass] = text.split(/[:\s]+/);
      try {
        const cookie = await loginAndGetLiAt(user, pass, CONFIG.linkedin.timeoutMs);
        if (cookie) {
          this.linkedinSessions.set(contactId, cookie);
          await this.sendResponse(contactId, '✅ Login do LinkedIn salvo!');
        } else {
          await this.sendResponse(contactId, '❌ Falha ao obter cookie li_at');
        }
      } catch (err) {
        await this.sendResponse(contactId, '❌ Erro no login: ' + err.message);
      }
      this.awaitingLinkedinCreds.delete(contactId);
      return;
    }

    if (Utils.isVoltarCommand(text)) {
      this.setMode(contactId, null);
      this.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
      await this.sendResponse(contactId, MENU_MESSAGE);
      return;
    }

    const currentMode = this.getCurrentMode(contactId);
    const navigationState = this.getNavigationState(contactId);

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
            await this.handleAudioMessage(msg, contactId);
            return;
        }
    }

    if (currentMode) {
        await this.processMessageByMode(contactId, text, msg);
        return;
    }

    logger.log(`❓ Mensagem não reconhecida de ${contactId}, exibindo menu.`);
    await this.sendResponse(contactId, MENU_MESSAGE);
  }

  async handleCommand(msg, contactId, lowerText, originalText) {
      const commandHandlers = {
          [COMMANDS.MENU]: async () => {
              this.setMode(contactId, null);
              await this.sendResponse(contactId, MENU_MESSAGE);
          },
          [COMMANDS.AJUDA]: async () => {
              this.setMode(contactId, null);
              await this.sendResponse(contactId, MENU_MESSAGE);
          },
          [COMMANDS.DEEP]: () => this.handleDeepCommand(contactId, originalText),
          [COMMANDS.AGENDA]: () => this.handleAgendabotCommand(contactId, originalText),
          [COMMANDS.TRANSCREVER]: () => this.handleTranscreverCommand(contactId),
          [COMMANDS.TRANSCREVER_RESUMIR]: () => this.handleTranscreverResumir(contactId),
          [COMMANDS.LINKEDIN]: () => this.handleLinkedinCommand(contactId, originalText),
          [COMMANDS.LISTAR]: () => this.handleListarCommand(contactId),
          [COMMANDS.DELETAR]: () => this.handleDeletarCommand(contactId),
          [COMMANDS.VOZ]: () => this.handleVozCommand(contactId),
          [COMMANDS.RECURSO]: () => this.handleRecursoCommand(contactId),
          [COMMANDS.RESUMIR]: () => this.handleResumirCommand(msg, contactId),
          [COMMANDS.RESUMIRVIDEO]: () => this.handleResumirVideoCommand(msg, contactId),
          [COMMANDS.RESUMIRVIDEO2]: () => this.handleResumirVideo2Command(msg, contactId),
          [COMMANDS.IMPORTAR_AGENDA]: () => this.handleImportarAgendaCommand(msg, contactId),
          [COMMANDS.FOTO]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.CALORIAS]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.MODELOS]: () => this.handleModelosCommand(contactId),
          [COMMANDS.TROCAR_MODELO]: () => this.handleTrocarModeloCommand(contactId),
          [COMMANDS.MODELOS_WHISPER]: () => this.handleModelosWhisperCommand(contactId),
          [COMMANDS.TROCAR_MODELO_WHISPER]: () => this.handleTrocarModeloWhisperCommand(contactId),
          [COMMANDS.REINICIAR_OLLAMA]: () => this.handleReiniciarOllamaCommand(contactId),
          [COMMANDS.REINICIAR_WHISPER]: () => this.handleReiniciarWhisperCommand(contactId)
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

  async handleVozCommand(contactId) {
      const voiceEnabled = this.toggleVoicePreference(contactId);
      const message = voiceEnabled ? SUCCESS_MESSAGES.VOICE_ENABLED : SUCCESS_MESSAGES.VOICE_DISABLED;
      // Enviar confirmação sempre em texto para clareza
      await this.sendResponse(contactId, message, true);
  }

  async handleModelosCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🤖 Carregando lista de modelos IA...', true);
      
      // Listar modelos usando API do Ollama
      const models = await ollamaClient.list();
      
      if (!models || !models.models || models.models.length === 0) {
        await this.sendResponse(contactId, '❌ Nenhum modelo encontrado no Ollama.\n\nVerifique se o Ollama está rodando e possui modelos instalados.');
        return;
      }
      
      // Obter modelo atual
      const currentModel = CONFIG.llm.model;
      const currentImageModel = CONFIG.llm.imageModel;
      
      let message = '🤖 *MODELOS IA DISPONÍVEIS*\n\n';
      message += `📋 *Modelo Atual (Texto):* ${currentModel}\n`;
      message += `🖼️ *Modelo Atual (Imagem):* ${currentImageModel}\n\n`;
      message += '📊 *Modelos Instalados:*\n\n';
      
      models.models.forEach((model, index) => {
        const isCurrentText = model.name === currentModel;
        const isCurrentImage = model.name === currentImageModel;
        const icon = isCurrentText ? '✅' : (isCurrentImage ? '🖼️' : '🔸');
        
        message += `${icon} **${index + 1}.** ${model.name}\n`;
        
        if (model.details) {
          const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);
          message += `   📏 Tamanho: ${sizeGB}GB\n`;
          
          if (model.details.family) {
            message += `   🏷️ Família: ${model.details.family}\n`;
          }
        }
        
        if (model.modified_at) {
          const modDate = new Date(model.modified_at).toLocaleDateString('pt-BR');
          message += `   📅 Modificado: ${modDate}\n`;
        }
        
        message += '\n';
      });
      
      message += `💡 *Para trocar modelo:* Use ${COMMANDS.TROCAR_MODELO}\n`;
      message += `🔄 *Para atualizar lista:* Use ${COMMANDS.MODELOS}\n\n`;
      message += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
      
      await this.sendResponse(contactId, message);
      
    } catch (err) {
      logger.error(`❌ Erro ao listar modelos para ${contactId}`, err);
      await this.sendResponse(contactId, '❌ Erro ao acessar modelos do Ollama.\n\nVerifique se o serviço está rodando e tente novamente.');
    }
  }

  async handleTrocarModeloCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🤖 Carregando modelos disponíveis...', true);
      
      // Listar modelos para seleção
      const models = await ollamaClient.list();
      
      if (!models || !models.models || models.models.length === 0) {
        await this.sendResponse(contactId, '❌ Nenhum modelo encontrado no Ollama.\n\nVerifique se o Ollama está rodando e possui modelos instalados.');
        return;
      }
      
      // Armazenar lista de modelos para este usuário
      this.setUserPreference(contactId, 'availableModels', models.models);
      
      let message = '🔄 *TROCAR MODELO IA*\n\n';
      message += '🤖 *Selecione o novo modelo:*\n\n';
      
      models.models.forEach((model, index) => {
        const isCurrentText = model.name === CONFIG.llm.model;
        const isCurrentImage = model.name === CONFIG.llm.imageModel;
        const status = isCurrentText ? ' ✅ (atual-texto)' : (isCurrentImage ? ' 🖼️ (atual-imagem)' : '');
        
        message += `**${index + 1}.** ${model.name}${status}\n`;
        
        if (model.details?.family) {
          message += `   🏷️ ${model.details.family}`;
          if (model.details.parameter_size) {
            message += ` (${model.details.parameter_size})`;
          }
          message += '\n';
        }
        
        message += '\n';
      });
      
      message += '📝 *Digite o número* do modelo que deseja ativar.\n\n';
      message += '💡 *Tipos de modelo:*\n';
      message += '• Modelos de texto: llama, granite, mistral, etc.\n';
      message += '• Modelos de imagem: llava, bakllava, etc.\n\n';
      message += `🔙 Para cancelar: ${COMMANDS.VOLTAR}`;
      
      this.setMode(contactId, CHAT_MODES.TROCAR_MODELO);
      await this.sendResponse(contactId, message);
      
    } catch (err) {
      logger.error(`❌ Erro ao preparar troca de modelo para ${contactId}`, err);
      await this.sendResponse(contactId, '❌ Erro ao acessar modelos do Ollama.\n\nVerifique se o serviço está rodando e tente novamente.');
    }
  }

  async handleModelosWhisperCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🎤 *MODELOS WHISPER DISPONÍVEIS*\n\n⏳ Carregando lista...', true);
      
      const currentModel = CONFIG.audio.model;
      
      let message = '🎤 *MODELOS WHISPER DISPONÍVEIS*\n\n';
      message += '🗣️ *Lista de modelos para transcrição:*\n\n';
      
      WHISPER_MODELS_LIST.forEach((model, index) => {
        const isCurrent = model === currentModel;
        const status = isCurrent ? ' ✅ (ativo)' : '';
        
        message += `**${index + 1}.** ${model}${status}\n`;
        
        // Adicionar descrição do modelo
        if (model.includes('tiny')) {
          message += '   📊 Mais rápido, menor qualidade\n';
        } else if (model.includes('small')) {
          message += '   ⚖️ Equilibrio velocidade/qualidade\n';
        } else if (model.includes('medium')) {
          message += '   🎯 Boa qualidade, velocidade moderada\n';
        } else if (model.includes('large')) {
          message += '   🏆 Melhor qualidade, mais lento\n';
        } else if (model.includes('base')) {
          message += '   🔸 Qualidade básica, rápido\n';
        }
        
        if (model.includes('.en')) {
          message += '   🇺🇸 Especializado em inglês\n';
        } else {
          message += '   🌍 Multilíngue (inclui português)\n';
        }
        
        message += '\n';
      });
      
      message += '💡 **Sobre os modelos:**\n';
      message += '• **tiny:** Mais rápido, menor precisão\n';
      message += '• **base/small:** Equilibrio ótimo para uso geral\n';
      message += '• **medium:** Qualidade superior\n';
      message += '• **large:** Máxima qualidade para casos críticos\n';
      message += '• **.en:** Versões otimizadas apenas para inglês\n\n';
      message += `🔄 Para trocar modelo: ${COMMANDS.TROCAR_MODELO_WHISPER}\n`;
      message += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
      
      await this.sendResponse(contactId, message);
      
    } catch (err) {
      logger.error(`❌ Erro ao listar modelos Whisper para ${contactId}`, err);
      await this.sendResponse(contactId, '❌ Erro ao listar modelos Whisper.\n\nTente novamente mais tarde.');
    }
  }

  async handleTrocarModeloWhisperCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🎤 *TROCAR MODELO WHISPER*\n\n⏳ Preparando lista de modelos...', true);
      
      const currentModel = CONFIG.audio.model;
      
      // Armazenar lista de modelos para este usuário
      this.setUserPreference(contactId, 'availableWhisperModels', WHISPER_MODELS_LIST);
      
      let message = '🔄 *TROCAR MODELO WHISPER*\n\n';
      message += '🎤 *Selecione o novo modelo:*\n\n';
      
      WHISPER_MODELS_LIST.forEach((model, index) => {
        const isCurrent = model === currentModel;
        const status = isCurrent ? ' ✅ (atual)' : '';
        
        message += `**${index + 1}.** ${model}${status}\n`;
        
        // Adicionar informação do modelo
        if (model.includes('tiny')) {
          message += '   ⚡ Ultrarrápido\n';
        } else if (model.includes('small')) {
          message += '   🚀 Rápido\n';
        } else if (model.includes('medium')) {
          message += '   ⚖️ Moderado\n';
        } else if (model.includes('large')) {
          message += '   🐌 Lento, alta qualidade\n';
        } else if (model.includes('base')) {
          message += '   💨 Básico e rápido\n';
        }
        
        message += '\n';
      });
      
      message += '📝 *Digite o número* do modelo que deseja ativar.\n\n';
      message += '💡 **Recomendações:**\n';
      message += '• **Uso geral:** small ou base\n';
      message += '• **Só inglês:** tiny.en ou small.en\n';
      message += '• **Máxima qualidade:** large-v3-turbo\n';
      message += '• **Rapidez máxima:** tiny\n\n';
      message += `🔙 Para cancelar: ${COMMANDS.VOLTAR}`;
      
      this.setMode(contactId, CHAT_MODES.TROCAR_MODELO_WHISPER);
      await this.sendResponse(contactId, message);
      
    } catch (err) {
      logger.error(`❌ Erro ao preparar troca de modelo Whisper para ${contactId}`, err);
      await this.sendResponse(contactId, '❌ Erro ao acessar modelos Whisper.\n\nTente novamente mais tarde.');
    }
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

  async handleResumirCommand(msg, contactId) {
      const text = msg.body.substring(COMMANDS.RESUMIR.length).trim();
      
      if (msg.hasMedia || text) {
          await this.sendResponse(contactId, '⚠️ *Comando !resumir ativado!*\n\nPara usar o comando !resumir, envie apenas `!resumir` primeiro.\nEm seguida, envie o documento ou texto que deseja resumir.\n\n🔙 Para voltar ao menu: !voltar');
          return;
      }
      
      this.setMode(contactId, CHAT_MODES.RESUMIR);
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.RESUMIR]);
  }

  async performResumir(msg, contactId, providedText = '') {
      let textContent = '';
      let fileType = '';

      if (msg && msg.hasMedia) {
          await this.sendResponse(contactId, '⏳ *Processando arquivo...*', true);
          
          const media = await Utils.downloadMediaWithRetry(msg);
          if (!media) {
              await this.sendErrorMessage(contactId, '❌ Não foi possível baixar o arquivo. Tente novamente.');
              return;
          }
          
          const buffer = Buffer.from(media.data, 'base64');
          const filename = msg.filename ? msg.filename.toLowerCase() : '';
          const type = msg.mimetype;
          
          // Debug info
          logger.verbose(`🔍 Debug arquivo - Contato: ${contactId}`);
          logger.verbose(`📁 Filename: ${msg.filename}`);
          logger.verbose(`📁 Filename lowercase: ${filename}`);
          logger.verbose(`🏷️ MIME type: ${type}`);
          logger.verbose(`📏 Buffer size: ${buffer.length} bytes`);
          
          try {
              // Função para detectar PDF por magic bytes
              const detectPdfByHeader = (buffer) => {
                  if (buffer.length < 4) return false;
                  const header = buffer.subarray(0, 4).toString('ascii');
                  return header === '%PDF';
              };
              
              // Função para detectar DOCX por magic bytes (ZIP signature)
              const detectDocxByHeader = (buffer) => {
                  if (buffer.length < 4) return false;
                  const header = buffer.subarray(0, 4);
                  return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
              };
              
              // Detectar tipo de arquivo por múltiplos métodos
              const isPdf = filename.endsWith('.pdf') || 
                           type === 'application/pdf' || 
                           (type === 'application/octet-stream' && detectPdfByHeader(buffer)) ||
                           detectPdfByHeader(buffer);
                           
              const isTxt = filename.endsWith('.txt') || type === 'text/plain';
              const isCsv = filename.endsWith('.csv') || type === 'text/csv' || type === 'application/csv';
              const isDocx = filename.endsWith('.docx') || 
                            type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                            (type === 'application/octet-stream' && detectDocxByHeader(buffer) && filename.includes('docx'));
              
              logger.verbose(`🔍 Detecção de tipo:`);
              logger.verbose(`📄 isPdf: ${isPdf} (magic: ${detectPdfByHeader(buffer)})`);
              logger.verbose(`📄 isTxt: ${isTxt}`);
              logger.verbose(`📄 isCsv: ${isCsv}`);
              logger.verbose(`📄 isDocx: ${isDocx} (magic: ${detectDocxByHeader(buffer)})`);
              
              if (isPdf) {
                  fileType = 'PDF';
                  await this.sendResponse(contactId, '📑 Extraindo texto do PDF...', true);
                  textContent = await parsePdfBuffer(buffer);
              } else if (isTxt) {
                  fileType = 'TXT';
                  await this.sendResponse(contactId, '📄 Lendo arquivo de texto...', true);
                  textContent = buffer.toString('utf8');
              } else if (isCsv) {
                  fileType = 'CSV';
                  await this.sendResponse(contactId, '📊 Processando arquivo CSV...', true);
                  textContent = buffer.toString('utf8');
              } else if (isDocx) {
                  fileType = 'DOCX';
                  await this.sendResponse(contactId, '📄 Extraindo texto do Word...', true);
                  const result = await mammoth.extractRawText({ buffer });
                  textContent = result.value;
              } else {
                  logger.warn(`❌ Tipo de arquivo não reconhecido`);
                  await this.sendResponse(contactId, `❌ *Tipo de arquivo não suportado*\n\n📎 **Arquivo recebido:**\n• Nome: ${msg.filename || 'sem nome'}\n• Tipo: ${type || 'desconhecido'}\n• Tamanho: ${buffer.length} bytes\n\n📎 **Formatos aceitos:**\n• PDF (.pdf)\n• Word (.docx)\n• Texto (.txt)\n• CSV (.csv)\n\n🔄 Envie um arquivo válido ou !voltar para cancelar`);
                  return;
              }
          } catch (err) {
              logger.error(`❌ Erro ao ler arquivo ${fileType} para ${contactId}`, err);
              await this.sendErrorMessage(contactId, `❌ Erro ao processar arquivo ${fileType}. Verifique se o arquivo não está corrompido e tente novamente.`);
              return;
          }
      } else if (providedText) {
          textContent = providedText;
          fileType = 'texto fornecido';
      } else if (msg && msg.body) {
          textContent = msg.body.trim();
          fileType = 'mensagem de texto';
      }

      if (!textContent || textContent.trim().length === 0) {
          await this.sendResponse(contactId, '❌ *Conteúdo vazio detectado*\n\nO arquivo ou texto não contém informações para resumir.\n\n🔄 Envie outro documento ou !voltar para cancelar');
          return;
      }

      const originalLength = textContent.length;
      const text = textContent.trim().slice(0, 1500000);
      const truncated = originalLength > 1500000;

      try {
          let statusMsg = `📝 *Gerando resumo...*\n\n📊 Caracteres: ${originalLength.toLocaleString()}`;
          if (fileType) {
              statusMsg += `\n📎 Fonte: ${fileType}`;
          }
          if (truncated) {
              statusMsg += `\n⚠️ Texto truncado para 8.000 caracteres`;
          }
          
          await this.sendResponse(contactId, statusMsg, true);
          
          const summary = await this.llmService.getAssistantResponse(contactId, `Resuma em português o texto a seguir de forma clara e concisa:\n\n${text}`);
          
          let finalResponse = `✅ *Resumo Concluído*\n\n${summary}`;
          
          if (truncated) {
              finalResponse += `\n\n⚠️ *Nota:* Devido ao tamanho do documento, apenas os primeiros 8.000 caracteres foram resumidos.`;
          }
          
          finalResponse += `\n\n🔙 Para voltar ao menu: !voltar`;
          
          await this.sendResponse(contactId, finalResponse);
          
      } catch (err) {
          logger.error(`❌ Erro ao gerar resumo para ${contactId}`, err);
          await this.sendErrorMessage(contactId, '❌ Erro ao gerar o resumo. Tente novamente em alguns instantes.');
      }
  }

  async processVideoSummaryResilient(link, contactId, method) {
      const maxRetries = 3;
      const retryDelays = [2000, 5000, 10000];
      let lastError = null;
      
      logger.flow(`▶️ Iniciando resumo de vídeo resiliente para ${contactId}. Método: ${method}, Link: ${link}`);
      
      if (!this.checkCircuitBreaker(contactId)) {
          await this.sendErrorMessage(contactId, '⚠️ Sistema temporariamente indisponível para processamento de vídeo devido a falhas recentes. Tente novamente em 5 minutos.');
          return;
      }
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
              logger.verbose(`🔄 Tentativa ${attempt}/${maxRetries} para processar vídeo`);
              
              const progressMsg = attempt === 1 
                  ? `⏳ Transcrevendo vídeo${method === 'whisper' ? ' via Whisper' : ''}...`
                  : `🔄 Tentativa ${attempt}/${maxRetries} - Transcrevendo vídeo...`;
              
              await this.sendResponse(contactId, progressMsg, true);
              
              let transcript;
              if (method === 'whisper') {
                  logger.service('🎙️ Chamando serviço YouTubeService.fetchTranscriptWhisperOnly');
                  transcript = await YouTubeService.fetchTranscriptWhisperOnly(link);
              } else {
                  logger.service('🎙️ Chamando serviço YouTubeService.fetchTranscript');
                  transcript = await YouTubeService.fetchTranscript(link);
              }
              
              logger.verbose(`📝 Transcrição concluída (${transcript?.length || 0} caracteres)`);
              
              if (!transcript || transcript.trim().length === 0) {
                  const errorMsg = `❌ Transcrição vazia na tentativa ${attempt}/${maxRetries}`;
                  logger.warn(errorMsg);
                  
                  if (attempt === maxRetries) {
                      await this.sendResponse(contactId, '❌ Não foi possível obter a transcrição do vídeo após múltiplas tentativas. Verifique se o link está correto e se o vídeo possui legendas/áudio.');
                      return;
                  }
                  
                  await this.sendResponse(contactId, `⚠️ Falha na transcrição. Tentando novamente em ${retryDelays[attempt-1]/1000}s...`);
                  await new Promise(resolve => setTimeout(resolve, retryDelays[attempt-1]));
                  continue;
              }
              
              const transcriptLength = transcript.length;
              const truncatedTranscript = transcript.slice(0, 15000);
              const truncated = transcriptLength > 15000;
              
              if (truncated) {
                  logger.verbose('⚠️ Transcrição grande, aplicando truncamento para 15k caracteres');
              }
              
              await this.sendResponse(contactId, 
                  `📝 *Gerando resumo...*\n\n📊 Caracteres transcritos: ${transcriptLength.toLocaleString()}${truncated ? '\n⚠️ Texto truncado para processamento' : ''}`, 
                  true
              );
              
              const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos, em até 30 linhas:\n\n${truncatedTranscript}`;
              
              logger.flow(`📨 Prompt preparado com ${summaryPrompt.length} caracteres. Enviando ao LLM`);
              
              let summary;
              try {
                  logger.api('💬 Chamando LLM para gerar resumo');
                  summary = await this.llmService.getAssistantResponse(contactId, summaryPrompt);
              } catch (llmError) {
                  logger.error(`❌ Erro no LLM ao processar vídeo para ${contactId}`, llmError);
                  
                  if (llmError.message && llmError.message.includes('timeout')) {
                      if (attempt === maxRetries) {
                          await this.sendResponse(contactId, '⏱️ O processamento do vídeo demorou mais que o esperado após múltiplas tentativas. Tente novamente com um vídeo menor ou aguarde alguns minutos.');
                          return;
                      }
                      
                      await this.sendResponse(contactId, `⏱️ Timeout na geração do resumo. Tentando novamente em ${retryDelays[attempt-1]/1000}s...`);
                      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt-1]));
                      continue;
                  }
                  throw llmError;
              }
              
              logger.verbose(`✅ Resumo gerado com ${summary.length} caracteres`);
              logger.flow('📤 Enviando resumo final ao usuário');
              
              let finalResponse = `📑 *Resumo do Vídeo*\n\n${summary}`;
              if (truncated) {
                  finalResponse += `\n\n⚠️ *Nota:* Devido ao tamanho da transcrição, apenas os primeiros 15.000 caracteres foram resumidos.`;
              }
              
              if (attempt > 1) {
                  finalResponse += `\n\n✅ *Sucesso na tentativa ${attempt}/${maxRetries}*`;
              }
              
              await this.sendResponse(contactId, finalResponse);
              logger.success('🏁 Processo de resumo finalizado com sucesso');
              return;
              
          } catch (err) {
              logger.error(`❌ Erro na tentativa ${attempt}/${maxRetries} para ${contactId}`, err);
              lastError = err;
              
              if (attempt === maxRetries) {
                  break;
              }
              
              const shouldRetry = this.shouldRetryVideoProcessing(err);
              if (!shouldRetry) {
                  logger.warn(`❌ Erro não recuperável, interrompendo tentativas: ${err.message}`);
                  break;
              }
              
              await this.sendResponse(contactId, `⚠️ Erro temporário. Tentando novamente em ${retryDelays[attempt-1]/1000}s...`);
              await new Promise(resolve => setTimeout(resolve, retryDelays[attempt-1]));
          }
      }
      
      logger.error(`❌ Falha final no processamento de vídeo para ${contactId}`, lastError);
      
      const circuitBreakerTriggered = this.recordVideoProcessingFailure(contactId, lastError);
      
      if (circuitBreakerTriggered) {
          await this.sendErrorMessage(contactId, '⚠️ Muitas falhas detectadas no processamento de vídeo. O sistema foi temporariamente bloqueado por 5 minutos para proteção. Tente novamente mais tarde.');
      } else if (lastError?.message?.includes('falhou após') && lastError?.message?.includes('tentativas')) {
          await this.sendErrorMessage(contactId, '⏱️ O processamento do vídeo demorou mais que o esperado. O sistema tentou por até 1 hora, mas não conseguiu completar. Tente novamente mais tarde ou com um vídeo menor.');
      } else {
          await this.sendErrorMessage(contactId, `❌ Erro ao processar o vídeo após ${maxRetries} tentativas. Verifique se o link é válido e tente novamente em alguns minutos.`);
      }
  }

  shouldRetryVideoProcessing(error) {
      const retryableErrors = [
          'network',
          'timeout',
          'connection',
          'ECONNRESET',
          'ENOTFOUND',
          'ECONNREFUSED',
          'socket hang up',
          'request timeout',
          'Parse error',
          'Unexpected token',
          'JSON',
          'HTTP error',
          'Service unavailable',
          'Bad gateway',
          'Gateway timeout'
      ];
      
      const errorMessage = error.message.toLowerCase();
      return retryableErrors.some(retryableError => 
          errorMessage.includes(retryableError.toLowerCase())
      );
  }

  getVideoProcessingCircuitBreaker() {
      if (!this.videoCircuitBreaker) {
          this.videoCircuitBreaker = {
              failures: new Map(),
              isOpen: false,
              lastFailureTime: 0,
              resetTimeoutMs: 300000
          };
      }
      return this.videoCircuitBreaker;
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

  recordVideoProcessingFailure(contactId, error) {
      const cb = this.getVideoProcessingCircuitBreaker();
      const now = Date.now();
      
      const userFailures = cb.failures.get(contactId) || [];
      userFailures.push({ time: now, error: error.message });
      
      const recentFailures = userFailures.filter(f => (now - f.time) < 900000);
      cb.failures.set(contactId, recentFailures);
      
      if (recentFailures.length >= 5) {
          logger.warn(`⚠️ Muitas falhas no processamento de vídeo para ${contactId} - ativando circuit breaker`);
          cb.isOpen = true;
          cb.lastFailureTime = now;
          return true;
      }
      
      return false;
  }

  async handleResumirVideoCommand(msg, contactId) {
      const link = msg.body.substring(COMMANDS.RESUMIRVIDEO.length).trim();
      if (!link) {
          await this.sendResponse(contactId, '📺 Por favor, envie o link do vídeo do YouTube que deseja transcrever.');
          return;
      }
      
      return this.processVideoSummaryResilient(link, contactId, 'fast');
  }

  async handleResumirVideo2Command(msg, contactId) {
      const link = msg.body.substring(COMMANDS.RESUMIRVIDEO2.length).trim();
      if (!link) {
          await this.sendResponse(contactId, '📺 Por favor, envie o link do vídeo do YouTube que deseja transcrever.');
          return;
      }
      
      return this.processVideoSummaryResilient(link, contactId, 'whisper');
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
      const response = await ollamaClient.generate({
        model: CONFIG.llm.imageModel,
        prompt: prompt,
        images: [imagePath],
        stream: false
      });
      const description = response.response.trim();
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

  async handleAgendabotCommand(contactId, text) {
    this.setMode(contactId, CHAT_MODES.AGENDABOT);
    const query = text.substring(COMMANDS.AGENDA.length).trim();
    if (!query) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.AGENDABOT]);
      return;
    }
    await this.processAgendabotMessage(contactId, query);
  }

  async handleTranscreverCommand(contactId) {
    this.setMode(contactId, CHAT_MODES.TRANSCRICAO);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.TRANSCRICAO]);
  }

  async handleTranscreverResumir(contactId) {
    this.setMode(contactId, CHAT_MODES.TRANSCREVER_RESUMIR);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.TRANSCREVER_RESUMIR]);
  }

  async handleLinkedinCommand(contactId, text) {
    const arg = text.substring(COMMANDS.LINKEDIN.length).trim();
    
    // Comando para configurar login
    if (arg.toLowerCase() === 'login') {
      this.awaitingLinkedinCreds.set(contactId, true);
      await this.sendResponse(contactId, `🔑 *Configuração do LinkedIn*

Para analisar perfis do LinkedIn, preciso das suas credenciais.

📝 *Envie no formato:*
usuario@email.com:senha

⚠️ *Importante:*
• Use ":" para separar email e senha
• Suas credenciais ficam salvas apenas no seu dispositivo
• Para remover credenciais, use: ${COMMANDS.LINKEDIN} logout`);
      return;
    }
    
    // Comando para remover login
    if (arg.toLowerCase() === 'logout') {
      this.linkedinSessions.delete(contactId);
      await this.sendResponse(contactId, '✅ Credenciais do LinkedIn removidas!');
      return;
    }
    
    // Comando para testar conexão
    if (arg.toLowerCase() === 'test') {
      await this.testLinkedInConnection(contactId);
      return;
    }
    
    // Se não tem argumento, ativar modo LinkedIn
    if (!arg) {
      this.setMode(contactId, CHAT_MODES.LINKEDIN);
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.LINKEDIN]);
      return;
    }
    
    // Validar se é uma URL do LinkedIn
    if (!this.isValidLinkedInUrl(arg)) {
      await this.sendResponse(contactId, `❌ *URL inválida!*

Por favor, envie uma URL válida do LinkedIn no formato:
https://www.linkedin.com/in/nome-do-perfil

💡 *Exemplos válidos:*
• https://www.linkedin.com/in/username
• https://linkedin.com/in/username`);
      return;
    }
    
    // Buscar credenciais
    let liAt = this.linkedinSessions.get(contactId) || CONFIG.linkedin.liAt;
    let hasCredentials = false;
    
    // Tentar buscar do MongoDB se não tem na sessão
    if (!liAt) {
      try {
        const { configService } = await import('../services/configService.js');
        const savedConfig = await configService.getConfig();
        if (savedConfig?.linkedin?.liAt) {
          liAt = savedConfig.linkedin.liAt;
          hasCredentials = true;
          logger.info('✅ Credenciais encontradas no MongoDB para WhatsApp');
        }
      } catch (error) {
        logger.warn('⚠️ Erro ao buscar credenciais do MongoDB:', error.message);
      }
    } else {
      hasCredentials = true;
    }
    
    if (!hasCredentials) {
      this.awaitingLinkedinCreds.set(contactId, true);
      await this.sendResponse(contactId, `🔑 *Credenciais não configuradas!*

Para analisar perfis do LinkedIn, preciso das suas credenciais.

📝 *Configure enviando:*
${COMMANDS.LINKEDIN} login

Ou envie diretamente:
usuario@email.com:senha`);
      return;
    }
    
    // Realizar análise resiliente
    await this.analyzeLinkedInProfileResilient(contactId, arg, liAt);
  }

  /**
   * Analisa um perfil do LinkedIn de forma resiliente via WhatsApp
   */
  async analyzeLinkedInProfileResilient(contactId, url, liAt) {
    try {
      await this.sendResponse(contactId, '🔍 *Iniciando análise do LinkedIn...*', true);
      
      // Primeira tentativa: análise estruturada
      const { fetchProfileStructured } = await import('../services/linkedinScraper.js');
      const result = await fetchProfileStructured(url, {
        liAt,
        timeoutMs: CONFIG.linkedin.timeoutMs,
        retries: 3
      });
      
      if (!result.success) {
        await this.sendResponse(contactId, '⚠️ *Análise estruturada falhou, tentando método alternativo...*', true);
        
        // Segunda tentativa: análise básica
        const { fetchProfileRaw } = await import('../services/linkedinScraper.js');
        const rawResult = await fetchProfileRaw(url, {
          liAt,
          timeoutMs: CONFIG.linkedin.timeoutMs
        });
        
        if (!rawResult.success) {
          throw new Error(`Falha na análise: ${rawResult.error}`);
        }
        
        // Processar texto bruto com LLM
        const response = await this.processRawLinkedInData(rawResult.rawText, url);
        await this.sendResponse(contactId, response);
        return;
      }
      
             // Processar dados estruturados
       const response = await this.processStructuredLinkedInData(result.data, result.dataQuality, contactId);
       await this.sendResponse(contactId, response);
      
    } catch (error) {
      logger.error('❌ Erro na análise LinkedIn WhatsApp:', error);
      
      let errorMessage = '❌ *Erro ao analisar perfil do LinkedIn*';
      
      if (error.message.includes('timeout')) {
        errorMessage += '\n\n⏱️ *Timeout:* O perfil demorou muito para carregar.';
      } else if (error.message.includes('login')) {
        errorMessage += '\n\n🔑 *Erro de login:* Suas credenciais podem estar inválidas.';
        errorMessage += `\n\nUse: ${COMMANDS.LINKEDIN} login`;
      } else if (error.message.includes('not found')) {
        errorMessage += '\n\n🔍 *Perfil não encontrado:* Verifique se a URL está correta.';
      } else {
        errorMessage += `\n\n💡 *Dica:* Tente novamente em alguns minutos.`;
      }
      
      errorMessage += `\n\n🔙 Para voltar: ${COMMANDS.VOLTAR}`;
      
      await this.sendResponse(contactId, errorMessage);
    }
  }

  /**
   * Processa dados estruturados do LinkedIn para WhatsApp
   */
  async processStructuredLinkedInData(data, quality, contactId) {
    let analysis = `🔗 *ANÁLISE DETALHADA DO PERFIL LINKEDIN*\n\n`;
    
    // Informações básicas
    if (data.name) {
      analysis += `👤 *Nome:* ${data.name}\n`;
    }
    
    if (data.headline) {
      analysis += `💼 *Cargo:* ${data.headline}\n`;
    }
    
    if (data.location) {
      analysis += `📍 *Localização:* ${data.location}\n`;
    }
    
    if (data.connections) {
      analysis += `🔗 *Conexões:* ${data.connections}\n`;
    }
    
    analysis += `\n📊 *Qualidade dos Dados:* ${quality.percentage}% (${quality.score}/${quality.maxScore} campos)\n\n`;
    
    // Sobre
    if (data.about) {
      analysis += `📝 *SOBRE:*\n${data.about}\n\n`;
    }
    
    // Experiência profissional
    if (data.experience && data.experience.length > 0) {
      analysis += `💼 *EXPERIÊNCIA PROFISSIONAL:*\n`;
      data.experience.slice(0, 8).forEach((exp, index) => {
        analysis += `${index + 1}. *${exp.title || 'Cargo não especificado'}*\n`;
        analysis += `   🏢 ${exp.company || 'Empresa não especificada'}\n`;
        if (exp.duration) {
          analysis += `   ⏰ ${exp.duration}\n`;
        }
        analysis += '\n';
      });
    }
    
    // Educação
    if (data.education && data.education.length > 0) {
      analysis += `🎓 *EDUCAÇÃO:*\n`;
      data.education.slice(0, 5).forEach((edu, index) => {
        analysis += `${index + 1}. *${edu.degree || 'Curso não especificado'}*\n`;
        analysis += `   🏫 ${edu.school || 'Instituição não especificada'}\n`;
        if (edu.years) {
          analysis += `   📅 ${edu.years}\n`;
        }
        analysis += '\n';
      });
    }
    
    // Skills
    if (data.skills && data.skills.length > 0) {
      analysis += `🛠️ *PRINCIPAIS HABILIDADES:*\n`;
      const topSkills = data.skills.slice(0, 15);
      analysis += topSkills.join(' • ') + '\n\n';
    }
    
    // Resumo profissional gerado por IA
    try {
      const summary = await this.llmService.getAssistantResponse(contactId, 
        `Com base nos dados extraídos do LinkedIn, crie um resumo profissional conciso e bem estruturado:\n\n${analysis}`
      );
      
      analysis += `🤖 *RESUMO PROFISSIONAL:*\n${summary}\n\n`;
    } catch (error) {
      logger.warn('⚠️ Erro ao gerar resumo com IA:', error.message);
    }
    
    analysis += `\n⏰ *Análise realizada em:* ${new Date().toLocaleString('pt-BR')}`;
    
    return analysis;
  }

  /**
   * Processa dados brutos do LinkedIn para WhatsApp
   */
  async processRawLinkedInData(rawText, url) {
    try {
      // Limpar e estruturar o texto
      const cleanedText = rawText
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 6000); // Limitar tamanho para WhatsApp
      
      const prompt = `Analise o seguinte texto extraído de um perfil do LinkedIn e crie um resumo profissional estruturado:

${cleanedText}

URL do perfil: ${url}

Crie um resumo que inclua:
- Nome e cargo
- Localização
- Experiência profissional (se encontrada)
- Educação (se encontrada)
- Skills/habilidades (se encontradas)
- Resumo profissional

Use emojis e formatação clara para facilitar a leitura.`;

      // Usar um contactId temporário para o LLM
      const tempContactId = 'linkedin-analysis';
      return await this.llmService.getAssistantResponse(tempContactId, prompt);
      
    } catch (error) {
      logger.error('❌ Erro ao processar dados brutos:', error);
      return `❌ Erro ao processar dados do perfil: ${error.message}`;
    }
  }

  /**
   * Testa conexão com LinkedIn
   */
  async testLinkedInConnection(contactId) {
    try {
      await this.sendResponse(contactId, '🔍 *Testando conexão com LinkedIn...*', true);
      
      const liAt = this.linkedinSessions.get(contactId) || CONFIG.linkedin.liAt;
      
      if (!liAt) {
        await this.sendResponse(contactId, '❌ *Credenciais não configuradas!*\n\nUse: !linkedin login');
        return;
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
        await this.sendResponse(contactId, `✅ *Conexão com LinkedIn funcionando!*

📊 *Qualidade dos dados:* ${result.dataQuality.percentage}%
🎯 *Status:* Conectado e operacional

💡 *Dica:* Agora você pode analisar qualquer perfil público do LinkedIn.`);
      } else {
        await this.sendResponse(contactId, `❌ *Falha na conexão*

🔍 *Erro:* ${result.error || 'Falha ao acessar perfil de teste'}

💡 *Soluções:*
• Verifique suas credenciais: !linkedin login
• Tente novamente em alguns minutos
• Verifique se o LinkedIn não está bloqueado`);
      }
      
    } catch (error) {
      logger.error('❌ Erro ao testar LinkedIn:', error);
      await this.sendResponse(contactId, `❌ *Erro ao testar conexão*

🔍 *Erro:* ${error.message}

💡 *Tente:* !linkedin login`);
    }
  }

  /**
   * Valida se a URL é do LinkedIn
   */
  isValidLinkedInUrl(url) {
    const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/.+/;
    return linkedinRegex.test(url);
  }

  async handleListarCommand(contactId) {
    await this.sendResponse(contactId, '📋 Buscando agendamentos...', true); // Status sempre em texto
    const listMessage = await this.scheduler.listSchedules(contactId);
    await this.sendResponse(contactId, listMessage);
  }

  async handleDeletarCommand(contactId) {
    this.setMode(contactId, CHAT_MODES.DELETAR);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.DELETAR], true); // Status sempre em texto
    const result = await this.scheduler.listSchedulesForDeletion(contactId);
    await this.sendResponse(contactId, result.message);
    if (!result.schedules || result.schedules.length === 0) {
        this.setMode(contactId, null);
    }
  }

  async handleAudioMessage(msg, contactId) {
    logger.verbose(`🎤 Recebido áudio de ${contactId}`);
    const media = await msg.downloadMedia();
    if (!media) {
      await this.sendErrorMessage(contactId, '❌ Desculpe, não consegui baixar seu áudio.');
      return;
    }
    const currentMode = this.getCurrentMode(contactId);
    const navigationState = this.getNavigationState(contactId);
    
    try {
      await this.sendResponse(contactId, '🎤 Transcrevendo áudio...', true);
      const transcription = await this.transcriber.transcribe(
        Buffer.from(media.data, 'base64')
      );
      logger.service(`📝 Transcrição para ${contactId}: ${transcription}`);
      
      if (currentMode === CHAT_MODES.TRANSCRICAO) {
        await this.sendResponse(contactId, `📝 *Transcrição:*\n\n${transcription}`);
        await this.sendResponse(contactId, SUCCESS_MESSAGES.TRANSCRIPTION_COMPLETE);
      } else if (currentMode === CHAT_MODES.TRANSCREVER_RESUMIR) {
        await this.sendResponse(contactId, '🧠 Gerando resumo...', true);
        const result = await this.transcriber.transcribeAndSummarize(
          Buffer.from(media.data, 'base64')
        );
        await this.sendResponse(contactId, result.combined);
        await this.sendResponse(contactId, `✅ *Transcrição e Resumo Concluídos!*\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
      } else if (currentMode) {
        await this.processMessageByMode(contactId, transcription, msg);
      } else {
        // Processamento de áudio no menu ou submenu
        await this.processAudioNavigation(msg, contactId, transcription, navigationState);
      }
    } catch (err) {
      logger.error(`❌ Erro no processamento de áudio para ${contactId}`, err);
      
      if (err.message?.includes('falhou após') && err.message?.includes('tentativas')) {
        await this.sendErrorMessage(contactId, '⏱️ O processamento do áudio demorou mais que o esperado. Tente novamente mais tarde.');
      } else {
        await this.sendErrorMessage(contactId, `❌ Erro ao processar áudio: ${err.message || 'Tente novamente.'}`);
      }
    }
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
        const response = await ollamaClient.chat({
            model: CONFIG.llm.model,
            messages: [{ role: 'user', content: commandPrompt }],
            options: { temperature: 0.2 }
        });
        mappedCommand = response.message.content.trim();
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
    const currentMode = this.getCurrentMode(contactId);
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
        // Validar se é uma URL do LinkedIn
        if (!this.isValidLinkedInUrl(text)) {
          await this.sendResponse(contactId, `❌ *URL inválida!*

Por favor, envie uma URL válida do LinkedIn no formato:
https://www.linkedin.com/in/nome-do-perfil

💡 *Exemplos válidos:*
• https://www.linkedin.com/in/username
• https://linkedin.com/in/username

🔙 Para sair do modo: ${COMMANDS.VOLTAR}`);
          break;
        }
        
        // Buscar credenciais
        let liAt = this.linkedinSessions.get(contactId) || CONFIG.linkedin.liAt;
        let hasCredentials = false;
        
        // Tentar buscar do MongoDB se não tem na sessão
        if (!liAt) {
          try {
            const { configService } = await import('../services/configService.js');
            const savedConfig = await configService.getConfig();
            if (savedConfig?.linkedin?.liAt) {
              liAt = savedConfig.linkedin.liAt;
              hasCredentials = true;
            }
          } catch (error) {
            logger.warn('⚠️ Erro ao buscar credenciais do MongoDB:', error.message);
          }
        } else {
          hasCredentials = true;
        }
        
        if (!hasCredentials) {
          this.awaitingLinkedinCreds.set(contactId, true);
          await this.sendResponse(contactId, `🔑 *Credenciais não configuradas!*

Para analisar perfis do LinkedIn, preciso das suas credenciais.

📝 *Configure enviando:*
usuario@email.com:senha

🔙 Para sair do modo: ${COMMANDS.VOLTAR}`);
          break;
        }
        
        // Realizar análise resiliente
        await this.analyzeLinkedInProfileResilient(contactId, text, liAt);
        this.setMode(contactId, null);
        break;
      case CHAT_MODES.DELETAR:
        await this.processDeletarMessage(contactId, text);
        break;
      case CHAT_MODES.AGENDABOT:
        await this.processAgendabotMessage(contactId, text);
        break;
      case CHAT_MODES.RESUMIR:
        if (!msg.hasMedia && !text.trim()) {
          await this.sendResponse(contactId, '📝 *Aguardando documento ou texto...*\n\nPor favor, envie:\n• Um arquivo (PDF, DOCX, TXT, CSV)\n• Ou digite/cole o texto na mensagem\n\n🔙 Para cancelar: !voltar');
          return;
        }
        await this.performResumir(msg, contactId, text);
        this.setMode(contactId, null);
        break;
      case CHAT_MODES.TROCAR_MODELO:
        await this.processTrocarModeloMessage(contactId, text);
        break;
      case CHAT_MODES.TROCAR_MODELO_WHISPER:
        await this.processTrocarModeloWhisperMessage(contactId, text);
        break;
      default:
          logger.warn(`⚠️ Modo desconhecido encontrado: ${currentMode}`);
          this.setMode(contactId, null);
          await this.sendResponse(contactId, MENU_MESSAGE);
          break;
    }
  }

  async processDeletarMessage(contactId, text) {
    const result = await this.scheduler.deleteSchedule(contactId, text.trim());
    await this.sendResponse(contactId, result);
    if (result.startsWith('✅') || result === ERROR_MESSAGES.INVALID_NUMBER) {
      this.setMode(contactId, null);
    }
  }

  async processAgendabotMessage(contactId, text) {
    try {
      await this.sendResponse(contactId, '📅 Processando agendamento...', true);
      const responseText = await this.llmService.getChatGPTResponse(contactId, text);
      try {
        const scheduleDataRaw = JSON.parse(responseText);
        await this.createSchedule(contactId, scheduleDataRaw);
        await this.sendResponse(contactId, SUCCESS_MESSAGES.SCHEDULE_CREATED);
        this.llmService.clearContext(contactId, CHAT_MODES.AGENDABOT);
      } catch (parseError) {
        logger.verbose('LLM não retornou JSON, enviando como texto.');
        await this.sendResponse(contactId, responseText);
      }
    } catch (err) {
      logger.error(`❌ Erro ao processar mensagem Agendabot para ${contactId}`, err);
      await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
    }
  }

  async processTrocarModeloMessage(contactId, text) {
    try {
      const selectedNumber = parseInt(text.trim());
      
      if (isNaN(selectedNumber) || selectedNumber < 1) {
        await this.sendResponse(contactId, '❌ *Número inválido!*\n\nPor favor, digite um número válido da lista de modelos.\n\nDigite um número ou !voltar para cancelar.');
        return;
      }
      
      // Obter lista de modelos armazenada
      const availableModels = this.getUserPreference(contactId, 'availableModels', []);
      
      if (availableModels.length === 0) {
        await this.sendResponse(contactId, '❌ *Lista de modelos não encontrada!*\n\nUse !trocarmodelo novamente para recarregar a lista.');
        this.setMode(contactId, null);
        return;
      }
      
      if (selectedNumber > availableModels.length) {
        await this.sendResponse(contactId, `❌ *Número fora do intervalo!*\n\nEscolha um número entre 1 e ${availableModels.length}.\n\nDigite um número válido ou !voltar para cancelar.`);
        return;
      }
      
      const selectedModel = availableModels[selectedNumber - 1];
      
      if (!selectedModel) {
        await this.sendResponse(contactId, '❌ *Modelo não encontrado!*\n\nTente usar !trocarmodelo novamente.');
        this.setMode(contactId, null);
        return;
      }
      
      await this.sendResponse(contactId, `🔄 *Ativando modelo:* ${selectedModel.name}\n\n⏳ Aguarde...`, true);
      
      // Detectar tipo de modelo e aplicar mudança
      const isImageModel = this.isImageModel(selectedModel.name);
      const oldModel = isImageModel ? CONFIG.llm.imageModel : CONFIG.llm.model;
      
      // Tentar descarregar modelo anterior
      try {
        logger.service(`🔄 Tentando descarregar modelo anterior: ${oldModel}`);
        await this.unloadModel(oldModel);
      } catch (unloadError) {
        logger.warn(`⚠️ Aviso ao descarregar modelo ${oldModel}`, { message: unloadError.message });
      }
      
      // Aplicar novo modelo
      if (isImageModel) {
        CONFIG.llm.imageModel = selectedModel.name;
        logger.service(`🖼️ Modelo de imagem alterado para: ${selectedModel.name}`);
      } else {
        CONFIG.llm.model = selectedModel.name;
        logger.service(`📝 Modelo de texto alterado para: ${selectedModel.name}`);
      }
      
      // Testar novo modelo
      try {
        await this.testModel(selectedModel.name, isImageModel);
        
        let successMessage = `✅ *Modelo ativado com sucesso!*\n\n`;
        successMessage += `🤖 **Novo modelo ${isImageModel ? '(imagem)' : '(texto)'}:** ${selectedModel.name}\n`;
        
        if (selectedModel.details?.family) {
          successMessage += `🏷️ **Família:** ${selectedModel.details.family}\n`;
        }
        
        if (selectedModel.size) {
          const sizeGB = (selectedModel.size / (1024 * 1024 * 1024)).toFixed(1);
          successMessage += `📏 **Tamanho:** ${sizeGB}GB\n`;
        }
        
        successMessage += `\n💡 **Modelo anterior descarregado:** ${oldModel}\n`;
        successMessage += `\n🎯 **O novo modelo já está ativo** e será usado nas próximas interações.\n\n`;
        successMessage += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
        
        await this.sendResponse(contactId, successMessage);
        
        // Limpar contextos LLM para usar novo modelo
        this.llmService.clearContext(contactId, CHAT_MODES.ASSISTANT);
        
      } catch (testError) {
        // Reverter mudança em caso de erro
        if (isImageModel) {
          CONFIG.llm.imageModel = oldModel;
        } else {
          CONFIG.llm.model = oldModel;
        }
        
        logger.error(`❌ Erro ao testar novo modelo ${selectedModel.name}`, testError);
        await this.sendResponse(contactId, `❌ *Erro ao ativar modelo!*\n\n🚫 **Modelo:** ${selectedModel.name}\n❗ **Erro:** ${testError.message}\n\n🔄 **Modelo anterior mantido:** ${oldModel}\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
      }
      
      this.setMode(contactId, null);
      
      // Limpar dados temporários
      this.setUserPreference(contactId, 'availableModels', []);
      
    } catch (err) {
      logger.error(`❌ Erro ao processar troca de modelo para ${contactId}`, err);
      await this.sendErrorMessage(contactId, '❌ Erro interno ao trocar modelo. Tente novamente.');
      this.setMode(contactId, null);
    }
  }

  async processTrocarModeloWhisperMessage(contactId, text) {
    try {
      const selectedNumber = parseInt(text.trim());
      
      if (isNaN(selectedNumber) || selectedNumber < 1) {
        await this.sendResponse(contactId, '❌ *Número inválido!*\n\nPor favor, digite um número válido da lista de modelos Whisper.\n\nDigite um número ou !voltar para cancelar.');
        return;
      }
      
      // Obter lista de modelos Whisper armazenada
      const availableModels = this.getUserPreference(contactId, 'availableWhisperModels', []);
      
      if (availableModels.length === 0) {
        await this.sendResponse(contactId, '❌ *Lista de modelos Whisper não encontrada!*\n\nUse !trocarmodelwhisper novamente para recarregar a lista.');
        this.setMode(contactId, null);
        return;
      }
      
      if (selectedNumber > availableModels.length) {
        await this.sendResponse(contactId, `❌ *Número fora do intervalo!*\n\nEscolha um número entre 1 e ${availableModels.length}.\n\nDigite um número válido ou !voltar para cancelar.`);
        return;
      }
      
      const selectedModel = availableModels[selectedNumber - 1];
      
      if (!selectedModel) {
        await this.sendResponse(contactId, '❌ *Modelo não encontrado!*\n\nTente usar !trocarmodelwhisper novamente.');
        this.setMode(contactId, null);
        return;
      }
      
      await this.sendResponse(contactId, `🎤 *Ativando modelo Whisper:* ${selectedModel}\n\n⏳ Aguarde...`, true);
      
      const oldModel = CONFIG.audio.model;
      
      try {
        // Aplicar novo modelo Whisper
        CONFIG.audio.model = selectedModel;
        logger.service(`🎤 Modelo Whisper alterado de ${oldModel} para: ${selectedModel}`);
        
        // Notificar transcriber se disponível sobre mudança de modelo
        if (this.transcriber && typeof this.transcriber.onModelChange === 'function') {
          try {
            await this.transcriber.onModelChange(selectedModel);
            logger.service(`📡 Transcriber notificado sobre mudança de modelo para: ${selectedModel}`);
          } catch (notifyError) {
            logger.warn(`⚠️ Erro ao notificar transcriber sobre mudança`, { message: notifyError.message });
          }
        }
        
        let successMessage = `✅ *MODELO WHISPER ALTERADO COM SUCESSO!*\n\n`;
        successMessage += `🔄 **Mudança aplicada:**\n`;
        successMessage += `• 🎤 **Modelo anterior:** ${oldModel}\n`;
        successMessage += `• ✅ **Novo modelo:** ${selectedModel}\n\n`;
        
        // Adicionar informações sobre o modelo
        if (selectedModel.includes('tiny')) {
          successMessage += `⚡ **Velocidade:** Ultrarrápida\n📊 **Qualidade:** Básica\n`;
        } else if (selectedModel.includes('small')) {
          successMessage += `🚀 **Velocidade:** Rápida\n📊 **Qualidade:** Boa\n`;
        } else if (selectedModel.includes('medium')) {
          successMessage += `⚖️ **Velocidade:** Moderada\n📊 **Qualidade:** Superior\n`;
        } else if (selectedModel.includes('large')) {
          successMessage += `🐌 **Velocidade:** Lenta\n📊 **Qualidade:** Máxima\n`;
        } else if (selectedModel.includes('base')) {
          successMessage += `💨 **Velocidade:** Rápida\n📊 **Qualidade:** Básica\n`;
        }
        
        if (selectedModel.includes('.en')) {
          successMessage += `🇺🇸 **Idioma:** Especializado em inglês\n`;
        } else {
          successMessage += `🌍 **Idioma:** Multilíngue (português incluído)\n`;
        }
        
        successMessage += `\n💡 **O modelo está ativo** e será usado em novas transcrições.\n\n`;
        successMessage += `🎯 **Teste:** Use ${COMMANDS.TRANSCREVER} e envie um áudio.\n\n`;
        successMessage += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
        
        await this.sendResponse(contactId, successMessage);
        
      } catch (err) {
        // Reverter em caso de erro
        CONFIG.audio.model = oldModel;
        logger.error(`❌ Erro ao aplicar modelo Whisper ${selectedModel}`, err);
        await this.sendResponse(contactId, `❌ *ERRO AO TROCAR MODELO WHISPER*\n\n🚫 **Falha:** Não foi possível ativar o modelo "${selectedModel}"\n\n💡 **Modelo anterior mantido:** ${oldModel}\n\n⚠️ **Erro:** ${err.message}\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
      }
      
      this.setMode(contactId, null);
      
      // Limpar dados temporários
      this.setUserPreference(contactId, 'availableWhisperModels', []);
      
    } catch (err) {
      logger.error(`❌ Erro ao processar troca de modelo Whisper para ${contactId}`, err);
      await this.sendErrorMessage(contactId, '❌ Erro interno ao trocar modelo Whisper. Tente novamente.');
      this.setMode(contactId, null);
    }
  }

  isImageModel(modelName) {
    // Detectar se é modelo de imagem baseado no nome
    const imageModelNames = ['llava', 'bakllava', 'moondream', 'vision'];
    return imageModelNames.some(name => modelName.toLowerCase().includes(name));
  }

  async unloadModel(modelName) {
    try {
      // Usar API do Ollama para descarregar modelo
      await ollamaClient.delete({
        model: modelName,
        keep_alive: 0 // Força descarregamento imediato
      });
      logger.success(`✅ Modelo ${modelName} descarregado com sucesso`);
    } catch (err) {
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        logger.info(`ℹ️ Modelo ${modelName} já estava descarregado`);
      } else {
        throw err;
      }
    }
  }

  async testModel(modelName, isImageModel) {
    if (isImageModel) {
      // Teste simples para modelo de imagem (sem imagem real)
      logger.service(`🧪 Testando modelo de imagem: ${modelName}`);
      // Para modelos de imagem, apenas verificamos se está carregado
      await ollamaClient.show({ model: modelName });
    } else {
      // Teste simples para modelo de texto
      logger.service(`🧪 Testando modelo de texto: ${modelName}`);
      const testResponse = await ollamaClient.chat({
        model: modelName,
        messages: [{ role: 'user', content: 'Responda apenas: OK' }],
        options: { temperature: 0.1 }
      });
      
      if (!testResponse?.message?.content) {
        throw new Error('Modelo não respondeu corretamente ao teste');
      }
    }
  }

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

  async handleReiniciarWhisperCommand(contactId) {
    try {
      await this.sendResponse(contactId, '🎤 *REINICIAR WHISPER*\n\n⚠️ **Atenção:** Esta operação irá:\n• Limpar cache de transcrições\n• Reinicializar serviço Whisper\n• Resetar modos de transcrição\n\n⏳ Iniciando processo...', true);
      
      logger.flow(`🎤 Iniciando reinicialização do Whisper solicitada por ${contactId}`);
      
      // 1. Limpar modos de transcrição
      let clearedTranscriptionModes = 0;
      for (const [userId, mode] of this.chatModes.entries()) {
        if (mode === CHAT_MODES.TRANSCRICAO) {
          this.chatModes.delete(userId);
          clearedTranscriptionModes++;
        }
      }
      logger.service(`🧹 ${clearedTranscriptionModes} modos de transcrição limpos`);
      
      // 2. Reinicializar transcriber se disponível
      let transcriberStatus = 'N/A';
      if (this.transcriber) {
        try {
          // Se o transcriber tem método de cleanup, usar
          if (typeof this.transcriber.cleanup === 'function') {
            await this.transcriber.cleanup();
            logger.service('🧹 Cache do transcriber limpo');
            transcriberStatus = 'Cache limpo';
          } else {
            logger.info('ℹ️ Transcriber não possui método de cleanup');
            transcriberStatus = 'Sem cache para limpar';
          }
          
          // Teste básico do transcriber
          if (typeof this.transcriber.isReady === 'function') {
            const isReady = await this.transcriber.isReady();
            transcriberStatus += isReady ? ' - Pronto' : ' - Não disponível';
          } else {
            transcriberStatus += ' - Status desconhecido';
          }
          
        } catch (err) {
          logger.warn('⚠️ Erro ao reinicializar transcriber', { message: err.message });
          transcriberStatus = `Erro: ${err.message}`;
        }
      } else {
        transcriberStatus = 'Não inicializado';
      }
      
      // 3. Limpar preferências relacionadas a áudio se necessário
      let clearedAudioPrefs = 0;
      for (const [, prefs] of this.userPreferences.entries()) {
        if (prefs && typeof prefs === 'object') {
          let hasAudioPrefs = false;
          // Manter outras preferências, limpar apenas relacionadas a áudio se houver
          if (prefs.lastTranscriptionTime) {
            delete prefs.lastTranscriptionTime;
            hasAudioPrefs = true;
          }
          if (prefs.transcriptionCache) {
            delete prefs.transcriptionCache;
            hasAudioPrefs = true;
          }
          if (hasAudioPrefs) {
            clearedAudioPrefs++;
          }
        }
      }
      
      let successMessage = `✅ *WHISPER REINICIADO COM SUCESSO!*\n\n`;
      successMessage += `📊 **Resultados:**\n`;
      successMessage += `• 🎤 Modos de transcrição resetados: ${clearedTranscriptionModes}\n`;
      successMessage += `• 🔄 Status do transcriber: ${transcriberStatus}\n`;
      successMessage += `• 🧹 Preferências de áudio limpas: ${clearedAudioPrefs}\n\n`;
      successMessage += `💡 **O serviço de transcrição** está pronto para uso.\n\n`;
      successMessage += `🎯 **Teste:** Use ${COMMANDS.TRANSCREVER} e envie um áudio.\n\n`;
      successMessage += `🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`;
      
      await this.sendResponse(contactId, successMessage);
      
      logger.success(`✅ Reinicialização do Whisper concluída com sucesso para ${contactId}`);
      
    } catch (err) {
      logger.error(`❌ Erro ao reiniciar Whisper para ${contactId}`, err);
      await this.sendResponse(contactId, `❌ *ERRO AO REINICIAR WHISPER*\n\n🚫 **Erro:** ${err.message}\n\n⚠️ **Recomendação:** Verifique a configuração do Whisper e tente novamente.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
    }
  }

  async createSchedule(contactId, scheduleDataRaw) {
    logger.verbose('🔧 Criando agendamento com dados:', scheduleDataRaw);
    if (!scheduleDataRaw || typeof scheduleDataRaw !== 'object' || !scheduleDataRaw.message || !scheduleDataRaw.scheduledTime || !scheduleDataRaw.scheduledTime.$date) {
        throw new Error('Dados de agendamento inválidos recebidos do LLM.');
    }
    const scheduleData = {
        recipient: contactId.replace(/\D/g, ''),
        message: scheduleDataRaw.message,
        status: 'approved',
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null,
        scheduledTime: null,
        expiryTime: null
    };
    try {
        const scheduledUTC = new Date(scheduleDataRaw.scheduledTime.$date);
        if (isNaN(scheduledUTC.getTime())) {
            throw new Error('Formato de data inválido em scheduledTime.$date.');
        }
        logger.verbose('🔧 Passo1:', scheduledUTC);
        scheduleData.scheduledTime = Utils.toLocalTime(scheduledUTC);
        logger.verbose('🔧 Passo2:', scheduleData.scheduledTime);
        const expiryUTC = new Date(scheduledUTC);
        expiryUTC.setMonth(expiryUTC.getMonth() + 1);
        scheduleData.expiryTime = Utils.toLocalTime(expiryUTC);
    } catch (dateError) {
        logger.error('Erro ao processar datas do agendamento', dateError);
        throw new Error(`Erro ao processar data do agendamento: ${dateError.message}`);
    }
    const errors = this.validateScheduleData(scheduleData);
    if (errors.length) {
      throw new Error(`Erros nos dados do agendamento: ${errors.join('; ')}`);
    }
    if (!this.scheduler || !this.scheduler.schedCollection) {
      throw new Error('Serviço de agendamento não está pronto.');
    }
    await this.scheduler.insertSchedule(scheduleData);
    logger.success(`✅ Agendamento criado para ${contactId} às ${scheduleData.scheduledTime}`);
  }

  validateScheduleData(data) {
    const errors = [];
    if (!data.recipient) errors.push('Destinatário (recipient) está vazio.');
    if (!data.message) errors.push('Mensagem (message) está vazia.');
    if (!data.scheduledTime || isNaN(data.scheduledTime.getTime())) errors.push('Data/Hora agendada (scheduledTime) é inválida.');
    if (!data.expiryTime || isNaN(data.expiryTime.getTime())) errors.push('Data de expiração (expiryTime) é inválida.');
    return errors;
  }

  async handleImportarAgendaCommand(msg, contactId) {
    if (!msg.hasMedia) {
      await this.sendResponse(contactId, '📎 Envie um arquivo .ics junto com o comando.');
      return;
    }
    const media = await Utils.downloadMediaWithRetry(msg);
    if (!media) {
      await this.sendResponse(contactId, ERROR_MESSAGES.GENERIC);
      return;
    }
    const buffer = Buffer.from(media.data, 'base64');
    try {
      const icsService = new (await import('../services/icsImportService.js')).default(this.scheduler);
      await icsService.importFromBuffer(buffer, contactId.replace(/\D/g, ''));
      await this.sendResponse(contactId, '✅ Eventos importados com sucesso!');
    } catch (err) {
      logger.error('Erro ao importar agenda', err);
      await this.sendResponse(contactId, ERROR_MESSAGES.GENERIC);
    }
  }
}

export default WhatsAppBot;

