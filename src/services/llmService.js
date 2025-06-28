import { Ollama } from 'ollama';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, CHAT_MODES, PROMPTS } from '../config/index.js'; // Ajustar caminho se necessário
import { fetchProfileStructured } from './linkedinScraper.js';
import JobQueue from './jobQueue.js';

// ============ Serviço LLM ============
class LLMService {
  constructor() {
    this.contexts = new Map();
    this.ollama = new Ollama({ host: CONFIG.llm.host });
    this.queue = new JobQueue(
      CONFIG.queues.llmConcurrency,
      CONFIG.queues.memoryThresholdGB
    );
  }

  getContext(contactId, type) {
    const key = `${contactId}_${type}`;
    if (!this.contexts.has(key)) {
      this.contexts.set(key, []);
    }
    return this.contexts.get(key);
  }

  async chat(contactId, text, type, systemPrompt) {
    const context = this.getContext(contactId, type);
    context.push({ role: 'user', content: text });
    
    // Usa o método estático de Utils para limitar o contexto
    const limitedContext = Utils.limitContext([...context]); 
    const messages = [{ role: 'system', content: systemPrompt }, ...limitedContext];
    
    try {
      const response = await this.queue.add(() =>
        this.ollama.chat({
          model: CONFIG.llm.model,
          messages
        })
      );
      
      // Usa o método estático de Utils para extrair JSON
      const content = type === CHAT_MODES.AGENDABOT 
        ? Utils.extractJSON(response.message.content)
        : response.message.content;
      
      context.push({ role: 'assistant', content });
      return content;
    } catch (err) {
      console.error(`Erro no LLM (${type}):`, err);
      throw err;
    }
  }

  async getChatGPTResponse(contactId, text) {
    // Usa o método estático de Utils para obter a data
    const date = Utils.getCurrentDateInGMTMinus3().toISOString();
    return this.chat(contactId, text, CHAT_MODES.AGENDABOT, PROMPTS.agenda(date));
  }

  async getAssistantResponse(contactId, text) {
    // Usa o método estático de Utils para obter a data
    const date = Utils.getCurrentDateInGMTMinus3().toISOString();
    return this.chat(contactId, text, CHAT_MODES.ASSISTANT, PROMPTS.assistant(date));
  }

  async getAssistantResponseLinkedin(contactId, url, liAt) {
    try {
      const data = await fetchProfileStructured(url, {
        liAt,
        timeoutMs: CONFIG.linkedin.timeoutMs,
        retries: 3
      });
      
      if (!data.success) {
        return `❌ Erro ao analisar perfil: ${data.error}`;
      }

      const profileData = data.data;
      const quality = data.dataQuality;

      const structuredText = this.formatProfileForLLM(profileData, quality);
      
      const enhancedPrompt = `${PROMPTS.linkedin}

QUALIDADE DOS DADOS: ${quality.quality} (${quality.percentage}%)
TENTATIVAS: ${data.attempt || 1}

Analise o perfil abaixo e forneça um resumo profissional detalhado e insights relevantes:

${structuredText}`;

      return await this.chat(contactId, enhancedPrompt, CHAT_MODES.LINKEDIN, PROMPTS.linkedin);
    } catch (err) {
      console.error('Erro ao raspar LinkedIn:', err);
      return '❌ Erro interno ao processar perfil LinkedIn.';
    }
  }

  formatProfileForLLM(profileData, quality) {
    let formatted = '';
    
    if (profileData.name) {
      formatted += `**NOME:** ${profileData.name}\n`;
    }
    
    if (profileData.headline) {
      formatted += `**TÍTULO:** ${profileData.headline}\n`;
    }
    
    if (profileData.location) {
      formatted += `**LOCALIZAÇÃO:** ${profileData.location}\n`;
    }
    
    if (profileData.connections) {
      formatted += `**CONEXÕES:** ${profileData.connections}\n`;
    }
    
    if (profileData.about && profileData.about.length > 0) {
      formatted += `\n**SOBRE:**\n${profileData.about}\n`;
    }
    
    if (profileData.experience && profileData.experience.length > 0) {
      formatted += `\n**EXPERIÊNCIA PROFISSIONAL:**\n`;
      profileData.experience.forEach((exp, index) => {
        formatted += `${index + 1}. ${exp.title || 'Cargo não especificado'}\n`;
        formatted += `   Empresa: ${exp.company || 'Empresa não especificada'}\n`;
        formatted += `   Período: ${exp.duration || 'Período não especificado'}\n\n`;
      });
    }
    
    if (profileData.education && profileData.education.length > 0) {
      formatted += `**EDUCAÇÃO:**\n`;
      profileData.education.forEach((edu, index) => {
        formatted += `${index + 1}. ${edu.degree || 'Curso não especificado'}\n`;
        formatted += `   Instituição: ${edu.school || 'Instituição não especificada'}\n`;
        formatted += `   Período: ${edu.years || 'Período não especificado'}\n\n`;
      });
    }
    
    if (profileData.skills && profileData.skills.length > 0) {
      formatted += `**PRINCIPAIS HABILIDADES:**\n`;
      formatted += profileData.skills.slice(0, 15).join(' • ') + '\n';
    }
    
    formatted += `\n**QUALIDADE DOS DADOS EXTRAÍDOS:** ${quality.percentage}% (${quality.score}/${quality.maxScore} campos preenchidos)`;
    
    return formatted;
  }

  clearContext(contactId, type) {
    const key = `${contactId}_${type}`;
    this.contexts.delete(key);
  }
}

export default LLMService;
