import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Serviço para monitoramento de criptomoedas
 * Integra com APIs gratuitas para obter cotações de Bitcoin e Ethereum
 */
class CryptoService {
  constructor() {
    // Histórico de preços para tracking de variações
    this.priceHistory = new Map(); // {coin: [{price, timestamp}]}
    this.activeMonitoring = new Map(); // {userId: {active, coins, threshold}}
    this.monitoringInterval = null;
    this.lastPrices = new Map(); // {coin: price}
    
    // URLs das APIs (usando APIs gratuitas sem necessidade de chave)
    this.apiUrls = {
      coinGecko: 'https://api.coingecko.com/api/v3/simple/price',
      binance: 'https://api.binance.com/api/v3/ticker/price'
    };
    
    // Configurações globais padrão
    this.config = {
      checkInterval: 60000, // 1 minuto
      historyLimit: 100, // Manter últimas 100 leituras
      defaultThreshold: 1.0, // 1% de variação para alertar
      maxRetries: 3,
      // Novos parâmetros parametrizáveis
      defaultMonitoringConfig: {
        thresholdPercentage: 1.0, // % de oscilação para alertar (padrão 1%)
        checkIntervalMinutes: 1, // Intervalo de verificação em minutos
        timeframe: '1m', // Timeframe para comparação: '1m', '5m', '15m', '1h'
        coins: ['bitcoin', 'ethereum'], // Moedas para monitorar
        notifications: true, // Enviar notificações
        alertOnRise: true, // Alertar em alta
        alertOnFall: true, // Alertar em queda
        minThreshold: 0.1, // Threshold mínimo (0.1%)
        maxThreshold: 50.0, // Threshold máximo (50%)
        cooldownMinutes: 15 // Tempo entre alertas da mesma moeda para o mesmo usuário
      }
    };
    
    // Cache de alertas para cooldown
    this.alertCooldown = new Map(); // {userId-coin: timestamp}
  }

