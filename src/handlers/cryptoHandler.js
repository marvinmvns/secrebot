import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class CryptoHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleCryptoCommand(contactId, originalText) {
    try {
      // Extract crypto subcommand
      const parts = originalText.toLowerCase().split(' ');
      if (parts.length < 2) {
        await this.whatsAppBot.sendErrorMessage(contactId, 'Comando crypto incompleto. Use !crypto quotes, !crypto config, etc.');
        return true;
      }

      const subcommand = parts[1];
      logger.info(`💰 Comando crypto: ${subcommand} de ${contactId}`);

      switch (subcommand) {
        case 'quotes':
        case 'cotações':
        case 'precos':
        case 'preços':
          return await this.handleCryptoQuotes(contactId);
        
        case 'start':
        case 'iniciar':
          return await this.handleCryptoStartMonitoring(contactId);
        
        case 'stop':
        case 'parar':
          return await this.handleCryptoStopMonitoring(contactId);
        
        case 'status':
          return await this.handleCryptoStatus(contactId);
        
        case 'config':
        case 'configurar':
          return await this.handleCryptoConfig(contactId, originalText);
        
        case 'preferences':
        case 'preferências':
          return await this.handleCryptoPreferences(contactId);
        
        case 'list':
        case 'listar':
          return await this.handleCryptoListCoins(contactId);
        
        case 'select':
        case 'selecionar':
          return await this.handleCryptoSelectCoins(contactId);
        
        case 'pause':
        case 'pausar':
        case 'resume':
        case 'continuar':
          return await this.handleCryptoPauseResume(contactId);
        
        case 'technical':
        case 'técnica':
        case 'análise':
          return await this.handleCryptoTechnicalAnalysis(contactId);
        
        case 'compare':
        case 'comparar':
          return await this.handleCryptoComparePerformance(contactId);
        
        case 'health':
        case 'saúde':
        case 'sistema':
          return await this.handleCryptoSystemHealth(contactId);
        
        case 'debug':
          return await this.handleCryptoDebugStatus(contactId);
        
        case 'simulate':
        case 'simular':
          return await this.handleCryptoSimulateAlert(contactId);
        
        case 'force':
        case 'forçar':
          return await this.handleCryptoForceCheck(contactId);
        
        case 'llm':
        case 'ia':
          return await this.handleCryptoLLMAnalysis(contactId);
        
        case 'trade':
        case 'trading':
          return await this.handleCryptoAutoTrading(contactId);
        
        case 'ml':
        case 'machine':
          return await this.handleCryptoMLSubmenu(contactId);
        
        case 'help':
        case 'ajuda':
          return await this.sendCryptoHelp(contactId);
        
        default:
          await this.whatsAppBot.sendErrorMessage(contactId, `Comando crypto desconhecido: ${subcommand}\n\nUse !crypto help para ver os comandos disponíveis.`);
          return true;
      }
    } catch (error) {
      logger.error('❌ Erro ao processar comando crypto:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar comando crypto.');
      return false;
    }
  }

  async handleCryptoSubmenu(msg, contactId, input) {
    switch (input) {
      case '9.1':
        await this.handleCryptoQuotes(contactId);
        return true;
      case '9.2':
        await this.handleCryptoStartMonitoring(contactId);
        return true;
      case '9.3':
        await this.handleCryptoStopMonitoring(contactId);
        return true;
      case '9.4':
        await this.handleCryptoStatus(contactId);
        return true;
      case '9.5':
        await this.handleCryptoConfig(contactId);
        return true;
      case '9.6':
        await this.handleCryptoPreferences(contactId);
        return true;
      case '9.7':
        await this.handleCryptoListCoins(contactId);
        return true;
      case '9.8':
        await this.handleCryptoSelectCoins(contactId);
        return true;
      case '9.9':
        await this.handleCryptoMLSubmenu(contactId);
        return true;
      case '9.10':
        await this.handleCryptoTechnicalAnalysis(contactId);
        return true;
      case '9.11':
        await this.handleCryptoComparePerformance(contactId);
        return true;
      case '9.12':
        await this.handleCryptoSystemHealth(contactId);
        return true;
      case '9.13':
        await this.handleCryptoDebugStatus(contactId);
        return true;
      case '9.14':
        await this.handleCryptoSimulateAlert(contactId);
        return true;
      case '9.15':
        await this.handleCryptoForceCheck(contactId);
        return true;
      case '9.16':
        await this.handleCryptoLLMAnalysis(contactId);
        return true;
      case '9.17':
        await this.handleCryptoAutoTrading(contactId);
        return true;
      case '9.9.1':
        await this.handleCryptoMLTrain(contactId);
        return true;
      case '9.9.2':
        await this.handleCryptoMLPredict(contactId);
        return true;
      case '9.9.3':
        await this.handleCryptoMLStatus(contactId);
        return true;
      case '0':
        await this.whatsAppBot.setNavigationState(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, this.whatsAppBot.getMenuMessage());
        return true;
    }
    return false;
  }

  async sendCryptoHelp(contactId) {
    try {
      const helpMessage = `💰 *Comandos Crypto*\n\n` +
        `!crypto quotes - Ver cotações atuais\n` +
        `!crypto start - Iniciar monitoramento\n` +
        `!crypto stop - Parar monitoramento\n` +
        `!crypto status - Status do sistema\n` +
        `!crypto config - Configurações\n` +
        `!crypto preferences - Preferências\n` +
        `!crypto list - Listar moedas\n` +
        `!crypto select - Selecionar moedas\n` +
        `!crypto technical - Análise técnica\n` +
        `!crypto compare - Comparar performance\n` +
        `!crypto health - Saúde do sistema\n` +
        `!crypto llm - Análise com IA\n` +
        `!crypto trade - Trading automático\n` +
        `!crypto ml - Machine Learning\n` +
        `!crypto help - Esta ajuda\n\n` +
        `💡 *Exemplos:*\n` +
        `!crypto quotes\n` +
        `!crypto config btc 50000\n` +
        `!crypto technical btc`;

      await this.whatsAppBot.sendResponse(contactId, helpMessage);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao enviar ajuda crypto:', error);
      return false;
    }
  }

  // Crypto methods moved from whatsAppBot
  async handleCryptoQuotes(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '📊 Buscando cotações atuais...', true);
      
      // Get user preferences first
      const userPreferences = await this.whatsAppBot.cryptoService.getUserPreferences(contactId);
      let coins = null;
      
      if (userPreferences && userPreferences.coins && userPreferences.coins.length > 0) {
        coins = userPreferences.coins;
      }
      
      const prices = await this.whatsAppBot.cryptoService.getCurrentPrices(coins);
      const formattedMessage = this.whatsAppBot.cryptoService.formatPrices(prices);
      
      // Add user preference info
      let finalMessage = formattedMessage;
      if (coins) {
        finalMessage += `\n\n🎯 _Mostrando suas ${coins.length} moedas favoritas_\n`;
        finalMessage += `💡 Use 9.6 para ver/alterar preferências`;
      } else {
        finalMessage += `\n\n💡 _Mostrando moedas padrão (Bitcoin/Ethereum)_\n`;
        finalMessage += `🎯 Use 9.8 para selecionar suas moedas favoritas`;
      }
      
      await this.whatsAppBot.sendResponse(contactId, finalMessage);
    } catch (error) {
      logger.error(`Erro ao buscar cotações crypto para ${contactId}:`, error);
      await this.whatsAppBot.sendResponse(contactId, `❌ Erro ao obter cotações: ${error.message}\n\n💡 Tente novamente em alguns minutos.`);
    }
  }

  async handleCryptoStartMonitoring(contactId) {
    try {
      const status = this.whatsAppBot.cryptoService.getMonitoringStatus(contactId);
      
      if (status.active) {
        const config = status.config;
        await this.whatsAppBot.sendResponse(contactId, `🔔 *Monitoramento já ativo!*\n\n📊 Configuração atual:\n🎯 Threshold: ${config.thresholdPercentage || 1.0}%\n⏱️ Timeframe: ${config.timeframe || '1m'}\n📈 Alta: ${config.alertOnRise ? '✅' : '❌'}\n📉 Queda: ${config.alertOnFall ? '✅' : '❌'}\n\n💡 Use 9.3 para desativar, 9.4 para status ou 9.5 para configurar.`);
        return;
      }

      // Carregar preferências personalizadas do usuário
      const userPrefs = await this.whatsAppBot.cryptoService.getUserPreferences(contactId);
      
      const config = this.whatsAppBot.cryptoService.activateMonitoring(contactId, {
        thresholdPercentage: userPrefs.settings?.thresholdPercentage || 1.0,
        notifications: userPrefs.settings?.notifications !== false,
        alertOnRise: userPrefs.settings?.alertOnRise !== false,
        alertOnFall: userPrefs.settings?.alertOnFall !== false,
        coins: userPrefs.coins || ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'matic-network']
      });

      // Buscar nomes das moedas para exibição
      const top20 = this.whatsAppBot.cryptoService.top20Cryptos;
      const coinNames = config.coins.map(coinId => {
        const coin = top20.find(c => c.id === coinId);
        return coin ? `${coin.symbol} (${coin.name})` : coinId.toUpperCase();
      }).join('\n• ');

      await this.whatsAppBot.sendResponse(contactId, `🔔 *Monitoramento ativado!*\n\n✅ Suas configurações:\n🎯 Threshold: ${config.thresholdPercentage}%\n⏱️ Timeframe: ${config.timeframe}\n📈 Alertar alta: ${config.alertOnRise ? '✅' : '❌'}\n📉 Alertar queda: ${config.alertOnFall ? '✅' : '❌'}\n⏰ Cooldown: ${config.cooldownMinutes} min\n\n🪙 *Suas moedas (${config.coins.length}):*\n• ${coinNames}\n\n💡 Use 9.5 para personalizar ou 9.7 para escolher outras moedas`);
      
      logger.info(`Monitoramento crypto ativado para ${contactId}`);
    } catch (error) {
      logger.error(`Erro ao ativar monitoramento crypto para ${contactId}:`, error);
      await this.whatsAppBot.sendResponse(contactId, `❌ Erro ao ativar monitoramento: ${error.message}`);
    }
  }

  async handleCryptoStopMonitoring(contactId) {
    return await this.whatsAppBot.handleCryptoStopMonitoring(contactId);
  }

  async handleCryptoStatus(contactId) {
    return await this.whatsAppBot.handleCryptoStatus(contactId);
  }

  async handleCryptoConfig(contactId, originalText = '') {
    return await this.whatsAppBot.handleCryptoConfig(contactId, originalText);
  }

  async handleCryptoPreferences(contactId) {
    return await this.whatsAppBot.handleCryptoPreferences(contactId);
  }

  async handleCryptoListCoins(contactId) {
    return await this.whatsAppBot.handleCryptoListCoins(contactId);
  }

  async handleCryptoSelectCoins(contactId) {
    return await this.whatsAppBot.handleCryptoSelectCoins(contactId);
  }

  async handleCryptoPauseResume(contactId) {
    return await this.whatsAppBot.handleCryptoPauseResume(contactId);
  }

  async handleCryptoTechnicalAnalysis(contactId) {
    return await this.whatsAppBot.handleCryptoTechnicalAnalysis(contactId);
  }

  async handleCryptoComparePerformance(contactId) {
    return await this.whatsAppBot.handleCryptoComparePerformance(contactId);
  }

  async handleCryptoSystemHealth(contactId) {
    return await this.whatsAppBot.handleCryptoSystemHealth(contactId);
  }

  async handleCryptoDebugStatus(contactId) {
    return await this.whatsAppBot.handleCryptoDebugStatus(contactId);
  }

  async handleCryptoSimulateAlert(contactId) {
    return await this.whatsAppBot.handleCryptoSimulateAlert(contactId);
  }

  async handleCryptoForceCheck(contactId) {
    return await this.whatsAppBot.handleCryptoForceCheck(contactId);
  }

  async handleCryptoLLMAnalysis(contactId) {
    return await this.whatsAppBot.handleCryptoLLMAnalysis(contactId);
  }

  async handleCryptoAutoTrading(contactId) {
    return await this.whatsAppBot.handleCryptoAutoTrading(contactId);
  }

  async handleCryptoMLSubmenu(contactId) {
    return await this.whatsAppBot.handleCryptoMLSubmenu(contactId);
  }

  async handleCryptoMLTrain(contactId) {
    return await this.whatsAppBot.handleCryptoMLTrain(contactId);
  }

  async handleCryptoMLPredict(contactId) {
    return await this.whatsAppBot.handleCryptoMLPredict(contactId);
  }

  async handleCryptoMLStatus(contactId) {
    return await this.whatsAppBot.handleCryptoMLStatus(contactId);
  }

  async handleCryptoMLTraining(contactId, messageBody) {
    return await this.whatsAppBot.handleCryptoMLTraining(contactId, messageBody);
  }

  async handleCryptoMLModelSelection(contactId, messageBody) {
    return await this.whatsAppBot.handleCryptoMLModelSelection(contactId, messageBody);
  }

  // Chat mode processing for crypto-specific modes
  async processCryptoCoinSelectionMessage(contactId, text) {
    return await this.whatsAppBot.processCryptoCoinSelectionMessage(contactId, text);
  }

  async handleCryptoLLMAnalysisMode(contactId, messageBody) {
    return await this.whatsAppBot.handleCryptoLLMAnalysisMode(contactId, messageBody);
  }

  async handleCryptoTechnicalAnalysisInput(contactId, text) {
    return await this.whatsAppBot.handleCryptoTechnicalAnalysisInput(contactId, text);
  }
}