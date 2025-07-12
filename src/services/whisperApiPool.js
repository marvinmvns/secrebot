import WhisperAPIClient from './whisperApiClient.js';
import logger from '../utils/logger.js';
import { CONFIG, getDynamicConfig } from '../config/index.js';

class WhisperAPIPool {
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
        logger.warn('⚠️ Erro ao obter configuração do MongoDB para WhisperAPI, usando configuração padrão:', error.message);
      }
    }
    return getDynamicConfig(mongoConfig);
  }

  async initialize() {
    logger.info('🔧 Inicializando pool de APIs Whisper...');
    
    const effectiveConfig = await this.getEffectiveConfig();
    
    if (!effectiveConfig.whisperApi.enabled || !effectiveConfig.whisperApi.endpoints.length) {
      logger.warn('⚠️ WhisperAPI não habilitado ou sem endpoints configurados');
      return;
    }

    this.clients = effectiveConfig.whisperApi.endpoints.map(endpoint => {
      const client = new WhisperAPIClient(endpoint.url);
      client.endpoint = endpoint;
      client.retryCount = 0;
      logger.info(`📡 Endpoint configurado: ${endpoint.url} (prioridade: ${endpoint.priority})`);
      return client;
    });

    this.clients.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
    
    logger.success(`✅ Pool inicializado com ${this.clients.length} endpoints`);
    this.startHealthCheckInterval();
  }

  startHealthCheckInterval() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, CONFIG.whisperApi.loadBalancing.healthCheckInterval);
  }

  async performHealthChecks() {
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

  selectClientByStrategy(healthyClients) {
    const strategy = CONFIG.whisperApi.loadBalancing.strategy;
    
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

  selectByQueueLength(clients) {
    if (clients.length === 0) return null;
    
    const client = clients.reduce((best, current) => {
      const bestScore = best.getLoadScore();
      const currentScore = current.getLoadScore();
      return currentScore < bestScore ? current : best;
    });

    logger.debug(`📊 Queue length selecionou: ${client.baseURL} (score: ${client.getLoadScore()})`);
    return client;
  }

  async selectBestClient() {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
      logger.error('❌ Nenhum endpoint saudável disponível');
      throw new Error('No healthy Whisper API endpoints available');
    }

    await Promise.allSettled(
      healthyClients.map(client => client.getQueueEstimate().catch(() => {}))
    );

    return this.selectClientByStrategy(healthyClients);
  }

  async transcribeWithFallback(audioBuffer, filename, options = {}) {
    const healthyClients = this.getHealthyClients();
    
    if (healthyClients.length === 0) {
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
    
    throw new Error(`All Whisper API endpoints failed. Last error: ${lastError?.message}`);
  }

  async transcribe(audioBuffer, filename, options = {}) {
    logger.service('🎤 Iniciando transcrição via Whisper API...');
    
    try {
      const client = await this.selectBestClient();
      
      logger.info(`🎯 Endpoint selecionado: ${client.baseURL} (${CONFIG.whisperApi.loadBalancing.strategy})`);
      
      const result = await client.transcribeBufferAndWait(audioBuffer, filename, options);
      
      logger.success(`✅ Transcrição via API concluída com sucesso`);
      return result.result.text;
      
    } catch (error) {
      logger.warn(`⚠️ Falha no endpoint principal, tentando fallback...`);
      
      const result = await this.transcribeWithFallback(audioBuffer, filename, options);
      return result.result.text;
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
          lastHealthCheck: new Date(client.lastHealthCheck).toISOString()
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
    return effectiveConfig.whisperApi.enabled && this.clients.length > 0;
  }

  hasHealthyEndpoints() {
    return this.getHealthyClients().length > 0;
  }
}

// Será inicializado com configService no AudioTranscriber
export default WhisperAPIPool;