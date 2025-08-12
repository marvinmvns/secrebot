import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class AudioTranscriptionHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleTranscreverCommand(contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.TRANSCRIBE);
      await this.whatsAppBot.sendResponse(contactId, '🎤 *Modo Transcrição Ativado*\n\nEnvie um áudio que deseja transcrever.\n\n💡 O áudio será convertido em texto.\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar transcrição:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar transcrição.');
      return false;
    }
  }

  async handleTranscreverResumir(contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.TRANSCRIBE_SUMMARIZE);
      await this.whatsAppBot.sendResponse(contactId, '🎤📝 *Modo Transcrever + Resumir Ativado*\n\nEnvie um áudio que deseja transcrever e resumir.\n\n💡 O áudio será convertido em texto e resumido.\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar transcrição + resumo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar transcrição + resumo.');
      return false;
    }
  }

  async handleAudioMessage(msg, contactId) {
    try {
      logger.info(`🎤 Processando áudio de ${contactId}`);
      
      // Check current mode to determine how to process audio
      const currentMode = await this.whatsAppBot.getCurrentMode(contactId);
      const navigationState = await this.whatsAppBot.getNavigationState(contactId);

      // Handle audio in specific modes
      if (currentMode === CHAT_MODES.TRANSCRIBE) {
        return await this.processTranscriptionMode(msg, contactId);
      } else if (currentMode === CHAT_MODES.TRANSCRIBE_SUMMARIZE) {
        return await this.processTranscribeSummarizeMode(msg, contactId);
      } else if (currentMode === CHAT_MODES.SCHEDULER) {
        return await this.processSchedulerMode(msg, contactId);
      } else if (navigationState) {
        return await this.processAudioNavigation(msg, contactId);
      } else {
        return await this.processGeneralAudioMode(msg, contactId);
      }
    } catch (error) {
      logger.error(`❌ Erro ao processar áudio para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar áudio.');
      return false;
    }
  }

  async processTranscriptionMode(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Transcrevendo áudio...', true);
      
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar o áudio.');
        return false;
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      const transcription = await this.whatsAppBot.transcriber.transcribe(audioBuffer, 'ogg', contactId);
      
      await this.whatsAppBot.sendResponse(contactId, `📝 *Transcrição:*\n\n${transcription}`);
      
      // Exit transcription mode
      await this.whatsAppBot.setMode(contactId, null);
      await this.whatsAppBot.sendResponse(contactId, '✅ Transcrição concluída!\n\n🔙 Para voltar ao menu: !menu');
      
      return true;
    } catch (error) {
      logger.error('❌ Erro no modo transcrição:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao transcrever áudio.');
      return false;
    }
  }

  async processTranscribeSummarizeMode(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤📝 Transcrevendo e resumindo áudio...', true);
      
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar o áudio.');
        return false;
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      const result = await this.whatsAppBot.transcriber.transcribeAndSummarize(audioBuffer);
      
      if (result.success) {
        let response = `📝 *Transcrição + Resumo:*\n\n`;
        
        if (result.transcription) {
          response += `🎤 *Transcrição:*\n${result.transcription}\n\n`;
        }
        
        if (result.summary) {
          response += `📋 *Resumo:*\n${result.summary}`;
        }
        
        await this.whatsAppBot.sendResponse(contactId, response);
        
        // Exit mode
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '✅ Transcrição + Resumo concluídos!\n\n🔙 Para voltar ao menu: !menu');
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ Erro: ${result.error}\n\nTente novamente ou digite "cancelar" para sair.`);
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro no modo transcrever + resumir:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar áudio.');
      return false;
    }
  }

  async processAudioNavigation(msg, contactId) {
    try {
      // Transcribe audio for navigation purposes
      await this.whatsAppBot.sendResponse(contactId, '🎤 Processando comando de voz...', true);
      
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar o áudio.');
        return false;
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      const transcription = await this.whatsAppBot.transcriber.transcribe(audioBuffer, 'ogg', contactId);
      
      logger.info(`🎤 Comando de voz transcrito: "${transcription}" de ${contactId}`);
      
      // Process transcription as navigation command
      const navigationState = await this.whatsAppBot.getNavigationState(contactId);
      return await this.whatsAppBot.menuNavigationHandler.processAudioNavigation(
        msg, contactId, transcription, navigationState
      );
    } catch (error) {
      logger.error('❌ Erro na navegação por áudio:', error);
      return false;
    }
  }

  async processSchedulerMode(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Transcrevendo para criar agendamento...', true);
      
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar o áudio.');
        return false;
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      const transcription = await this.whatsAppBot.transcriber.transcribe(audioBuffer, 'ogg', contactId);
      
      // Process the transcribed text as scheduler input
      logger.info(`📝 Agendamento via áudio transcrito: "${transcription}" de ${contactId}`);
      
      // Delegate to scheduler handler to process the transcribed text
      return await this.whatsAppBot.scheduleHandler.processSchedulerMessage(contactId, transcription);
      
    } catch (error) {
      logger.error('❌ Erro no modo scheduler via áudio:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar áudio para agendamento.');
      return false;
    }
  }

  async processGeneralAudioMode(msg, contactId) {
    try {
      // Default audio processing with suggestion to summarize
      await this.whatsAppBot.sendResponse(contactId, '🎤 Processando áudio...', true);
      
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar o áudio.');
        return false;
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      const transcription = await this.whatsAppBot.transcriber.transcribe(audioBuffer, 'ogg', contactId);
      
      await this.whatsAppBot.sendResponse(contactId, `📝 *Transcrição:*\n\n${transcription}`);
      
      // Suggest summarization for longer audios
      if (transcription.length > 500) {
        await this.whatsAppBot.sendResponse(contactId, '💡 *Áudio longo detectado!*\n\nDeseja que eu faça um resumo?\n\n1️⃣ - Sim, fazer resumo\n❌ - Não, obrigado');
        
        // Store audio buffer for potential summarization
        this.whatsAppBot.setUserPreference(contactId, 'awaitingSummarizationResponse', {
          audioBuffer: audioBuffer,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro no modo geral de áudio:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar áudio.');
      return false;
    }
  }

  async handleWhisperSilentConfigCommand(contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, 'WHISPER_SILENT_CONFIG');
      await this.whatsAppBot.sendResponse(contactId, '🔧 *Configuração Whisper Silent*\n\nEnvie o comando de configuração que deseja executar.\n\n💡 Comandos disponíveis:\n• health - Status geral\n• status - Status detalhado\n• transcriptions_list - Listar transcrições\n• control_start - Iniciar serviço\n• control_stop - Parar serviço\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar configuração Whisper Silent:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar configuração.');
      return false;
    }
  }

  async handleWhisperSilentSearchCommand(contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, 'WHISPER_SILENT_SEARCH');
      await this.whatsAppBot.sendResponse(contactId, '🔍 *Busca em Transcrições*\n\nDigite a palavra ou frase que deseja buscar nas transcrições.\n\n💡 Exemplo: "reunião cliente"\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar busca Whisper Silent:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar busca.');
      return false;
    }
  }

  async handleWhisperSilentCommand(contactId, action) {
    try {
      logger.info(`🔧 Executando comando Whisper Silent: ${action} para ${contactId}`);
      
      // Execute whisper silent command
      const result = await this.whatsAppBot.whisperSilentService.executeCommand(action, { userId: contactId });
      
      let response = `🔧 *Whisper Silent - ${action.toUpperCase()}*\n\n`;
      
      if (result.success) {
        switch (action) {
          case 'health':
          case 'health_detailed':
            response += this.formatHealthStatus(result.data);
            break;
          case 'status':
            response += this.formatDetailedStatus(result.data);
            break;
          case 'transcriptions_list':
            response += this.formatTranscriptionsList(result.data);
            break;
          case 'transcriptions_stats':
            response += this.formatTranscriptionsStats(result.data);
            break;
          default:
            response += result.message || 'Comando executado com sucesso.';
        }
      } else {
        response += `❌ Erro: ${result.error || 'Comando falhou'}`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, response);
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao executar comando Whisper Silent ${action}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, `Erro ao executar comando ${action}.`);
      return false;
    }
  }

  formatHealthStatus(data) {
    if (!data) return '❌ Dados de saúde não disponíveis.';
    
    let status = '';
    status += `🟢 Status: ${data.status || 'Desconhecido'}\n`;
    status += `📊 APIs ativas: ${data.activeApis || 0}\n`;
    status += `💾 Transcrições: ${data.totalTranscriptions || 0}\n`;
    status += `⏱️ Última atividade: ${data.lastActivity || 'N/A'}`;
    
    return status;
  }

  formatDetailedStatus(data) {
    if (!data) return '❌ Status detalhado não disponível.';
    
    let status = '';
    status += `🔧 *Sistema:*\n`;
    status += `• CPU: ${data.cpu || 'N/A'}%\n`;
    status += `• RAM: ${data.memory || 'N/A'} MB\n`;
    status += `• Disco: ${data.disk || 'N/A'} GB\n\n`;
    
    if (data.apis && data.apis.length > 0) {
      status += `🌐 *APIs:*\n`;
      data.apis.forEach(api => {
        status += `• ${api.name}: ${api.status} (${api.url})\n`;
      });
    }
    
    return status;
  }

  formatTranscriptionsList(data) {
    if (!data || !data.transcriptions || data.transcriptions.length === 0) {
      return '📝 Nenhuma transcrição encontrada.';
    }
    
    let list = `📝 *Últimas ${data.transcriptions.length} transcrições:*\n\n`;
    
    data.transcriptions.forEach((t, index) => {
      const date = new Date(t.timestamp).toLocaleString('pt-BR');
      const preview = t.text.substring(0, 50) + (t.text.length > 50 ? '...' : '');
      list += `${index + 1}. ${date}\n   "${preview}"\n\n`;
    });
    
    return list;
  }

  formatTranscriptionsStats(data) {
    if (!data) return '📊 Estatísticas não disponíveis.';
    
    let stats = `📊 *Estatísticas de Transcrições:*\n\n`;
    stats += `🔢 Total: ${data.total || 0}\n`;
    stats += `📅 Hoje: ${data.today || 0}\n`;
    stats += `📆 Esta semana: ${data.thisWeek || 0}\n`;
    stats += `🗓️ Este mês: ${data.thisMonth || 0}\n`;
    
    if (data.avgDuration) {
      stats += `⏱️ Duração média: ${data.avgDuration}s\n`;
    }
    
    if (data.languages && Object.keys(data.languages).length > 0) {
      stats += `\n🗣️ *Idiomas:*\n`;
      Object.entries(data.languages).forEach(([lang, count]) => {
        stats += `• ${lang}: ${count}\n`;
      });
    }
    
    return stats;
  }

  async processWhisperSilentConfigMessage(contactId, text) {
    try {
      const command = text.toLowerCase().trim();
      
      if (command === 'cancelar' || command === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Configuração Whisper Silent cancelada.');
        return;
      }
      
      // Execute the command
      await this.handleWhisperSilentCommand(contactId, command);
      
      // Keep in config mode for multiple commands
      await this.whatsAppBot.sendResponse(contactId, '\n💡 Digite outro comando ou "cancelar" para sair.');
    } catch (error) {
      logger.error('❌ Erro ao processar comando de configuração:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar comando.');
    }
  }

  async processWhisperSilentSearchMessage(contactId, text) {
    try {
      const searchTerm = text.trim();
      
      if (searchTerm.toLowerCase() === 'cancelar' || searchTerm.toLowerCase() === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Busca cancelada.');
        return;
      }
      
      if (searchTerm.length < 3) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Digite pelo menos 3 caracteres para buscar.\n\n💡 Exemplo: "reunião cliente"');
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, `🔍 Buscando por "${searchTerm}"...`, true);
      
      // Execute search
      const result = await this.whatsAppBot.whisperSilentService.searchTranscriptions(searchTerm, {
        userId: contactId,
        limit: 10
      });
      
      if (result.success && result.results && result.results.length > 0) {
        let response = `🔍 *Resultados para "${searchTerm}":*\n\n`;
        
        result.results.forEach((item, index) => {
          const date = new Date(item.timestamp).toLocaleString('pt-BR');
          const snippet = this.highlightSearchTerm(item.text, searchTerm);
          response += `${index + 1}. ${date}\n   ${snippet}\n\n`;
        });
        
        response += `📊 ${result.results.length} resultado(s) encontrado(s).`;
        await this.whatsAppBot.sendResponse(contactId, response);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ Nenhum resultado encontrado para "${searchTerm}".`);
      }
      
      // Exit search mode
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro ao processar busca:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao realizar busca.');
    }
  }

  highlightSearchTerm(text, searchTerm) {
    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (index === -1) return text.substring(0, 100) + '...';
    
    const start = Math.max(0, index - 30);
    const end = Math.min(text.length, index + searchTerm.length + 30);
    const snippet = text.substring(start, end);
    
    return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
  }
}