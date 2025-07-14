import OllamaAPIClient from './ollamaApiClient.js';
import logger from '../utils/logger.js';
import { CONFIG, getDynamicConfig } from '../config/index.js';

class OllamaAPIPool {
  constructor(configService = null) {
    this.configService = configService;
    this.clients = [];
    this.currentIndex = 0;
    this.lastHealthCheck = 0;
    this.initialize();
  }

  async getEffectiveConfig() {
    let mongoConfig = null;
    if (this.configService) {
      try {
        mongoConfig = await this.configService.getConfig();
      } catch (error) {
        logger.warn('⚠️ Erro ao obter configuração do MongoDB para OllamaAPI, usando configuração padrão:', error.message);
      }
    }
    return getDynamicConfig(mongoConfig);
  }

  async initialize() {
    logger.info('🔧 Inicializando pool de APIs Ollama...');
    
    const effectiveConfig = await this.getEffectiveConfig();
    
    if (!effectiveConfig.ollamaApi.enabled || !effectiveConfig.ollamaApi.endpoints.length) {
      logger.warn('⚠️ OllamaAPI não habilitado ou sem endpoints configurados');
      return;
    }

    this.clients = effectiveConfig.ollamaApi.endpoints.map(endpoint => {
      const client = new OllamaAPIClient(endpoint.url);
      client.endpoint = endpoint;
      client.retryCount = 0;
      logger.info(`📡 Endpoint Ollama configurado: ${endpoint.url} (prioridade: ${endpoint.priority})`);
      return client;
    });

    this.clients.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
    
    logger.success(`✅ Pool Ollama inicializado com ${this.clients.length} endpoints`);
    this.startHealthCheckInterval();
  }

