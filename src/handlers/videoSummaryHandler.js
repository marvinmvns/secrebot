import logger from '../utils/logger.js';
import YouTubeService from '../services/youtubeService.js';

export default class VideoSummaryHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleVideoSubmenu(msg, contactId, input) {
    switch (input) {
      case '7.1':
        await this.whatsAppBot.sendResponse(contactId, '🎬 *Resumir Vídeo do YouTube*\n\nEnvie o link do vídeo que deseja resumir.\n\n💡 Exemplo: https://youtube.com/watch?v=xyz123');
        await this.whatsAppBot.setMode(contactId, 'VIDEO_SUMMARY');
        return true;
      case '7.2':
        await this.whatsAppBot.sendResponse(contactId, '🎬 *Resumir Vídeo (Método 2)*\n\nEnvie o link do vídeo que deseja resumir com método alternativo.\n\n💡 Exemplo: https://youtube.com/watch?v=xyz123');
        await this.whatsAppBot.setMode(contactId, 'VIDEO_SUMMARY_V2');
        return true;
      case '0':
        await this.whatsAppBot.setNavigationState(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, this.whatsAppBot.getMenuMessage());
        return true;
    }
    return false;
  }

  async handleResumirVideoCommand(msg, contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, 'VIDEO_SUMMARY');
      await this.whatsAppBot.sendResponse(contactId, '🎬 *Resumir Vídeo do YouTube*\n\nEnvie o link do vídeo que deseja resumir.\n\n💡 Exemplo: https://youtube.com/watch?v=xyz123\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar resumo de vídeo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar resumo de vídeo.');
      return false;
    }
  }

  async handleResumirVideo2Command(msg, contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, 'VIDEO_SUMMARY_V2');
      await this.whatsAppBot.sendResponse(contactId, '🎬 *Resumir Vídeo (Método 2)*\n\nEnvie o link do vídeo que deseja resumir.\n\n💡 Exemplo: https://youtube.com/watch?v=xyz123\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar resumo de vídeo v2:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar resumo de vídeo v2.');
      return false;
    }
  }

  async processVideoSummaryMessage(contactId, text, method = 'v1') {
    try {
      const lowerText = text.toLowerCase().trim();
      
      // Allow cancellation
      if (lowerText === 'cancelar' || lowerText === 'sair' || lowerText === 'voltar') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Resumo de vídeo cancelado.\n\n📋 Para voltar ao menu: digite !menu');
        return true;
      }

      // Validate YouTube URL
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = text.match(youtubeRegex);
      
      if (!match) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Link do YouTube inválido.\n\n💡 Envie um link válido como:\nhttps://youtube.com/watch?v=xyz123\n\nOu digite "cancelar" para sair.');
        return true;
      }

      const videoId = match[1];
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      await this.whatsAppBot.sendResponse(contactId, `🎬 Processando vídeo...\n🔗 ${videoUrl}\n\n⏳ Isso pode levar alguns minutos...`, true);
      
      // Process video summary
      const result = await this.processVideoSummaryResilient(videoUrl, contactId, method);
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, result.summary);
        
        // Return to normal mode
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, `✅ *Resumo concluído!*\n\n🔙 Para voltar ao menu: !menu`);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ ${result.error}\n\n💡 Tente outro link ou digite "cancelar" para sair.`);
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao processar resumo de vídeo para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro interno ao processar vídeo.');
      await this.whatsAppBot.setMode(contactId, null);
      return false;
    }
  }

  async processVideoSummaryResilient(link, contactId, method = 'v1') {
    try {
      // Validate YouTube URL
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      if (!youtubeRegex.test(link)) {
        return {
          success: false,
          error: 'URL do YouTube inválida. Verifique o link e tente novamente.'
        };
      }

      // Process based on method
      if (method === 'v2') {
        return await this.processVideoSummaryMethodV2(link, contactId);
      } else {
        return await this.processVideoSummaryMethodV1(link, contactId);
      }
    } catch (error) {
      logger.error(`❌ Erro no processamento resiliente de vídeo:`, error);
      return {
        success: false,
        error: `Erro no processamento: ${error.message}`
      };
    }
  }

  async processVideoSummaryMethodV1(link, contactId) {
    try {
      logger.info(`🎬 Iniciando resumo v1 do vídeo: ${link}`);
      
      // Use YouTubeService to get video transcript and generate summary
      const result = await YouTubeService.summarizeVideo(link, {
        method: 'v1',
        language: 'pt',
        maxLength: 1000
      });

      if (result.success) {
        let summary = `🎬 *Resumo do Vídeo* (Método 1)\n\n`;
        
        if (result.title) {
          summary += `📹 *Título:* ${result.title}\n\n`;
        }
        
        if (result.duration) {
          summary += `⏱️ *Duração:* ${result.duration}\n\n`;
        }
        
        summary += `📝 *Resumo:*\n${result.summary}\n\n`;
        
        if (result.keyPoints && result.keyPoints.length > 0) {
          summary += `🔑 *Pontos-chave:*\n`;
          result.keyPoints.forEach((point, index) => {
            summary += `${index + 1}. ${point}\n`;
          });
          summary += `\n`;
        }
        
        summary += `🔗 *Link:* ${link}`;
        
        return {
          success: true,
          summary: summary
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro ao processar vídeo com método v1'
        };
      }
    } catch (error) {
      logger.error('❌ Erro no método v1:', error);
      return {
        success: false,
        error: `Método v1 falhou: ${error.message}`
      };
    }
  }

  async processVideoSummaryMethodV2(link, contactId) {
    try {
      logger.info(`🎬 Iniciando resumo v2 do vídeo: ${link}`);
      
      // Use alternative method for video processing
      const result = await YouTubeService.summarizeVideo(link, {
        method: 'v2',
        language: 'pt',
        maxLength: 1500,
        includeTimestamps: true
      });

      if (result.success) {
        let summary = `🎬 *Resumo do Vídeo* (Método 2)\n\n`;
        
        if (result.title) {
          summary += `📹 *Título:* ${result.title}\n\n`;
        }
        
        if (result.channel) {
          summary += `📺 *Canal:* ${result.channel}\n\n`;
        }
        
        if (result.duration) {
          summary += `⏱️ *Duração:* ${result.duration}\n\n`;
        }
        
        summary += `📝 *Resumo Detalhado:*\n${result.summary}\n\n`;
        
        if (result.timestamps && result.timestamps.length > 0) {
          summary += `🕐 *Momentos importantes:*\n`;
          result.timestamps.forEach((timestamp, index) => {
            summary += `⏰ ${timestamp.time} - ${timestamp.description}\n`;
          });
          summary += `\n`;
        }
        
        summary += `🔗 *Link:* ${link}`;
        
        return {
          success: true,
          summary: summary
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro ao processar vídeo com método v2'
        };
      }
    } catch (error) {
      logger.error('❌ Erro no método v2:', error);
      return {
        success: false,
        error: `Método v2 falhou: ${error.message}`
      };
    }
  }

  async getVideoInfo(link) {
    try {
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = link.match(youtubeRegex);
      
      if (!match) {
        return null;
      }

      const videoId = match[1];
      
      // Get basic video information
      return await YouTubeService.getVideoInfo(videoId);
    } catch (error) {
      logger.error('❌ Erro ao obter informações do vídeo:', error);
      return null;
    }
  }
}