import WhisperAPIClient from './whisperApiClient.js';
import logger from '../utils/logger.js';
import { CONFIG, getDynamicConfig } from '../config/index.js';

class WhisperAPIPool {
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
        logger.warn('⚠️ Erro ao obter configuração do MongoDB para WhisperAPI, usando configuração padrão:', error.message);
      }
    }
    return getDynamicConfig(mongoConfig);
  }

  async initialize() {
    logger.info('🔧 Inicializando pool de APIs Whisper...');
    
    // Stop existing health check interval if running
    this.stopHealthCheckInterval();
    
    const effectiveConfig = await this.getEffectiveConfig();
    
    if (!effectiveConfig.whisperApi.enabled || !effectiveConfig.whisperApi.endpoints.length) {
      logger.warn('⚠️ WhisperAPI não habilitado ou sem endpoints configurados');
      this.clients = [];
      return;
    }

    this.clients = effectiveConfig.whisperApi.endpoints
      .filter(endpoint => endpoint.enabled)
      .map(endpoint => {
        const client = new WhisperAPIClient(endpoint.url);
        client.endpoint = endpoint;
        client.retryCount = 0;
        logger.info(`📡 Endpoint configurado: ${endpoint.url} (prioridade: ${endpoint.priority})`);
        return client;
      });

    this.clients.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
    
    if (this.clients.length > 0) {
      logger.success(`✅ Pool inicializado com ${this.clients.length} endpoints`);
      this.startHealthCheckInterval();
    } else {
      logger.warn('⚠️ Nenhum endpoint habilitado encontrado');
    }
  }

  startHealthCheckInterval() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, CONFIG.whisperApi.loadBalancing.healthCheckInterval);
  }

  stopHealthCheckInterval() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.debug('🛑 Health check interval parado');
    }
  }

  async performHealthChecks() {
    // Check if the service is still enabled
    const isServiceEnabled = await this.isEnabled();
    if (!isServiceEnabled) {
      logger.debug('🛑 WhisperAPI desabilitado, parando health checks');
      this.stopHealthCheckInterval();
      return;
    }

    if (this.clients.length === 0) {
      logger.debug('🛑 Nenhum cliente disponível para health check');
      return;
    }

    logger.debug('🔍 Executando health checks nos endpoints...');
    
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
    const strategy = effectiveConfig.whisperApi.loadBalancing.strategy;
    
    // Log mais visível para debug
    logger.info(`🎯 WHISPER Estratégia aplicada: ${strategy} para ${healthyClients.length} clientes`);
    logger.debug(`🎯 Aplicando estratégia: ${strategy} para ${healthyClients.length} clientes`);
    
    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(healthyClients);
      
      case 'priority':
        return this.selectByPriority(healthyClients);
      
      case 'queue_length':
        return this.selectByQueueLength(healthyClients);
      
      default:
        logger.warn(`⚠️ Estratégia desconhecida: ${strategy}, usando queue_length`);
        return this.selectByQueueLength(healthyClients);
    }
  }

  selectRoundRobin(clients) {
    if (clients.length === 0) return null;
    
    // Encontra o índice do cliente na lista de clientes saudáveis
    const healthyUrls = clients.map(c => c.baseURL);
    let selectedIndex = this.currentIndex % clients.length;
    
    const client = clients[selectedIndex];
    this.currentIndex = (this.currentIndex + 1) % clients.length;
    
    // Log mais detalhado para debug
    logger.info(`🔄 WHISPER Round-robin: currentIndex=${this.currentIndex-1}, selectedIndex=${selectedIndex}, total=${clients.length}, selecionado=${client.baseURL}`);
    logger.debug(`🔄 Round-robin selecionou: ${client.baseURL} (índice: ${selectedIndex}/${clients.length})`);
    return client;
  }

  selectByPriority(clients) {
    if (clients.length === 0) return null;
    
    const client = clients[0];
    logger.debug(`⭐ Prioridade selecionou: ${client.baseURL} (prioridade: ${client.endpoint.priority})`);
    return client;
  }

  selectByQueueLength(clients) {
    if (clients.length === 0) return null;
    
    // Log informações de todos os clientes para debug
    const clientStats = clients.map(c => ({
      url: c.baseURL,
      queue: c.queueLength,
      score: c.getLoadScore(),
      avgTime: c.avgProcessingTime
    }));
    logger.debug('📊 Estatísticas de clientes para seleção:', clientStats);
    
    const client = clients.reduce((best, current) => {
      const bestScore = best.getLoadScore();
      const currentScore = current.getLoadScore();
      return currentScore < bestScore ? current : best;
    });

    logger.debug(`📊 Queue length selecionou: ${client.baseURL} (score: ${client.getLoadScore()}, fila: ${client.queueLength})`);
    return client;
  }

  async selectBestClient() {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.error('❌ Nenhum endpoint saudável disponível');
      throw new Error('No healthy Whisper API endpoints available');
    }

    // Atualiza informações de fila para todos os clientes saudáveis
    logger.debug('📊 Atualizando informações de fila para balanceamento...');
    await Promise.allSettled(
      healthyClients.map(async (client) => {
        try {
          await client.getQueueEstimate();
          logger.debug(`📊 ${client.baseURL}: fila=${client.queueLength}, score=${client.getLoadScore()}`);
        } catch (error) {
          logger.debug(`⚠️ Erro ao obter fila de ${client.baseURL}: ${error.message}`);
        }
      })
    );

    const selectedClient = await this.selectClientByStrategy(healthyClients);
    const effectiveConfig = await this.getEffectiveConfig();
    logger.info(`🎯 Cliente selecionado: ${selectedClient.baseURL} (estratégia: ${effectiveConfig.whisperApi.loadBalancing.strategy})`);
    
    return selectedClient;
  }

  async transcribeWithFallback(audioBuffer, filename, options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.warn('⚠️ Nenhum endpoint Whisper API saudável disponível');
      throw new Error('No healthy Whisper API endpoints available');
    }

    let lastError;
    
    for (const client of healthyClients) {
      try {
        logger.info(`🎯 Tentando transcrição com ${client.baseURL}`);
        
        const result = await client.transcribeBufferAndWait(audioBuffer, filename, options);
        
        logger.success(`✅ Transcrição bem-sucedida via ${client.baseURL}`);
        return result;
        
      } catch (error) {
        lastError = error;
        client.retryCount++;
        
        logger.warn(`⚠️ Falha na transcrição via ${client.baseURL}: ${error.message}`);
        
        if (client.retryCount >= client.endpoint.maxRetries) {
          client.isHealthy = false;
          logger.error(`❌ Endpoint ${client.baseURL} marcado como não saudável após ${client.retryCount} falhas`);
        }
        
        if (healthyClients.indexOf(client) < healthyClients.length - 1) {
          logger.info(`🔄 Tentando próximo endpoint em ${CONFIG.whisperApi.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.whisperApi.retryDelay));
        }
      }
    }
    
    logger.error(`❌ Todos os endpoints Whisper API falharam. Último erro: ${lastError?.message}`);
    throw new Error(`All Whisper API endpoints failed. Last error: ${lastError?.message}`);
  }

  async transcribe(audioBuffer, filename, options = {}) {
    logger.service('🎤 Iniciando transcrição via Whisper API...');
    
    // Use balanceamento adequado baseado na estratégia configurada
    const result = await this.transcribeWithLoadBalancing(audioBuffer, filename, options);
    return result.result.text;
  }

  async transcribeWithLoadBalancing(audioBuffer, filename, options = {}) {
    this.requestCount++;
    const effectiveConfig = await this.getEffectiveConfig();
    
    logger.info(`🎯 Requisição #${this.requestCount} - Iniciando balanceamento (estratégia: ${effectiveConfig.whisperApi.loadBalancing.strategy})`);
    
    const selectedClient = await this.selectBestClient();
    
    if (!selectedClient) {
      logger.warn('⚠️ Nenhum endpoint Whisper API saudável disponível');
      throw new Error('No healthy Whisper API endpoints available');
    }

    const startTime = Date.now();
    try {
      logger.info(`🎯 Req #${this.requestCount}: Usando ${selectedClient.baseURL} (fila: ${selectedClient.queueLength}, score: ${selectedClient.getLoadScore()})`);
      
      const result = await selectedClient.transcribeBufferAndWait(audioBuffer, filename, options);
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Req #${this.requestCount}: Transcrição bem-sucedida via ${selectedClient.baseURL} em ${duration}ms`);
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
      return await this.transcribeWithFallback(audioBuffer, filename, options);
    }
  }

  async getPoolStatus() {
    const status = {
      totalEndpoints: this.clients.length,
      healthyEndpoints: this.getHealthyClients().length,
      strategy: CONFIG.whisperApi.loadBalancing.strategy,
      endpoints: []
    };

    for (const client of this.clients) {
      try {
        const health = await client.getHealth();
        const queueInfo = await client.getQueueEstimate();
        
        status.endpoints.push({
          url: client.baseURL,
          healthy: client.isHealthy,
          priority: client.endpoint.priority,
          queueLength: queueInfo.queueLength,
          avgProcessingTime: queueInfo.averageProcessingTime,
          loadScore: client.getLoadScore(),
          retryCount: client.retryCount,
          lastHealthCheck: client.lastHealthCheck ? new Date(client.lastHealthCheck).toISOString() : 'never'
        });
      } catch (error) {
        status.endpoints.push({
          url: client.baseURL,
          healthy: false,
          priority: client.endpoint.priority,
          error: error.message,
          retryCount: client.retryCount,
          lastHealthCheck: client.lastHealthCheck ? new Date(client.lastHealthCheck).toISOString() : 'never'
        });
      }
    }

    return status;
  }

  async isEnabled() {
    const effectiveConfig = await this.getEffectiveConfig();
    return effectiveConfig.whisperApi.enabled && this.clients.length > 0;
  }

  hasHealthyEndpoints() {
    return this.getHealthyClients().length > 0;
  }

  async reinitialize() {
    logger.info('🔄 Reinicializando pool de APIs Whisper...');
    await this.initialize();
  }

  destroy() {
    logger.info('🗑️ Destruindo pool de APIs Whisper...');
    this.stopHealthCheckInterval();
    this.clients = [];
  }
}

// Será inicializado com configService no AudioTranscriber
export default WhisperAPIPool;