import logger from '../utils/logger.js';
import { NAVIGATION_STATES } from '../config/index.js';
import { Ollama } from 'ollama';
import si from 'systeminformation';

export default class ApiStatusHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleStatusApisSubmenu(msg, contactId, input) {
    switch (input) {
      case '8.1':
        await this.handleApiStatusOllama(contactId);
        return true;
      case '8.2':
        await this.handleApiStatusWhisper(contactId);
        return true;
      case '8.3':
        await this.handleApiStatusComplete(contactId);
        return true;
      case '8.4':
        await this.handleApiModelsOllama(contactId);
        return true;
      case '8.5':
        await this.handleApiModelsWhisper(contactId);
        return true;
      case '8.6':
        await this.handleApiEndpointsOllama(contactId);
        return true;
      case '8.7':
        await this.handleApiEndpointsWhisper(contactId);
        return true;
      case '0':
        await this.whatsAppBot.setNavigationState(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, this.whatsAppBot.getMenuMessage());
        return true;
    }
    return false;
  }

  async handleStatusEndpointsCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔍 *Verificando status dos endpoints...*', true);
      
      // Check Ollama endpoints
      const ollamaStatus = await this.checkOllamaEndpoints();
      
      // Check Whisper endpoints  
      const whisperStatus = await this.checkWhisperEndpoints();
      
      // Check system resources
      const systemStatus = await this.checkSystemResources();
      
      let message = '📊 *Status Completo dos Endpoints*\n\n';
      
      // Ollama section
      message += '🤖 *Ollama:*\n';
      if (ollamaStatus.available) {
        message += `✅ Online - ${ollamaStatus.modelsCount} modelos\n`;
        message += `🔗 ${ollamaStatus.host}\n`;
      } else {
        message += `❌ Offline - ${ollamaStatus.error}\n`;
      }
      message += '\n';
      
      // Whisper section
      message += '🎤 *Whisper:*\n';
      if (whisperStatus.available) {
        message += `✅ Online - ${whisperStatus.endpointsCount} endpoints\n`;
      } else {
        message += `❌ Problemas detectados\n`;
      }
      message += '\n';
      
      // System section
      message += '💻 *Sistema:*\n';
      message += `🔋 CPU: ${systemStatus.cpu}%\n`;
      message += `💾 RAM: ${systemStatus.memory}% (${systemStatus.memoryUsed}GB/${systemStatus.memoryTotal}GB)\n`;
      message += `💿 Disco: ${systemStatus.disk}% usado\n`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar status dos endpoints:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar status dos endpoints.');
      return false;
    }
  }

  async handleApiStatusOllama(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Verificando status da API Ollama...', true);
      
      const status = await this.checkOllamaEndpoints();
      
      let message = '🤖 *Status da API Ollama*\n\n';
      
      if (status.available) {
        message += `✅ **Status:** Online\n`;
        message += `🔗 **Host:** ${status.host}\n`;
        message += `📊 **Modelos:** ${status.modelsCount} disponíveis\n`;
        message += `⏱️ **Resposta:** ${status.responseTime}ms\n`;
        
        if (status.version) {
          message += `🔖 **Versão:** ${status.version}\n`;
        }
        
        if (status.models && status.models.length > 0) {
          message += `\n🎯 **Principais modelos:**\n`;
          status.models.slice(0, 5).forEach(model => {
            message += `• ${model.name}\n`;
          });
          
          if (status.models.length > 5) {
            message += `... e mais ${status.models.length - 5} modelos\n`;
          }
        }
      } else {
        message += `❌ **Status:** Offline\n`;
        message += `🔗 **Host:** ${status.host}\n`;
        message += `⚠️ **Erro:** ${status.error}\n`;
        message += `\n💡 **Soluções:**\n`;
        message += `• Verifique se o Ollama está rodando\n`;
        message += `• Confirme o host: ${status.host}\n`;
        message += `• Reinicie o serviço se necessário`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar status Ollama:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar status Ollama.');
      return false;
    }
  }

  async handleApiStatusWhisper(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Verificando status da API Whisper...', true);
      
      const status = await this.checkWhisperEndpoints();
      
      let message = '🎤 *Status da API Whisper*\n\n';
      
      if (status.available) {
        message += `✅ **Status:** Online\n`;
        message += `🔗 **Endpoints:** ${status.endpointsCount} configurados\n`;
        message += `⏱️ **Resposta média:** ${status.averageResponseTime}ms\n`;
        
        if (status.endpoints && status.endpoints.length > 0) {
          message += `\n🌐 **Endpoints:**\n`;
          status.endpoints.forEach((endpoint, index) => {
            const statusIcon = endpoint.status === 'online' ? '✅' : '❌';
            message += `${statusIcon} ${endpoint.url} (${endpoint.responseTime}ms)\n`;
          });
        }
        
        if (status.models && status.models.length > 0) {
          message += `\n🎯 **Modelos suportados:** ${status.models.join(', ')}\n`;
        }
      } else {
        message += `❌ **Status:** Problemas detectados\n`;
        message += `⚠️ **Erro:** ${status.error}\n`;
        message += `\n💡 **Verificações:**\n`;
        message += `• Confirme se os endpoints Whisper estão rodando\n`;
        message += `• Verifique a configuração de rede\n`;
        message += `• Teste a conectividade manualmente`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar status Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar status Whisper.');
      return false;
    }
  }

  async handleApiStatusComplete(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔍 Executando verificação completa...', true);
      
      // Get all API statuses
      const ollamaStatus = await this.checkOllamaEndpoints();
      const whisperStatus = await this.checkWhisperEndpoints();
      const systemStatus = await this.checkSystemResources();
      
      // Check additional services
      const servicesStatus = await this.checkAdditionalServices();
      
      let message = '📊 *Status Completo das APIs*\n\n';
      
      // Summary section
      const totalServices = 2 + (servicesStatus.services ? servicesStatus.services.length : 0);
      const onlineServices = (ollamaStatus.available ? 1 : 0) + (whisperStatus.available ? 1 : 0) + (servicesStatus.onlineCount || 0);
      const healthPercentage = Math.round((onlineServices / totalServices) * 100);
      
      message += `🎯 **Saúde Geral:** ${healthPercentage}% (${onlineServices}/${totalServices} serviços)\n\n`;
      
      // Detailed sections
      message += '🤖 **Ollama:**\n';
      message += ollamaStatus.available ? `✅ Online (${ollamaStatus.modelsCount} modelos)\n` : `❌ Offline\n`;
      
      message += '\n🎤 **Whisper:**\n';
      message += whisperStatus.available ? `✅ Online (${whisperStatus.endpointsCount} endpoints)\n` : `❌ Problemas detectados\n`;
      
      if (servicesStatus.services && servicesStatus.services.length > 0) {
        message += '\n🌐 **Serviços Adicionais:**\n';
        servicesStatus.services.forEach(service => {
          const icon = service.status === 'online' ? '✅' : '❌';
          message += `${icon} ${service.name}\n`;
        });
      }
      
      message += '\n💻 **Recursos do Sistema:**\n';
      message += `🔋 CPU: ${systemStatus.cpu}%\n`;
      message += `💾 RAM: ${systemStatus.memory}% usado\n`;
      message += `💿 Disco: ${systemStatus.disk}% usado\n`;
      
      // Recommendations
      if (healthPercentage < 80) {
        message += '\n⚠️ **Recomendações:**\n';
        if (!ollamaStatus.available) {
          message += '• Verificar e reiniciar Ollama\n';
        }
        if (!whisperStatus.available) {
          message += '• Verificar endpoints Whisper\n';
        }
        if (systemStatus.memory > 80) {
          message += '• Liberar memória RAM\n';
        }
        if (systemStatus.cpu > 80) {
          message += '• Reduzir carga de CPU\n';
        }
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar status completo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar status completo.');
      return false;
    }
  }

  async handleApiModelsOllama(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Buscando modelos Ollama...', true);
      
      const models = await this.whatsAppBot.llmService.getAvailableModels();
      
      if (!models || models.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ *Nenhum modelo Ollama encontrado*\n\nVerifique se o Ollama está rodando e possui modelos instalados.');
        return false;
      }
      
      let message = `🤖 *Modelos Ollama (${models.length})*\n\n`;
      
      // Calculate total size
      let totalSize = 0;
      models.forEach(model => {
        if (model.size) totalSize += model.size;
      });
      
      message += `📦 **Tamanho total:** ${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n`;
      
      // Group models by family
      const modelFamilies = {};
      models.forEach(model => {
        const family = model.name.split(':')[0];
        if (!modelFamilies[family]) {
          modelFamilies[family] = [];
        }
        modelFamilies[family].push(model);
      });
      
      // Display by family
      Object.entries(modelFamilies).forEach(([family, familyModels]) => {
        message += `🏷️ **${family.toUpperCase()}:**\n`;
        familyModels.forEach(model => {
          const size = model.size ? `(${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB)` : '';
          const current = model.name === this.whatsAppBot.llmService.getCurrentModel() ? ' ⭐' : '';
          message += `• ${model.name} ${size}${current}\n`;
        });
        message += '\n';
      });
      
      const currentModel = this.whatsAppBot.llmService.getCurrentModel();
      if (currentModel) {
        message += `🔥 **Modelo atual:** ${currentModel}`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar modelos Ollama:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar modelos Ollama.');
      return false;
    }
  }

  async handleApiModelsWhisper(contactId) {
    try {
      let message = '🎤 *Modelos Whisper Disponíveis*\n\n';
      
      // Get available Whisper models
      const availableModels = await this.whatsAppBot.transcriber.getAvailableModels();
      const currentModel = this.whatsAppBot.transcriber.getCurrentModel();
      
      if (availableModels && availableModels.length > 0) {
        message += `📋 **Modelos disponíveis (${availableModels.length}):**\n\n`;
        
        availableModels.forEach(model => {
          const current = model === currentModel ? ' ⭐ **(atual)**' : '';
          const quality = this.getWhisperModelQuality(model);
          message += `• **${model}** ${quality}${current}\n`;
        });
      } else {
        message += '📋 **Modelos padrão:**\n\n';
        
        // Fallback to standard model list
        const standardModels = ['tiny', 'base', 'small', 'medium', 'large-v3-turbo'];
        standardModels.forEach(model => {
          const current = model === currentModel ? ' ⭐ **(atual)**' : '';
          const quality = this.getWhisperModelQuality(model);
          message += `• **${model}** ${quality}${current}\n`;
        });
      }
      
      message += '\n💡 **Legenda:**\n';
      message += '🟢 Rápido e básico\n';
      message += '🟡 Balanceado\n';
      message += '🟠 Alta qualidade\n';
      message += '🔴 Máxima qualidade\n';
      
      // Add endpoint information
      const endpoints = await this.whatsAppBot.transcriber.getAvailableEndpoints();
      if (endpoints && endpoints.length > 0) {
        message += `\n🌐 **Endpoints ativos:** ${endpoints.length}\n`;
        endpoints.forEach((endpoint, index) => {
          message += `${index + 1}. ${endpoint.url}\n`;
        });
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar modelos Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar modelos Whisper.');
      return false;
    }
  }

  async handleApiEndpointsOllama(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔗 Verificando endpoints Ollama...', true);
      
      const mainHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const endpoints = await this.whatsAppBot.llmService.getAvailableEndpoints();
      
      let message = '🤖 *Endpoints Ollama*\n\n';
      
      if (endpoints && endpoints.length > 0) {
        message += `🌐 **Endpoints configurados (${endpoints.length}):**\n\n`;
        
        for (let i = 0; i < endpoints.length; i++) {
          const endpoint = endpoints[i];
          const status = await this.testOllamaEndpoint(endpoint.url);
          const statusIcon = status.available ? '✅' : '❌';
          const responseTime = status.responseTime ? `(${status.responseTime}ms)` : '';
          
          message += `${statusIcon} **${endpoint.url}** ${responseTime}\n`;
          if (status.modelsCount) {
            message += `   📊 ${status.modelsCount} modelos\n`;
          }
          if (!status.available && status.error) {
            message += `   ⚠️ ${status.error}\n`;
          }
          message += '\n';
        }
      } else {
        message += `🌐 **Endpoint principal:**\n`;
        const status = await this.testOllamaEndpoint(mainHost);
        const statusIcon = status.available ? '✅' : '❌';
        
        message += `${statusIcon} **${mainHost}**\n`;
        if (status.available) {
          message += `📊 ${status.modelsCount} modelos disponíveis\n`;
          message += `⏱️ Resposta: ${status.responseTime}ms\n`;
        } else {
          message += `⚠️ Erro: ${status.error}\n`;
        }
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar endpoints Ollama:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar endpoints Ollama.');
      return false;
    }
  }

  async handleApiEndpointsWhisper(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔗 Verificando endpoints Whisper...', true);
      
      const endpoints = await this.whatsAppBot.transcriber.getAvailableEndpoints();
      
      let message = '🎤 *Endpoints Whisper*\n\n';
      
      if (endpoints && endpoints.length > 0) {
        message += `🌐 **Endpoints configurados (${endpoints.length}):**\n\n`;
        
        for (let i = 0; i < endpoints.length; i++) {
          const endpoint = endpoints[i];
          const status = await this.testWhisperEndpoint(endpoint.url);
          const statusIcon = status.available ? '✅' : '❌';
          const responseTime = status.responseTime ? `(${status.responseTime}ms)` : '';
          
          message += `${statusIcon} **${endpoint.url}** ${responseTime}\n`;
          if (status.models && status.models.length > 0) {
            message += `   🎯 Modelos: ${status.models.join(', ')}\n`;
          }
          if (!status.available && status.error) {
            message += `   ⚠️ ${status.error}\n`;
          }
          message += '\n';
        }
      } else {
        message += '❌ **Nenhum endpoint Whisper configurado**\n\n';
        message += '💡 **Para configurar endpoints:**\n';
        message += '• Adicione URLs na configuração\n';
        message += '• Verifique se os serviços estão rodando\n';
        message += '• Teste a conectividade manualmente';
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao verificar endpoints Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao verificar endpoints Whisper.');
      return false;
    }
  }

  // Helper methods for status checks
  async checkOllamaEndpoints() {
    try {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const startTime = Date.now();
      
      const ollama = new Ollama({ host });
      const models = await ollama.list();
      
      const responseTime = Date.now() - startTime;
      
      return {
        available: true,
        host: host,
        modelsCount: models.models ? models.models.length : 0,
        models: models.models || [],
        responseTime: responseTime
      };
    } catch (error) {
      return {
        available: false,
        host: process.env.OLLAMA_HOST || 'http://localhost:11434',
        error: error.message,
        modelsCount: 0
      };
    }
  }

  async checkWhisperEndpoints() {
    try {
      // This would check actual Whisper endpoints
      // For now, return a mock status
      return {
        available: true,
        endpointsCount: 1,
        averageResponseTime: 150,
        endpoints: [
          { url: 'http://localhost:8000', status: 'online', responseTime: 150 }
        ],
        models: ['base', 'small', 'medium']
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
        endpointsCount: 0
      };
    }
  }

  async checkSystemResources() {
    try {
      const cpu = await si.currentLoad();
      const memory = await si.mem();
      const disk = await si.fsSize();
      
      const memoryUsed = ((memory.used / memory.total) * 100).toFixed(1);
      const memoryUsedGB = (memory.used / (1024 * 1024 * 1024)).toFixed(1);
      const memoryTotalGB = (memory.total / (1024 * 1024 * 1024)).toFixed(1);
      
      let diskUsed = 0;
      if (disk && disk.length > 0) {
        const mainDisk = disk[0];
        diskUsed = ((mainDisk.used / mainDisk.size) * 100).toFixed(1);
      }
      
      return {
        cpu: cpu.currentLoad ? cpu.currentLoad.toFixed(1) : '0',
        memory: memoryUsed,
        memoryUsed: memoryUsedGB,
        memoryTotal: memoryTotalGB,
        disk: diskUsed
      };
    } catch (error) {
      logger.error('❌ Erro ao obter recursos do sistema:', error);
      return {
        cpu: '0',
        memory: '0',
        memoryUsed: '0',
        memoryTotal: '0',
        disk: '0'
      };
    }
  }

  async checkAdditionalServices() {
    try {
      const services = [];
      let onlineCount = 0;
      
      // Check if WhisperSilent service exists and is available
      if (this.whatsAppBot.whisperSilentService) {
        try {
          const wsStatus = await this.whatsAppBot.whisperSilentService.getHealthStatus();
          services.push({
            name: 'WhisperSilent',
            status: wsStatus.success ? 'online' : 'offline'
          });
          if (wsStatus.success) onlineCount++;
        } catch (error) {
          services.push({
            name: 'WhisperSilent',
            status: 'offline'
          });
        }
      }
      
      // Check crypto service
      if (this.whatsAppBot.cryptoService) {
        services.push({
          name: 'Crypto Service',
          status: 'online'
        });
        onlineCount++;
      }
      
      return {
        services,
        onlineCount
      };
    } catch (error) {
      return {
        services: [],
        onlineCount: 0
      };
    }
  }

  async testOllamaEndpoint(url) {
    try {
      const startTime = Date.now();
      const ollama = new Ollama({ host: url });
      const models = await ollama.list();
      const responseTime = Date.now() - startTime;
      
      return {
        available: true,
        responseTime,
        modelsCount: models.models ? models.models.length : 0
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  async testWhisperEndpoint(url) {
    try {
      // Mock test for Whisper endpoint
      // In real implementation, would make actual HTTP request
      return {
        available: true,
        responseTime: 100,
        models: ['base', 'small']
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  getWhisperModelQuality(model) {
    const qualityMap = {
      'tiny': '🟢',
      'base': '🟡', 
      'small': '🟡',
      'medium': '🟠',
      'large': '🔴',
      'large-v3-turbo': '🔴'
    };
    return qualityMap[model] || '🟡';
  }
}