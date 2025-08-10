import logger from '../utils/logger.js';
import { COMMANDS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../config/index.js';

export default class CommandHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleCommand(msg, contactId, lowerText, originalText) {
    try {
      logger.info(`📋 Comando detectado: ${lowerText} de ${contactId}`);

      switch (lowerText) {
        case COMMANDS.MENU:
          return await this.whatsAppBot.sendResponse(contactId, SUCCESS_MESSAGES.MENU_SHOWN);
        
        case COMMANDS.DEEP:
          return await this.handleDeepCommand(contactId, originalText);
        
        case COMMANDS.RESUMIR:
          return await this.handleResumirCommand(msg, contactId);
        
        case COMMANDS.RESUMIR_VIDEO:
          return await this.handleResumirVideoCommand(msg, contactId);
        
        case COMMANDS.RESUMIR_VIDEO2:
          return await this.handleResumirVideo2Command(msg, contactId);
        
        case COMMANDS.TRANSCREVER:
          return await this.handleTranscreverCommand(contactId);
        
        case COMMANDS.TRANSCREVER_RESUMIR:
          return await this.handleTranscreverResumir(contactId);
        
        case COMMANDS.AGENDABOT:
          return await this.handleAgendabotCommand(contactId, originalText);
        
        case COMMANDS.LINKEDIN:
          return await this.handleLinkedinCommand(contactId, originalText);
        
        case COMMANDS.LISTAR:
          return await this.handleListarCommand(contactId);
        
        case COMMANDS.DELETAR:
          return await this.handleDeletarCommand(contactId);
        
        case COMMANDS.RECURSO:
          return await this.handleRecursoCommand(contactId);
        
        case COMMANDS.IMPORTAR_AGENDA:
          return await this.handleImportarAgendaCommand(msg, contactId);
        
        case COMMANDS.VOZ:
          return await this.handleVozCommand(contactId);
        
        case COMMANDS.TTS_CONFIG:
          return await this.handleTTSConfigCommand(contactId);
        
        case COMMANDS.MODELOS:
          return await this.handleModelosCommand(contactId);
        
        case COMMANDS.TROCAR_MODELO:
          return await this.handleTrocarModeloCommand(contactId);
        
        case COMMANDS.MODELOS_WHISPER:
          return await this.handleModelosWhisperCommand(contactId);
        
        case COMMANDS.TROCAR_MODELO_WHISPER:
          return await this.handleTrocarModeloWhisperCommand(contactId);
        
        case COMMANDS.REINICIAR_OLLAMA:
          return await this.handleReiniciarOllamaCommand(contactId);
        
        case COMMANDS.REINICIAR_WHISPER:
          return await this.handleReiniciarWhisperCommand(contactId);
        
        case COMMANDS.LISTAR_ENDPOINTS_WHISPER:
          return await this.handleListarEndpointsWhisperCommand(contactId);
        
        case COMMANDS.LISTAR_ENDPOINTS_OLLAMA:
          return await this.handleListarEndpointsOllamaCommand(contactId);
        
        case COMMANDS.STATUS_ENDPOINTS:
          return await this.handleStatusEndpointsCommand(contactId);
        
        case COMMANDS.API_STATUS_OLLAMA:
          return await this.handleApiStatusOllama(contactId);
        
        case COMMANDS.API_STATUS_WHISPER:
          return await this.handleApiStatusWhisper(contactId);
        
        case COMMANDS.API_STATUS_COMPLETE:
          return await this.handleApiStatusComplete(contactId);
        
        case COMMANDS.API_MODELS_OLLAMA:
          return await this.handleApiModelsOllama(contactId);
        
        case COMMANDS.API_MODELS_WHISPER:
          return await this.handleApiModelsWhisper(contactId);
        
        case COMMANDS.API_ENDPOINTS_OLLAMA:
          return await this.handleApiEndpointsOllama(contactId);
        
        case COMMANDS.API_ENDPOINTS_WHISPER:
          return await this.handleApiEndpointsWhisper(contactId);
        
        case COMMANDS.WHISPER_SILENT_CONFIG:
          return await this.handleWhisperSilentConfigCommand(contactId);
        
        case COMMANDS.WHISPER_SILENT_SEARCH:
          return await this.handleWhisperSilentSearchCommand(contactId);
        
        default:
          // Handle flow commands
          if (lowerText.startsWith('!flow ')) {
            return await this.handleFlowCommand(msg, contactId, originalText);
          }
          
          // Handle crypto commands
          if (lowerText.startsWith('!crypto ')) {
            return await this.handleCryptoCommand(contactId, originalText);
          }
          
          // Handle whisper silent commands
          if (lowerText.startsWith('!whisper_silent ')) {
            const action = lowerText.replace('!whisper_silent ', '').trim();
            return await this.handleWhisperSilentCommand(contactId, action);
          }
          
          return false; // Comando não reconhecido
      }
    } catch (error) {
      logger.error(`❌ Erro ao processar comando ${lowerText}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, ERROR_MESSAGES.COMMAND_PROCESSING_ERROR);
      return false;
    }
  }

  // Delegate methods - these will call the original methods in whatsAppBot
  async handleDeepCommand(contactId, originalText) {
    return await this.whatsAppBot.handleDeepCommand(contactId, originalText);
  }

  async handleResumirCommand(msg, contactId) {
    return await this.whatsAppBot.handleResumirCommand(msg, contactId);
  }

  async handleResumirVideoCommand(msg, contactId) {
    return await this.whatsAppBot.handleResumirVideoCommand(msg, contactId);
  }

  async handleResumirVideo2Command(msg, contactId) {
    return await this.whatsAppBot.handleResumirVideo2Command(msg, contactId);
  }

  async handleTranscreverCommand(contactId) {
    return await this.whatsAppBot.handleTranscreverCommand(contactId);
  }

  async handleTranscreverResumir(contactId) {
    return await this.whatsAppBot.handleTranscreverResumir(contactId);
  }

  async handleAgendabotCommand(contactId, originalText) {
    return await this.whatsAppBot.handleAgendabotCommand(contactId, originalText);
  }

  async handleLinkedinCommand(contactId, originalText) {
    return await this.whatsAppBot.handleLinkedinCommand(contactId, originalText);
  }

  async handleListarCommand(contactId) {
    return await this.whatsAppBot.handleListarCommand(contactId);
  }

  async handleDeletarCommand(contactId) {
    return await this.whatsAppBot.handleDeletarCommand(contactId);
  }

  async handleRecursoCommand(contactId) {
    return await this.whatsAppBot.handleRecursoCommand(contactId);
  }

  async handleImportarAgendaCommand(msg, contactId) {
    return await this.whatsAppBot.handleImportarAgendaCommand(msg, contactId);
  }

  async handleVozCommand(contactId) {
    return await this.whatsAppBot.handleVozCommand(contactId);
  }

  async handleTTSConfigCommand(contactId) {
    return await this.whatsAppBot.handleTTSConfigCommand(contactId);
  }

  async handleModelosCommand(contactId) {
    return await this.whatsAppBot.handleModelosCommand(contactId);
  }

  async handleTrocarModeloCommand(contactId) {
    return await this.whatsAppBot.handleTrocarModeloCommand(contactId);
  }

  async handleModelosWhisperCommand(contactId) {
    return await this.whatsAppBot.handleModelosWhisperCommand(contactId);
  }

  async handleTrocarModeloWhisperCommand(contactId) {
    return await this.whatsAppBot.handleTrocarModeloWhisperCommand(contactId);
  }

  async handleReiniciarOllamaCommand(contactId) {
    return await this.whatsAppBot.handleReiniciarOllamaCommand(contactId);
  }

  async handleReiniciarWhisperCommand(contactId) {
    return await this.whatsAppBot.handleReiniciarWhisperCommand(contactId);
  }

  async handleListarEndpointsWhisperCommand(contactId) {
    return await this.whatsAppBot.handleListarEndpointsWhisperCommand(contactId);
  }

  async handleListarEndpointsOllamaCommand(contactId) {
    return await this.whatsAppBot.handleListarEndpointsOllamaCommand(contactId);
  }

  async handleStatusEndpointsCommand(contactId) {
    return await this.whatsAppBot.handleStatusEndpointsCommand(contactId);
  }

  async handleApiStatusOllama(contactId) {
    return await this.whatsAppBot.handleApiStatusOllama(contactId);
  }

  async handleApiStatusWhisper(contactId) {
    return await this.whatsAppBot.handleApiStatusWhisper(contactId);
  }

  async handleApiStatusComplete(contactId) {
    return await this.whatsAppBot.handleApiStatusComplete(contactId);
  }

  async handleApiModelsOllama(contactId) {
    return await this.whatsAppBot.handleApiModelsOllama(contactId);
  }

  async handleApiModelsWhisper(contactId) {
    return await this.whatsAppBot.handleApiModelsWhisper(contactId);
  }

  async handleApiEndpointsOllama(contactId) {
    return await this.whatsAppBot.handleApiEndpointsOllama(contactId);
  }

  async handleApiEndpointsWhisper(contactId) {
    return await this.whatsAppBot.handleApiEndpointsWhisper(contactId);
  }

  async handleWhisperSilentConfigCommand(contactId) {
    return await this.whatsAppBot.handleWhisperSilentConfigCommand(contactId);
  }

  async handleWhisperSilentSearchCommand(contactId) {
    return await this.whatsAppBot.handleWhisperSilentSearchCommand(contactId);
  }

  async handleFlowCommand(msg, contactId, text) {
    return await this.whatsAppBot.handleFlowCommand(msg, contactId, text);
  }

  async handleCryptoCommand(contactId, originalText) {
    // Extract crypto subcommand
    const parts = originalText.toLowerCase().split(' ');
    if (parts.length < 2) {
      await this.whatsAppBot.sendErrorMessage(contactId, 'Comando crypto incompleto. Use !crypto quotes, !crypto config, etc.');
      return true;
    }

    const subcommand = parts[1];
    switch (subcommand) {
      case 'quotes':
        return await this.whatsAppBot.handleCryptoQuotes(contactId);
      case 'start':
        return await this.whatsAppBot.handleCryptoStartMonitoring(contactId);
      case 'stop':
        return await this.whatsAppBot.handleCryptoStopMonitoring(contactId);
      case 'status':
        return await this.whatsAppBot.handleCryptoStatus(contactId);
      case 'config':
        return await this.whatsAppBot.handleCryptoConfig(contactId, originalText);
      case 'preferences':
        return await this.whatsAppBot.handleCryptoPreferences(contactId);
      case 'list':
        return await this.whatsAppBot.handleCryptoListCoins(contactId);
      case 'select':
        return await this.whatsAppBot.handleCryptoSelectCoins(contactId);
      case 'pause':
      case 'resume':
        return await this.whatsAppBot.handleCryptoPauseResume(contactId);
      case 'technical':
        return await this.whatsAppBot.handleCryptoTechnicalAnalysis(contactId);
      case 'compare':
        return await this.whatsAppBot.handleCryptoComparePerformance(contactId);
      case 'health':
        return await this.whatsAppBot.handleCryptoSystemHealth(contactId);
      case 'debug':
        return await this.whatsAppBot.handleCryptoDebugStatus(contactId);
      case 'simulate':
        return await this.whatsAppBot.handleCryptoSimulateAlert(contactId);
      case 'force':
        return await this.whatsAppBot.handleCryptoForceCheck(contactId);
      case 'llm':
        return await this.whatsAppBot.handleCryptoLLMAnalysis(contactId);
      case 'trade':
        return await this.whatsAppBot.handleCryptoAutoTrading(contactId);
      case 'ml':
        return await this.whatsAppBot.handleCryptoMLSubmenu(contactId);
      default:
        await this.whatsAppBot.sendErrorMessage(contactId, `Comando crypto desconhecido: ${subcommand}`);
        return true;
    }
  }

  async handleWhisperSilentCommand(contactId, action) {
    return await this.whatsAppBot.handleWhisperSilentCommand(contactId, action);
  }
}