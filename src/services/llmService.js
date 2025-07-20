import { Ollama } from 'ollama';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, CHAT_MODES, PROMPTS, getDynamicConfig } from '../config/index.js'; // Ajustar caminho se necessário
import { fetchProfileStructured } from './linkedinScraper.js';
import JobQueue from './jobQueue.js';
import OllamaAPIPool from './ollamaApiPool.js';
import logger from '../utils/logger.js';

// ============ Serviço LLM ============
class LLMService {
  constructor(configService = null) {
    this.configService = configService;
    this.contexts = new Map();
    this.ollamaApiPool = new OllamaAPIPool(configService);
    this.queue = new JobQueue(
      CONFIG.queues.llmConcurrency,
      CONFIG.queues.memoryThresholdGB
    );
    this.ollama = null; // Initialize after config is loaded
    this.loadLastUsedModel();
    this.initializeOllama();

    // Configurações de timeout progressivo
    this.timeoutLevels = [
      6000000,   // 1 minuto
      180000000, // 30 minutos
      360000000  // 1 hora (limite máximo)
    ];
  }

  initializeOllama() {
    this.ollama = new Ollama({ host: CONFIG.llm.host });
    logger.info(`Ollama client initialized with host: ${CONFIG.llm.host}`);
  }

  async loadLastUsedModel() {
    if (this.configService) {
      try {
        const config = await this.configService.getConfig();
        if (config && config.llm && config.llm.model) {
          CONFIG.llm.model = config.llm.model; // Update global CONFIG
          logger.info(`Modelo LLM carregado do MongoDB: ${CONFIG.llm.model}`);
        }
      } catch (error) {
        logger.warn('⚠️ Erro ao carregar último modelo LLM do MongoDB, usando configuração padrão:', error.message);
      }
    }
  }

  async getEffectiveConfig() {
    let mongoConfig = null;
    if (this.configService) {
      try {
        mongoConfig = await this.configService.getConfig();
      } catch (error) {
        logger.warn('⚠️ Erro ao obter configuração do MongoDB para LLM, usando configuração padrão:', error.message);
      }
    }
    return getDynamicConfig(mongoConfig);
  }

  async shouldUseApiPool() {
    const config = await this.getEffectiveConfig();
    return config.ollamaApi.enabled && 
           config.ollamaApi.mode === 'api' && 
           await this.ollamaApiPool.isEnabled() &&
           this.ollamaApiPool.hasHealthyEndpoints();
  }

  getContext(contactId, type) {
    const key = `${contactId}_${type}`;
    if (!this.contexts.has(key)) {
      this.contexts.set(key, []);
    }
    return this.contexts.get(key);
  }

