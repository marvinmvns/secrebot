import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

export default class DocumentHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleResumirCommand(msg, contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.RESUMIR);
      await this.whatsAppBot.sendResponse(contactId, '📝 *Modo Resumir Ativado*\n\nEnvie um documento ou texto que deseja resumir.\n\n📋 *Formatos aceitos:*\n• PDF (.pdf)\n• Word (.docx)\n• Texto (.txt)\n• CSV (.csv)\n• Ou cole texto diretamente\n\n❌ Digite "cancelar" para sair.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar comando resumir:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar modo resumir.');
      return false;
    }
  }

  async performResumir(msg, contactId, providedText = '') {
    try {
      let textToSummarize = '';
      let documentInfo = '';
      
      // Check if there's provided text
      if (providedText && providedText.trim()) {
        textToSummarize = providedText.trim();
        documentInfo = '📝 *Fonte:* Texto fornecido\n';
      }
      // Check if message has media attachment
      else if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        const filename = msg._data.filename || 'document';
        
        documentInfo = `📎 *Documento:* ${filename}\n`;
        
        // Process different file types
        if (filename.toLowerCase().endsWith('.pdf')) {
          textToSummarize = await this.processPdfDocument(media);
        } else if (filename.toLowerCase().endsWith('.docx')) {
          textToSummarize = await this.processWordDocument(media);
        } else if (filename.toLowerCase().endsWith('.txt')) {
          textToSummarize = await this.processTextDocument(media);
        } else if (filename.toLowerCase().endsWith('.csv')) {
          textToSummarize = await this.processCsvDocument(media);
        } else {
          await this.whatsAppBot.sendResponse(contactId, 
            '❌ *Formato não suportado!*\n\n' +
            '📋 *Formatos aceitos:*\n' +
            '• PDF (.pdf)\n• Word (.docx)\n• Texto (.txt)\n• CSV (.csv)\n\n' +
            '🔄 Envie outro arquivo ou cole o texto diretamente.'
          );
          return;
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Nenhum conteúdo para resumir!*\n\n' +
          '📝 Envie:\n• Um arquivo (PDF, DOCX, TXT, CSV)\n• Ou digite/cole o texto na mensagem'
        );
        return;
      }
      
      if (!textToSummarize || textToSummarize.trim().length === 0) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Documento vazio ou não foi possível extrair texto.*\n\n' +
          '🔄 Tente outro arquivo ou verifique se o documento contém texto.'
        );
        return;
      }
      
      // Check text length
      if (textToSummarize.length < 100) {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ *Texto muito curto para resumir.*\n\n' +
          '💡 O texto precisa ter pelo menos 100 caracteres para gerar um resumo útil.\n\n' +
          `📊 *Tamanho atual:* ${textToSummarize.length} caracteres`
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, 
        `${documentInfo}📊 *Tamanho:* ${textToSummarize.length} caracteres\n\n🤖 Gerando resumo...`, 
        true
      );
      
      // Generate summary using LLM
      const summary = await this.generateDocumentSummary(textToSummarize, contactId);
      
      if (summary.success) {
        let response = `📝 *Resumo do Documento:*\n\n`;
        response += summary.content;
        
        // Add statistics if available
        if (summary.stats) {
          response += `\n\n📊 *Estatísticas:*\n`;
          response += `• Texto original: ${summary.stats.originalLength} caracteres\n`;
          response += `• Resumo: ${summary.stats.summaryLength} caracteres\n`;
          response += `• Redução: ${summary.stats.reductionPercent}%`;
        }
        
        await this.whatsAppBot.sendResponse(contactId, response);
        await this.whatsAppBot.sendResponse(contactId, '✅ *Resumo concluído!*\n\n🔙 Para voltar ao menu: !menu');
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Erro ao gerar resumo:* ${summary.error}\n\n🔄 Tente novamente ou use um texto menor.`
        );
      }
    } catch (error) {
      logger.error(`❌ Erro ao realizar resumo para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro interno ao processar documento.');
    }
  }

  async processPdfDocument(media) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      const text = await parsePdfBuffer(buffer);
      return text;
    } catch (error) {
      logger.error('❌ Erro ao processar PDF:', error);
      throw new Error('Não foi possível processar o arquivo PDF.');
    }
  }

  async processWordDocument(media) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      const result = await mammoth.extractRawText({ buffer: buffer });
      return result.value;
    } catch (error) {
      logger.error('❌ Erro ao processar DOCX:', error);
      throw new Error('Não foi possível processar o arquivo Word.');
    }
  }

  async processTextDocument(media) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      return buffer.toString('utf-8');
    } catch (error) {
      logger.error('❌ Erro ao processar TXT:', error);
      throw new Error('Não foi possível processar o arquivo de texto.');
    }
  }

  async processCsvDocument(media) {
    try {
      const buffer = Buffer.from(media.data, 'base64');
      const csvText = buffer.toString('utf-8');
      
      // Convert CSV to readable format
      const lines = csvText.split('\n');
      const headers = lines[0];
      const dataRows = lines.slice(1, Math.min(50, lines.length)); // Limit to first 50 rows for summary
      
      let processedText = `Arquivo CSV com ${lines.length - 1} linhas de dados.\n\n`;
      processedText += `Cabeçalhos: ${headers}\n\n`;
      processedText += `Primeiras linhas de dados:\n`;
      processedText += dataRows.join('\n');
      
      if (lines.length > 51) {
        processedText += `\n\n... e mais ${lines.length - 51} linhas de dados.`;
      }
      
      return processedText;
    } catch (error) {
      logger.error('❌ Erro ao processar CSV:', error);
      throw new Error('Não foi possível processar o arquivo CSV.');
    }
  }

  async generateDocumentSummary(text, contactId) {
    try {
      const originalLength = text.length;
      
      // Truncate text if too long (to avoid token limits)
      let textToSummarize = text;
      if (text.length > 10000) {
        textToSummarize = text.substring(0, 10000) + '\n\n[Texto truncado para análise...]';
      }
      
      const prompt = `Por favor, faça um resumo completo e estruturado do seguinte texto. O resumo deve ser informativo, capturando os pontos principais e organizando-os de forma clara:

TEXTO PARA RESUMIR:
${textToSummarize}

INSTRUÇÕES PARA O RESUMO:
1. Identifique o tema/assunto principal
2. Liste os pontos-chave mais importantes
3. Mantenha a estrutura lógica do conteúdo original
4. Use bullets ou numeração quando apropriado
5. Seja conciso mas abrangente
6. Escreva em português brasileiro
7. Máximo de 500 palavras

Formate o resumo de forma organizada e fácil de ler.`;
      
      const response = await this.whatsAppBot.llmService.getAssistantResponse(prompt, {
        userId: contactId,
        system: "Você é um especialista em análise e resumo de documentos. Crie resumos claros, organizados e informativos."
      });
      
      if (response.success) {
        const summaryLength = response.response.length;
        const reductionPercent = Math.round(((originalLength - summaryLength) / originalLength) * 100);
        
        return {
          success: true,
          content: response.response,
          stats: {
            originalLength,
            summaryLength,
            reductionPercent
          }
        };
      } else {
        return {
          success: false,
          error: response.error || 'Erro ao gerar resumo com IA'
        };
      }
    } catch (error) {
      logger.error('❌ Erro ao gerar resumo:', error);
      return {
        success: false,
        error: 'Erro interno ao gerar resumo'
      };
    }
  }

  async processResumarMessage(contactId, text, msg) {
    try {
      if (!msg.hasMedia && !text.trim()) {
        await this.whatsAppBot.sendResponse(contactId, '📝 *Aguardando documento ou texto...*\n\nPor favor, envie:\n• Um arquivo (PDF, DOCX, TXT, CSV)\n• Ou digite/cole o texto na mensagem\n\n🔙 Para cancelar: digite "cancelar"');
        return;
      }
      
      const lowerText = text.toLowerCase().trim();
      
      // Allow cancellation
      if (lowerText === 'cancelar' || lowerText === 'sair' || lowerText === 'voltar') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Resumo cancelado.\n\n📋 Para voltar ao menu: !menu');
        return;
      }
      
      await this.performResumir(msg, contactId, text);
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem de resumo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar documento.');
    }
  }

  async validateDocumentFormat(filename) {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.csv'];
    const extension = path.extname(filename.toLowerCase());
    return allowedExtensions.includes(extension);
  }

  async getDocumentStats(text) {
    const words = text.split(/\s+/).length;
    const chars = text.length;
    const paragraphs = text.split(/\n\s*\n/).length;
    const lines = text.split('\n').length;
    
    return {
      characters: chars,
      words: words,
      paragraphs: paragraphs,
      lines: lines
    };
  }

  async extractKeywords(text, contactId) {
    try {
      const prompt = `Analise o seguinte texto e extraia as 10 palavras-chave mais importantes:

${text.substring(0, 2000)}

Responda apenas com as palavras-chave separadas por vírgulas, em português brasileiro.`;
      
      const response = await this.whatsAppBot.llmService.getAssistantResponse(prompt, {
        userId: contactId,
        system: "Você é um especialista em análise textual. Extraia apenas as palavras-chave mais relevantes."
      });
      
      if (response.success) {
        return response.response.split(',').map(keyword => keyword.trim());
      }
      
      return [];
    } catch (error) {
      logger.error('❌ Erro ao extrair palavras-chave:', error);
      return [];
    }
  }

  async generateDocumentOutline(text, contactId) {
    try {
      const prompt = `Crie um outline/estrutura do seguinte documento, identificando os principais tópicos e subtópicos:

${text.substring(0, 3000)}

Formate como uma estrutura hierárquica usando números e bullets. Responda em português brasileiro.`;
      
      const response = await this.whatsAppBot.llmService.getAssistantResponse(prompt, {
        userId: contactId,
        system: "Você é um especialista em análise de documentos. Crie estruturas claras e organizadas."
      });
      
      if (response.success) {
        return {
          success: true,
          outline: response.response
        };
      }
      
      return {
        success: false,
        error: response.error || 'Erro ao gerar outline'
      };
    } catch (error) {
      logger.error('❌ Erro ao gerar outline:', error);
      return {
        success: false,
        error: 'Erro interno ao gerar outline'
      };
    }
  }
}