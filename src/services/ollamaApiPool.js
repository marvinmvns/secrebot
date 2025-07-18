import OllamaAPIClient from './ollamaApiClient.js';
import RKLlamaAPIClient from './rkllamaApiClient.js';
import logger from '../utils/logger.js';
import { CONFIG, getDynamicConfig } from '../config/index.js';

class OllamaAPIPool {
  constructor(configService = null) {
    this.configService = configService;
    this.clients = [];
    this.currentIndex = 0;
    this.lastHealthCheck = 0;
    this.healthCheckInterval = null;
    this.requestCount = 0; // Para tracking de balanceamento
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

  // Helper function to detect RKLLama endpoints (by configured type)
  isRKLlamaEndpoint(endpoint) {
    // Check configured type first, fallback to port detection for backward compatibility
    if (endpoint.type) {
      return endpoint.type === 'rkllama';
    }
    
    // Fallback: detect by port for existing configurations
    try {
      const parsedUrl = new URL(endpoint.url || endpoint);
      return parsedUrl.port === '8080';
    } catch (error) {
      logger.warn(`⚠️ URL inválida para detecção RKLLama: ${endpoint.url || endpoint}`);
      return false;
    }
  }

  // Create appropriate client based on endpoint type
  createClient(endpoint) {
    const isRKLlama = this.isRKLlamaEndpoint(endpoint);
    
    if (isRKLlama) {
      logger.info(`🤖 Criando cliente RKLLama para: ${endpoint.url}`);
      return new RKLlamaAPIClient(endpoint.url);
    } else {
      logger.info(`🧠 Criando cliente Ollama para: ${endpoint.url}`);
      return new OllamaAPIClient(endpoint.url);
    }
  }

  async initialize() {
    logger.info('🔧 Inicializando pool de APIs Ollama...');
    
    // Stop existing health check interval if running
    this.stopHealthCheckInterval();
    
    const effectiveConfig = await this.getEffectiveConfig();
    
    if (!effectiveConfig.ollamaApi.enabled || !effectiveConfig.ollamaApi.endpoints.length) {
      logger.warn('⚠️ OllamaAPI não habilitado ou sem endpoints configurados');
      this.clients = [];
      return;
    }

    this.clients = effectiveConfig.ollamaApi.endpoints
      .filter(endpoint => endpoint.enabled)
      .map(endpoint => {
        const client = this.createClient(endpoint);
        client.endpoint = endpoint;
        client.retryCount = 0;
        
        const clientType = this.isRKLlamaEndpoint(endpoint) ? 'RKLLama' : 'Ollama';
        logger.info(`📡 Endpoint ${clientType} configurado: ${endpoint.url} (prioridade: ${endpoint.priority})`);
        return client;
      });

    this.clients.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
    
    if (this.clients.length > 0) {
      logger.success(`✅ Pool Ollama inicializado com ${this.clients.length} endpoints`);
      this.startHealthCheckInterval();
    } else {
      logger.warn('⚠️ Nenhum endpoint Ollama habilitado encontrado');
    }
  }

  startHealthCheckInterval() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, CONFIG.ollamaApi.loadBalancing.healthCheckInterval);
  }

  stopHealthCheckInterval() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.debug('🛑 Health check interval Ollama parado');
    }
  }

  async performHealthChecks() {
    // Check if the service is still enabled
    const isServiceEnabled = await this.isEnabled();
    if (!isServiceEnabled) {
      logger.debug('🛑 OllamaAPI desabilitado, parando health checks');
      this.stopHealthCheckInterval();
      return;
    }

    if (this.clients.length === 0) {
      logger.debug('🛑 Nenhum cliente Ollama disponível para health check');
      return;
    }

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

  async selectClientByStrategy(healthyClients) {
    const effectiveConfig = await this.getEffectiveConfig();
    const strategy = effectiveConfig.ollamaApi.loadBalancing.strategy;
    
    logger.debug(`🎯 Aplicando estratégia: ${strategy} para ${healthyClients.length} clientes`);
    
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
    
    const selectedIndex = this.currentIndex % clients.length;
    const client = clients[selectedIndex];
    this.currentIndex = (this.currentIndex + 1) % clients.length;
    
    logger.debug(`🔄 Round-robin selecionou: ${client.baseURL} (índice: ${selectedIndex}/${clients.length})`);
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
    
    // Log informações de todos os clientes para debug
    const clientStats = clients.map(c => ({
      url: c.baseURL,
      type: c.constructor.name,
      activeRequests: c.activeRequests,
      totalRequests: c.totalRequests,
      runningModels: c.runningModels?.length || 0,
      loadScore: c.getLoadScore()
    }));
    logger.debug('📊 Estatísticas de clientes para seleção:', clientStats);
    
    const client = clients.reduce((best, current) => {
      const bestScore = best.getLoadScore();
      const currentScore = current.getLoadScore();
      return currentScore < bestScore ? current : best;
    });

    logger.debug(`📊 Load balancing selecionou: ${client.baseURL} (score: ${client.getLoadScore()}, ativo: ${client.activeRequests})`);
    return client;
  }

  async selectBestClient() {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.error('❌ Nenhum endpoint Ollama saudável disponível');
      throw new Error('No healthy Ollama API endpoints available');
    }

    // Atualiza informações de carga para todos os clientes saudáveis
    logger.debug('📊 Atualizando informações de carga para balanceamento...');
    await Promise.allSettled(
      healthyClients.map(async (client) => {
        try {
          await client.listRunningModels();
          const processingStatus = client.getProcessingStatus();
          logger.debug(`📊 ${client.baseURL}: ativo=${processingStatus.activeRequests}, total=${processingStatus.totalRequests}, score=${client.getLoadScore()}`);
        } catch (error) {
          logger.debug(`⚠️ Erro ao obter status de ${client.baseURL}: ${error.message}`);
        }
      })
    );

    const selectedClient = await this.selectClientByStrategy(healthyClients);
    const effectiveConfig = await this.getEffectiveConfig();
    logger.info(`🎯 Cliente selecionado: ${selectedClient.baseURL} (estratégia: ${effectiveConfig.ollamaApi.loadBalancing.strategy})`);
    
    return selectedClient;
  }

  // ============ Generate Methods ============
  async generateWithFallback(options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.warn('⚠️ Nenhum endpoint Ollama API saudável disponível');
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
    
    logger.error(`❌ Todos os endpoints Ollama API falharam. Último erro: ${lastError?.message}`);
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  async generate(options = {}) {
    logger.service('🤖 Iniciando geração via Ollama API...');
    
    // Use balanceamento adequado baseado na estratégia configurada
    return await this.generateWithLoadBalancing(options);
  }

  async generateWithLoadBalancing(options = {}) {
    this.requestCount++;
    const effectiveConfig = await this.getEffectiveConfig();
    
    logger.info(`🎯 Requisição #${this.requestCount} - Iniciando balanceamento (estratégia: ${effectiveConfig.ollamaApi.loadBalancing.strategy})`);
    
    const selectedClient = await this.selectBestClient();
    
    if (!selectedClient) {
      logger.warn('⚠️ Nenhum endpoint Ollama API saudável disponível');
      throw new Error('No healthy Ollama API endpoints available');
    }

    const startTime = Date.now();
    try {
      const processingStatus = selectedClient.getProcessingStatus();
      logger.info(`🎯 Req #${this.requestCount}: Usando ${selectedClient.baseURL} (ativo: ${processingStatus.activeRequests}, score: ${selectedClient.getLoadScore()})`);
      
      const result = await selectedClient.generate(options);
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Req #${this.requestCount}: Geração bem-sucedida via ${selectedClient.baseURL} em ${duration}ms`);
      return result;
      
    } catch (error) {
      selectedClient.retryCount++;
      const duration = Date.now() - startTime;
      logger.warn(`⚠️ Req #${this.requestCount}: Falha via ${selectedClient.baseURL} após ${duration}ms: ${error.message}`);
      
      // Se falhar, marca como não saudável e tenta com fallback
      if (selectedClient.retryCount >= selectedClient.endpoint.maxRetries) {
        selectedClient.isHealthy = false;
        logger.error(`❌ Endpoint ${selectedClient.baseURL} marcado como não saudável após ${selectedClient.retryCount} falhas`);
      }
      
      // Fallback para outros endpoints disponíveis
      logger.info(`🔄 Req #${this.requestCount}: Tentando fallback para outros endpoints...`);
      return await this.generateWithFallback(options);
    }
  }

  // ============ Chat Methods ============
  async chatWithFallback(options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.warn('⚠️ Nenhum endpoint Ollama API saudável disponível');
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
    
    logger.error(`❌ Todos os endpoints Ollama API falharam. Último erro: ${lastError?.message}`);
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  async chat(options = {}) {
    logger.service('💬 Iniciando chat via Ollama API...');
    
    // Use balanceamento adequado baseado na estratégia configurada
    return await this.chatWithLoadBalancing(options);
  }

  async chatWithLoadBalancing(options = {}) {
    this.requestCount++;
    const effectiveConfig = await this.getEffectiveConfig();
    
    logger.info(`🎯 Chat #${this.requestCount} - Iniciando balanceamento (estratégia: ${effectiveConfig.ollamaApi.loadBalancing.strategy})`);
    
    const selectedClient = await this.selectBestClient();
    
    if (!selectedClient) {
      logger.warn('⚠️ Nenhum endpoint Ollama API saudável disponível');
      throw new Error('No healthy Ollama API endpoints available');
    }

    const startTime = Date.now();
    try {
      const processingStatus = selectedClient.getProcessingStatus();
      logger.info(`🎯 Chat #${this.requestCount}: Usando ${selectedClient.baseURL} (ativo: ${processingStatus.activeRequests}, score: ${selectedClient.getLoadScore()})`);
      
      const result = await selectedClient.chat(options);
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Chat #${this.requestCount}: Chat bem-sucedido via ${selectedClient.baseURL} em ${duration}ms`);
      return result;
      
    } catch (error) {
      selectedClient.retryCount++;
      const duration = Date.now() - startTime;
      logger.warn(`⚠️ Chat #${this.requestCount}: Falha via ${selectedClient.baseURL} após ${duration}ms: ${error.message}`);
      
      // Se falhar, marca como não saudável e tenta com fallback
      if (selectedClient.retryCount >= selectedClient.endpoint.maxRetries) {
        selectedClient.isHealthy = false;
        logger.error(`❌ Endpoint ${selectedClient.baseURL} marcado como não saudável após ${selectedClient.retryCount} falhas`);
      }
      
      // Fallback para outros endpoints disponíveis
      logger.info(`🔄 Chat #${this.requestCount}: Tentando fallback para outros endpoints...`);
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
      logger.warn('⚠️ Nenhum endpoint Ollama API saudável disponível');
      throw new Error('No healthy Ollama API endpoints available');
    }

    let lastError;
    
    for (const client of healthyClients) {
      try {
        logger.debug(`🎯 Tentando ${method} com ${client.baseURL}`);
        const result = await client[method](...args);
        logger.success(`✅ ${method} bem-sucedido via ${client.baseURL}`);
        return result;
      } catch (error) {
        lastError = error;
        client.retryCount++;
        
        logger.warn(`⚠️ Falha em ${method} via ${client.baseURL}: ${error.message}`);
        
        if (client.retryCount >= client.endpoint.maxRetries) {
          client.isHealthy = false;
          logger.error(`❌ Endpoint ${client.baseURL} marcado como não saudável após ${client.retryCount} falhas`);
        }
        
        if (healthyClients.indexOf(client) < healthyClients.length - 1) {
          logger.debug(`🔄 Tentando próximo endpoint para ${method}...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.ollamaApi.retryDelay));
        }
      }
    }
    
    logger.error(`❌ Todos os endpoints falharam para ${method}. Último erro: ${lastError?.message}`);
    throw new Error(`All Ollama API endpoints failed. Last error: ${lastError?.message}`);
  }

  // ============ Pool Status ============
  async getPoolStatus() {
    const effectiveConfig = await this.getEffectiveConfig();
    const status = {
      enabled: effectiveConfig.ollamaApi.enabled,
      mode: effectiveConfig.ollamaApi.mode || 'local',
      totalEndpoints: this.clients.length,
      healthyEndpoints: this.getHealthyClients().length,
      strategy: CONFIG.ollamaApi.loadBalancing.strategy,
      endpoints: []
    };

    for (const client of this.clients) {
      try {
        const health = await client.getHealth();
        const runningModels = await client.listRunningModels();
        const clientType = this.isRKLlamaEndpoint(client.endpoint) ? 'RKLLama' : 'Ollama';
        
        const processingStatus = client.getProcessingStatus ? client.getProcessingStatus() : {
          activeRequests: 0,
          totalRequests: 0,
          recentRequests: 0,
          averageResponseTime: 0,
          requestHistory: []
        };

        status.endpoints.push({
          url: client.baseURL,
          type: clientType,
          healthy: client.isHealthy,
          priority: client.endpoint.priority,
          runningModels: runningModels.models?.length || 0,
          loadScore: client.getLoadScore(),
          retryCount: client.retryCount,
          lastHealthCheck: client.lastHealthCheck ? new Date(client.lastHealthCheck).toISOString() : 'never',
          version: health.version,
          currentModel: health.currentModel || null,
          processing: processingStatus
        });
      } catch (error) {
        const clientType = this.isRKLlamaEndpoint(client.endpoint) ? 'RKLLama' : 'Ollama';
        const processingStatus = client.getProcessingStatus ? client.getProcessingStatus() : {
          activeRequests: 0,
          totalRequests: 0,
          recentRequests: 0,
          averageResponseTime: 0,
          requestHistory: []
        };

        status.endpoints.push({
          url: client.baseURL,
          type: clientType,
          healthy: false,
          priority: client.endpoint.priority,
          error: error.message,
          retryCount: client.retryCount,
          lastHealthCheck: client.lastHealthCheck ? new Date(client.lastHealthCheck).toISOString() : 'never',
          processing: processingStatus
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

  async reinitialize() {
    logger.info('🔄 Reinicializando pool de APIs Ollama...');
    await this.initialize();
  }

  destroy() {
    logger.info('🗑️ Destruindo pool de APIs Ollama...');
    this.stopHealthCheckInterval();
    this.clients = [];
  }
}

export default OllamaAPIPool;