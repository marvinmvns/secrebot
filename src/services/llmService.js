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
    
    // Configurações de timeout progressivo
    this.timeoutLevels = [
      300000,   // 30 segundos
      600000,   // 1 minuto
      18000000, // 30 minutos
      36000000  // 1 hora (limite máximo)
    ];
  }

  getContext(contactId, type) {
    const key = `${contactId}_${type}`;
    if (!this.contexts.has(key)) {
      this.contexts.set(key, []);
    }
    return this.contexts.get(key);
  }

  async chat(contactId, text, type, systemPrompt, maxRetries = this.timeoutLevels.length) {
    const context = this.getContext(contactId, type);
    context.push({ role: 'user', content: text });
    
    // Usa o método estático de Utils para limitar o contexto
    const limitedContext = Utils.limitContext([...context]); 
    const messages = [{ role: 'system', content: systemPrompt }, ...limitedContext];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const timeoutMs = this.timeoutLevels[attempt] || this.timeoutLevels[this.timeoutLevels.length - 1];
      const timeoutLabel = this.formatTimeout(timeoutMs);
      
      try {
        console.log(`🔄 LLM Tentativa ${attempt + 1}/${maxRetries} (timeout: ${timeoutLabel}) para ${contactId}`);
        
        const response = await this.queue.add(() => 
          this.chatWithTimeout({
            model: CONFIG.llm.model,
            messages
          }, timeoutMs)
        );
        
        // Usa o método estático de Utils para extrair JSON
        const content = type === CHAT_MODES.AGENDABOT 
          ? Utils.extractJSON(response.message.content)
          : response.message.content;
        
        context.push({ role: 'assistant', content });
        console.log(`✅ LLM resposta obtida em tentativa ${attempt + 1} para ${contactId}`);
        return content;
      } catch (err) {
        const isTimeout = err.code === 'UND_ERR_HEADERS_TIMEOUT' || err.name === 'TimeoutError' || err.message?.includes('timeout');
        
        console.error(`❌ LLM (${type}) - Tentativa ${attempt + 1}/${maxRetries} [${timeoutLabel}]:`, {
          error: err.message,
          code: err.code,
          isTimeout,
          contactId
        });
        
        if (attempt === maxRetries - 1) {
          // Remove the failed user message from context on final failure
          context.pop();
          console.error(`🚫 LLM falhou definitivamente após ${maxRetries} tentativas para ${contactId}`);
          throw new Error(`LLM falhou após ${maxRetries} tentativas. Último erro: ${err.message}`);
        }
        
        // Delay progressivo entre tentativas
        const delayMs = Math.min(2000 * Math.pow(1.5, attempt), 30000);
        console.log(`⏳ Aguardando ${this.formatTimeout(delayMs)} antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  async chatWithTimeout(requestParams, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`LLM timeout após ${this.formatTimeout(timeoutMs)}`));
      }, timeoutMs);
      
      this.ollama.chat(requestParams)
        .then(response => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  formatTimeout(ms) {
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.round(ms / 60000)}min`;
    } else {
      return `${Math.round(ms / 3600000)}h`;
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
