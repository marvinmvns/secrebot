import axios from 'axios';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class OllamaAPIClient {
  constructor(baseURL = 'http://localhost:11434') {
    this.baseURL = baseURL;
    this.axios = axios.create({ 
      baseURL: baseURL,
      timeout: CONFIG.ollamaApi.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.lastHealthCheck = 0;
    this.isHealthy = true;
    this.loadScore = 0;
    this.runningModels = [];
  }

  // ============ Generate Completion ============
  async generate(options = {}) {
    try {
      logger.debug(`🔄 Gerando completion via API: ${this.baseURL}`);
      
      const requestData = {
        model: options.model || CONFIG.llm.model,
        prompt: options.prompt || '',
        stream: options.stream || false,
        ...options
      };

      const response = await this.axios.post('/api/generate', requestData);
      logger.debug(`✅ Completion gerada com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha na geração via ${this.baseURL}:`, error.message);
      throw new Error(`Generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Generate Chat Completion ============
  async chat(options = {}) {
    try {
      logger.debug(`🔄 Gerando chat completion via API: ${this.baseURL}`);
      
      const requestData = {
        model: options.model || CONFIG.llm.model,
        messages: options.messages || [],
        stream: options.stream || false,
        ...options
      };

      const response = await this.axios.post('/api/chat', requestData);
      logger.debug(`✅ Chat completion gerada com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha no chat via ${this.baseURL}:`, error.message);
      throw new Error(`Chat failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ List Local Models ============
  async listModels() {
    try {
      const response = await this.axios.get('/api/tags');
      return response.data;
    } catch (error) {
      throw new Error(`List models failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Show Model Information ============
  async showModel(model, verbose = false) {
    try {
      const response = await this.axios.post('/api/show', {
        model,
        verbose
      });
      return response.data;
    } catch (error) {
      throw new Error(`Show model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Create Model ============
  async createModel(options = {}) {
    try {
      logger.debug(`🔄 Criando modelo via API: ${this.baseURL}`);
      
      const requestData = {
        model: options.model,
        from: options.from,
        stream: options.stream || false,
        ...options
      };

      const response = await this.axios.post('/api/create', requestData);
      logger.debug(`✅ Modelo criado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha na criação de modelo via ${this.baseURL}:`, error.message);
      throw new Error(`Create model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Copy Model ============
  async copyModel(source, destination) {
    try {
      const response = await this.axios.post('/api/copy', {
        source,
        destination
      });
      return response.data;
    } catch (error) {
      throw new Error(`Copy model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Delete Model ============
  async deleteModel(model) {
    try {
      const response = await this.axios.delete('/api/delete', {
        data: { model }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Delete model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Pull Model ============
  async pullModel(model, stream = false) {
    try {
      logger.debug(`🔄 Fazendo pull do modelo ${model} via API: ${this.baseURL}`);
      
      const response = await this.axios.post('/api/pull', {
        model,
        stream
      });
      
      logger.debug(`✅ Pull do modelo ${model} realizado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha no pull do modelo via ${this.baseURL}:`, error.message);
      throw new Error(`Pull model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Push Model ============
  async pushModel(model, stream = false) {
    try {
      const response = await this.axios.post('/api/push', {
        model,
        stream
      });
      return response.data;
    } catch (error) {
      throw new Error(`Push model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Generate Embeddings ============
  async generateEmbeddings(model, input, options = {}) {
    try {
      logger.debug(`🔄 Gerando embeddings via API: ${this.baseURL}`);
      
      const requestData = {
        model,
        input,
        ...options
      };

      const response = await this.axios.post('/api/embed', requestData);
      logger.debug(`✅ Embeddings geradas com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha na geração de embeddings via ${this.baseURL}:`, error.message);
      throw new Error(`Generate embeddings failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ List Running Models ============
  async listRunningModels() {
    try {
      const response = await this.axios.get('/api/ps');
      this.runningModels = response.data.models || [];
      this.loadScore = this.runningModels.length;
      return response.data;
    } catch (error) {
      throw new Error(`List running models failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Get Version ============
  async getVersion() {
    try {
      const response = await this.axios.get('/api/version');
      return response.data;
    } catch (error) {
      throw new Error(`Get version failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Check if Blob Exists ============
  async blobExists(digest) {
    try {
      const response = await this.axios.head(`/api/blobs/${digest}`);
      return response.status === 200;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw new Error(`Blob check failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Push Blob ============
  async pushBlob(digest, blob) {
    try {
      const response = await this.axios.post(`/api/blobs/${digest}`, blob, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Push blob failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Health Check ============
  async getHealth() {
    try {
      // Ollama doesn't have a dedicated health endpoint, so we use /api/version
      const response = await this.axios.get('/api/version', { timeout: 5000 });
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      // Also get running models for load estimation
      try {
        await this.listRunningModels();
      } catch (error) {
        logger.warn(`⚠️ Falha ao obter modelos em execução para ${this.baseURL}`);
      }
      
      return {
        status: 'healthy',
        version: response.data.version,
        runningModels: this.runningModels.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      logger.warn(`⚠️ Health check falhou para ${this.baseURL}: ${error.message}`);
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async checkHealth() {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastHealthCheck;
    
    if (timeSinceLastCheck > CONFIG.ollamaApi.loadBalancing.healthCheckInterval) {
      try {
        await this.getHealth();
      } catch (error) {
        logger.warn(`⚠️ Health check automático falhou para ${this.baseURL}`);
      }
    }
    
    return this.isHealthy;
  }

  // ============ Load Balancing Helpers ============
  getRunningModelsCount() {
    return this.runningModels.length;
  }

  getLoadScore() {
    return this.loadScore;
  }

  // ============ Streaming Support ============
  async generateStream(options = {}) {
    try {
      logger.debug(`🔄 Gerando completion com stream via API: ${this.baseURL}`);
      
      const requestData = {
        model: options.model || CONFIG.llm.model,
        prompt: options.prompt || '',
        stream: true,
        ...options
      };

      const response = await this.axios.post('/api/generate', requestData, {
        responseType: 'stream'
      });
      
      logger.debug(`✅ Stream iniciado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha no stream via ${this.baseURL}:`, error.message);
      throw new Error(`Stream generation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async chatStream(options = {}) {
    try {
      logger.debug(`🔄 Gerando chat com stream via API: ${this.baseURL}`);
      
      const requestData = {
        model: options.model || CONFIG.llm.model,
        messages: options.messages || [],
        stream: true,
        ...options
      };

      const response = await this.axios.post('/api/chat', requestData, {
        responseType: 'stream'
      });
      
      logger.debug(`✅ Chat stream iniciado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha no chat stream via ${this.baseURL}:`, error.message);
      throw new Error(`Chat stream failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Convenience Methods ============
  async isModelAvailable(modelName) {
    try {
      const models = await this.listModels();
      return models.models?.some(model => model.name === modelName || model.model === modelName);
    } catch (error) {
      logger.warn(`⚠️ Erro ao verificar disponibilidade do modelo ${modelName}: ${error.message}`);
      return false;
    }
  }

  async ensureModelAvailable(modelName) {
    const isAvailable = await this.isModelAvailable(modelName);
    if (!isAvailable) {
      logger.info(`📥 Modelo ${modelName} não encontrado, fazendo pull...`);
      await this.pullModel(modelName);
      logger.success(`✅ Modelo ${modelName} baixado com sucesso`);
    }
    return true;
  }

  // ============ Utility Methods ============
  getBaseURL() {
    return this.baseURL;
  }

  setTimeout(timeout) {
    this.axios.defaults.timeout = timeout;
  }

  setHeaders(headers) {
    Object.assign(this.axios.defaults.headers, headers);
  }
}

export default OllamaAPIClient;