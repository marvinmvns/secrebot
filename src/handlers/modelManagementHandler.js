import logger from '../utils/logger.js';
import { CHAT_MODES, WHISPER_MODELS_LIST } from '../config/index.js';
import { Ollama } from 'ollama';

export default class ModelManagementHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleModelosCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Buscando modelos disponíveis...', true);
      
      const models = await this.whatsAppBot.llmService.getAvailableModels();
      
      if (!models || models.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum modelo encontrado ou erro na conexão com Ollama.');
        return false;
      }
      
      let message = `🤖 *Modelos Disponíveis (${models.length}):*\n\n`;
      models.forEach((model, index) => {
        const size = model.size ? ` (${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB)` : '';
        message += `${index + 1}. **${model.name}**${size}\n`;
        
        if (model.modified_at) {
          const date = new Date(model.modified_at);
          message += `   📅 ${date.toLocaleDateString('pt-BR')}\n`;
        }
        
        message += `\n`;
      });
      
      // Show current model
      const currentModel = this.whatsAppBot.llmService.getCurrentModel();
      if (currentModel) {
        message += `🔥 *Modelo Atual:* ${currentModel}`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar modelos:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao buscar modelos disponíveis.');
      return false;
    }
  }

  async handleTrocarModeloCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Carregando lista de modelos...', true);
      
      const models = await this.whatsAppBot.llmService.getAvailableModels();
      
      if (!models || models.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum modelo encontrado. Verifique se o Ollama está rodando.');
        return false;
      }
      
      // Store models for later use
      this.whatsAppBot.setUserPreference(contactId, 'availableModels', models);
      
      let message = `🔄 *Trocar Modelo LLM*\n\n`;
      message += `📋 *Modelos Disponíveis:*\n\n`;
      
      models.forEach((model, index) => {
        const size = model.size ? ` (${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB)` : '';
        message += `**${index + 1}.** ${model.name}${size}\n`;
      });
      
      const currentModel = this.whatsAppBot.llmService.getCurrentModel();
      if (currentModel) {
        message += `\n🔥 *Atual:* ${currentModel}`;
      }
      
      message += `\n\n💡 *Digite o número do modelo desejado.*`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.TROCAR_MODELO);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar troca de modelo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao carregar modelos.');
      return false;
    }
  }

  async handleModelosWhisperCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 *Modelos Whisper Disponíveis:*\n\n', false);
      
      let message = '';
      WHISPER_MODELS_LIST.forEach((model, index) => {
        const current = model === this.whatsAppBot.transcriber.getCurrentModel() ? ' ⭐ **(atual)**' : '';
        message += `${index + 1}. **${model}**${current}\n`;
      });
      
      message += `\n💡 *Modelos maiores = melhor qualidade, mais lento*`;
      message += `\n⚡ *Modelos menores = menor qualidade, mais rápido*`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar modelos Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar modelos Whisper.');
      return false;
    }
  }

  async handleTrocarModeloWhisperCommand(contactId) {
    try {
      let message = `🎤 *Trocar Modelo Whisper*\n\n`;
      message += `📋 *Modelos Disponíveis:*\n\n`;
      
      WHISPER_MODELS_LIST.forEach((model, index) => {
        const current = model === this.whatsAppBot.transcriber.getCurrentModel() ? ' ⭐ **(atual)**' : '';
        message += `**${index + 1}.** ${model}${current}\n`;
      });
      
      message += `\n💡 *Digite o número do modelo desejado.*`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.TROCAR_MODELO_WHISPER);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar troca de modelo Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao carregar modelos Whisper.');
      return false;
    }
  }

  async handleChooseModelCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🤖 Carregando modelos disponíveis...', true);
      
      const models = await this.whatsAppBot.llmService.getAvailableModels();
      
      if (!models || models.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum modelo disponível. Verifique o Ollama.');
        return false;
      }
      
      // Store models for later use
      this.whatsAppBot.setUserPreference(contactId, 'availableModels', models);
      
      let message = `🎯 *Escolher Modelo Específico*\n\n`;
      message += `Selecione um modelo para usar temporariamente:\n\n`;
      
      models.forEach((model, index) => {
        const size = model.size ? ` (${(model.size / (1024 * 1024 * 1024)).toFixed(1)}GB)` : '';
        message += `**${index + 1}.** ${model.name}${size}\n`;
      });
      
      message += `\n💡 Digite o número do modelo desejado.`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.CHOOSE_SPECIFIC_MODEL);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar modelos para escolha:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao carregar modelos.');
      return false;
    }
  }

  async handleChangeSpecificModelCommand(contactId) {
    try {
      const currentSpecificModel = this.whatsAppBot.getUserPreference(contactId, 'specificModel');
      
      let message = `🎯 *Modelo Específico Atual*\n\n`;
      
      if (currentSpecificModel) {
        message += `🤖 **Modelo:** ${currentSpecificModel}\n\n`;
        message += `✅ *Opções:*\n`;
        message += `1️⃣ **Trocar** - Escolher outro modelo\n`;
        message += `2️⃣ **Remover** - Voltar ao modelo padrão\n`;
        message += `3️⃣ **Manter** - Continuar usando este modelo\n\n`;
        message += `💡 Digite o número da opção desejada.`;
      } else {
        message += `❌ **Nenhum modelo específico configurado**\n\n`;
        message += `🔄 Use !escolhermodelo para definir um modelo específico.`;
      }
      
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.CHANGE_SPECIFIC_MODEL);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar configuração de modelo específico:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao acessar configurações.');
      return false;
    }
  }

  async handleChangeSpecificWhisperEndpointCommand(contactId) {
    try {
      const currentEndpoint = this.whatsAppBot.getUserPreference(contactId, 'specificWhisperEndpoint');
      
      let message = `🎤 *Endpoint Whisper Específico*\n\n`;
      
      if (currentEndpoint) {
        message += `🌐 **Endpoint atual:** ${currentEndpoint}\n\n`;
        message += `✅ *Opções:*\n`;
        message += `1️⃣ **Trocar** - Escolher outro endpoint\n`;
        message += `2️⃣ **Remover** - Voltar ao endpoint padrão\n`;
        message += `3️⃣ **Testar** - Verificar se está funcionando\n`;
        message += `4️⃣ **Manter** - Continuar usando este endpoint\n\n`;
      } else {
        message += `❌ **Nenhum endpoint específico configurado**\n\n`;
        message += `🔄 Use !escolherendpointwhisper para definir um endpoint específico.\n\n`;
        message += `✅ *Opções:*\n`;
        message += `1️⃣ **Configurar** - Definir endpoint específico\n`;
      }
      
      message += `💡 Digite o número da opção desejada.`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.CHANGE_SPECIFIC_WHISPER_ENDPOINT);
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar configuração de endpoint Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao acessar configurações.');
      return false;
    }
  }

  async processTrocarModeloMessage(contactId, text) {
    try {
      const selectedNumber = parseInt(text.trim());
      
      if (isNaN(selectedNumber) || selectedNumber < 1) {
        await this.whatsAppBot.sendResponse(contactId, '❌ *Número inválido!*\n\nPor favor, digite um número válido da lista de modelos.\n\nDigite um número ou "cancelar" para sair.');
        return;
      }
      
      // Get stored models
      const availableModels = this.whatsAppBot.getUserPreference(contactId, 'availableModels', []);
      
      if (availableModels.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ *Lista de modelos não encontrada!*\n\nUse !trocarmodelo novamente para recarregar a lista.');
        await this.whatsAppBot.setMode(contactId, null);
        return;
      }
      
      if (selectedNumber > availableModels.length) {
        await this.whatsAppBot.sendResponse(contactId, `❌ *Número fora do range!*\n\nEscolha um número entre 1 e ${availableModels.length}.\n\nOu digite "cancelar" para sair.`);
        return;
      }
      
      const selectedModel = availableModels[selectedNumber - 1];
      
      await this.whatsAppBot.sendResponse(contactId, `🔄 Trocando para modelo: **${selectedModel.name}**\n\n⏳ Isso pode levar alguns segundos...`, true);
      
      // Change the model
      const success = await this.whatsAppBot.llmService.setModel(selectedModel.name);
      
      if (success) {
        await this.whatsAppBot.sendResponse(contactId, `✅ *Modelo trocado com sucesso!*\n\n🤖 **Novo modelo:** ${selectedModel.name}\n\n💡 Agora suas perguntas usarão este modelo.`);
        
        // Clear stored models
        this.whatsAppBot.setUserPreference(contactId, 'availableModels', []);
        await this.whatsAppBot.setMode(contactId, null);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ *Erro ao trocar modelo!*\n\n🔄 Tente novamente ou escolha outro modelo.\n\nOu digite "cancelar" para sair.`);
      }
    } catch (error) {
      logger.error('❌ Erro ao processar troca de modelo:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao trocar modelo.');
    }
  }

  async processTrocarModeloWhisperMessage(contactId, text) {
    try {
      const selectedNumber = parseInt(text.trim());
      
      if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > WHISPER_MODELS_LIST.length) {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Número inválido!*\n\nEscolha um número entre 1 e ${WHISPER_MODELS_LIST.length}.\n\nOu digite "cancelar" para sair.`);
        return;
      }
      
      const selectedModel = WHISPER_MODELS_LIST[selectedNumber - 1];
      const currentModel = this.whatsAppBot.transcriber.getCurrentModel();
      
      if (selectedModel === currentModel) {
        await this.whatsAppBot.sendResponse(contactId, `ℹ️ *Modelo ${selectedModel} já está em uso.*\n\n🔙 Para voltar ao menu: !menu`);
        await this.whatsAppBot.setMode(contactId, null);
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, `🔄 Trocando para modelo Whisper: **${selectedModel}**\n\n⏳ Preparando modelo...`, true);
      
      // Ensure model is available
      const modelAvailable = await this.ensureWhisperModelAvailable(selectedModel);
      
      if (!modelAvailable) {
        await this.whatsAppBot.sendResponse(contactId, `❌ *Erro ao preparar modelo ${selectedModel}*\n\n🔄 Tente outro modelo ou verifique sua conexão.`);
        return;
      }
      
      // Change the model
      const success = await this.whatsAppBot.transcriber.setModel(selectedModel);
      
      if (success) {
        await this.whatsAppBot.sendResponse(contactId, `✅ *Modelo Whisper trocado!*\n\n🎤 **Novo modelo:** ${selectedModel}\n\n💡 Próximas transcrições usarão este modelo.`);
        await this.whatsAppBot.setMode(contactId, null);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ *Falha ao trocar modelo!*\n\n🔄 Tente novamente ou escolha outro modelo.`);
      }
    } catch (error) {
      logger.error('❌ Erro ao processar troca de modelo Whisper:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao trocar modelo Whisper.');
    }
  }

  async processChooseSpecificModelMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      if (lowerText === 'cancelar' || lowerText === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        this.whatsAppBot.setUserPreference(contactId, 'availableModels', []);
        await this.whatsAppBot.sendResponse(contactId, '❌ Seleção cancelada.');
        return;
      }
      
      const selectedNumber = parseInt(text.trim());
      const availableModels = this.whatsAppBot.getUserPreference(contactId, 'availableModels', []);
      
      if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > availableModels.length) {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ Número inválido! Escolha entre 1 e ${availableModels.length}.\n\nOu digite "cancelar" para sair.`);
        return;
      }
      
      const selectedModel = availableModels[selectedNumber - 1];
      
      await this.whatsAppBot.sendResponse(contactId, `✅ *Modelo selecionado:* ${selectedModel.name}\n\n💬 *Modo Assistente Específico ativado!*\n\nTodas suas próximas mensagens serão processadas com este modelo até você sair.\n\n❌ Digite "!voltar" para sair deste modo.`);
      
      // Set specific model for user
      this.whatsAppBot.setUserPreference(contactId, 'specificModel', selectedModel.name);
      
      // Enter specific model assistant mode
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.ASSISTANT_WITH_SPECIFIC_MODEL);
      
      // Clear stored models
      this.whatsAppBot.setUserPreference(contactId, 'availableModels', []);
      
    } catch (error) {
      logger.error('❌ Erro ao processar escolha de modelo específico:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao selecionar modelo.');
    }
  }

  async processChangeSpecificModelMessage(contactId, text) {
    try {
      const option = text.trim();
      const currentSpecificModel = this.whatsAppBot.getUserPreference(contactId, 'specificModel');
      
      switch(option) {
        case '1':
          // Trocar modelo
          await this.handleChooseModelCommand(contactId);
          break;
          
        case '2':
          // Remover modelo específico
          this.whatsAppBot.setUserPreference(contactId, 'specificModel', null);
          await this.whatsAppBot.sendResponse(contactId, '✅ *Modelo específico removido!*\n\n🔙 Voltando ao modelo padrão.');
          await this.whatsAppBot.setMode(contactId, null);
          break;
          
        case '3':
          // Manter modelo atual
          if (currentSpecificModel) {
            await this.whatsAppBot.sendResponse(contactId, `✅ *Mantendo modelo:* ${currentSpecificModel}\n\n💬 Continue usando normalmente.`);
          } else {
            await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum modelo específico configurado.');
          }
          await this.whatsAppBot.setMode(contactId, null);
          break;
          
        default:
          await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida! Digite 1, 2, 3 ou "cancelar".');
      }
    } catch (error) {
      logger.error('❌ Erro ao processar mudança de modelo específico:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar solicitação.');
    }
  }

  async processAssistantWithSpecificModelMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      if (lowerText === '!voltar' || lowerText === 'sair' || lowerText === 'cancelar') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '✅ *Modo modelo específico desativado.*\n\n🤖 Voltando ao modelo padrão.');
        return;
      }
      
      if (lowerText === '!trocarmodelo') {
        await this.handleChangeSpecificModelCommand(contactId);
        return;
      }
      
      const specificModel = this.whatsAppBot.getUserPreference(contactId, 'specificModel');
      
      if (!specificModel) {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Modelo específico não encontrado. Voltando ao modo normal.');
        return;
      }
      
      // Process message with specific model
      await this.whatsAppBot.sendResponse(contactId, `🤖 Processando com ${specificModel}...`, true);
      
      const response = await this.whatsAppBot.llmService.getAssistantResponse(text, {
        userId: contactId,
        model: specificModel,
        system: `Você está sendo executado especificamente no modelo ${specificModel}. Responda de forma útil e precisa.`
      });
      
      if (response.success) {
        await this.whatsAppBot.sendResponse(contactId, `🤖 *${specificModel}:*\n\n${response.response}`);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ Erro no modelo ${specificModel}: ${response.error}`);
      }
    } catch (error) {
      logger.error('❌ Erro no modo assistente com modelo específico:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar com modelo específico.');
    }
  }

  async ensureWhisperModelAvailable(modelName) {
    try {
      // Test if model is available by attempting a small test
      const testResult = await this.testModel(modelName, false);
      return testResult;
    } catch (error) {
      logger.error(`❌ Erro ao verificar modelo ${modelName}:`, error);
      return false;
    }
  }

  async testModel(modelName, isImageModel = false) {
    try {
      logger.info(`🧪 Testando modelo: ${modelName}`);
      
      const ollama = new Ollama({
        host: process.env.OLLAMA_HOST || 'http://localhost:11434'
      });
      
      const testPrompt = isImageModel ? 'Describe this test image briefly.' : 'Respond with "OK" if you can process this message.';
      
      const response = await ollama.generate({
        model: modelName,
        prompt: testPrompt,
        stream: false,
        options: {
          num_predict: 10
        }
      });
      
      return response && response.response && response.response.length > 0;
    } catch (error) {
      logger.error(`❌ Erro ao testar modelo ${modelName}:`, error);
      return false;
    }
  }

  async unloadModel(modelName) {
    try {
      logger.info(`🗑️ Descarregando modelo: ${modelName}`);
      
      const ollama = new Ollama({
        host: process.env.OLLAMA_HOST || 'http://localhost:11434'
      });
      
      // Ollama doesn't have direct unload, but we can try to free memory
      // by generating an empty response to clear the model from memory
      await ollama.generate({
        model: modelName,
        prompt: '',
        stream: false,
        options: {
          num_predict: 1
        }
      });
      
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao descarregar modelo ${modelName}:`, error);
      return false;
    }
  }
}