import logger from '../utils/logger.js';

export default class FlowHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleFlowCommand(msg, contactId, text) {
    try {
      const parts = text.split(' ');
      if (parts.length < 2) {
        return await this.sendFlowHelp(contactId);
      }

      const subcommand = parts[1].toLowerCase();
      
      switch (subcommand) {
        case 'start':
          return await this.handleFlowStart(contactId, parts);
        case 'stop':
          return await this.handleFlowStop(contactId);
        case 'sair':
          return await this.handleFlowSair(contactId);
        case 'restart':
          return await this.handleFlowRestart(contactId);
        case 'voltar':
          return await this.handleFlowVoltar(contactId);
        case 'status':
          return await this.handleFlowStatus(contactId);
        case 'list':
        case 'listar':
          return await this.handleFlowList(contactId);
        case 'help':
        case 'ajuda':
          return await this.sendFlowHelp(contactId);
        default:
          await this.whatsAppBot.sendResponse(contactId, `❌ Comando de flow desconhecido: ${subcommand}\n\nUse !flow help para ver os comandos disponíveis.`);
          return true;
      }
    } catch (error) {
      logger.error('❌ Erro ao processar comando de flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar comando de flow.');
      return false;
    }
  }

  async handleFlowStart(contactId, parts) {
    try {
      if (parts.length < 3) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Uso: !flow start <alias_do_flow> [mensagem_inicial]');
        return true;
      }

      const flowAlias = parts[2];
      const initialMessage = parts.slice(3).join(' ') || '';

      // Check if user already has an active flow
      if (await this.whatsAppBot.hasActiveFlow(contactId)) {
        await this.whatsAppBot.sendResponse(contactId, 
          '⚠️ Você já tem um flow ativo. Use !flow stop para parar ou !flow restart para reiniciar.');
        return true;
      }

      return await this.whatsAppBot.startFlow(contactId, flowAlias, initialMessage);
    } catch (error) {
      logger.error('❌ Erro ao iniciar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar flow.');
      return false;
    }
  }

  async handleFlowStop(contactId) {
    try {
      return await this.whatsAppBot.stopFlow(contactId);
    } catch (error) {
      logger.error('❌ Erro ao parar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao parar flow.');
      return false;
    }
  }

  async handleFlowSair(contactId) {
    try {
      // Same as stop flow for now
      return await this.whatsAppBot.stopFlow(contactId);
    } catch (error) {
      logger.error('❌ Erro ao sair do flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao sair do flow.');
      return false;
    }
  }

  async handleFlowRestart(contactId) {
    try {
      // First stop the current flow
      const stopped = await this.whatsAppBot.stopFlow(contactId);
      if (!stopped) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Não foi possível parar o flow atual.');
        return true;
      }

      // Get the last flow alias from session or ask user
      const session = this.whatsAppBot.sessions.get(contactId);
      if (session && session.lastFlowAlias) {
        return await this.whatsAppBot.startFlow(contactId, session.lastFlowAlias);
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ Nenhum flow anterior encontrado. Use !flow start <alias> para iniciar um novo flow.');
        return true;
      }
    } catch (error) {
      logger.error('❌ Erro ao reiniciar flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao reiniciar flow.');
      return false;
    }
  }

  async handleFlowVoltar(contactId) {
    try {
      // This would require flow execution service to handle "back" navigation
      if (!await this.whatsAppBot.hasActiveFlow(contactId)) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Você não tem um flow ativo.');
        return true;
      }

      // For now, just notify that this feature needs implementation
      await this.whatsAppBot.sendResponse(contactId, 
        '🔄 Função "voltar" em desenvolvimento. Use !flow restart para reiniciar o flow.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao voltar no flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao voltar no flow.');
      return false;
    }
  }

  async handleFlowStatus(contactId) {
    try {
      const hasFlow = await this.whatsAppBot.hasActiveFlow(contactId);
      
      if (!hasFlow) {
        await this.whatsAppBot.sendResponse(contactId, '📊 Status: Nenhum flow ativo.');
        return true;
      }

      // Get flow execution status from flow execution service
      const flowService = this.whatsAppBot.flowExecutionService;
      if (flowService) {
        const status = await flowService.getExecutionStatus(contactId);
        if (status) {
          const statusMessage = `📊 *Status do Flow*\n\n` +
            `🎯 Flow: ${status.flowAlias || 'N/A'}\n` +
            `📍 Nó atual: ${status.currentNodeId || 'N/A'}\n` +
            `⏱️ Iniciado em: ${status.startTime ? new Date(status.startTime).toLocaleString('pt-BR') : 'N/A'}\n` +
            `🔄 Última atualização: ${status.lastUpdate ? new Date(status.lastUpdate).toLocaleString('pt-BR') : 'N/A'}`;
          
          await this.whatsAppBot.sendResponse(contactId, statusMessage);
          return true;
        }
      }

      await this.whatsAppBot.sendResponse(contactId, '📊 Flow ativo, mas status detalhado não disponível.');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao obter status do flow:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao obter status do flow.');
      return false;
    }
  }

  async handleFlowList(contactId) {
    try {
      const flowService = this.whatsAppBot.flowExecutionService?.flowService;
      if (!flowService) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Serviço de flows não disponível.');
        return true;
      }

      const flows = await flowService.getAllFlowsWithAliases();
      
      if (!flows || flows.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '📋 Nenhum flow disponível.');
        return true;
      }

      let message = '📋 *Flows Disponíveis*\n\n';
      flows.forEach((flow, index) => {
        const alias = flow.alias || `flow_${flow._id}`;
        const name = flow.name || 'Sem nome';
        const description = flow.description || 'Sem descrição';
        
        message += `${index + 1}. *${alias}*\n`;
        message += `   Nome: ${name}\n`;
        message += `   Descrição: ${description}\n\n`;
      });

      message += '\n💡 Use !flow start <alias> para iniciar um flow.';
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao listar flows:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar flows.');
      return false;
    }
  }

  async sendFlowHelp(contactId) {
    try {
      const helpMessage = `🤖 *Comandos de Flow*\n\n` +
        `!flow start <alias> - Inicia um flow\n` +
        `!flow stop - Para o flow atual\n` +
        `!flow sair - Sai do flow atual\n` +
        `!flow restart - Reinicia o último flow\n` +
        `!flow voltar - Volta um passo (em desenvolvimento)\n` +
        `!flow status - Mostra status do flow atual\n` +
        `!flow list - Lista todos os flows disponíveis\n` +
        `!flow help - Mostra esta ajuda\n\n` +
        `💡 *Exemplos:*\n` +
        `!flow start academia\n` +
        `!flow start jiu-jitsu\n` +
        `!flow list`;

      await this.whatsAppBot.sendResponse(contactId, helpMessage);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao enviar ajuda de flow:', error);
      return false;
    }
  }

  async processFlowMessage(contactId, text) {
    try {
      // Process flow message using flowExecutionService
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.processMessage(contactId, text);
      }
      
      logger.warn('⚠️ FlowExecutionService não disponível');
      return false;
    } catch (error) {
      logger.error('❌ Erro ao processar mensagem de flow:', error);
      return false;
    }
  }

  async hasActiveFlow(contactId) {
    try {
      // Check if flowExecutionService is available and has active flow
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.hasActiveFlow(contactId);
      }
      
      // Fallback: check if user has any flow-related session state
      const session = this.whatsAppBot.sessions?.get(contactId);
      return !!(session && session.activeFlowId);
    } catch (error) {
      logger.error('❌ Erro ao verificar flow ativo:', error);
      return false;
    }
  }

  async startFlow(contactId, flowId, initialMessage = '') {
    try {
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.startFlow(contactId, flowId, initialMessage);
      }
      
      logger.warn('⚠️ FlowExecutionService não disponível');
      await this.whatsAppBot.sendResponse(contactId, '❌ Serviço de flows não está disponível no momento.');
      return false;
    } catch (error) {
      logger.error('❌ Erro ao iniciar flow:', error);
      return false;
    }
  }

  async stopFlow(contactId) {
    try {
      if (this.whatsAppBot.flowExecutionService) {
        return await this.whatsAppBot.flowExecutionService.stopFlow(contactId);
      }
      
      logger.warn('⚠️ FlowExecutionService não disponível');
      await this.whatsAppBot.sendResponse(contactId, '❌ Serviço de flows não está disponível no momento.');
      return false;
    } catch (error) {
      logger.error('❌ Erro ao parar flow:', error);
      return false;
    }
  }
}