  /**
   * Obtém cotação atual do Bitcoin e Ethereum
   */
  async getCurrentPrices() {
    try {
      // Tentar CoinGecko primeiro (mais confiável)
      try {
        const response = await axios.get(`${this.apiUrls.coinGecko}?ids=bitcoin,ethereum&vs_currencies=usd,brl`, {
          timeout: 5000
        });
        
        const data = response.data;
        return {
          bitcoin: {
            usd: data.bitcoin.usd,
            brl: data.bitcoin.brl,
            source: 'CoinGecko'
          },
          ethereum: {
            usd: data.ethereum.usd,
            brl: data.ethereum.brl,
            source: 'CoinGecko'
          },
          timestamp: new Date().toISOString()
        };
      } catch (coinGeckoError) {
        logger.warn('CoinGecko API falhou, tentando Binance...', coinGeckoError.message);
        
        // Fallback para Binance
        const [btcResponse, ethResponse] = await Promise.all([
          axios.get(`${this.apiUrls.binance}?symbol=BTCUSDT`, { timeout: 5000 }),
          axios.get(`${this.apiUrls.binance}?symbol=ETHUSDT`, { timeout: 5000 })
        ]);
        
        // Conversão aproximada USD para BRL (seria melhor buscar taxa de câmbio real)
        const usdToBrl = 5.20; // Taxa aproximada, pode ser melhorada
        
        return {
          bitcoin: {
            usd: parseFloat(btcResponse.data.price),
            brl: parseFloat(btcResponse.data.price) * usdToBrl,
            source: 'Binance'
          },
          ethereum: {
            usd: parseFloat(ethResponse.data.price),
            brl: parseFloat(ethResponse.data.price) * usdToBrl,
            source: 'Binance'
          },
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Erro ao obter cotações de criptomoedas:', error);
      throw new Error('Não foi possível obter as cotações. APIs indisponíveis.');
    }
  }

  /**
   * Formata preços para exibição
   */
  formatPrices(prices) {
    const formatCurrency = (value, currency) => {
      if (currency === 'brl') {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(value);
      } else {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      }
    };

    const formatChange = (currentPrice, previousPrice) => {
      if (!previousPrice) return '';
      
      const change = ((currentPrice - previousPrice) / previousPrice) * 100;
      const arrow = change >= 0 ? '📈' : '📉';
      const sign = change >= 0 ? '+' : '';
      return `${arrow} ${sign}${change.toFixed(2)}%`;
    };

    const btcPrevious = this.lastPrices.get('bitcoin');
    const ethPrevious = this.lastPrices.get('ethereum');

    return `₿ *COTAÇÕES DE CRIPTOMOEDAS* 💰

📊 *Bitcoin (BTC)*
💵 USD: ${formatCurrency(prices.bitcoin.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.bitcoin.brl, 'brl')}
${formatChange(prices.bitcoin.usd, btcPrevious)}

📊 *Ethereum (ETH)*
💵 USD: ${formatCurrency(prices.ethereum.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.ethereum.brl, 'brl')}
${formatChange(prices.ethereum.usd, ethPrevious)}

🕐 *Atualizado:* ${new Date(prices.timestamp).toLocaleString('pt-BR')}
📡 *Fonte:* ${prices.bitcoin.source}

💡 _Use 9.2 para ativar alertas automáticos_`;
  }

  /**
   * Armazena preço no histórico
   */
  storePriceHistory(coin, price) {
    if (!this.priceHistory.has(coin)) {
      this.priceHistory.set(coin, []);
    }
    
    const history = this.priceHistory.get(coin);
    history.push({
      price: price,
      timestamp: new Date().toISOString()
    });
    
    // Manter apenas os últimos registros
    if (history.length > this.config.historyLimit) {
      history.shift();
    }
    
    this.priceHistory.set(coin, history);
  }

  /**
   * Calcula variação percentual com timeframe parametrizável
   */
  calculateVariation(coin, timeframe = '1m') {
    return this.calculateVariationWithTimeframe(coin, timeframe);
  }
  
  /**
   * Calcula variação percentual com suporte a diferentes timeframes
   */
  calculateVariationWithTimeframe(coin, timeframe = '1m') {
    const history = this.priceHistory.get(coin);
    if (!history || history.length < 2) return null;
    
    const current = history[history.length - 1];
    let compareIndex = this.getCompareIndexForTimeframe(history, timeframe);
    
    if (compareIndex === -1) {
      // Fallback to previous entry if timeframe not available
      compareIndex = history.length - 2;
    }
    
    const previous = history[compareIndex];
    if (!previous) return null;
    
    const variation = ((current.price - previous.price) / previous.price) * 100;
    
    return {
      current: current.price,
      previous: previous.price,
      variation: variation,
      timestamp: current.timestamp,
      timeframe: timeframe,
      dataPoints: history.length - 1 - compareIndex
    };
  }
  
  /**
   * Determina o índice de comparação baseado no timeframe
   */
  getCompareIndexForTimeframe(history, timeframe) {
    const timeframes = {
      '1m': 1,   // 1 minuto atrás
      '5m': 5,   // 5 minutos atrás
      '15m': 15, // 15 minutos atrás
      '1h': 60   // 1 hora atrás
    };
    
    const minutesBack = timeframes[timeframe] || 1;
    const targetIndex = history.length - 1 - minutesBack;
    
    // Retornar índice válido ou -1 se não houver dados suficientes
    return targetIndex >= 0 ? targetIndex : -1;
  }

  /**
   * Ativa monitoramento para um usuário com configurações parametrizáveis
   */
  activateMonitoring(userId, options = {}) {
    const defaultConfig = this.config.defaultMonitoringConfig;
    
    const config = {
      active: true,
      // Parâmetros de oscilação
      thresholdPercentage: this.validateThreshold(options.thresholdPercentage || defaultConfig.thresholdPercentage),
      checkIntervalMinutes: options.checkIntervalMinutes || defaultConfig.checkIntervalMinutes,
      timeframe: options.timeframe || defaultConfig.timeframe,
      
      // Moedas e notificações
      coins: options.coins || defaultConfig.coins,
      notifications: options.notifications !== false,
      
      // Configurações de alerta
      alertOnRise: options.alertOnRise !== false,
      alertOnFall: options.alertOnFall !== false,
      cooldownMinutes: options.cooldownMinutes || defaultConfig.cooldownMinutes,
      
      // Metadados
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };
    
    this.activeMonitoring.set(userId, config);
    
    // Iniciar monitoramento global se não estiver ativo
    if (!this.monitoringInterval) {
      this.startGlobalMonitoring();
    }
    
    logger.info(`Monitoramento de crypto ativado para usuário ${userId} com threshold ${config.thresholdPercentage}%`);
    return config;
  }

  /**
   * Desativa monitoramento para um usuário
   */
  deactivateMonitoring(userId) {
    this.activeMonitoring.delete(userId);
    
    // Se não há mais usuários monitorando, parar monitoramento global
    if (this.activeMonitoring.size === 0 && this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Monitoramento global de crypto pausado (nenhum usuário ativo)');
    }
    
    logger.info(`Monitoramento de crypto desativado para usuário ${userId}`);
    return true;
  }

  /**
   * Verifica status do monitoramento para um usuário
   */
  getMonitoringStatus(userId) {
    const config = this.activeMonitoring.get(userId);
    
    return {
      active: !!config,
      config: config || null,
      totalUsers: this.activeMonitoring.size,
      isGlobalActive: !!this.monitoringInterval
    };
  }

  /**
   * Inicia monitoramento global
   */
  startGlobalMonitoring() {
    logger.info('Iniciando monitoramento global de criptomoedas...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkPriceChanges();
        
        // Limpeza periódica do cache de cooldown
        if (Math.random() < 0.1) { // 10% de chance a cada verificação
          this.cleanupCooldownCache();
        }
      } catch (error) {
        logger.error('Erro no monitoramento de crypto:', error);
      }
    }, this.config.checkInterval);
  }

