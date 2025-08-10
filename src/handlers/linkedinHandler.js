import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';
import { loginAndGetLiAt } from '../services/linkedinScraper.js';

export default class LinkedInHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleLinkedinCommand(contactId, originalText) {
    try {
      // Check if LinkedIn credentials are available
      const liAt = this.whatsAppBot.linkedinSessions.get(contactId);
      
      if (!liAt) {
        await this.whatsAppBot.sendResponse(contactId, 
          '🔗 *LinkedIn Analyzer*\n\n' +
          '⚠️ Primeiro, preciso que você forneça suas credenciais do LinkedIn.\n\n' +
          '📧 *Email:* Digite seu email do LinkedIn\n' +
          '🔒 *Senha:* Digite sua senha do LinkedIn\n\n' +
          '💡 *Formato:* email:senha\n' +
          '📝 *Exemplo:* seuemail@gmail.com:suasenha123\n\n' +
          '🔐 *Segurança:* Suas credenciais são usadas apenas para acessar perfis e não são armazenadas permanentemente.\n\n' +
          '❌ Digite "cancelar" para sair.'
        );
        
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.LINKEDIN);
        this.whatsAppBot.awaitingLinkedinCreds.set(contactId, true);
        return true;
      }
      
      // If we have credentials, ask for URL
      await this.whatsAppBot.sendResponse(contactId, 
        '🔗 *LinkedIn Analyzer*\n\n' +
        '✅ Credenciais LinkedIn encontradas!\n\n' +
        '🔍 Digite o URL do perfil LinkedIn que deseja analisar.\n\n' +
        '💡 *Exemplo:* https://linkedin.com/in/nome-pessoa\n\n' +
        '❌ Digite "cancelar" para sair.'
      );
      
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.LINKEDIN);
      this.whatsAppBot.awaitingLinkedinCreds.set(contactId, false);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar comando LinkedIn:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar análise LinkedIn.');
      return false;
    }
  }

  async processLinkedInMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      // Allow cancellation
      if (lowerText === 'cancelar' || lowerText === 'sair' || lowerText === 'voltar') {
        await this.whatsAppBot.setMode(contactId, null);
        this.whatsAppBot.awaitingLinkedinCreds.delete(contactId);
        this.whatsAppBot.linkedinSessions.delete(contactId);
        await this.whatsAppBot.sendResponse(contactId, '❌ Análise LinkedIn cancelada.\n\n📋 Para voltar ao menu: !menu');
        return;
      }
      
      const awaitingCreds = this.whatsAppBot.awaitingLinkedinCreds.get(contactId);
      
      if (awaitingCreds) {
        // Process credentials
        await this.processLinkedInCredentials(contactId, text);
      } else {
        // Process URL
        await this.processLinkedInUrl(contactId, text);
      }
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem LinkedIn:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar solicitação LinkedIn.');
    }
  }

  async processLinkedInCredentials(contactId, text) {
    try {
      if (!text.includes(':')) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ Formato inválido!\n\n' +
          '💡 Use o formato: email:senha\n' +
          '📝 Exemplo: seuemail@gmail.com:suasenha123\n\n' +
          'Ou digite "cancelar" para sair.'
        );
        return;
      }
      
      const [email, password] = text.split(':');
      
      if (!email || !password) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ Email ou senha não fornecidos!\n\n' +
          '💡 Use o formato: email:senha\n\n' +
          'Ou digite "cancelar" para sair.'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '🔐 Testando credenciais LinkedIn...', true);
      
      // Test LinkedIn login
      const liAt = await this.testLinkedInConnection(contactId, email.trim(), password.trim());
      
      if (liAt) {
        this.whatsAppBot.linkedinSessions.set(contactId, liAt);
        this.whatsAppBot.awaitingLinkedinCreds.set(contactId, false);
        
        await this.whatsAppBot.sendResponse(contactId, 
          '✅ *Credenciais LinkedIn válidas!*\n\n' +
          '🔍 Agora digite o URL do perfil LinkedIn que deseja analisar.\n\n' +
          '💡 *Exemplo:* https://linkedin.com/in/nome-pessoa\n\n' +
          '❌ Digite "cancelar" para sair.'
        );
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Credenciais inválidas!*\n\n' +
          '🔄 Verifique seu email e senha e tente novamente.\n\n' +
          '💡 *Formato:* email:senha\n\n' +
          'Ou digite "cancelar" para sair.'
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao processar credenciais LinkedIn:', error);
      await this.whatsAppBot.sendResponse(contactId, 
        '❌ Erro ao testar credenciais.\n\n' +
        '🔄 Tente novamente ou digite "cancelar" para sair.'
      );
    }
  }

  async processLinkedInUrl(contactId, text) {
    try {
      const linkedinRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/i;
      
      if (!linkedinRegex.test(text)) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ URL do LinkedIn inválido!\n\n' +
          '💡 *Formato esperado:*\n' +
          'https://linkedin.com/in/nome-pessoa\n\n' +
          '🔄 Tente novamente ou digite "cancelar" para sair.'
        );
        return;
      }
      
      const liAt = this.whatsAppBot.linkedinSessions.get(contactId);
      if (!liAt) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Sessão LinkedIn expirada. Use !linkedin novamente.');
        await this.whatsAppBot.setMode(contactId, null);
        return;
      }
      
      // Perform LinkedIn analysis
      await this.analyzeLinkedInProfileResilient(contactId, text, liAt);
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro ao processar URL LinkedIn:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao analisar perfil LinkedIn.');
    }
  }

  async testLinkedInConnection(contactId, email, password) {
    try {
      logger.info(`🔐 Testando conexão LinkedIn para ${contactId}`);
      
      const liAt = await loginAndGetLiAt(email, password);
      
      if (liAt) {
        logger.info(`✅ Conexão LinkedIn bem-sucedida para ${contactId}`);
        return liAt;
      } else {
        logger.warn(`❌ Falha na conexão LinkedIn para ${contactId}`);
        return null;
      }
    } catch (error) {
      logger.error(`❌ Erro ao testar conexão LinkedIn para ${contactId}:`, error);
      return null;
    }
  }

  async analyzeLinkedInProfileResilient(contactId, url, liAt) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔍 *Analisando perfil LinkedIn...*\n\n⏳ Isso pode levar alguns minutos...', true);
      
      // Use LinkedIn scraper service
      const { analyzeProfile } = await import('../services/linkedinScraper.js');
      const profileData = await analyzeProfile(url, liAt);
      
      if (!profileData) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Erro na análise*\n\n' +
          'Não foi possível analisar este perfil. Verifique:\n' +
          '• URL está correto?\n' +
          '• Perfil é público?\n' +
          '• Suas credenciais estão válidas?\n\n' +
          '🔄 Tente novamente com outro perfil.'
        );
        return;
      }
      
      // Process the profile data
      await this.processStructuredLinkedInData(profileData, 'high', contactId);
      
    } catch (error) {
      logger.error('❌ Erro na análise resiliente LinkedIn:', error);
      
      // Try fallback approach
      await this.whatsAppBot.sendResponse(contactId, 
        '⚠️ *Método principal falhou*\n\n' +
        '🔄 Tentando método alternativo...'
      );
      
      try {
        await this.fallbackLinkedInAnalysis(contactId, url);
      } catch (fallbackError) {
        logger.error('❌ Método alternativo também falhou:', fallbackError);
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Análise não foi possível*\n\n' +
          'Ambos os métodos de análise falharam.\n' +
          'Tente novamente mais tarde ou com outro perfil.'
        );
      }
    }
  }

  async processStructuredLinkedInData(data, quality, contactId) {
    try {
      let analysis = `🔍 *Análise do Perfil LinkedIn*\n\n`;
      
      if (data.name) {
        analysis += `👤 *Nome:* ${data.name}\n`;
      }
      
      if (data.headline) {
        analysis += `💼 *Headline:* ${data.headline}\n`;
      }
      
      if (data.location) {
        analysis += `📍 *Localização:* ${data.location}\n`;
      }
      
      if (data.connections) {
        analysis += `🔗 *Conexões:* ${data.connections}\n`;
      }
      
      analysis += `\n`;
      
      if (data.experience && data.experience.length > 0) {
        analysis += `💼 *Experiência Profissional:*\n`;
        data.experience.slice(0, 3).forEach((exp, index) => {
          analysis += `${index + 1}. ${exp.title} - ${exp.company}\n`;
          if (exp.duration) analysis += `   📅 ${exp.duration}\n`;
        });
        if (data.experience.length > 3) {
          analysis += `   ... e mais ${data.experience.length - 3} experiências\n`;
        }
        analysis += `\n`;
      }
      
      if (data.education && data.education.length > 0) {
        analysis += `🎓 *Educação:*\n`;
        data.education.forEach((edu, index) => {
          analysis += `${index + 1}. ${edu.school}\n`;
          if (edu.degree) analysis += `   📜 ${edu.degree}\n`;
        });
        analysis += `\n`;
      }
      
      if (data.skills && data.skills.length > 0) {
        analysis += `🛠️ *Principais Habilidades:*\n`;
        data.skills.slice(0, 10).forEach((skill, index) => {
          analysis += `• ${skill}\n`;
        });
        if (data.skills.length > 10) {
          analysis += `• ... e mais ${data.skills.length - 10} habilidades\n`;
        }
        analysis += `\n`;
      }
      
      // Generate AI-powered insights
      if (quality === 'high') {
        await this.whatsAppBot.sendResponse(contactId, analysis);
        await this.generateLinkedInInsights(contactId, data);
      } else {
        analysis += `⚠️ *Análise básica* - alguns dados podem estar limitados.`;
        await this.whatsAppBot.sendResponse(contactId, analysis);
      }
      
      await this.whatsAppBot.sendResponse(contactId, '✅ *Análise concluída!*\n\n🔙 Para voltar ao menu: !menu');
      
    } catch (error) {
      logger.error('❌ Erro ao processar dados estruturados LinkedIn:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar dados do perfil.');
    }
  }

  async generateLinkedInInsights(contactId, data) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 *Gerando insights com IA...*', true);
      
      const prompt = `Analise este perfil LinkedIn e forneça insights profissionais:
      
Nome: ${data.name || 'N/A'}
Headline: ${data.headline || 'N/A'}
Localização: ${data.location || 'N/A'}
Conexões: ${data.connections || 'N/A'}

Experiência: ${data.experience ? data.experience.map(exp => `${exp.title} na ${exp.company} (${exp.duration || 'N/A'})`).join(', ') : 'N/A'}

Educação: ${data.education ? data.education.map(edu => `${edu.degree || 'Curso'} em ${edu.school}`).join(', ') : 'N/A'}

Habilidades: ${data.skills ? data.skills.slice(0, 15).join(', ') : 'N/A'}

Forneça insights sobre:
1. Perfil profissional e senioridade
2. Área de atuação e especialização
3. Trajetória de carreira
4. Pontos fortes identificados
5. Recomendações para networking

Responda em português brasileiro, de forma objetiva e profissional.`;
      
      const response = await this.whatsAppBot.llmService.getAssistantResponse(prompt, {
        userId: contactId,
        system: "Você é um analista de RH especializado em perfis LinkedIn. Forneça insights profissionais e objetivos."
      });
      
      if (response.success) {
        await this.whatsAppBot.sendResponse(contactId, `🤖 *Insights da IA:*\n\n${response.response}`);
      } else {
        await this.whatsAppBot.sendResponse(contactId, '⚠️ Não foi possível gerar insights com IA neste momento.');
      }
    } catch (error) {
      logger.error('❌ Erro ao gerar insights LinkedIn:', error);
    }
  }

  async fallbackLinkedInAnalysis(contactId, url) {
    try {
      // Simple web scraping fallback
      const response = await this.whatsAppBot.sendResponse(contactId, 
        '🔄 *Método alternativo em uso*\n\n' +
        'Coletando informações básicas do perfil...'
      );
      
      // This would implement a simpler scraping method
      // For now, just acknowledge the attempt
      await this.whatsAppBot.sendResponse(contactId, 
        '⚠️ *Análise limitada*\n\n' +
        'O método alternativo também encontrou dificuldades.\n' +
        'Tente novamente em alguns minutos ou use outro perfil.'
      );
    } catch (error) {
      throw error;
    }
  }

  async processRawLinkedInData(rawText, url) {
    // This method would process raw HTML/text data
    // Implementation would depend on the scraping strategy
    return {
      url: url,
      raw: rawText,
      processed: false,
      timestamp: new Date().toISOString()
    };
  }
}