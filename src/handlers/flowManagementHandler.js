import logger from '../utils/logger.js';

export default class FlowManagementHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleFlowCommand(msg, contactId, text) {
    try {
      const parts = text.split(' ');
      const command = parts[1]?.toLowerCase();
      
      switch (command) {
        case 'start':
          await this.handleFlowStart(contactId, parts);
          break;
        case 'stop':
          await this.handleFlowStop(contactId);
          break;
        case 'sair':
          await this.handleFlowSair(contactId);
          break;
        case 'restart':
          await this.handleFlowRestart(contactId);
          break;
        case 'voltar':
          await this.handleFlowVoltar(contactId);
          break;
        case 'status':
          await this.handleFlowStatus(contactId);
          break;
        case 'list':
          await this.handleFlowList(contactId);
          break;
        default:
          await this.sendFlowHelp(contactId);
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao processar comando de flow para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar comando de flow.');
      return false;
    }
  }

  async handleFlowStart(contactId, parts) {
    try {
      const flowIdentifier = parts[2];
      
      if (!flowIdentifier) {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Identificador do flow não fornecido*\n\n' +
          '💡 **Uso:** !flow start <alias_ou_id>\n\n' +
          '📋 **Exemplos:**\n' +
          '• !flow start academia\n' +
          '• !flow start 507f1f77bcf86cd799439011\n\n' +
          '📖 Use !flow list para ver flows disponíveis.'
        );
        return;
      }
      
      // Check if user has active flow
      const hasActive = await this.hasActiveFlow(contactId);
      if (hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ *Flow já ativo*\n\n' +
          'Você já possui um flow em execução.\n\n' +
          '🔄 **Opções:**\n' +
          '• !flow stop - Parar flow atual\n' +
          '• !flow restart - Reiniciar flow atual\n' +
          '• !flow status - Ver status do flow'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, `🔄 Iniciando flow: ${flowIdentifier}...`, true);
      
      // Start the flow
      const result = await this.startFlow(contactId, flowIdentifier);
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, 
          `✅ *Flow iniciado com sucesso!*\n\n` +
          `📋 **Flow:** ${result.flowName || flowIdentifier}\n` +
          `🆔 **ID:** ${result.flowId}\n` +
          `🎯 **Status:** Executando\n\n` +
          `💬 Responda às mensagens do flow ou use:\n` +
          `• !flow voltar - Voltar um passo\n` +
          `• !flow stop - Parar flow\n` +
          `• !flow status - Ver status`
        );
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Erro ao iniciar flow*\n\n` +
          `🔍 **Flow:** ${flowIdentifier}\n` +
          `⚠️ **Erro:** ${result.error}\n\n` +
          `💡 **Verificações:**\n` +
          `• Flow existe?\n` +
          `• Alias está correto?\n` +
          `• Use !flow list para ver disponíveis`
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao iniciar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar flow.');
    }
  }

  async handleFlowStop(contactId) {
    try {
      const hasActive = await this.hasActiveFlow(contactId);
      
      if (!hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          'ℹ️ *Nenhum flow ativo*\n\n' +
          'Você não possui flows em execução.\n\n' +
          '🚀 Use !flow start <alias> para iniciar um flow.'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '🛑 Parando flow...', true);
      
      const result = await this.stopFlow(contactId);
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, 
          '✅ *Flow parado com sucesso!*\n\n' +
          '🔄 Use !flow start <alias> para iniciar outro flow.\n' +
          '📖 Use !flow list para ver flows disponíveis.'
        );
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Erro ao parar flow:* ${result.error}\n\n` +
          '🔧 Tente novamente ou reinicie o bot se necessário.'
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao parar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao parar flow.');
    }
  }

  async handleFlowSair(contactId) {
    try {
      // Same as stop but with different messaging
      const hasActive = await this.hasActiveFlow(contactId);
      
      if (!hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          'ℹ️ *Nenhum flow para sair*\n\n' +
          'Você não está em nenhum flow no momento.'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '🚪 Saindo do flow...', true);
      
      const result = await this.stopFlow(contactId);
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, 
          '✅ *Saiu do flow com sucesso!*\n\n' +
          '🔙 Voltou ao menu principal.\n' +
          '📋 Para ver o menu: !menu'
        );
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Erro ao sair do flow:* ${result.error}`
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao sair do flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao sair do flow.');
    }
  }

  async handleFlowRestart(contactId) {
    try {
      const hasActive = await this.hasActiveFlow(contactId);
      
      if (!hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          'ℹ️ *Nenhum flow para reiniciar*\n\n' +
          'Você não possui flows ativos no momento.\n\n' +
          '🚀 Use !flow start <alias> para iniciar um flow.'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '🔄 Reiniciando flow...', true);
      
      // Get current flow info before stopping
      const currentFlowInfo = await this.getCurrentFlowInfo(contactId);
      
      // Stop current flow
      const stopResult = await this.stopFlow(contactId);
      
      if (!stopResult.success) {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Erro ao parar flow atual:* ${stopResult.error}`
        );
        return;
      }
      
      // Start the same flow again
      if (currentFlowInfo && currentFlowInfo.flowId) {
        const startResult = await this.startFlow(contactId, currentFlowInfo.flowId);
        
        if (startResult.success) {
          await this.whatsAppBot.sendResponse(contactId, 
            '✅ *Flow reiniciado com sucesso!*\n\n' +
            `📋 **Flow:** ${currentFlowInfo.flowName || 'Flow'}\n` +
            '🎯 **Status:** Executando do início'
          );
        } else {
          await this.whatsAppBot.sendResponse(contactId, 
            `❌ *Erro ao reiniciar flow:* ${startResult.error}\n\n` +
            '🔧 Tente iniciar manualmente: !flow start <alias>'
          );
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ *Não foi possível obter informações do flow*\n\n' +
          'Flow foi parado, mas não foi possível reiniciar automaticamente.\n' +
          'Use !flow start <alias> para iniciar novamente.'
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao reiniciar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao reiniciar flow.');
    }
  }

  async handleFlowVoltar(contactId) {
    try {
      const hasActive = await this.hasActiveFlow(contactId);
      
      if (!hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          'ℹ️ *Nenhum flow ativo*\n\n' +
          'Você não está em nenhum flow no momento.'
        );
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '⏪ Voltando um passo no flow...', true);
      
      // Go back one step in the flow
      const result = await this.goBackInFlow(contactId);
      
      if (result.success) {
        await this.whatsAppBot.sendResponse(contactId, 
          '✅ *Voltou um passo no flow!*\n\n' +
          `📍 **Passo atual:** ${result.currentStep || 'Anterior'}\n` +
          '💬 Continue respondendo às mensagens do flow.'
        );
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          `❌ *Não foi possível voltar:* ${result.error}\n\n` +
          '💡 Possíveis motivos:\n' +
          '• Já está no primeiro passo\n' +
          '• Flow não suporta voltar\n' +
          '• Erro no flow engine'
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao voltar no flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao voltar no flow.');
    }
  }

  async handleFlowStatus(contactId) {
    try {
      const hasActive = await this.hasActiveFlow(contactId);
      
      if (!hasActive) {
        await this.whatsAppBot.sendResponse(contactId, 
          '📊 *Status dos Flows*\n\n' +
          '🔄 **Status:** Nenhum flow ativo\n' +
          '📋 **Flows disponíveis:** Use !flow list\n' +
          '🚀 **Iniciar flow:** !flow start <alias>'
        );
        return;
      }
      
      const flowInfo = await this.getCurrentFlowInfo(contactId);
      
      let message = '📊 *Status do Flow Ativo*\n\n';
      
      if (flowInfo) {
        message += `📋 **Nome:** ${flowInfo.flowName || 'Flow'}\n`;
        message += `🆔 **ID:** ${flowInfo.flowId}\n`;
        message += `📍 **Passo atual:** ${flowInfo.currentStep || 'N/A'}\n`;
        message += `⏱️ **Iniciado:** ${flowInfo.startTime ? new Date(flowInfo.startTime).toLocaleString('pt-BR') : 'N/A'}\n`;
        message += `🎯 **Status:** ${flowInfo.status || 'Executando'}\n`;
        
        if (flowInfo.variables && Object.keys(flowInfo.variables).length > 0) {
          message += `\n📝 **Variáveis ativas:**\n`;
          Object.entries(flowInfo.variables).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 50 
              ? value.substring(0, 50) + '...' 
              : value;
            message += `• ${key}: ${displayValue}\n`;
          });
        }
        
        message += `\n🔧 **Comandos disponíveis:**\n`;
        message += `• !flow voltar - Voltar um passo\n`;
        message += `• !flow restart - Reiniciar do início\n`;
        message += `• !flow stop - Parar flow\n`;
        message += `• !flow sair - Sair do flow`;
      } else {
        message += `⚠️ **Erro:** Não foi possível obter detalhes do flow\n`;
        message += `🔧 **Ações:**\n`;
        message += `• !flow stop - Tentar parar\n`;
        message += `• !flow restart - Tentar reiniciar`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, message);
    } catch (error) {
      logger.error('❌ Erro ao obter status do flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao obter status do flow.');
    }
  }

  async handleFlowList(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '📋 Carregando flows disponíveis...', true);
      
      const flows = await this.getAvailableFlows();
      
      if (!flows || flows.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, 
          '📋 *Nenhum flow disponível*\n\n' +
          '💡 **Possíveis motivos:**\n' +
          '• Nenhum flow foi criado ainda\n' +
          '• Flows não estão públicos\n' +
          '• Erro na conexão com banco de dados\n\n' +
          '🌐 **Criar flows:** Acesse /flow-builder'
        );
        return;
      }
      
      let message = `📋 *Flows Disponíveis (${flows.length})*\n\n`;
      
      // Group flows by category if available
      const categories = {};
      flows.forEach(flow => {
        const category = flow.category || 'Geral';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(flow);
      });
      
      Object.entries(categories).forEach(([category, categoryFlows]) => {
        message += `🏷️ **${category}:**\n`;
        
        categoryFlows.forEach(flow => {
          const status = flow.isActive ? '🟢' : '⚪';
          const alias = flow.alias ? ` (${flow.alias})` : '';
          
          message += `${status} **${flow.name}**${alias}\n`;
          
          if (flow.description) {
            const desc = flow.description.length > 60 
              ? flow.description.substring(0, 60) + '...' 
              : flow.description;
            message += `   💬 ${desc}\n`;
          }
          
          message += `   🚀 !flow start ${flow.alias || flow._id}\n\n`;
        });
      });
      
      message += `💡 **Como usar:**\n`;
      message += `• !flow start <alias> - Iniciar flow\n`;
      message += `• !flow status - Ver status atual\n`;
      message += `🌐 **Criar/Editar:** /flow-builder`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
    } catch (error) {
      logger.error('❌ Erro ao listar flows:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar flows.');
    }
  }

  async sendFlowHelp(contactId) {
    try {
      let message = '🤖 *Ajuda - Sistema de Flows*\n\n';
      
      message += '📋 **Comandos disponíveis:**\n\n';
      
      message += '🚀 **!flow start <alias>**\n';
      message += '   Iniciar um flow específico\n';
      message += '   Exemplo: !flow start academia\n\n';
      
      message += '🛑 **!flow stop**\n';
      message += '   Parar o flow atual\n\n';
      
      message += '🚪 **!flow sair**\n';
      message += '   Sair do flow atual\n\n';
      
      message += '🔄 **!flow restart**\n';
      message += '   Reiniciar o flow atual do início\n\n';
      
      message += '⏪ **!flow voltar**\n';
      message += '   Voltar um passo no flow\n\n';
      
      message += '📊 **!flow status**\n';
      message += '   Ver status do flow atual\n\n';
      
      message += '📋 **!flow list**\n';
      message += '   Listar flows disponíveis\n\n';
      
      message += '💡 **Dicas:**\n';
      message += '• Use aliases para facilitar (!flow start academia)\n';
      message += '• Flows executam passo a passo\n';
      message += '• Responda às perguntas para avançar\n';
      message += '• Um flow por usuário por vez\n\n';
      
      message += '🌐 **Criar flows:** Acesse /flow-builder';
      
      await this.whatsAppBot.sendResponse(contactId, message);
    } catch (error) {
      logger.error('❌ Erro ao enviar ajuda de flows:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao enviar ajuda.');
    }
  }

  // Helper methods that delegate to whatsAppBot or flowExecutionService
  async hasActiveFlow(contactId) {
    return await this.whatsAppBot.hasActiveFlow(contactId);
  }

  async startFlow(contactId, flowId, initialMessage = '') {
    return await this.whatsAppBot.startFlow(contactId, flowId, initialMessage);
  }

  async stopFlow(contactId) {
    return await this.whatsAppBot.stopFlow(contactId);
  }

  async processFlowMessage(contactId, text) {
    return await this.whatsAppBot.processFlowMessage(contactId, text);
  }

  async getCurrentFlowInfo(contactId) {
    try {
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.getCurrentFlowInfo(contactId);
      }
      return null;
    } catch (error) {
      logger.error('❌ Erro ao obter informações do flow atual:', error);
      return null;
    }
  }

  async goBackInFlow(contactId) {
    try {
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.goBack(contactId);
      }
      return {
        success: false,
        error: 'Serviço de execução de flows não disponível'
      };
    } catch (error) {
      logger.error('❌ Erro ao voltar no flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getAvailableFlows() {
    try {
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.getAvailableFlows();
      }
      return [];
    } catch (error) {
      logger.error('❌ Erro ao obter flows disponíveis:', error);
      return [];
    }
  }
}