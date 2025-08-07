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

  isChatGPTEndpoint(endpoint) {
    // Check configured type first
    if (endpoint.type) {
      return endpoint.type === 'chatgpt';
    }
    
    // Fallback: detect by URL for existing configurations
    try {
      const parsedUrl = new URL(endpoint.url || endpoint);
      return parsedUrl.hostname === 'api.openai.com';
    } catch (error) {
      logger.warn(`⚠️ URL inválida para detecção ChatGPT: ${endpoint.url || endpoint}`);
      return false;
    }
  }

  getEndpointType(endpoint) {
    if (this.isChatGPTEndpoint(endpoint)) return 'chatgpt';
    if (this.isRKLlamaEndpoint(endpoint)) return 'rkllama';
    return 'ollama';
  }

  // Create appropriate client based on endpoint type
  async createClient(endpoint) {
    const endpointType = this.getEndpointType(endpoint);
    
    logger.debug(`🔧 Criando cliente para endpoint:`, {
      url: endpoint.url,
      type: endpoint.type,
      enabled: endpoint.enabled,
      priority: endpoint.priority,
      detectedType: endpointType
    });
    
    try {
      if (endpointType === 'chatgpt') {
        logger.info(`🚀 Criando cliente ChatGPT para: ${endpoint.url}`);
        const chatGPTModule = await import('./chatgptApiClient.js');
        const { ChatGPTAPIClient } = chatGPTModule;
        
        const options = {
          useStreaming: endpoint.useStreaming !== false, // Default true
          model: endpoint.model || 'gpt-4'
        };
        
        return new ChatGPTAPIClient(endpoint.url, endpoint.apikey, options);
      } else if (endpointType === 'rkllama') {
        logger.info(`🤖 Criando cliente RKLLama para: ${endpoint.url}`);
        return new RKLlamaAPIClient(endpoint.url);
      } else {
        logger.info(`🧠 Criando cliente Ollama para: ${endpoint.url}`);
        return new OllamaAPIClient(endpoint.url);
      }
    } catch (error) {
      logger.error(`❌ Erro ao criar cliente para ${endpoint.url}:`, error.message);
      throw error;
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

    const clientPromises = effectiveConfig.ollamaApi.endpoints
      .filter(endpoint => endpoint.enabled)
      .map(async endpoint => {
        const client = await this.createClient(endpoint);
        client.endpoint = endpoint;
        client.retryCount = 0;
        
        const clientType = this.isRKLlamaEndpoint(endpoint) ? 'RKLLama' : 'Ollama';
        logger.info(`📡 Endpoint ${clientType} configurado: ${endpoint.url} (prioridade: ${endpoint.priority})`);
        return client;
      });

    this.clients = await Promise.all(clientPromises);

    this.clients.sort((a, b) => a.endpoint.priority - b.endpoint.priority);
    
    if (this.clients.length > 0) {
      logger.success(`✅ Pool Ollama inicializado com ${this.clients.length} endpoints`);
      this.startHealthCheckInterval();
      
      // Load saved models for RKLLama endpoints
      await this.loadSavedModels();
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

    logger.debug(`🔍 Executando health checks em ${this.clients.length} endpoints Ollama...`);
    
    const healthPromises = this.clients.map(async (client) => {
      try {
        logger.debug(`🔍 Health check para ${client.baseURL}...`);
        await client.checkHealth();
        client.retryCount = 0;
        logger.debug(`✅ Health check bem-sucedido para ${client.baseURL}`);
      } catch (error) {
        client.retryCount++;
        logger.warn(`⚠️ Health check falhou para ${client.baseURL} (tentativa ${client.retryCount}/${client.endpoint.maxRetries}): ${error.message}`);
        
        // Log detailed error for debugging
        if (error.message.includes('Invalid URL')) {
          logger.error(`❌ URL inválida detectada para ${client.baseURL}:`, {
            originalURL: client.baseURL,
            endpointURL: client.endpoint?.url,
            error: error.message
          });
        }
      }
    });

    await Promise.allSettled(healthPromises);
    
    const healthyCount = this.getHealthyClients().length;
    logger.debug(`📊 Health check concluído: ${healthyCount}/${this.clients.length} endpoints saudáveis`);
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
      
      case 'response_efficiency':
        return this.selectByResponseEfficiency(healthyClients);
      
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

  selectByResponseEfficiency(clients) {
    if (clients.length === 0) return null;
    
    // Calcula eficiência: Tempo estimado para completar próxima requisição
    const clientsWithEfficiency = clients.map(client => {
      const status = client.getProcessingStatus();
      const avgResponseTime = Math.max(status.averageResponseTime, 10); // Mínimo 10ms para evitar divisão por zero
      const queueSize = client.activeRequests;
      
      // Tempo estimado = (tempo médio de resposta × (fila + 1))
      // +1 porque nossa requisição seria a próxima na fila
      const estimatedTime = avgResponseTime * (queueSize + 1);
      
      return {
        client,
        avgResponseTime,
        queueSize,
        estimatedTime,
        url: client.baseURL
      };
    });

    // Log para debug
    const debugInfo = clientsWithEfficiency.map(c => ({
      url: c.url,
      avgTime: c.avgResponseTime + 'ms',
      queue: c.queueSize,
      estimatedTime: c.estimatedTime + 'ms'
    }));
    logger.debug('🚀 Análise de eficiência de endpoints:', debugInfo);

    // Seleciona cliente com menor tempo estimado
    const bestClient = clientsWithEfficiency.reduce((best, current) => 
      current.estimatedTime < best.estimatedTime ? current : best
    );

    logger.debug(`🎯 Response efficiency selecionou: ${bestClient.url} (tempo estimado: ${bestClient.estimatedTime}ms, fila: ${bestClient.queueSize})`);
    return bestClient.client;
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

    // Override model if a specific model is configured for this endpoint
    const finalOptions = { ...options };
    if (selectedClient.endpoint.model) {
      const endpointType = this.getEndpointType(selectedClient.endpoint);
      
      // For ChatGPT endpoints, ensure we use OpenAI-compatible chat models
      if (endpointType === 'chatgpt') {
        const isValidChatModel = (selectedClient.endpoint.model.includes('gpt') || 
                                 selectedClient.endpoint.model.includes('o3') || 
                                 selectedClient.endpoint.model.includes('o4')) &&
                                !selectedClient.endpoint.model.includes('instruct'); // Instruct models are not chat models
        
        if (isValidChatModel) {
          finalOptions.model = selectedClient.endpoint.model;
          logger.debug(`🔧 Usando modelo OpenAI específico do endpoint: ${finalOptions.model}`);
        } else {
          // Use default GPT-4 for ChatGPT endpoints with invalid models
          finalOptions.model = 'gpt-4';
          logger.warn(`⚠️ Modelo ${selectedClient.endpoint.model} não é compatível com chat completions, usando gpt-4`);
        }
      } else {
        // For Ollama/RKLLama endpoints, use the configured model as-is
        finalOptions.model = selectedClient.endpoint.model;
        logger.debug(`🔧 Usando modelo específico do endpoint: ${finalOptions.model}`);
      }
    }

    const startTime = Date.now();
    try {
      const processingStatus = selectedClient.getProcessingStatus();
      logger.info(`🎯 Req #${this.requestCount}: Usando ${selectedClient.baseURL} (ativo: ${processingStatus.activeRequests}, score: ${selectedClient.getLoadScore()})`);
      
      // For ChatGPT endpoints, use different call format
      let result;
      const endpointType = this.getEndpointType(selectedClient.endpoint);
      if (endpointType === 'chatgpt') {
        // ChatGPT generate expects prompt as first parameter
        const prompt = finalOptions.prompt || '';
        const generateOptions = { ...finalOptions };
        delete generateOptions.prompt; // Remove prompt from options
        result = await selectedClient.generate(prompt, generateOptions);
      } else {
        // Ollama and RKLLama expect options object
        result = await selectedClient.generate(finalOptions);
      }
      
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
      // Override model if a specific model is configured for this endpoint
      const finalOptions = { ...options };
      if (client.endpoint.model) {
        const endpointType = this.getEndpointType(client.endpoint);
        
        // For ChatGPT endpoints, ensure we use OpenAI-compatible chat models
        if (endpointType === 'chatgpt') {
          const isValidChatModel = (client.endpoint.model.includes('gpt') || 
                                   client.endpoint.model.includes('o3') || 
                                   client.endpoint.model.includes('o4')) &&
                                  !client.endpoint.model.includes('instruct'); // Instruct models are not chat models
          
          if (isValidChatModel) {
            finalOptions.model = client.endpoint.model;
            logger.debug(`🔧 Usando modelo OpenAI específico do endpoint para fallback: ${finalOptions.model}`);
          } else {
            // Use default GPT-4 for ChatGPT endpoints with invalid models
            finalOptions.model = 'gpt-4';
            logger.warn(`⚠️ Modelo ${client.endpoint.model} não é compatível com chat completions no fallback, usando gpt-4`);
          }
        } else {
          // For Ollama/RKLLama endpoints, use the configured model as-is
          finalOptions.model = client.endpoint.model;
          logger.debug(`🔧 Usando modelo específico do endpoint para fallback: ${finalOptions.model}`);
        }
      }

      try {
        logger.info(`🎯 Tentando chat com ${client.baseURL}`);
        
        // For ChatGPT endpoints, use different call format
        let result;
        const endpointType = this.getEndpointType(client.endpoint);
        if (endpointType === 'chatgpt') {
          // ChatGPT expects messages as first parameter
          const messages = finalOptions.messages || [];
          const chatOptions = { ...finalOptions };
          delete chatOptions.messages; // Remove messages from options
          result = await client.chat(messages, chatOptions);
        } else {
          // Ollama and RKLLama expect options object
          result = await client.chat(finalOptions);
        }
        
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

    // Override model if a specific model is configured for this endpoint
    const finalOptions = { ...options };
    if (selectedClient.endpoint.model) {
      const endpointType = this.getEndpointType(selectedClient.endpoint);
      
      // For ChatGPT endpoints, ensure we use OpenAI-compatible chat models
      if (endpointType === 'chatgpt') {
        const isValidChatModel = (selectedClient.endpoint.model.includes('gpt') || 
                                 selectedClient.endpoint.model.includes('o3') || 
                                 selectedClient.endpoint.model.includes('o4')) &&
                                !selectedClient.endpoint.model.includes('instruct'); // Instruct models are not chat models
        
        if (isValidChatModel) {
          finalOptions.model = selectedClient.endpoint.model;
          logger.debug(`🔧 Usando modelo OpenAI específico do endpoint: ${finalOptions.model}`);
        } else {
          // Use default GPT-4 for ChatGPT endpoints with invalid models
          finalOptions.model = 'gpt-4';
          logger.warn(`⚠️ Modelo ${selectedClient.endpoint.model} não é compatível com chat completions, usando gpt-4`);
        }
      } else {
        // For Ollama/RKLLama endpoints, use the configured model as-is
        finalOptions.model = selectedClient.endpoint.model;
        logger.debug(`🔧 Usando modelo específico do endpoint: ${finalOptions.model}`);
      }
    }

    const startTime = Date.now();
    try {
      const processingStatus = selectedClient.getProcessingStatus();
      logger.info(`🎯 Chat #${this.requestCount}: Usando ${selectedClient.baseURL} (ativo: ${processingStatus.activeRequests}, score: ${selectedClient.getLoadScore()})`);
      
      // For ChatGPT endpoints, use different call format
      let result;
      const endpointType = this.getEndpointType(selectedClient.endpoint);
      if (endpointType === 'chatgpt') {
        // ChatGPT expects messages as first parameter
        const messages = finalOptions.messages || [];
        const chatOptions = { ...finalOptions };
        delete chatOptions.messages; // Remove messages from options
        result = await selectedClient.chat(messages, chatOptions);
      } else {
        // Ollama and RKLLama expect options object
        result = await selectedClient.chat(finalOptions);
      }
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Chat #${this.requestCount}: Chat bem-sucedido via ${selectedClient.baseURL} em ${duration}ms`);
      return {
        result,
        endpoint: selectedClient.baseURL,
        client: selectedClient,
        duration
      };
      
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

  async chatWithSpecificEndpoint(endpointUrl, options = {}) {
    // Encontra o cliente específico pelo URL
    const client = this.clients.find(c => c.baseURL === endpointUrl);
    
    if (!client) {
      throw new Error(`Endpoint ${endpointUrl} não encontrado no pool`);
    }
    
    // Verifica se o cliente está saudável (isHealthy é uma propriedade, não método)
    if (!client.isHealthy || client.retryCount >= client.endpoint.maxRetries) {
      throw new Error(`Endpoint ${endpointUrl} não está saudável (health: ${client.isHealthy}, retries: ${client.retryCount}/${client.endpoint.maxRetries})`);
    }
    
    const startTime = Date.now();
    try {
      logger.info(`🎯 Chat direto: Usando endpoint específico ${endpointUrl}`);
      const result = await client.chat(options);
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Chat direto: Sucesso via ${endpointUrl} em ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Chat direto: Falha via ${endpointUrl} após ${duration}ms:`, error);
      throw error;
    }
  }

  async chatWithSpecificEndpointAndModel(endpointUrl, model, options = {}) {
    // Encontra o cliente específico pelo URL
    const client = this.clients.find(c => c.baseURL === endpointUrl);
    
    if (!client) {
      throw new Error(`Endpoint ${endpointUrl} não encontrado no pool`);
    }
    
    // Verifica se o cliente está saudável
    if (!client.isHealthy || client.retryCount >= client.endpoint.maxRetries) {
      throw new Error(`Endpoint ${endpointUrl} não está saudável (health: ${client.isHealthy}, retries: ${client.retryCount}/${client.endpoint.maxRetries})`);
    }
    
    const startTime = Date.now();
    try {
      logger.info(`🎯 Chat direto: Usando endpoint específico ${endpointUrl} com modelo ${model}`);
      
      // Define o modelo específico no options
      const chatOptions = {
        model: model,
        stream: false,
        ...options
      };
      
      // Use método específico para ChatGPT se disponível
      let result;
      if (client.chatWithSpecificEndpointAndModel && this.isChatGPTEndpoint(client.endpoint)) {
        result = await client.chatWithSpecificEndpointAndModel(endpointUrl, model, chatOptions);
      } else {
        result = await client.chat(chatOptions);
      }
      
      const duration = Date.now() - startTime;
      logger.success(`✅ Chat direto: Sucesso via ${endpointUrl} com modelo ${model} em ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Chat direto: Falha via ${endpointUrl} com modelo ${model} após ${duration}ms:`, error);
      throw error;
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

  async listModelsFromAllEndpoints() {
    logger.info('🔍 Listando modelos de todos os endpoints Ollama...');
    
    if (this.clients.length === 0) {
      logger.warn('⚠️ Nenhum endpoint configurado');
      return { endpoints: [], totalModels: 0, uniqueModels: [] };
    }

    const results = [];
    const uniqueModels = new Set();
    
    for (const client of this.clients) {
      const endpointResult = {
        url: client.endpoint.url,
        type: this.isRKLlamaEndpoint(client.endpoint) ? 'RKLLama' : 'Ollama',
        priority: client.endpoint.priority,
        healthy: false,
        models: [],
        error: null
      };

      try {
        logger.debug(`📡 Consultando modelos do endpoint: ${client.endpoint.url}`);
        const response = await client.listModels();
        
        if (response && response.models) {
          endpointResult.healthy = true;
          endpointResult.models = response.models;
          
          // Adicionar modelos únicos ao conjunto
          response.models.forEach(model => {
            uniqueModels.add(model.name);
          });
          
          logger.success(`✅ ${response.models.length} modelos encontrados em ${client.endpoint.url}`);
        } else {
          endpointResult.error = 'Resposta inválida do endpoint';
          logger.warn(`⚠️ Resposta inválida do endpoint ${client.endpoint.url}`);
        }
      } catch (error) {
        endpointResult.error = error.message;
        logger.error(`❌ Erro ao listar modelos do endpoint ${client.endpoint.url}:`, error.message);
      }

      results.push(endpointResult);
    }

    const totalModels = results.reduce((sum, result) => sum + result.models.length, 0);
    
    logger.info(`📊 Resumo: ${totalModels} modelos totais, ${uniqueModels.size} únicos em ${results.length} endpoints`);
    
    return {
      endpoints: results,
      totalModels,
      uniqueModels: Array.from(uniqueModels).sort(),
      timestamp: new Date().toISOString()
    };
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
      healthyEndpoints: 0, // Will be calculated after health checks
      strategy: CONFIG.ollamaApi.loadBalancing.strategy,
      endpoints: []
    };

    for (const client of this.clients) {
      try {
        const health = await client.getHealth();
        const runningModels = await client.listRunningModels();
        const clientType = this.getEndpointType(client.endpoint);
        
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
        const clientType = this.getEndpointType(client.endpoint);
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

    // Calculate healthy endpoints after all health checks are done
    status.healthyEndpoints = this.getHealthyClients().length;

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

  async loadSavedModels() {
    if (!this.configService) {
      logger.debug('🔧 ConfigService não disponível, pulando carregamento de modelos salvos');
      return;
    }

    try {
      const config = await this.configService.getConfig();
      const endpoints = config?.ollamaApi?.endpoints || [];
      
      logger.info('🔄 Carregando modelos salvos para todos os endpoints...');
      
      for (const client of this.clients) {
        const endpoint = client.endpoint; // Get the endpoint config directly from the client

        // Load models for both Ollama and RKLLama endpoints
        if (endpoint.model && endpoint.enabled) {
          try {
            const endpointType = this.getEndpointType(endpoint);
            
            // ChatGPT endpoints don't need model loading/pulling
            if (endpointType === 'chatgpt') {
              logger.info(`🚀 Endpoint ChatGPT ${endpoint.url} configurado com modelo ${endpoint.model} (sem pré-carregamento necessário)`);
              continue;
            }
            
            const endpointTypeName = endpointType === 'rkllama' ? 'RKLLama' : 'Ollama';
            logger.info(`🔄 Carregando modelo salvo ${endpoint.model} para ${endpointTypeName} ${endpoint.url}`);

            // Check if endpoint is healthy first
            await client.checkHealth();

            if (client.isHealthy) {
              if (endpointType === 'rkllama') {
                // For RKLLama, use loadModel method
                await client.loadModel(endpoint.model);
                logger.success(`✅ Modelo ${endpoint.model} carregado automaticamente em RKLLama ${endpoint.url}`);
              } else {
                // For Ollama, use pullModel method
                await client.pullModel(endpoint.model);
                logger.success(`✅ Modelo ${endpoint.model} pré-carregado automaticamente em Ollama ${endpoint.url}`);
              }
            } else {
              logger.warn(`⚠️ Endpoint ${endpoint.url} não está saudável, pulando carregamento do modelo ${endpoint.model}`);
            }
          } catch (error) {
            const endpointType = this.getEndpointType(endpoint);
            const endpointTypeName = endpointType === 'rkllama' ? 'RKLLama' : endpointType === 'chatgpt' ? 'ChatGPT' : 'Ollama';
            logger.warn(`⚠️ Falha ao carregar modelo ${endpoint.model} para ${endpointTypeName} ${endpoint.url}: ${error.message}`);
          }
        }
      }
      
      logger.info('✅ Carregamento de modelos salvos concluído');
    } catch (error) {
      logger.error('❌ Erro ao carregar modelos salvos:', error);
    }
  }

  destroy() {
    logger.info('🗑️ Destruindo pool de APIs Ollama...');
    this.stopHealthCheckInterval();
    this.clients = [];
  }
}

export default OllamaAPIPool;