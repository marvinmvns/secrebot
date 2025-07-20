import axios from 'axios';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class OllamaAPIClient {
  constructor(baseURL = 'http://localhost:11434') {
    // Validate and clean baseURL
    if (!baseURL || typeof baseURL !== 'string') {
      throw new Error(`Invalid baseURL provided: ${baseURL}`);
    }
    
    // Ensure URL has protocol
    if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
      baseURL = `http://${baseURL}`;
    }
    
    // Validate URL format
    try {
      new URL(baseURL);
    } catch (error) {
      throw new Error(`Invalid URL format: ${baseURL} - ${error.message}`);
    }
    
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
    // Request tracking for processing status
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.requestHistory = [];
  }

  // ============ Request Tracking ============
  _startRequest(type = 'unknown') {
    this.activeRequests++;
    this.totalRequests++;
    const requestId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.requestHistory.unshift({
      id: requestId,
      type,
      startTime: Date.now(),
      endTime: null,
      duration: null
    });
    // Keep only last 10 requests in history
    if (this.requestHistory.length > 10) {
      this.requestHistory = this.requestHistory.slice(0, 10);
    }
    return requestId;
  }

  _endRequest(requestId) {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    const request = this.requestHistory.find(r => r.id === requestId);
    if (request) {
      request.endTime = Date.now();
      request.duration = request.endTime - request.startTime;
    }
  }

  // ============ Generate Completion ============
  async generate(options = {}) {
    const requestId = this._startRequest('generate');
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
    } finally {
      this._endRequest(requestId);
    }
  }

  // ============ Generate Chat Completion ============
  async chat(options = {}) {
    const requestId = this._startRequest('chat');
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
    } finally {
      this._endRequest(requestId);
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
      logger.debug(`🔍 Executando health check para ${this.baseURL}`);
      
      // Ollama doesn't have a dedicated health endpoint, so we use /api/version
      const response = await this.axios.get('/api/version', { timeout: 5000 });
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      logger.debug(`✅ Health check bem-sucedido para ${this.baseURL}`);
      
      // Also get running models for load estimation
      try {
        await this.listRunningModels();
      } catch (error) {
        logger.warn(`⚠️ Falha ao obter modelos em execução para ${this.baseURL}: ${error.message}`);
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
      
      // More detailed error logging
      const errorDetails = {
        message: error.message,
        code: error.code,
        response: error.response?.status,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          timeout: error.config?.timeout
        }
      };
      
      logger.warn(`⚠️ Health check falhou para ${this.baseURL}:`, errorDetails);
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
    // Calcula score baseado em múltiplos fatores:
    // - Requisições ativas (peso 2x)
    // - Modelos em execução (peso 1x)
    // - Tempo médio de resposta (normalizado por 1000ms)
    const processingStatus = this.getProcessingStatus();
    const activeRequestsScore = this.activeRequests * 2;
    const runningModelsScore = this.runningModels.length;
    const avgTimeScore = processingStatus.averageResponseTime / 1000;
    
    this.loadScore = activeRequestsScore + runningModelsScore + avgTimeScore;
    return this.loadScore;
  }

  // ============ Processing Status ============
  getProcessingStatus() {
    const recentRequests = this.requestHistory.filter(r => 
      r.endTime && (Date.now() - r.endTime) < 300000 // Last 5 minutes
    );
    
    const avgDuration = recentRequests.length > 0 
      ? recentRequests.reduce((sum, req) => sum + (req.duration || 0), 0) / recentRequests.length 
      : 0;

    return {
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      recentRequests: recentRequests.length,
      averageResponseTime: Math.round(avgDuration),
      requestHistory: this.requestHistory.map(r => ({
        type: r.type,
        startTime: new Date(r.startTime).toISOString(),
        endTime: r.endTime ? new Date(r.endTime).toISOString() : null,
        duration: r.duration,
        active: !r.endTime
      }))
    };
  }

  // ============ Streaming Support ============
  async generateStream(options = {}) {
    const requestId = this._startRequest('generateStream');
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
    } finally {
      this._endRequest(requestId);
    }
  }

  async chatStream(options = {}) {
    const requestId = this._startRequest('chatStream');
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
    } finally {
      this._endRequest(requestId);
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

  // ============ Preload Model ============
  async preloadModel(modelName) {
    try {
      logger.debug(`🔄 Pré-carregando modelo ${modelName} via API: ${this.baseURL}`);
      
      // Make a minimal generate request to load the model into memory
      const requestData = {
        model: modelName,
        prompt: 'test',
        stream: false,
        options: {
          num_predict: 1
        }
      };

      await this.axios.post('/api/generate', requestData);
      logger.success(`✅ Modelo ${modelName} pré-carregado com sucesso para ${this.baseURL}`);
      return true;
    } catch (error) {
      logger.error(`❌ Falha no pré-carregamento do modelo ${modelName} via ${this.baseURL}:`, error.message);
      throw new Error(`Preload model failed: ${error.response?.data?.error || error.message}`);
    }
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