import { OpenAI } from 'openai';
import logger from '../utils/logger.js';

/**
 * Cliente para integração com a API ChatGPT da OpenAI via streaming
 * Compatível com a interface dos clientes Ollama/RKLLama existentes
 */
export class ChatGPTAPIClient {
  constructor(baseURL, apiKey, options = {}) {
    this.baseURL = baseURL || 'https://api.openai.com';
    this.apiKey = apiKey;
    this.isHealthy = false;
    this.retryCount = 0;
    this.lastHealthCheck = null;
    this.lastError = null;
    this.useStreaming = options.useStreaming !== false; // Default true
    this.defaultModel = options.model || 'gpt-4';
    
    // Initialize OpenAI client (only if API key is provided)
    if (this.apiKey) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseURL.endsWith('/v1') ? this.baseURL : `${this.baseURL}/v1`
      });
    } else {
      this.client = null;
    }
    
    // Processing metrics for load balancing
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.requestHistory = [];
    this.averageResponseTime = 0;
    
    logger.debug(`🚀 ChatGPT client criado para: ${this.baseURL}`);
  }

  // Health check compatible with existing interface
  async getHealth() {
    try {
      if (!this.apiKey || !this.client) {
        throw new Error('API Key da OpenAI não configurada');
      }

      // Test with a simple models list request
      const models = await this.client.models.list();
      
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      this.lastError = null;
      this.retryCount = 0;
      
      return {
        status: 'ok',
        version: 'OpenAI API',
        models_available: models.data?.length || 0,
        currentModel: null // ChatGPT doesn't have a "current" model like Ollama
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastError = error.message;
      this.retryCount++;
      
      logger.warn(`⚠️ Health check falhou para ChatGPT ${this.baseURL}: ${error.message}`);
      throw error;
    }
  }

  // List available models
  async listModels() {
    try {
      const response = await this.client.models.list();
      
      // Filter to only chat-compatible OpenAI models for LLM use
      const chatModels = response.data.filter(model => 
        (model.id.includes('gpt') || 
         model.id.includes('o3') || 
         model.id.includes('o4')) &&
        !model.id.includes('whisper') && 
        !model.id.includes('tts') &&
        !model.id.includes('dall-e') &&
        !model.id.includes('instruct') && // Exclude instruct models as they're not chat models
        !model.id.includes('embedding') // Exclude embedding models
      );
      
      return {
        models: chatModels.map(model => ({
          name: model.id,
          size: null, // OpenAI doesn't provide size info
          format: 'openai',
          family: this.getModelFamily(model.id),
          parameter_size: null,
          quantization_level: null,
          modified_at: model.created ? new Date(model.created * 1000).toISOString() : null,
          capabilities: this.getModelCapabilities(model.id)
        }))
      };
    } catch (error) {
      logger.error(`❌ Erro ao listar modelos ChatGPT: ${error.message}`);
      throw error;
    }
  }

  // List running models (ChatGPT doesn't have this concept)
  async listRunningModels() {
    return { models: [] };
  }

  // Generate text with streaming support
  async generateText(messages, options = {}) {
    const startTime = Date.now();
    this.activeRequests++;
    this.totalRequests++;
    
    try {
      const useStreaming = options.stream !== undefined ? options.stream : this.useStreaming;
      const model = options.model || this.defaultModel;
      
      const requestOptions = {
        model: model,
        messages: messages,
        stream: useStreaming,
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 1.0,
        stop: options.stop || null
      };

      if (useStreaming) {
        const stream = await this.client.chat.completions.create(requestOptions);

        // Collect streaming response
        let fullResponse = '';
        const chunks = [];
        
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullResponse += delta.content;
            chunks.push({
              message: {
                role: 'assistant',
                content: delta.content
              },
              done: false
            });
          }
        }
        
        // Final chunk
        chunks.push({
          message: {
            role: 'assistant', 
            content: fullResponse
          },
          done: true
        });

        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime);
        
        return chunks;
      } else {
        // Non-streaming response
        const response = await this.client.chat.completions.create(requestOptions);
        
        const content = response.choices[0]?.message?.content || '';
        
        // Update metrics
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime);
        
        return [{
          message: {
            role: 'assistant',
            content: content
          },
          done: true
        }];
      }
    } catch (error) {
      logger.error(`❌ Erro na geração de texto ChatGPT: ${error.message}`);
      throw error;
    } finally {
      this.activeRequests--;
    }
  }

  // Generate simple text (non-streaming) for compatibility
  async generate(prompt, options = {}) {
    const messages = [{ role: 'user', content: prompt }];
    const chunks = await this.generateText(messages, options);
    
    // Return the final response with fallback
    if (!chunks || chunks.length === 0) {
      return {
        response: '',
        done: true,
        model: options.model || this.defaultModel
      };
    }
    
    const finalChunk = chunks[chunks.length - 1];
    return {
      response: finalChunk?.message?.content || '',
      done: true,
      model: options.model || this.defaultModel
    };
  }

  // Chat completion for compatibility
  async chat(messages, options = {}) {
    // Ensure messages is an array
    if (!Array.isArray(messages)) {
      logger.warn(`⚠️ ChatGPT: messages deve ser um array, recebido: ${typeof messages}`);
      // Try to convert options format from Ollama to OpenAI format
      if (typeof messages === 'object' && messages.messages) {
        messages = messages.messages;
      } else {
        throw new Error('ChatGPT API requires messages to be an array');
      }
    }
    
    const chunks = await this.generateText(messages, options);
    
    // Return Ollama-compatible format (get the final chunk)
    if (!chunks || chunks.length === 0) {
      return {
        message: {
          role: 'assistant',
          content: ''
        },
        done: true,
        model: options.model || this.defaultModel
      };
    }
    
    const finalChunk = chunks[chunks.length - 1];
    return {
      message: {
        role: 'assistant',
        content: finalChunk?.message?.content || ''
      },
      done: true,
      model: options.model || this.defaultModel
    };
  }

  // Chat with specific endpoint and model (compatibility with ollamaApiPool interface)
  async chatWithSpecificEndpointAndModel(endpointUrl, model, options = {}) {
    logger.info(`🎯 ChatGPT API: Chat direto com modelo ${model}`);
    
    // Extract messages from options (Ollama format compatibility)
    let messages = options.messages || [];
    
    // Ensure messages is an array
    if (!Array.isArray(messages)) {
      logger.warn(`⚠️ ChatGPT: messages deve ser um array, recebido: ${typeof messages}`);
      if (typeof messages === 'object' && messages.messages) {
        messages = messages.messages;
      } else {
        messages = [];
      }
    }
    
    // Override model in options
    const chatOptions = {
      ...options,
      model: model
    };
    
    const chunks = await this.generateText(messages, chatOptions);
    
    // Return Ollama-compatible format (get the final chunk)
    if (!chunks || chunks.length === 0) {
      return {
        message: {
          role: 'assistant',
          content: ''
        },
        done: true,
        model: model
      };
    }
    
    const finalChunk = chunks[chunks.length - 1];
    return {
      message: {
        role: 'assistant',
        content: finalChunk?.message?.content || ''
      },
      done: true,
      model: model
    };
  }

  // Queue estimation for load balancing
  async getQueueEstimate() {
    return {
      queueLength: this.activeRequests,
      averageProcessingTime: this.averageResponseTime,
      estimatedWaitTime: this.activeRequests * this.averageResponseTime
    };
  }

  // Processing status for monitoring
  getProcessingStatus() {
    return {
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      recentRequests: this.getRecentRequestCount(),
      averageResponseTime: this.averageResponseTime,
      requestHistory: this.requestHistory.slice(-10) // Last 10 requests
    };
  }

  // Load score for balancing (lower is better)
  getLoadScore() {
    const queueWeight = this.activeRequests * 2;
    const responseTimeWeight = Math.min(this.averageResponseTime / 1000, 10);
    return queueWeight + responseTimeWeight;
  }

  // Update performance metrics
  updateMetrics(responseTime) {
    this.requestHistory.push({
      timestamp: Date.now(),
      responseTime: responseTime
    });
    
    // Keep only last 50 requests
    if (this.requestHistory.length > 50) {
      this.requestHistory.shift();
    }
    
    // Calculate average response time
    if (this.requestHistory.length > 0) {
      const totalTime = this.requestHistory.reduce((sum, req) => sum + req.responseTime, 0);
      this.averageResponseTime = Math.round(totalTime / this.requestHistory.length);
    }
  }

  // Get recent request count (last 5 minutes)
  getRecentRequestCount() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.requestHistory.filter(req => req.timestamp > fiveMinutesAgo).length;
  }

  // Health check for monitoring
  async checkHealth() {
    return await this.getHealth();
  }

  // Disconnect (no action needed for HTTP client)
  async disconnect() {
    logger.debug(`🚀 ChatGPT client desconectado: ${this.baseURL}`);
  }

  // Get model family based on model name
  getModelFamily(modelId) {
    if (modelId.includes('o3') || modelId.includes('o4')) return 'o-series';
    if (modelId.includes('gpt-4.1')) return 'gpt-4.1';
    if (modelId.includes('gpt-4')) return 'gpt-4';
    if (modelId.includes('gpt-3.5')) return 'gpt-3.5';
    return 'gpt';
  }

  // Get model capabilities and recommended use cases
  getModelCapabilities(modelId) {
    const capabilities = {
      'o3': 'Best for long-term planning, hard tasks, and reasoning',
      'o4-mini': 'Best for low-latency reasoning tasks',
      'gpt-4.1': 'Best for agentic execution and complex workflows',
      'gpt-4.1-mini': 'Good balance of agentic capability and latency',
      'gpt-4.1-nano': 'Best for low-latency applications'
    };

    // Find matching capability by checking if model ID contains the key
    for (const [key, description] of Object.entries(capabilities)) {
      if (modelId.includes(key)) {
        return description;
      }
    }

    // Default capabilities for other GPT models
    if (modelId.includes('gpt-4')) return 'General purpose advanced reasoning';
    if (modelId.includes('gpt-3.5')) return 'Fast and efficient for most tasks';
    
    return 'General purpose language model';
  }
}

export default ChatGPTAPIClient;