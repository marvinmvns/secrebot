import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class EndpointHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleChooseWhisperEndpointCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Buscando endpoints Whisper disponíveis...', true);
      
      const endpoints = await this.getAvailableWhisperEndpoints();
      
      if (!endpoints || endpoints.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum endpoint Whisper disponível.\n\nVerifique a configuração dos endpoints.');
        return false;
      }
      
      // Store endpoints for later use
      this.whatsAppBot.setUserPreference(contactId, 'availableWhisperEndpoints', endpoints);
      
      let message = `🎤 *Escolher Endpoint Whisper*\n\n`;
      message += `📋 *Endpoints Disponíveis:*\n\n`;
      
      endpoints.forEach((endpoint, index) => {
        const status = endpoint.status === 'online' ? '✅' : '❌';
        const responseTime = endpoint.responseTime ? `(${endpoint.responseTime}ms)` : '';
        message += `**${index + 1}.** ${status} ${endpoint.url} ${responseTime}\n`;
        if (endpoint.models && endpoint.models.length > 0) {
          message += `   🎯 Modelos: ${endpoint.models.join(', ')}\n`;
        }
      });
      
      const currentEndpoint = this.whatsAppBot.getUserPreference(contactId, 'specificWhisperEndpoint');
      if (currentEndpoint) {
        message += `\n🔥 **Atual:** ${currentEndpoint}`;
      }
      
      message += `\n\n💡 Digite o número do endpoint desejado.`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.CHOOSE_SPECIFIC_WHISPER_ENDPOINT);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar endpoints Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao carregar endpoints Whisper.');
      return false;
    }
  }

  async processChooseSpecificWhisperEndpointMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      if (lowerText === 'cancelar' || lowerText === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        this.whatsAppBot.setUserPreference(contactId, 'availableWhisperEndpoints', []);
        await this.whatsAppBot.sendResponse(contactId, '❌ Seleção cancelada.');
        return;
      }
      
      const selectedNumber = parseInt(text.trim());
      const availableEndpoints = this.whatsAppBot.getUserPreference(contactId, 'availableWhisperEndpoints', []);
      
      if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > availableEndpoints.length) {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ Número inválido! Escolha entre 1 e ${availableEndpoints.length}.\n\nOu digite "cancelar" para sair.`);
        return;
      }
      
      const selectedEndpoint = availableEndpoints[selectedNumber - 1];
      
      if (selectedEndpoint.status !== 'online') {
        await this.whatsAppBot.sendResponse(contactId, 
          `⚠️ **Endpoint offline:** ${selectedEndpoint.url}\n\n` +
          `Deseja continuar mesmo assim?\n\n` +
          `✅ Digite "sim" para confirmar\n` +
          `❌ Digite "não" para cancelar`);
        
        this.whatsAppBot.setUserPreference(contactId, 'pendingEndpoint', selectedEndpoint);
        await this.whatsAppBot.setMode(contactId, 'CONFIRM_OFFLINE_ENDPOINT');
        return;
      }
      
      await this.selectWhisperEndpoint(contactId, selectedEndpoint);
      
    } catch (error) {
      logger.error('❌ Erro ao processar seleção de endpoint:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao selecionar endpoint.');
    }
  }

  async processChangeSpecificWhisperEndpointMessage(contactId, text) {
    try {
      const option = text.trim();
      const currentEndpoint = this.whatsAppBot.getUserPreference(contactId, 'specificWhisperEndpoint');
      
      switch(option) {
        case '1':
          // Configurar novo endpoint
          await this.handleChooseWhisperEndpointCommand(contactId);
          break;
          
        case '2':
          // Remover endpoint específico
          this.whatsAppBot.setUserPreference(contactId, 'specificWhisperEndpoint', null);
          await this.whatsAppBot.sendResponse(contactId, '✅ *Endpoint específico removido!*\n\n🔙 Voltando ao endpoint padrão.');
          await this.whatsAppBot.setMode(contactId, null);
          break;
          
        case '3':
          // Testar endpoint atual
          if (currentEndpoint) {
            await this.testWhisperEndpoint(contactId, currentEndpoint);
          } else {
            await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum endpoint específico configurado.');
          }
          await this.whatsAppBot.setMode(contactId, null);
          break;
          
        case '4':
          // Manter endpoint atual
          if (currentEndpoint) {
            await this.whatsAppBot.sendResponse(contactId, `✅ *Mantendo endpoint:* ${currentEndpoint}\n\n💬 Continue usando normalmente.`);
          } else {
            await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum endpoint específico configurado.');
          }
          await this.whatsAppBot.setMode(contactId, null);
          break;
          
        default:
          await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida! Digite 1, 2, 3, 4 ou "cancelar".');
      }
    } catch (error) {
      logger.error('❌ Erro ao processar mudança de endpoint:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar solicitação.');
    }
  }

  async processTranscribeWithSpecificEndpointMessage(contactId, msg) {
    try {
      if (!msg.hasMedia) {
        await this.whatsAppBot.sendResponse(contactId, '🎤 Por favor, envie um áudio para transcrever.\n\n❌ Digite "cancelar" para sair.');
        return;
      }
      
      const specificEndpoint = this.whatsAppBot.getUserPreference(contactId, 'specificWhisperEndpoint');
      
      if (!specificEndpoint) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Endpoint específico não configurado.\n\nUse !escolherendpointwhisper primeiro.');
        await this.whatsAppBot.setMode(contactId, null);
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, `🎤 Transcrevendo com endpoint específico...\n🌐 ${specificEndpoint}`, true);
      
      // Use specific endpoint for transcription
      const result = await this.transcribeWithSpecificEndpoint(msg, { url: specificEndpoint });
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, `📝 *Transcrição:*\n\n${result.text}\n\n🌐 *Endpoint:* ${specificEndpoint}`);
        await this.whatsAppBot.sendResponse(contactId, '✅ Transcrição concluída!\n\n🔙 Para voltar ao menu: !menu');
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ Erro na transcrição: ${result.error}\n\n🔄 Tente novamente ou mude o endpoint.`);
      }
      
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro na transcrição com endpoint específico:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao transcrever com endpoint específico.');
    }
  }

  async selectWhisperEndpoint(contactId, endpoint) {
    try {
      await this.whatsAppBot.sendResponse(contactId, `✅ *Endpoint selecionado:* ${endpoint.url}\n\n💬 *Modo Transcrição Específica ativado!*\n\nEnvie áudios para transcrever com este endpoint.\n\n❌ Digite "!voltar" para sair deste modo.`);
      
      // Set specific endpoint for user
      this.whatsAppBot.setUserPreference(contactId, 'specificWhisperEndpoint', endpoint.url);
      
      // Enter specific endpoint transcription mode
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.TRANSCRIBE_WITH_SPECIFIC_ENDPOINT);
      
      // Clear stored endpoints
      this.whatsAppBot.setUserPreference(contactId, 'availableWhisperEndpoints', []);
      
    } catch (error) {
      logger.error('❌ Erro ao selecionar endpoint:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao configurar endpoint.');
    }
  }

  async transcribeWithSpecificEndpoint(msg, endpointInfo) {
    try {
      // Download the audio data from the message
      const media = await msg.downloadMedia();
      if (!media || !media.data) {
        return {
          success: false,
          error: 'Não foi possível baixar o áudio.'
        };
      }
      
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(media.data, 'base64');
      
      // Use the specific endpoint for transcription
      const result = await this.whatsAppBot.transcriber.transcribe(audioBuffer, 'ogg', msg.from, {
        endpoint: endpointInfo.url,
        preferredEndpoint: endpointInfo.url
      });
      
      return {
        success: true,
        text: result
      };
    } catch (error) {
      logger.error('❌ Erro na transcrição com endpoint específico:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testWhisperEndpoint(contactId, endpointUrl) {
    try {
      await this.whatsAppBot.sendResponse(contactId, `🧪 Testando endpoint: ${endpointUrl}`, true);
      
      // Test endpoint connectivity
      const testResult = await this.pingWhisperEndpoint(endpointUrl);
      
      if (testResult.success) {
        let message = `✅ *Endpoint funcionando!*\n\n`;
        message += `🌐 **URL:** ${endpointUrl}\n`;
        message += `⏱️ **Resposta:** ${testResult.responseTime}ms\n`;
        
        if (testResult.models && testResult.models.length > 0) {
          message += `🎯 **Modelos:** ${testResult.models.join(', ')}\n`;
        }
        
        if (testResult.version) {
          message += `🔖 **Versão:** ${testResult.version}`;
        }
        
        await this.whatsAppBot.sendResponse(contactId, message);
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Endpoint offline ou com problemas*\n\n` +
          `🌐 **URL:** ${endpointUrl}\n` +
          `⚠️ **Erro:** ${testResult.error}\n\n` +
          `💡 **Verificações:**\n` +
          `• Endpoint está rodando?\n` +
          `• URL está correta?\n` +
          `• Há conectividade de rede?`
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao testar endpoint:', error);
      await this.whatsAppBot.sendResponse(contactId, 
        `❌ *Erro no teste*\n\n` +
        `Não foi possível testar o endpoint: ${endpointUrl}\n\n` +
        `Erro: ${error.message}`
      );
    }
  }

  async pingWhisperEndpoint(url) {
    try {
      const startTime = Date.now();
      
      // Simple ping to check if endpoint is alive
      // In real implementation, would make actual HTTP request to Whisper API
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        timeout: 5000
      }).catch(() => ({ ok: false, status: 0 }));
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          success: true,
          responseTime,
          models: ['base', 'small', 'medium'], // Mock models
          version: '1.0.0' // Mock version
        };
      } else {
        return {
          success: false,
          error: `HTTP ${response.status}`,
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAvailableEndpoints() {
    try {
      // Get all configured endpoints (Ollama + Whisper)
      const ollamaEndpoints = await this.getOllamaEndpoints();
      const whisperEndpoints = await this.getAvailableWhisperEndpoints();
      
      return {
        ollama: ollamaEndpoints,
        whisper: whisperEndpoints,
        total: ollamaEndpoints.length + whisperEndpoints.length
      };
    } catch (error) {
      logger.error('❌ Erro ao obter endpoints disponíveis:', error);
      return {
        ollama: [],
        whisper: [],
        total: 0
      };
    }
  }

  async getAvailableWhisperEndpoints() {
    try {
      // Get configured Whisper endpoints
      const endpoints = this.whatsAppBot.transcriber?.getAvailableEndpoints() || [];
      
      // Test each endpoint for status
      const testedEndpoints = [];
      
      for (const endpoint of endpoints) {
        const test = await this.pingWhisperEndpoint(endpoint.url);
        testedEndpoints.push({
          url: endpoint.url,
          status: test.success ? 'online' : 'offline',
          responseTime: test.responseTime || 0,
          models: test.models || [],
          version: test.version || null,
          error: test.error || null
        });
      }
      
      return testedEndpoints;
    } catch (error) {
      logger.error('❌ Erro ao obter endpoints Whisper:', error);
      return [];
    }
  }

  async getOllamaEndpoints() {
    try {
      // Get configured Ollama endpoints
      const mainHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      
      // For now, return main endpoint
      // In full implementation, would support multiple Ollama endpoints
      return [
        {
          url: mainHost,
          type: 'ollama',
          status: 'unknown'
        }
      ];
    } catch (error) {
      logger.error('❌ Erro ao obter endpoints Ollama:', error);
      return [];
    }
  }

  async handleListarEndpointsWhisperCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Listando endpoints Whisper...', true);
      
      const endpoints = await this.getAvailableWhisperEndpoints();
      
      if (!endpoints || endpoints.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ *Nenhum endpoint Whisper configurado*\n\nConfigurações necessárias:\n• Adicionar URLs na configuração\n• Verificar conectividade');
        return false;
      }
      
      let message = `🎤 *Endpoints Whisper (${endpoints.length})*\n\n`;
      
      endpoints.forEach((endpoint, index) => {
        const statusIcon = endpoint.status === 'online' ? '✅' : '❌';
        const responseTime = endpoint.responseTime ? `(${endpoint.responseTime}ms)` : '';
        
        message += `${statusIcon} **${index + 1}. ${endpoint.url}** ${responseTime}\n`;
        
        if (endpoint.models && endpoint.models.length > 0) {
          message += `   🎯 Modelos: ${endpoint.models.join(', ')}\n`;
        }
        
        if (endpoint.status === 'offline' && endpoint.error) {
          message += `   ⚠️ Erro: ${endpoint.error}\n`;
        }
        
        message += '\n';
      });
      
      // Show current endpoint
      const currentEndpoint = this.whatsAppBot.getUserPreference(contactId, 'specificWhisperEndpoint');
      if (currentEndpoint) {
        message += `🔥 **Endpoint específico ativo:** ${currentEndpoint}`;
      } else {
        message += `🔄 **Usando:** Balanceamento automático`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar endpoints Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar endpoints Whisper.');
      return false;
    }
  }

  async handleListarEndpointsOllamaCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Listando endpoints Ollama...', true);
      
      const endpoints = await this.getOllamaEndpoints();
      
      let message = `🤖 *Endpoints Ollama (${endpoints.length})*\n\n`;
      
      for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        
        // Test endpoint
        const test = await this.whatsAppBot.apiStatusHandler.testOllamaEndpoint(endpoint.url);
        const statusIcon = test.available ? '✅' : '❌';
        const responseTime = test.responseTime ? `(${test.responseTime}ms)` : '';
        
        message += `${statusIcon} **${i + 1}. ${endpoint.url}** ${responseTime}\n`;
        
        if (test.available && test.modelsCount) {
          message += `   📊 ${test.modelsCount} modelos disponíveis\n`;
        }
        
        if (!test.available && test.error) {
          message += `   ⚠️ Erro: ${test.error}\n`;
        }
        
        message += '\n';
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar endpoints Ollama:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar endpoints Ollama.');
      return false;
    }
  }

  async handleReiniciarWhisperCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔄 Reiniciando serviços Whisper...', true);
      
      // Restart Whisper services
      if (this.whatsAppBot.transcriber?.restart) {
        const result = await this.whatsAppBot.transcriber.restart();
        
        if (result.success) {
          await this.whatsAppBot.sendResponse(contactId, '✅ *Serviços Whisper reiniciados com sucesso!*\n\n🎤 Transcrições já podem ser utilizadas normalmente.');
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ *Erro ao reiniciar:* ${result.error}\n\n🔧 Verifique os logs e configurações.`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, '⚠️ *Reinicialização não disponível*\n\nEsta funcionalidade requer configuração específica do transcriber.');
      }
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao reiniciar Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao reiniciar serviços Whisper.');
      return false;
    }
  }
}