  startHealthCheckInterval() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, CONFIG.ollamaApi.loadBalancing.healthCheckInterval);
  }

  async performHealthChecks() {
    logger.debug('🔍 Executando health checks nos endpoints Ollama...');
    
    const healthPromises = this.clients.map(async (client) => {
      try {
        await client.checkHealth();
        client.retryCount = 0;
      } catch (error) {
        client.retryCount++;
        logger.warn(`⚠️ Health check falhou para ${client.baseURL} (tentativa ${client.retryCount})`);
      }
    });

    await Promise.allSettled(healthPromises);
  }

  getHealthyClients() {
    return this.clients.filter(client => 
      client.isHealthy && client.retryCount < client.endpoint.maxRetries
    );
  }

  selectClientByStrategy(healthyClients) {
    const strategy = CONFIG.ollamaApi.loadBalancing.strategy;
    
    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(healthyClients);
      
      case 'priority':
        return this.selectByPriority(healthyClients);
      
      case 'queue_length':
        return this.selectByLoad(healthyClients);
      
      default:
        logger.warn(`⚠️ Estratégia desconhecida: ${strategy}, usando priority`);
        return this.selectByPriority(healthyClients);
    }
  }

  selectRoundRobin(clients) {
    if (clients.length === 0) return null;
    
    const client = clients[this.currentIndex % clients.length];
    this.currentIndex = (this.currentIndex + 1) % clients.length;
    
    logger.debug(`🔄 Round-robin selecionou: ${client.baseURL}`);
    return client;
  }

  selectByPriority(clients) {
    if (clients.length === 0) return null;
    
    const client = clients[0];
    logger.debug(`⭐ Prioridade selecionou: ${client.baseURL} (prioridade: ${client.endpoint.priority})`);
    return client;
  }

  selectByLoad(clients) {
    if (clients.length === 0) return null;
    
    const client = clients.reduce((best, current) => {
      const bestScore = best.getLoadScore();
      const currentScore = current.getLoadScore();
      return currentScore < bestScore ? current : best;
    });

    logger.debug(`📊 Load balancing selecionou: ${client.baseURL} (score: ${client.getLoadScore()})`);
    return client;
  }

  async selectBestClient() {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.error('❌ Nenhum endpoint Ollama saudável disponível');
      throw new Error('No healthy Ollama API endpoints available');
    }

    // Update load information for all healthy clients
    await Promise.allSettled(
      healthyClients.map(client => client.listRunningModels().catch(() => {}))
    );

    return this.selectClientByStrategy(healthyClients);
  }

  // ============ Generate Methods ============
  async generateWithFallback(options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      throw new Error('No healthy Ollama API endpoints available');
    }

    let lastError;
    
    for (const client of healthyClients) {
      try {
        logger.info(`🎯 Tentando geração com ${client.baseURL}`);
        
        const result = await client.generate(options);
        
        logger.success(`✅ Geração bem-sucedida via ${client.baseURL}`);
        return result;
        
      } catch (error) {
        lastError = error;
        client.retryCount++;
        
        logger.warn(`⚠️ Falha na geração via ${client.baseURL}: ${error.message}`);
        
        if (client.retryCount >= client.endpoint.maxRetries) {
          client.isHealthy = false;
          logger.error(`❌ Endpoint ${client.baseURL} marcado como não saudável após ${client.retryCount} falhas`);
        }
        
        if (healthyClients.indexOf(client) < healthyClients.length - 1) {
          logger.info(`🔄 Tentando próximo endpoint em ${CONFIG.ollamaApi.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.ollamaApi.retryDelay));
        }
      }
    }
    
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  async generate(options = {}) {
    logger.service('🤖 Iniciando geração via Ollama API...');
    
    try {
      const client = await this.selectBestClient();
      
      logger.info(`🎯 Endpoint selecionado: ${client.baseURL} (${CONFIG.ollamaApi.loadBalancing.strategy})`);
      
      const result = await client.generate(options);
      
      logger.success(`✅ Geração via API concluída com sucesso`);
      return result;
      
    } catch (error) {
      logger.warn(`⚠️ Falha no endpoint principal, tentando fallback...`);
      
      return await this.generateWithFallback(options);
    }
  }

  // ============ Chat Methods ============
  async chatWithFallback(options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      throw new Error('No healthy Ollama API endpoints available');
    }

    let lastError;
    
    for (const client of healthyClients) {
      try {
        logger.info(`🎯 Tentando chat com ${client.baseURL}`);
        
        const result = await client.chat(options);
        
        logger.success(`✅ Chat bem-sucedido via ${client.baseURL}`);
        return result;
        
      } catch (error) {
        lastError = error;
        client.retryCount++;
        
        logger.warn(`⚠️ Falha no chat via ${client.baseURL}: ${error.message}`);
        
        if (client.retryCount >= client.endpoint.maxRetries) {
          client.isHealthy = false;
          logger.error(`❌ Endpoint ${client.baseURL} marcado como não saudável após ${client.retryCount} falhas`);
        }
        
        if (healthyClients.indexOf(client) < healthyClients.length - 1) {
          logger.info(`🔄 Tentando próximo endpoint em ${CONFIG.ollamaApi.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.ollamaApi.retryDelay));
        }
      }
    }
    
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  async chat(options = {}) {
    logger.service('💬 Iniciando chat via Ollama API...');
    
    try {
      const client = await this.selectBestClient();
      
      logger.info(`🎯 Endpoint selecionado: ${client.baseURL} (${CONFIG.ollamaApi.loadBalancing.strategy})`);
      
      const result = await client.chat(options);
      
      logger.success(`✅ Chat via API concluído com sucesso`);
      return result;
      
    } catch (error) {
      logger.warn(`⚠️ Falha no endpoint principal, tentando fallback...`);
      
      return await this.chatWithFallback(options);
    }
  }

  // ============ Model Management Methods ============
  async listModels() {
    try {
      const client = await this.selectBestClient();
      return await client.listModels();
    } catch (error) {
      return await this.executeWithFallback('listModels');
    }
  }

  async showModel(model, verbose = false) {
    try {
      const client = await this.selectBestClient();
      return await client.showModel(model, verbose);
    } catch (error) {
      return await this.executeWithFallback('showModel', model, verbose);
    }
  }

  async pullModel(model, stream = false) {
    try {
      const client = await this.selectBestClient();
      return await client.pullModel(model, stream);
    } catch (error) {
      return await this.executeWithFallback('pullModel', model, stream);
    }
  }

  async createModel(options = {}) {
    try {
      const client = await this.selectBestClient();
      return await client.createModel(options);
    } catch (error) {
      return await this.executeWithFallback('createModel', options);
    }
  }

  async deleteModel(model) {
    try {
      const client = await this.selectBestClient();
      return await client.deleteModel(model);
    } catch (error) {
      return await this.executeWithFallback('deleteModel', model);
    }
  }

  async copyModel(source, destination) {
    try {
      const client = await this.selectBestClient();
      return await client.copyModel(source, destination);
    } catch (error) {
      return await this.executeWithFallback('copyModel', source, destination);
    }
  }

  // ============ Other Methods ============
  async generateEmbeddings(model, input, options = {}) {
    try {
      const client = await this.selectBestClient();
      return await client.generateEmbeddings(model, input, options);
    } catch (error) {
      return await this.executeWithFallback('generateEmbeddings', model, input, options);
    }
  }

  async listRunningModels() {
    try {
      const client = await this.selectBestClient();
      return await client.listRunningModels();
    } catch (error) {
      return await this.executeWithFallback('listRunningModels');
    }
  }

  // ============ Generic Fallback Method ============
  async executeWithFallback(method, ...args) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      throw new Error('No healthy Ollama API endpoints available');
    }

    let lastError;
    
    for (const client of healthyClients) {
      try {
        return await client[method](...args);
      } catch (error) {
        lastError = error;
        client.retryCount++;
        
        if (client.retryCount >= client.endpoint.maxRetries) {
          client.isHealthy = false;
        }
      }
    }
    
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  // ============ Pool Status ============
  async getPoolStatus() {
    const status = {
      totalEndpoints: this.clients.length,
      healthyEndpoints: this.getHealthyClients().length,
      strategy: CONFIG.ollamaApi.loadBalancing.strategy,
      endpoints: []
    };

    for (const client of this.clients) {
      try {
        const health = await client.getHealth();
        const runningModels = await client.listRunningModels();
        
        status.endpoints.push({
          url: client.baseURL,
          healthy: client.isHealthy,
          priority: client.endpoint.priority,
          runningModels: runningModels.models?.length || 0,
          loadScore: client.getLoadScore(),
          retryCount: client.retryCount,
          lastHealthCheck: new Date(client.lastHealthCheck).toISOString(),
          version: health.version
        });
      } catch (error) {
        status.endpoints.push({
          url: client.baseURL,
          healthy: false,
          priority: client.endpoint.priority,
          error: error.message,
          retryCount: client.retryCount,
          lastHealthCheck: new Date(client.lastHealthCheck).toISOString()
        });
      }
    }

    return status;
  }

  async isEnabled() {
    const effectiveConfig = await this.getEffectiveConfig();
    return effectiveConfig.ollamaApi.enabled && this.clients.length > 0;
  }

  hasHealthyEndpoints() {
    return this.getHealthyClients().length > 0;
  }

  getMode() {
    return CONFIG.ollamaApi.mode;
  }
}

export default OllamaAPIPool;