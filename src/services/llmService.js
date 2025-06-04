import ollama from 'ollama';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, CHAT_MODES, PROMPTS } from '../config/index.js'; // Ajustar caminho se necessário

// ============ Serviço LLM ============
class LLMService {
  constructor() {
    this.contexts = new Map();
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
      const response = await ollama.chat({ 
        model: CONFIG.llm.model, 
        messages 
      });
      
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

  async getAssistantResponseLinkedin(contactId, text) {
    // Simulação, idealmente buscaria dados reais do LinkedIn
    const linkedinJson = { profileData: text }; // Exemplo, usar dados reais
    const jsonText = JSON.stringify(linkedinJson, null, 2);
    return this.chat(contactId, jsonText, CHAT_MODES.LINKEDIN, PROMPTS.linkedin);
  }

  clearContext(contactId, type) {
    const key = `${contactId}_${type}`;
    this.contexts.delete(key);
  }
}

export default LLMService;
