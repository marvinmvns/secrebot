import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class ImageHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleImageMessage(msg, contactId, lowerText) {
    try {
      logger.info(`🖼️ Processando imagem de ${contactId}`);
      
      // Check if it's an image analysis request
      if (lowerText.includes('analise') || lowerText.includes('describe') || lowerText.includes('o que é')) {
        return await this.analyzeImage(msg, contactId);
      }
      
      // Check if it's an OCR request
      if (lowerText.includes('texto') || lowerText.includes('ler') || lowerText.includes('ocr')) {
        return await this.extractTextFromImage(msg, contactId);
      }
      
      // Check if it's a translation request
      if (lowerText.includes('traduz') || lowerText.includes('translate')) {
        return await this.translateImageText(msg, contactId);
      }
      
      // Default: provide image analysis options
      await this.showImageOptions(msg, contactId);
      return true;
      
    } catch (error) {
      logger.error(`❌ Erro ao processar imagem para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar imagem.');
      return false;
    }
  }

  async analyzeImage(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🖼️ Analisando imagem com IA...', true);
      
      // Download image
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar a imagem.');
        return false;
      }
      
      // Check if we have an LLM service with vision capabilities
      if (this.whatsAppBot.llmService && this.whatsAppBot.llmService.supportsImages) {
        const analysis = await this.whatsAppBot.llmService.analyzeImage(media.data, {
          userId: contactId,
          prompt: 'Descreva esta imagem em detalhes em português brasileiro. Inclua objetos, pessoas, cores, ambiente e contexto.'
        });
        
        if (analysis.success) {
          let response = `🖼️ *Análise da Imagem:*\n\n${analysis.response}`;
          
          // Add additional information if available
          if (analysis.objects && analysis.objects.length > 0) {
            response += `\n\n🎯 *Objetos detectados:*\n${analysis.objects.join(', ')}`;
          }
          
          if (analysis.colors && analysis.colors.length > 0) {
            response += `\n\n🎨 *Cores principais:*\n${analysis.colors.join(', ')}`;
          }
          
          await this.whatsAppBot.sendResponse(contactId, response);
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ Erro na análise: ${analysis.error}`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ *Análise de imagem não disponível*\n\n' +
          'Para usar esta funcionalidade:\n' +
          '• Configure um modelo LLM com suporte a imagens\n' +
          '• Ex: llava, bakllava, ou GPT-4 Vision\n\n' +
          '🔧 Verifique sua configuração de LLM'
        );
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro na análise de imagem:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao analisar imagem.');
      return false;
    }
  }

  async extractTextFromImage(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '📖 Extraindo texto da imagem (OCR)...', true);
      
      // Download image
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar a imagem.');
        return false;
      }
      
      // Use OCR service or LLM with vision
      let ocrResult = null;
      
      if (this.whatsAppBot.llmService && this.whatsAppBot.llmService.supportsImages) {
        ocrResult = await this.whatsAppBot.llmService.analyzeImage(media.data, {
          userId: contactId,
          prompt: 'Extraia todo o texto visível nesta imagem. Mantenha a formatação original quando possível. Se não houver texto, responda "Nenhum texto encontrado".'
        });
      }
      
      if (ocrResult && ocrResult.success) {
        if (ocrResult.response.toLowerCase().includes('nenhum texto') || ocrResult.response.trim().length < 10) {
          await this.whatsAppBot.sendResponse(contactId, '📖 *Nenhum texto encontrado na imagem*\n\n💡 Certifique-se de que:\n• A imagem contém texto legível\n• A qualidade está boa\n• O texto não está muito pequeno');
        } else {
          await this.whatsAppBot.sendResponse(contactId, `📖 *Texto extraído da imagem:*\n\n${ocrResult.response}`);
          
          // Offer translation if text is detected
          await this.whatsAppBot.sendResponse(contactId, '🌐 *Precisa traduzir o texto?*\n\n💡 Responda "traduzir para [idioma]" se necessário\nEx: "traduzir para inglês"');
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ *OCR não disponível*\n\n' +
          'Para extrair texto de imagens:\n' +
          '• Configure um modelo LLM com suporte a imagens\n' +
          '• Ou instale uma ferramenta de OCR dedicada'
        );
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro no OCR:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao extrair texto da imagem.');
      return false;
    }
  }

  async translateImageText(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🌐 Extraindo e traduzindo texto...', true);
      
      // First extract text
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível baixar a imagem.');
        return false;
      }
      
      if (this.whatsAppBot.llmService && this.whatsAppBot.llmService.supportsImages) {
        const result = await this.whatsAppBot.llmService.analyzeImage(media.data, {
          userId: contactId,
          prompt: 'Extraia todo o texto desta imagem e traduza para português brasileiro. Se o texto já estiver em português, traduza para inglês. Formato: [TEXTO ORIGINAL]\n\n[TRADUÇÃO]'
        });
        
        if (result.success) {
          await this.whatsAppBot.sendResponse(contactId, `🌐 *Texto extraído e traduzido:*\n\n${result.response}`);
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ Erro na tradução: ${result.error}`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, '⚠️ Funcionalidade de tradução de imagem não disponível.');
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro na tradução de imagem:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao traduzir texto da imagem.');
      return false;
    }
  }

  async showImageOptions(msg, contactId) {
    try {
      let message = `🖼️ *Opções para Imagem*\n\n`;
      message += `📋 **O que posso fazer:**\n\n`;
      
      message += `🔍 **1. Analisar imagem**\n`;
      message += `• Descrever conteúdo\n`;
      message += `• Identificar objetos e pessoas\n`;
      message += `• Analisar cores e composição\n\n`;
      
      message += `📖 **2. Extrair texto (OCR)**\n`;
      message += `• Ler texto da imagem\n`;
      message += `• Manter formatação\n`;
      message += `• Documentos digitalizados\n\n`;
      
      message += `🌐 **3. Traduzir texto**\n`;
      message += `• Extrair e traduzir automaticamente\n`;
      message += `• Suporte a múltiplos idiomas\n`;
      message += `• Ideal para placas e documentos\n\n`;
      
      message += `💡 **Como usar:**\n`;
      message += `• "analise esta imagem"\n`;
      message += `• "extrair texto"\n`;
      message += `• "traduzir texto"\n\n`;
      
      // Check capabilities
      const hasVision = this.whatsAppBot.llmService && this.whatsAppBot.llmService.supportsImages;
      
      if (hasVision) {
        message += `✅ **Funcionalidades disponíveis:** Todas\n`;
        message += `🤖 **Modelo:** ${await this.getVisionModelName()}`;
      } else {
        message += `⚠️ **Limitado:** Configure modelo com suporte a imagens\n`;
        message += `💡 **Modelos recomendados:** llava, bakllava`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar opções de imagem:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao mostrar opções.');
      return false;
    }
  }

  async processImageAnalysisMode(contactId, text, msg) {
    try {
      if (msg && msg.hasMedia) {
        // Process the image with the text as context
        const media = await msg.downloadMedia();
        
        if (this.whatsAppBot.llmService && this.whatsAppBot.llmService.supportsImages) {
          const analysis = await this.whatsAppBot.llmService.analyzeImage(media.data, {
            userId: contactId,
            prompt: `${text}\n\nAnalise esta imagem considerando o contexto acima. Responda em português brasileiro.`
          });
          
          if (analysis.success) {
            await this.whatsAppBot.sendResponse(contactId, `🖼️ *Análise contextual:*\n\n${analysis.response}`);
          } else {
            await this.whatsAppBot.sendResponse(contactId, `❌ Erro na análise: ${analysis.error}`);
          }
        }
        
        await this.whatsAppBot.setMode(contactId, null);
      } else if (text.toLowerCase().includes('cancelar') || text.toLowerCase().includes('sair')) {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Análise de imagem cancelada.');
      } else {
        await this.whatsAppBot.sendResponse(contactId, '📸 Envie uma imagem para analisar com o contexto fornecido.\n\nOu digite "cancelar" para sair.');
      }
    } catch (error) {
      logger.error('❌ Erro no modo análise de imagem:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar análise de imagem.');
    }
  }

  async getVisionModelName() {
    try {
      if (this.whatsAppBot.llmService) {
        return await this.whatsAppBot.llmService.getCurrentModel() || 'Modelo com visão';
      }
      return 'Desconhecido';
    } catch (error) {
      return 'Não disponível';
    }
  }

  async validateImageFormat(media) {
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (!media.mimetype || !supportedFormats.includes(media.mimetype.toLowerCase())) {
      return {
        valid: false,
        error: 'Formato de imagem não suportado. Use: JPEG, PNG, GIF ou WebP'
      };
    }
    
    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const buffer = Buffer.from(media.data, 'base64');
    
    if (buffer.length > maxSize) {
      return {
        valid: false,
        error: 'Imagem muito grande. Tamanho máximo: 10MB'
      };
    }
    
    return { valid: true };
  }

  async getImageMetadata(media) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      
      return {
        size: buffer.length,
        format: media.mimetype,
        sizeFormatted: this.formatFileSize(buffer.length)
      };
    } catch (error) {
      return null;
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}