import axios from 'axios';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class RKLlamaAPIClient {
  constructor(baseURL = 'http://localhost:8080') {
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
    this.currentModel = null;
    this.type = 'rkllama';
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

  // ============ RKLLama Specific Methods ============

  // GET /models - List available models
  async listModels() {
    try {
      const response = await this.axios.get('/models');
      return {
        models: response.data.models || []
      };
    } catch (error) {
      throw new Error(`List models failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // POST /load_model - Load a specific model
  async loadModel(modelName) {
    try {
      logger.debug(`🔄 Carregando modelo ${modelName} via RKLLama: ${this.baseURL}`);
      
      const response = await this.axios.post('/load_model', {
        model_name: modelName
      });
      
      this.currentModel = modelName;
      logger.debug(`✅ Modelo ${modelName} carregado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha ao carregar modelo via ${this.baseURL}:`, error.message);
      throw new Error(`Load model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // POST /unload_model - Unload current model
  async unloadModel() {
    try {
      logger.debug(`🔄 Descarregando modelo via RKLLama: ${this.baseURL}`);
      
      const response = await this.axios.post('/unload_model');
      this.currentModel = null;
      
      logger.debug(`✅ Modelo descarregado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha ao descarregar modelo via ${this.baseURL}:`, error.message);
      throw new Error(`Unload model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // GET /current_model - Get current loaded model
  async getCurrentModel() {
    try {
      const response = await this.axios.get('/current_model');
      this.currentModel = response.data.model_name;
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        this.currentModel = null;
        return { model_name: null };
      }
      throw new Error(`Get current model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // POST /generate - Generate response
  async generate(options = {}) {
    const requestId = this._startRequest('generate');
    try {
      logger.debug(`🔄 Gerando completion via RKLLama: ${this.baseURL}`);
      
      // For RKLLama, we need to check if we have a model loaded
      if (!this.currentModel) {
        const currentModelInfo = await this.getCurrentModel();
        if (!currentModelInfo.model_name) {
          throw new Error('No model is currently loaded. Please load a model first.');
        }
        this.currentModel = currentModelInfo.model_name;
      }

      // Convert messages to prompt for RKLLama API (it expects model + prompt format)
      let prompt;
      if (options.messages && Array.isArray(options.messages)) {
        // Convert messages array to a single prompt string
        prompt = options.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      } else {
        prompt = options.prompt || options.messages || '';
      }

      const requestData = {
        model: this.currentModel,
        prompt: prompt,
        stream: options.stream || false
      };

      const response = await this.axios.post('/api/generate', requestData);
      logger.debug(`✅ Completion gerada com sucesso para ${this.baseURL}`);
      
      // Transform RKLLama response to Ollama-like format for compatibility
      const rkResponse = response.data;
      
      // RKLLama returns response in 'response' field directly
      return {
        model: rkResponse.model || this.currentModel,
        created_at: rkResponse.created_at || new Date().toISOString(),
        response: rkResponse.response || '',
        done: rkResponse.done || true,
        context: [],
        total_duration: rkResponse.total_duration || 0,
        load_duration: rkResponse.load_duration || 0,
        prompt_eval_count: rkResponse.prompt_eval_count || 0,
        prompt_eval_duration: rkResponse.prompt_eval_duration || 0,
        eval_count: rkResponse.eval_count || 0,
        eval_duration: rkResponse.eval_duration || 0
      };
    } catch (error) {
      logger.error(`❌ Falha na geração via ${this.baseURL}:`, error.message);
      throw new Error(`Generation failed: ${error.response?.data?.error || error.message}`);
    } finally {
      this._endRequest(requestId);
    }
  }

  // POST /generate for chat - Convert chat to RKLLama format
  async chat(options = {}) {
    const requestId = this._startRequest('chat');
    try {
      logger.debug(`🔄 Gerando chat completion via RKLLama: ${this.baseURL}`);
      
      // Ensure we have a current model
      if (!this.currentModel) {
        const currentModelInfo = await this.getCurrentModel();
        if (!currentModelInfo.model_name) {
          throw new Error('No model is currently loaded. Please load a model first.');
        }
        this.currentModel = currentModelInfo.model_name;
      }
      
      // Convert Ollama chat format to RKLLama prompt format
      let prompt;
      if (options.messages && Array.isArray(options.messages)) {
        // Convert messages array to a single prompt string
        prompt = options.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      } else {
        // If it's a simple prompt
        prompt = options.prompt || '';
      }

      const requestData = {
        model: this.currentModel,
        prompt: prompt,
        stream: options.stream || false
      };

      const response = await this.axios.post('/api/generate', requestData);
      logger.debug(`✅ Chat completion gerada com sucesso para ${this.baseURL}`);
      
      // Transform to Ollama chat response format
      const rkResponse = response.data;
      const content = rkResponse.response || '';
      
      return {
        model: rkResponse.model || this.currentModel,
        created_at: rkResponse.created_at || new Date().toISOString(),
        message: {
          role: 'assistant',
          content: content
        },
        done_reason: rkResponse.done_reason || 'stop',
        done: rkResponse.done || true,
        total_duration: rkResponse.total_duration || 0,
        load_duration: rkResponse.load_duration || 0,
        prompt_eval_count: rkResponse.prompt_eval_count || 0,
        prompt_eval_duration: rkResponse.prompt_eval_duration || 0,
        eval_count: rkResponse.eval_count || 0,
        eval_duration: rkResponse.eval_duration || 0
      };
    } catch (error) {
      logger.error(`❌ Falha no chat via ${this.baseURL}:`, error.message);
      throw new Error(`Chat failed: ${error.response?.data?.error || error.message}`);
    } finally {
      this._endRequest(requestId);
    }
  }

  // POST /pull - Download model from HuggingFace
  async pullModel(model, stream = false) {
    try {
      logger.debug(`🔄 Fazendo pull do modelo ${model} via RKLLama: ${this.baseURL}`);
      
      const response = await this.axios.post('/pull', {
        model: model
      });
      
      logger.debug(`✅ Pull do modelo ${model} realizado com sucesso para ${this.baseURL}`);
      return response.data;
    } catch (error) {
      logger.error(`❌ Falha no pull do modelo via ${this.baseURL}:`, error.message);
      throw new Error(`Pull model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // POST /rm - Delete model
  async deleteModel(model) {
    try {
      const response = await this.axios.post('/rm', {
        model: model
      });
      return response.data;
    } catch (error) {
      throw new Error(`Delete model failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // ============ Compatibility Methods (Not supported by RKLLama) ============
  
  async showModel(model, verbose = false) {
    // RKLLama doesn't have this endpoint, return basic info
    return {
      license: 'N/A',
      modelfile: 'N/A',
      parameters: 'N/A',
      template: 'N/A',
      details: {
        format: 'rkllm',
        family: 'RKLLama',
        parameter_size: 'Unknown'
      }
    };
  }

  async createModel(options = {}) {
    throw new Error('Create model is not supported by RKLLama API');
  }

  async copyModel(source, destination) {
    throw new Error('Copy model is not supported by RKLLama API');
  }

  async pushModel(model, stream = false) {
    throw new Error('Push model is not supported by RKLLama API');
  }

  async generateEmbeddings(model, input, options = {}) {
    throw new Error('Generate embeddings is not supported by RKLLama API');
  }

  async blobExists(digest) {
    throw new Error('Blob operations are not supported by RKLLama API');
  }

  async pushBlob(digest, blob) {
    throw new Error('Blob operations are not supported by RKLLama API');
  }

  // ============ Health Check ============
  async getHealth() {
    try {
      // Use RKLLama root endpoint for health check
      const response = await this.axios.get('/', { timeout: 5000 });
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      // Try to get current model for load estimation (silently fail if no model loaded)
      try {
        const currentModelInfo = await this.getCurrentModel();
        this.currentModel = currentModelInfo.model_name;
        this.loadScore = this.currentModel ? 1 : 0;
      } catch (error) {
        // This is expected when no model is loaded, not an error
        this.currentModel = null;
        this.loadScore = 0;
        logger.debug(`🔍 Nenhum modelo carregado no RKLLama: ${this.baseURL}`);
      }
      
      return {
        status: 'healthy',
        version: 'RKLLama',
        type: 'rkllama',
        currentModel: this.currentModel,
        loadScore: this.loadScore,
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
  async listRunningModels() {
    try {
      const currentModel = await this.getCurrentModel();
      const running = currentModel.model_name ? [{ 
        name: currentModel.model_name,
        model: currentModel.model_name,
        size: 0,
        digest: '',
        details: {
          format: 'rkllm',
          family: 'RKLLama',
          parameter_size: 'Unknown'
        }
      }] : [];
      
      this.runningModels = running;
      this.loadScore = running.length;
      return { models: running };
    } catch (error) {
      // If getCurrentModel fails, assume no model is loaded
      this.runningModels = [];
      this.loadScore = 0;
      logger.debug(`🔍 Nenhum modelo em execução no RKLLama: ${this.baseURL}`);
      return { models: [] };
    }
  }

  getRunningModelsCount() {
    return this.runningModels.length;
  }

  getLoadScore() {
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

  // ============ Streaming Support (Limited) ============
  async generateStream(options = {}) {
    // RKLLama supports streaming but we'll use the regular generate for now
    return await this.generate({ ...options, stream: true });
  }

  async chatStream(options = {}) {
    // RKLLama supports streaming but we'll use the regular chat for now
    return await this.chat({ ...options, stream: true });
  }

  // ============ Convenience Methods ============
  async isModelAvailable(modelName) {
    try {
      const models = await this.listModels();
      return models.models?.includes(modelName) || false;
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

  async ensureModelLoaded(modelName) {
    // First ensure it's available
    await this.ensureModelAvailable(modelName);
    
    // Then ensure it's loaded
    const currentModel = await this.getCurrentModel();
    if (currentModel.model_name !== modelName) {
      // Unload current model if any
      if (currentModel.model_name) {
        await this.unloadModel();
      }
      // Load the requested model
      await this.loadModel(modelName);
    }
    return true;
  }

  // ============ Utility Methods ============
  getBaseURL() {
    return this.baseURL;
  }

  getType() {
    return this.type;
  }

  setTimeout(timeout) {
    this.axios.defaults.timeout = timeout;
  }

  setHeaders(headers) {
    Object.assign(this.axios.defaults.headers, headers);
  }
}

export default RKLlamaAPIClient;