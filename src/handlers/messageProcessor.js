import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class MessageProcessor {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async processMessage(msg) {
    try {
      const contactId = msg.from;
      const messageType = msg.type;
      const text = msg.body;
      const lowerText = text.toLowerCase().trim();
      
      logger.info(`📨 Processando mensagem ${messageType} de ${contactId}: ${text.substring(0, 100)}`);

      // Check if user has active flow first
      if (await this.whatsAppBot.hasActiveFlow(contactId)) {
        return await this.whatsAppBot.processFlowMessage(contactId, text);
      }

      // Process by message type
      switch (messageType) {
        case 'chat':
          return await this.processTextMessage(msg, contactId, text, lowerText);
        
        case 'ptt':
        case 'audio':
          return await this.processAudioMessage(msg, contactId);
        
        case 'image':
          return await this.processImageMessage(msg, contactId, lowerText);
        
        case 'document':
          return await this.processDocumentMessage(msg, contactId);
        
        case 'video':
          return await this.processVideoMessage(msg, contactId);
        
        default:
          logger.warn(`⚠️  Tipo de mensagem não suportado: ${messageType}`);
          return false;
      }
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem:', error);
      return false;
    }
  }

  async processTextMessage(msg, contactId, text, lowerText) {
    try {
      // Check for commands first
      if (lowerText.startsWith('!')) {
        const commandHandler = this.whatsAppBot.commandHandler;
        if (commandHandler) {
          return await commandHandler.handleCommand(msg, contactId, lowerText, text);
        }
      }

      // Check current mode
      const currentMode = await this.whatsAppBot.getCurrentMode(contactId);
      if (currentMode && currentMode !== CHAT_MODES.NORMAL) {
        return await this.whatsAppBot.processMessageByMode(contactId, text, msg);
      }

      // Check navigation state
      const navigationState = await this.whatsAppBot.getNavigationState(contactId);
      if (navigationState) {
        return await this.whatsAppBot.processTextNavigation(msg, contactId, text, navigationState);
      }

      // No navigation state - let legacy handler process it
      return false;
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem de texto:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar sua mensagem.');
      return false;
    }
  }

  async processAudioMessage(msg, contactId) {
    try {
      return await this.whatsAppBot.audioTranscriptionHandler.handleAudioMessage(msg, contactId);
    } catch (error) {
      logger.error('❌ Erro ao processar áudio:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar áudio.');
      return false;
    }
  }

  async processImageMessage(msg, contactId, lowerText) {
    try {
      return await this.whatsAppBot.handleImageMessage(msg, contactId, lowerText);
    } catch (error) {
      logger.error('❌ Erro ao processar imagem:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar imagem.');
      return false;
    }
  }

  async processDocumentMessage(msg, contactId) {
    try {
      // Check if it's a calendar file
      const attachment = await msg.downloadMedia();
      if (attachment) {
        const filename = msg._data.filename || 'document';
        
        if (filename.toLowerCase().endsWith('.ics')) {
          // Handle calendar import
          return await this.whatsAppBot.handleImportarAgendaCommand(msg, contactId);
        }
        
        // Handle other document types like PDFs
        if (filename.toLowerCase().endsWith('.pdf')) {
          const currentMode = await this.whatsAppBot.getCurrentMode(contactId);
          if (currentMode === CHAT_MODES.DEEP) {
            // Process PDF with LLM
            const buffer = Buffer.from(attachment.data, 'base64');
            const pdfText = await this.whatsAppBot.parsePdfBuffer(buffer);
            
            if (pdfText && pdfText.trim().length > 0) {
              await this.whatsAppBot.sendResponse(contactId, '📄 Processando PDF...');
              return await this.whatsAppBot.processDeepMessage(contactId, pdfText);
            }
          }
        }
      }
      
      await this.whatsAppBot.sendResponse(contactId, 'Tipo de documento não suportado ou contexto inadequado.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao processar documento:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar documento.');
      return false;
    }
  }

  async processVideoMessage(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, 'Vídeos não são processados diretamente. Use !resumir_video com um link do YouTube.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao processar vídeo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar vídeo.');
      return false;
    }
  }
}