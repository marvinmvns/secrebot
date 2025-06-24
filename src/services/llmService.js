import { Ollama } from 'ollama';
import { MongoClient } from 'mongodb';
import Utils from '../utils/index.js';
import { CONFIG, CHAT_MODES, PROMPTS } from '../config/index.js';
import { fetchProfileRaw } from './linkedinScraper.js';
import JobQueue from './jobQueue.js';
import TextSummarizer from './video/TextSummarizer.js';

// ============ Serviço LLM ============
class LLMService {
  constructor() {
    this.contexts = new Map();
    this.ollama = new Ollama({ host: CONFIG.llm.host });
    this.queue = new JobQueue(
      CONFIG.queues.llmConcurrency,
      CONFIG.queues.memoryThresholdGB
    );

    this.mongoClient = null;
    this.db = null;
    this.collection = null;
    this.summarizer = new TextSummarizer({ defaultSentences: 5 });
  }

  async connect() {
    this.mongoClient = new MongoClient(CONFIG.mongo.uri);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(CONFIG.llm.dbName);
    const collName = CONFIG.llm.collectionName;
    const hasColl = await this.db.listCollections({ name: collName }).toArray();
    if (!hasColl.length) {
      await this.db.createCollection(collName);
    }
    this.collection = this.db.collection(collName);
    await this.collection.createIndex({ contactId: 1 });
    if (CONFIG.llm.ttlDays > 0) {
      await this.collection.createIndex(
        { timestamp: 1 },
        { expireAfterSeconds: CONFIG.llm.ttlDays * 24 * 60 * 60 }
      );
    }
  }

  async disconnect() {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.mongoClient = null;
    }
  }

  getContext(contactId, type) {
    const key = `${contactId}_${type}`;
    if (!this.contexts.has(key)) {
      this.contexts.set(key, []);
    }
    return this.contexts.get(key);
  }

  async loadDbContext(contactId) {
    if (!this.collection) return [];
    const docs = await this.collection
      .find({ contactId })
      .sort({ timestamp: 1 })
      .toArray();
    return docs.map((d) => ({ role: d.role, content: d.content }));
  }

  async saveMessage(contactId, role, content) {
    if (!this.collection) return;
    await this.collection.insertOne({
      contactId,
      role,
      content,
      timestamp: new Date()
    });
  }

  async summarizeAndReset(contactId, messages) {
    if (!this.collection || !messages.length) return;
    const text = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    try {
      const { text: summary } = await this.summarizer.summarize(text, 5);
      await this.collection.deleteMany({ contactId });
      await this.saveMessage(contactId, 'system', `Resumo da conversa: ${summary}`);
    } catch (err) {
      console.error('Erro ao resumir contexto:', err);
      await this.collection.deleteMany({ contactId });
    }
  }

  async chat(contactId, text, type, systemPrompt) {
    let context;
    if (type === CHAT_MODES.ASSISTANT) {
      context = await this.loadDbContext(contactId);
      const tokens = context.reduce((a, c) => a + Utils.countTokens(c.content || ''), 0);
      if (tokens + Utils.countTokens(text) > CONFIG.llm.maxTokens) {
        await this.summarizeAndReset(contactId, context);
        context = await this.loadDbContext(contactId);
      }
    } else {
      context = this.getContext(contactId, type);
    }

    context.push({ role: 'user', content: text });
    if (type === CHAT_MODES.ASSISTANT) {
      await this.saveMessage(contactId, 'user', text);
    }

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
      if (type === CHAT_MODES.ASSISTANT) {
        await this.saveMessage(contactId, 'assistant', content);
      }
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

  async getVideoSummary(contactId, text) {
    const date = Utils.getCurrentDateInGMTMinus3().toISOString();
    return this.chat(contactId, text, CHAT_MODES.ASSISTANT, PROMPTS.videoSummary(date));
  }

  async getAssistantResponseLinkedin(contactId, url, liAt) {
    try {
      const data = await fetchProfileRaw(url, {
        liAt,
        timeoutMs: CONFIG.linkedin.timeoutMs
      });
      const text = data.success ? data.rawText : data.error;
      return await this.chat(contactId, text, CHAT_MODES.LINKEDIN, PROMPTS.linkedin);
    } catch (err) {
      console.error('Erro ao raspar LinkedIn:', err);
      return 'Função em construção.';
    }
  }

  clearContext(contactId, type) {
    const key = `${contactId}_${type}`;
    this.contexts.delete(key);
    if (type === CHAT_MODES.ASSISTANT && this.collection) {
      this.collection.deleteMany({ contactId }).catch(() => {});
    }
  }
}

export default LLMService;