  async chat(contactId, text, type, systemPrompt, maxRetries = this.timeoutLevels.length) {
    const context = this.getContext(contactId, type);
    context.push({ role: 'user', content: text });
    
    // Usa o método estático de Utils para limitar o contexto
    const limitedContext = Utils.limitContext([...context]); 
    const messages = [{ role: 'system', content: systemPrompt }, ...limitedContext];
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const timeoutMs = this.timeoutLevels[attempt] || this.timeoutLevels[this.timeoutLevels.length - 1];
      const timeoutLabel = this.formatTimeout(timeoutMs);
      
      try {
        logger.service(`🔄 LLM Tentativa ${attempt + 1}/${maxRetries} (timeout: ${timeoutLabel}) para ${contactId}`);
        
        const response = await this.queue.add(() => 
          this.chatWithTimeout({
            model: CONFIG.llm.model,
            messages
          }, timeoutMs)
        );
        
        // Usa o método estático de Utils para extrair JSON
        const content = type === CHAT_MODES.AGENDABOT 
          ? Utils.extractJSON(response.message.content)
          : response.message.content;
        
        context.push({ role: 'assistant', content });
        logger.success(`✅ LLM resposta obtida em tentativa ${attempt + 1} para ${contactId}`);
        return content;
      } catch (err) {
        const isTimeout = err.code === 'UND_ERR_HEADERS_TIMEOUT' || err.name === 'TimeoutError' || err.message?.includes('timeout');
        
        logger.error(`❌ LLM (${type}) - Tentativa ${attempt + 1}/${maxRetries} [${timeoutLabel}]:`, {
          error: err.message,
          code: err.code,
          isTimeout,
          contactId
        });
        
        if (attempt === maxRetries - 1) {
          // Remove the failed user message from context on final failure
          context.pop();
          logger.error(`🚫 LLM falhou definitivamente após ${maxRetries} tentativas para ${contactId}`);
          throw new Error(`LLM falhou após ${maxRetries} tentativas. Último erro: ${err.message}`);
        }
        
        // Delay progressivo entre tentativas
        const delayMs = Math.min(2000 * Math.pow(1.5, attempt), 30000);
        logger.info(`⏳ Aguardando ${this.formatTimeout(delayMs)} antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  async chatWithTimeout(requestParams, timeoutMs) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`LLM timeout após ${this.formatTimeout(timeoutMs)}`));
      }, timeoutMs);
      
      try {
        const useApiPool = await this.shouldUseApiPool();
        let response;
        
        if (useApiPool) {
          logger.debug('🔄 Usando Ollama API Pool para chat');
          response = await this.ollamaApiPool.chat({
            ...requestParams,
            stream: false
          });
        } else {
          logger.debug('🔄 Usando Ollama local para chat');
          response = await this.ollama.chat(requestParams);
        }
        
        clearTimeout(timeout);
        resolve(response);
      } catch (error) {
        clearTimeout(timeout);
        
        // Se falhou com API Pool, sempre tenta fallback para local
        const usedApiPool = await this.shouldUseApiPool();
        if (usedApiPool) {
          try {
            logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback...');
            const response = await this.ollama.chat(requestParams);
            logger.success('✅ Fallback para Ollama local bem-sucedido');
            resolve(response);
            return;
          } catch (fallbackError) {
            logger.error('❌ Fallback para Ollama local também falhou:', fallbackError.message);
            // Use the more informative error message
            const combinedError = new Error(`API pool failed: ${error.message}. Local fallback failed: ${fallbackError.message}`);
            reject(combinedError);
            return;
          }
        }
        
        reject(error);
      }
    });
  }
  
  formatTimeout(ms) {
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.round(ms / 60000)}min`;
    } else {
      return `${Math.round(ms / 3600000)}h`;
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

  async getAssistantResponseLinkedin(contactId, url, liAt) {
    try {
      const data = await fetchProfileStructured(url, {
        liAt,
        timeoutMs: CONFIG.linkedin.timeoutMs,
        retries: 3
      });
      
      if (!data.success) {
        return `❌ Erro ao analisar perfil: ${data.error}`;
      }

      const profileData = data.data;
      const quality = data.dataQuality;

      const structuredText = this.formatProfileForLLM(profileData, quality);
      
      const enhancedPrompt = `${PROMPTS.linkedin}

QUALIDADE DOS DADOS: ${quality.quality} (${quality.percentage}%)
TENTATIVAS: ${data.attempt || 1}

Analise o perfil abaixo e forneça um resumo profissional detalhado e insights relevantes:

${structuredText}`;

      return await this.chat(contactId, enhancedPrompt, CHAT_MODES.LINKEDIN, PROMPTS.linkedin);
    } catch (err) {
      logger.error('Erro ao raspar LinkedIn:', err);
      return '❌ Erro interno ao processar perfil LinkedIn.';
    }
  }

  formatProfileForLLM(profileData, quality) {
    let formatted = '';
    
    if (profileData.name) {
      formatted += `**NOME:** ${profileData.name}\n`;
    }
    
    if (profileData.headline) {
      formatted += `**TÍTULO:** ${profileData.headline}\n`;
    }
    
    if (profileData.location) {
      formatted += `**LOCALIZAÇÃO:** ${profileData.location}\n`;
    }
    
    if (profileData.connections) {
      formatted += `**CONEXÕES:** ${profileData.connections}\n`;
    }
    
    if (profileData.about && profileData.about.length > 0) {
      formatted += `\n**SOBRE:**\n${profileData.about}\n`;
    }
    
    if (profileData.experience && profileData.experience.length > 0) {
      formatted += `\n**EXPERIÊNCIA PROFISSIONAL:**\n`;
      profileData.experience.forEach((exp, index) => {
        formatted += `${index + 1}. ${exp.title || 'Cargo não especificado'}\n`;
        formatted += `   Empresa: ${exp.company || 'Empresa não especificada'}\n`;
        formatted += `   Período: ${exp.duration || 'Período não especificado'}\n\n`;
      });
    }
    
    if (profileData.education && profileData.education.length > 0) {
      formatted += `**EDUCAÇÃO:**\n`;
      profileData.education.forEach((edu, index) => {
        formatted += `${index + 1}. ${edu.degree || 'Curso não especificado'}\n`;
        formatted += `   Instituição: ${edu.school || 'Instituição não especificada'}\n`;
        formatted += `   Período: ${edu.years || 'Período não especificado'}\n\n`;
      });
    }
    
    if (profileData.skills && profileData.skills.length > 0) {
      formatted += `**PRINCIPAIS HABILIDADES:**\n`;
      formatted += profileData.skills.slice(0, 15).join(' • ') + '\n';
    }
    
    formatted += `\n**QUALIDADE DOS DADOS EXTRAÍDOS:** ${quality.percentage}% (${quality.score}/${quality.maxScore} campos preenchidos)`;
    
    return formatted;
  }

  clearContext(contactId, type) {
    const key = `${contactId}_${type}`;
    this.contexts.delete(key);
  }

  // Método para gerar resposta genérica (usado pelo Telegram)
  async generateResponse(prompt, options = {}) {
    const contactId = 'telegram_' + Date.now();
    const maxTokens = options.maxTokens || 2000;
    const temperature = options.temperature || 0.7;
    
    try {
      const useApiPool = await this.shouldUseApiPool();
      let response;
      
      const requestParams = {
        model: CONFIG.llm.model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: temperature
        },
        stream: false
      };
      
      if (useApiPool) {
        logger.debug('🔄 Usando Ollama API Pool para geração de resposta');
        response = await this.ollamaApiPool.chat(requestParams);
      } else {
        logger.debug('🔄 Usando Ollama local para geração de resposta');
        response = await this.ollama.chat(requestParams);
      }
      
      return response.message.content;
    } catch (error) {
      // Fallback para local se a API falhar
      const usedApiPool = await this.shouldUseApiPool();
      if (usedApiPool) {
        try {
          logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback na geração de resposta...');
          const response = await this.ollama.chat({
            model: CONFIG.llm.model,
            messages: [{ role: 'user', content: prompt }],
            options: {
              temperature: temperature
            }
          });
          logger.success('✅ Fallback para Ollama local bem-sucedido na geração de resposta');
          return response.message.content;
        } catch (fallbackError) {
          logger.error('❌ Fallback também falhou na geração de resposta:', fallbackError.message);
          throw new Error(`API pool failed: ${error.message}. Local fallback failed: ${fallbackError.message}`);
        }
      }
      
      logger.error('Erro ao gerar resposta LLM:', error);
      throw error;
    }
  }

  // Método para análise de imagem (usado pelo Telegram)
  async analyzeImage(imagePath, prompt) {
    try {
      // Para Ollama com suporte a vision, usar o modelo multimodal
      const visionModel = CONFIG.llm.imageModel || CONFIG.llm.visionModel || 'llava';
      const useApiPool = await this.shouldUseApiPool();
      let response;
      
      const requestParams = {
        model: visionModel,
        messages: [{
          role: 'user',
          content: prompt,
          images: [imagePath]
        }],
        stream: false
      };
      
      if (useApiPool) {
        logger.debug('🔄 Usando Ollama API Pool para análise de imagem');
        response = await this.ollamaApiPool.chat(requestParams);
      } else {
        logger.debug('🔄 Usando Ollama local para análise de imagem');
        response = await this.ollama.chat(requestParams);
      }
      
      return response.message.content;
    } catch (error) {
      // Fallback para local se a API falhar
      const usedApiPool = await this.shouldUseApiPool();
      if (usedApiPool) {
        try {
          logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback na análise de imagem...');
          const visionModel = CONFIG.llm.imageModel || CONFIG.llm.visionModel || 'llava';
          const response = await this.ollama.chat({
            model: visionModel,
            messages: [{
              role: 'user',
              content: prompt,
              images: [imagePath]
            }]
          });
          logger.success('✅ Fallback para Ollama local bem-sucedido na análise de imagem');
          return response.message.content;
        } catch (fallbackError) {
          logger.error('❌ Fallback também falhou na análise de imagem:', fallbackError.message);
          throw new Error(`API pool failed: ${error.message}. Local fallback failed: ${fallbackError.message}`);
        }
      }
      
      logger.error('Erro ao analisar imagem:', error);
      return null;
    }
  }

  // ============ Métodos de gerenciamento da API Ollama ============
  async getOllamaApiStatus() {
    try {
      const poolStatus = await this.ollamaApiPool.getPoolStatus();
      
      // If the pool is not enabled, return disabled status with reason
      if (!poolStatus.enabled) {
        return { 
          enabled: false, 
          mode: poolStatus.mode || 'local',
          message: 'Ollama API Pool não está habilitado',
          totalEndpoints: 0,
          healthyEndpoints: 0,
          strategy: poolStatus.strategy,
          endpoints: []
        };
      }
      
      // If enabled but no clients, it means no endpoints are configured or enabled
      if (poolStatus.totalEndpoints === 0) {
        return {
          ...poolStatus,
          enabled: false,
          message: 'Nenhum endpoint configurado ou habilitado'
        };
      }
      
      return poolStatus;
    } catch (error) {
      logger.error('Erro ao obter status do Ollama API Pool:', error);
      return { 
        enabled: false, 
        mode: 'local',
        message: `Erro ao obter status: ${error.message}`,
        totalEndpoints: 0,
        healthyEndpoints: 0,
        strategy: 'queue_length',
        endpoints: []
      };
    }
  }

  async listModels() {
    const useApiPool = await this.shouldUseApiPool();
    
    if (useApiPool) {
      try {
        return await this.ollamaApiPool.listModels();
      } catch (error) {
        logger.warn('⚠️ Fallback para Ollama local na listagem de modelos');
      }
    }
    
    // Fallback para método direto do Ollama local
    return await this.ollama.list();
  }

  async pullModel(modelName) {
    const useApiPool = await this.shouldUseApiPool();
    
    if (useApiPool) {
      try {
        return await this.ollamaApiPool.pullModel(modelName);
      } catch (error) {
        logger.warn('⚠️ Fallback para Ollama local no pull do modelo');
      }
    }
    
    // Fallback para método direto do Ollama local
    return await this.ollama.pull({ model: modelName });
  }

  async deleteModel(modelName) {
    const useApiPool = await this.shouldUseApiPool();
    
    if (useApiPool) {
      try {
        return await this.ollamaApiPool.deleteModel(modelName);
      } catch (error) {
        logger.warn('⚠️ Fallback para Ollama local na deleção do modelo');
      }
    }
    
    // Fallback para método direto do Ollama local
    return await this.ollama.delete({ model: modelName });
  }

  // Método simplificado para uso direto (usado por RestAPI)
  async chatWithModel(prompt, model = CONFIG.llm.model) {
    try {
      logger.debug(`🤖 LLMService.chatWithModel: ${model}`);
      
      if (await this.shouldUseApiPool()) {
        logger.debug('📡 Usando OllamaAPI pool');
        try {
          const response = await this.ollamaApiPool.chat({
            model,
            messages: [{ role: 'user', content: prompt }]
          });
          return response;
        } catch (apiError) {
          logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback...', apiError.message);
        }
      }
      
      // Fallback para Ollama local
      logger.debug('🏠 Usando Ollama local');
      const response = await this.ollama.chat({
        model,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response;
    } catch (error) {
      logger.error('❌ Erro em chatWithModel:', error);
      throw error;
    }
  }

  // Method for generating text (used by AudioTranscriber)
  async generateText(prompt, temperature = 0.7) {
    try {
      const useApiPool = await this.shouldUseApiPool();
      let response;
      
      const requestParams = {
        model: CONFIG.llm.model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: temperature
        },
        stream: false
      };
      
      if (useApiPool) {
        logger.debug('🔄 Usando Ollama API Pool para geração de texto');
        response = await this.ollamaApiPool.chat(requestParams);
        return response.message.content;
      } else {
        logger.debug('🔄 Usando Ollama local para geração de texto');
        response = await this.ollama.chat(requestParams);
        return response.message.content;
      }
    } catch (error) {
      // Fallback para local se a API falhar
      const usedApiPool = await this.shouldUseApiPool();
      if (usedApiPool) {
        try {
          logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback na geração de texto...');
          const response = await this.ollama.chat({
            model: CONFIG.llm.model,
            messages: [{ role: 'user', content: prompt }],
            options: {
              temperature: temperature
            }
          });
          logger.success('✅ Fallback para Ollama local bem-sucedido na geração de texto');
          return response.message.content;
        } catch (fallbackError) {
          logger.error('❌ Fallback também falhou na geração de texto:', fallbackError.message);
          throw new Error(`API pool failed: ${error.message}. Local fallback failed: ${fallbackError.message}`);
        }
      }
      
      logger.error('Erro ao gerar texto LLM:', error);
      throw error;
    }
  }

  // Method for image analysis (used by WhatsAppBot)
  async generateImageAnalysis(prompt, imagePath) {
    try {
      const useApiPool = await this.shouldUseApiPool();
      let response;
      
      const visionModel = CONFIG.llm.imageModel || CONFIG.llm.visionModel || 'llava';
      
      if (useApiPool) {
        logger.debug('🔄 Usando Ollama API Pool para análise de imagem');
        response = await this.ollamaApiPool.generate({
          model: visionModel,
          prompt: prompt,
          images: [imagePath],
          stream: false
        });
        return response.response.trim();
      } else {
        logger.debug('🔄 Usando Ollama local para análise de imagem');
        response = await this.ollama.generate({
          model: visionModel,
          prompt: prompt,
          images: [imagePath],
          stream: false
        });
        return response.response.trim();
      }
    } catch (error) {
      // Fallback para local se a API falhar
      const usedApiPool = await this.shouldUseApiPool();
      if (usedApiPool) {
        try {
          logger.warn('⚠️ Todos os endpoints API falharam, tentando Ollama local como fallback na análise de imagem...');
          const visionModel = CONFIG.llm.imageModel || CONFIG.llm.visionModel || 'llava';
          const response = await this.ollama.generate({
            model: visionModel,
            prompt: prompt,
            images: [imagePath],
            stream: false
          });
          logger.success('✅ Fallback para Ollama local bem-sucedido na análise de imagem');
          return response.response.trim();
        } catch (fallbackError) {
          logger.error('❌ Fallback também falhou na análise de imagem:', fallbackError.message);
          throw new Error(`API pool failed: ${error.message}. Local fallback failed: ${fallbackError.message}`);
        }
      }
      
      logger.error('Erro ao analisar imagem:', error);
      throw error;
    }
  }

  async onConfigurationChanged() {
    logger.info('🔄 Configuração alterada, reinicializando OllamaAPIPool e carregando último modelo...');
    await this.ollamaApiPool.reinitialize();
    await this.loadLastUsedModel();
  }

  destroy() {
    logger.info('🗑️ Destruindo LLMService...');
    this.ollamaApiPool.destroy();
  }
}

export default LLMService;
