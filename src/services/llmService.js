import ollama from 'ollama';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, CHAT_MODES, PROMPTS } from '../config/index.js'; // Ajustar caminho se necessário
import { scrapeProfile } from './linkedinScraper.js';
import JobQueue from './jobQueue.js';

// ============ Serviço LLM ============
class LLMService {
  constructor() {
    this.contexts = new Map();
    this.queue = new JobQueue(CONFIG.queues.llmConcurrency);
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
        ollama.chat({
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

  async getAssistantResponseLinkedin(contactId, url) {
    try {
      const data = await scrapeProfile(url);
      const jsonText = JSON.stringify(data, null, 2);
      return await this.chat(contactId, jsonText, CHAT_MODES.LINKEDIN, PROMPTS.linkedin);
    } catch (err) {
      console.error('Erro ao raspar LinkedIn:', err);
      return 'Função em construção.';
    }
  }

  clearContext(contactId, type) {
    const key = `${contactId}_${type}`;
    this.contexts.delete(key);
  }
}

export default LLMService;