  /**
   * Verifica mudanças de preço e envia notificações com parâmetros personalizados
   */
  async checkPriceChanges() {
    try {
      const currentPrices = await this.getCurrentPrices();
      
      // Armazenar histórico
      this.storePriceHistory('bitcoin', currentPrices.bitcoin.usd);
      this.storePriceHistory('ethereum', currentPrices.ethereum.usd);
      
      // Verificar variações significativas para cada usuário
      for (const [userId, config] of this.activeMonitoring.entries()) {
        if (!config.active || !config.notifications) continue;
        
        for (const coin of config.coins) {
          const variation = this.calculateVariationWithTimeframe(coin, config.timeframe);
          
          if (variation && this.shouldSendAlert(userId, coin, variation, config)) {
            this.sendVariationAlert(userId, coin, variation, currentPrices, config);
          }
        }
      }
      
      // Atualizar últimos preços
      this.lastPrices.set('bitcoin', currentPrices.bitcoin.usd);
      this.lastPrices.set('ethereum', currentPrices.ethereum.usd);
      
    } catch (error) {
      logger.error('Erro ao verificar mudanças de preço:', error);
    }
  }

  /**
   * Verifica se deve enviar alerta baseado nas configurações do usuário
   */
  shouldSendAlert(userId, coin, variation, config) {
    // Verificar threshold
    if (Math.abs(variation.variation) < config.thresholdPercentage) {
      return false;
    }
    
    // Verificar direção do alerta
    if (variation.variation > 0 && !config.alertOnRise) {
      return false;
    }
    if (variation.variation < 0 && !config.alertOnFall) {
      return false;
    }
    
    // Verificar cooldown
    const cooldownKey = `${userId}-${coin}`;
    const lastAlert = this.alertCooldown.get(cooldownKey);
    if (lastAlert) {
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastAlert < cooldownMs) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Envia alerta de variação com configurações personalizadas
   */
  sendVariationAlert(userId, coin, variation, currentPrices, config) {
    const coinNames = {
      bitcoin: 'Bitcoin (BTC)',
      ethereum: 'Ethereum (ETH)'
    };
    
    const arrow = variation.variation >= 0 ? '📈' : '📉';
    const trend = variation.variation >= 0 ? 'SUBIU' : 'CAIU';
    const sign = variation.variation >= 0 ? '+' : '';
    
    const coinData = currentPrices[coin];
    const formattedPrice = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(coinData.usd);
    
    const alertMessage = `${arrow} *ALERTA CRYPTO* ${arrow}

💰 *${coinNames[coin]}* ${trend} *${sign}${variation.variation.toFixed(2)}%*

💵 *Preço atual:* ${formattedPrice}
📊 *Variação (${variation.timeframe}):* ${sign}${variation.variation.toFixed(2)}%
⚡ *Threshold:* ${config.thresholdPercentage}%
🕐 *Horário:* ${new Date().toLocaleString('pt-BR')}

💡 _Use 9.3 para desativar alertas ou 9.5 para configurar threshold_`;

    // Armazenar para ser enviado pelo WhatsApp bot
    this.pendingAlerts = this.pendingAlerts || [];
    this.pendingAlerts.push({
      userId,
      message: alertMessage,
      timestamp: new Date().toISOString(),
      coin,
      variation: variation.variation,
      threshold: config.thresholdPercentage
    });
    
    // Registrar cooldown
    const cooldownKey = `${userId}-${coin}`;
    this.alertCooldown.set(cooldownKey, Date.now());
    
    logger.info(`Alerta de variação ${coin} (${variation.variation.toFixed(2)}%, threshold ${config.thresholdPercentage}%) para usuário ${userId}`);
  }

  /**
   * Valida threshold de acordo com os limites
   */
  validateThreshold(threshold) {
    const min = this.config.defaultMonitoringConfig.minThreshold;
    const max = this.config.defaultMonitoringConfig.maxThreshold;
    
    if (threshold < min) return min;
    if (threshold > max) return max;
    return threshold;
  }
  
  /**
   * Atualiza configurações de monitoramento para um usuário
   */
  updateMonitoringConfig(userId, updates = {}) {
    const currentConfig = this.activeMonitoring.get(userId);
    if (!currentConfig) {
      throw new Error('Usuário não possui monitoramento ativo');
    }
    
    const updatedConfig = {
      ...currentConfig,
      ...updates,
      lastModified: new Date().toISOString()
    };
    
    // Validar threshold se fornecido
    if (updates.thresholdPercentage !== undefined) {
      updatedConfig.thresholdPercentage = this.validateThreshold(updates.thresholdPercentage);
    }
    
    this.activeMonitoring.set(userId, updatedConfig);
    
    logger.info(`Configurações de monitoramento atualizadas para usuário ${userId}`);
    return updatedConfig;
  }
  
  /**
   * Obtém configurações detalhadas de um usuário
   */
  getUserConfig(userId) {
    const config = this.activeMonitoring.get(userId);
    if (!config) return null;
    
    return {
      ...config,
      availableTimeframes: ['1m', '5m', '15m', '1h'],
      availableCoins: ['bitcoin', 'ethereum'],
      thresholdLimits: {
        min: this.config.defaultMonitoringConfig.minThreshold,
        max: this.config.defaultMonitoringConfig.maxThreshold
      }
    };
  }
  
  /**
   * Obtém alertas pendentes e limpa a lista
   */
  getPendingAlerts() {
    const alerts = this.pendingAlerts || [];
    this.pendingAlerts = [];
    return alerts;
  }
  
  /**
   * Limpa cache de cooldown antigo (mais de 24h)
   */
  cleanupCooldownCache() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [key, timestamp] of this.alertCooldown.entries()) {
      if (timestamp < oneDayAgo) {
        this.alertCooldown.delete(key);
      }
    }
  }
}

export default CryptoService;