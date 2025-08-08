import axios from 'axios';
import { MongoClient } from 'mongodb';
import { CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Serviço para monitoramento de criptomoedas
 * Integra com APIs gratuitas para obter cotações de Bitcoin e Ethereum
 */
class CryptoService {
  constructor(llmService) {
    this.llmService = llmService;
    // Histórico de preços para tracking de variações
    this.priceHistory = new Map(); // {coin: [{price, timestamp}]}
    this.activeMonitoring = new Map(); // {userId: {active, coins, threshold}}
    this.monitoringInterval = null;
    this.lastPrices = new Map(); // {coin: price}
    
    // MongoDB connection
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
    
    // Initialize MongoDB connection asynchronously
    this.initializeMongoDB().catch(error => {
      logger.error('Failed to initialize CryptoService MongoDB during construction:', error.message);
    });
    
    // URLs das APIs para fallbacks múltiplos (20+ fontes)
    this.apiUrls = {
      // APIs principais gratuitas
      coinGecko: 'https://api.coingecko.com/api/v3/simple/price',
      binance: 'https://api.binance.com/api/v3/ticker/price',
      cryptocompare: 'https://min-api.cryptocompare.com/data/price',
      exchangeRate: 'https://api.exchangerate-api.com/v4/latest/USD',
      
      // APIs alternativas para fallback 
      coinbase: 'https://api.coinbase.com/v2/exchange-rates',
      kraken: 'https://api.kraken.com/0/public/Ticker',
      huobi: 'https://api.huobi.pro/market/detail/merged',
      kucoin: 'https://api.kucoin.com/api/v1/market/orderbook/level1',
      gate: 'https://api.gateio.ws/api/v4/spot/tickers',
      okx: 'https://www.okx.com/api/v5/market/ticker',
      bitfinex: 'https://api-pub.bitfinex.com/v2/tickers',
      mexc: 'https://api.mexc.com/api/v3/ticker/price',
      bybit: 'https://api.bybit.com/v2/public/tickers',
      htx: 'https://api.htx.com/market/detail/merged',
      
      // Agregadores de preços
      coinapi: 'https://rest.coinapi.io/v1/exchangerate',
      nomics: 'https://api.nomics.com/v1/currencies/ticker',
      messari: 'https://data.messari.io/api/v1/assets',
      coinlore: 'https://api.coinlore.net/api/ticker/',
      coinstats: 'https://api.coin-stats.com/v2/coins',
      livecoinwatch: 'https://api.livecoinwatch.com/coins/single',
      
      // APIs regionais/locais
      mercadobitcoin: 'https://www.mercadobitcoin.net/api',
      foxbit: 'https://api.foxbit.com.br/rest/v1/ticker',
      bitcointrade: 'https://api.bitcointrade.com.br/v2/public/ticker',
      novadax: 'https://api.novadax.com/v1/market/ticker',
      braziliex: 'https://braziliex.com/api/v1/public/ticker',
      
      // Backup estático local para emergências
      static: 'local-fallback'
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
        coins: ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'polygon'], // Moedas para monitorar
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
    
    // Lista das 20 criptomoedas mais atrativas (baseada em market cap, volume e interesse)
    this.top20Cryptos = [
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', rank: 1, category: 'Store of Value' },
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', rank: 2, category: 'Smart Contracts' },
      { id: 'tether', name: 'Tether', symbol: 'USDT', rank: 3, category: 'Stablecoin' },
      { id: 'binancecoin', name: 'BNB', symbol: 'BNB', rank: 4, category: 'Exchange Token' },
      { id: 'solana', name: 'Solana', symbol: 'SOL', rank: 5, category: 'Smart Contracts' },
      { id: 'usd-coin', name: 'USDC', symbol: 'USDC', rank: 6, category: 'Stablecoin' },
      { id: 'ripple', name: 'XRP', symbol: 'XRP', rank: 7, category: 'Payments' },
      { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', rank: 8, category: 'Meme' },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA', rank: 9, category: 'Smart Contracts' },
      { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX', rank: 10, category: 'Smart Contracts' },
      { id: 'tron', name: 'TRON', symbol: 'TRX', rank: 11, category: 'Smart Contracts' },
      { id: 'chainlink', name: 'Chainlink', symbol: 'LINK', rank: 12, category: 'Oracle' },
      { id: 'matic-network', name: 'Polygon', symbol: 'MATIC', rank: 13, category: 'Layer 2' },
      { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', rank: 14, category: 'Interoperability' },
      { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', rank: 15, category: 'Payments' },
      { id: 'shiba-inu', name: 'Shiba Inu', symbol: 'SHIB', rank: 16, category: 'Meme' },
      { id: 'wrapped-bitcoin', name: 'Wrapped Bitcoin', symbol: 'WBTC', rank: 17, category: 'Wrapped' },
      { id: 'uniswap', name: 'Uniswap', symbol: 'UNI', rank: 18, category: 'DeFi' },
      { id: 'bitcoin-cash', name: 'Bitcoin Cash', symbol: 'BCH', rank: 19, category: 'Payments' },
      { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR', rank: 20, category: 'Smart Contracts' }
    ];
    
    // Preferências de usuários (cache em memória + MongoDB)
    this.userPreferences = new Map(); // {userId: {coins: [], settings: {}}}
    this.userPrefsCollection = null;
  }

  /**
   * Inicializa conexão MongoDB para persistência de configurações
   */
  async initializeMongoDB() {
    try {
      this.client = new MongoClient(CONFIG.mongo.uri);
      await this.client.connect();
      this.db = this.client.db(CONFIG.mongo.database);
      this.collection = this.db.collection('crypto_monitoring');
      this.userPrefsCollection = this.db.collection('crypto_user_prefs');
      this.isConnected = true;
      
      logger.info('✅ CryptoService MongoDB connection established');
      
      // Load existing monitoring configurations
      await this.loadMonitoringConfigs();
      
    } catch (error) {
      logger.error('❌ Failed to initialize CryptoService MongoDB:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Carrega configurações de monitoramento do MongoDB
   */
  async loadMonitoringConfigs() {
    if (!this.isConnected) return;

    try {
      const configs = await this.collection.find({ active: true }).toArray();
      
      for (const config of configs) {
        const { userId, ...monitoringConfig } = config;
        this.activeMonitoring.set(userId, monitoringConfig);
        logger.info(`📊 Loaded crypto monitoring config for user: ${userId}`);
      }
      
      logger.info(`✅ Loaded ${configs.length} crypto monitoring configurations from database`);
      
    } catch (error) {
      logger.error('❌ Failed to load monitoring configs:', error.message);
    }
  }

  /**
   * Salva configuração de monitoramento no MongoDB
   */
  async saveMonitoringConfig(userId, config) {
    if (!this.isConnected) return;

    try {
      await this.collection.replaceOne(
        { userId },
        { userId, ...config },
        { upsert: true }
      );
      
      logger.info(`💾 Saved crypto monitoring config for user: ${userId}`);
      
    } catch (error) {
      logger.error(`❌ Failed to save monitoring config for ${userId}:`, error.message);
    }
  }

  /**
   * Remove configuração de monitoramento do MongoDB
   */
  async deleteMonitoringConfig(userId) {
    if (!this.isConnected) return;

    try {
      await this.collection.deleteOne({ userId });
      logger.info(`🗑️ Deleted crypto monitoring config for user: ${userId}`);
      
    } catch (error) {
      logger.error(`❌ Failed to delete monitoring config for ${userId}:`, error.message);
    }
  }

  /**
   * Conecta ao MongoDB para armazenar histórico
   */
  async connect() {
    if (this.isConnected) return;

    try {
      this.client = new MongoClient(CONFIG.mongo.uri);
      await this.client.connect();
      this.db = this.client.db(CONFIG.mongo.database);
      this.collection = this.db.collection('crypto_history');
      this.userPrefsCollection = this.db.collection('crypto_user_preferences');
      this.isConnected = true;
      
      // Criar índices para otimizar consultas
      await this.collection.createIndex({ symbol: 1, timestamp: -1 });
      await this.collection.createIndex({ timestamp: -1 });
      await this.userPrefsCollection.createIndex({ userId: 1 }, { unique: true });
      
      logger.info('✅ CryptoService conectado ao MongoDB');
    } catch (error) {
      logger.error('❌ Erro ao conectar CryptoService ao MongoDB:', error);
    }
  }

  /**
   * Desconecta do MongoDB
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('🔌 CryptoService desconectado do MongoDB');
    }
  }

  /**
   * Salva histórico de preços no MongoDB
   */
  async savePriceHistoryToDB(cryptoData) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    if (!this.isConnected) return;
    
    try {
      const timestamp = new Date();
      const documents = [];
      
      Object.entries(cryptoData).forEach(([coin, data]) => {
        const doc = {
          symbol: coin.toUpperCase(),
          name: coin.charAt(0).toUpperCase() + coin.slice(1),
          coinId: coin,
          timestamp: timestamp,
          prices: {
            usd: data.usd,
            brl: data.brl
          },
          source: data.source || 'API',
          metadata: {
            savedAt: timestamp,
            version: '1.0'
          }
        };
        
        documents.push(doc);
      });
      
      const result = await this.collection.insertMany(documents);
      logger.debug(`💾 Salvos ${result.insertedCount} registros no histórico MongoDB`);
      
      return result;
    } catch (error) {
      logger.error('❌ Erro ao salvar histórico no MongoDB:', error);
    }
  }

  /**
   * Obtém dados históricos do MongoDB
   */
  async getHistoricalDataFromDB(symbol, days = 7) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    if (!this.isConnected) return [];
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const pipeline = [
        {
          $match: {
            symbol: symbol.toUpperCase(),
            timestamp: { $gte: startDate }
          }
        },
        {
          $sort: { timestamp: 1 }
        },
        {
          $project: {
            timestamp: 1,
            'prices.usd': 1,
            'prices.brl': 1
          }
        }
      ];
      
      const data = await this.collection.aggregate(pipeline).toArray();
      return data;
    } catch (error) {
      logger.error('❌ Erro ao buscar histórico do MongoDB:', error);
      return [];
    }
  }

  /**
   * Obtém análise comparativa baseada em dados históricos
   */
  async getComparisonAnalysis(symbol, days = 30) {
    const historicalData = await this.getHistoricalDataFromDB(symbol, days);
    
    if (historicalData.length < 2) {
      return { 
        analysis: 'Dados históricos insuficientes para análise comparativa',
        trend: 'unknown',
        dataPoints: historicalData.length
      };
    }
    
    const oldest = historicalData[0];
    const newest = historicalData[historicalData.length - 1];
    
    const priceChange = newest.prices.usd - oldest.prices.usd;
    const priceChangePercent = (priceChange / oldest.prices.usd) * 100;
    
    const trend = priceChangePercent > 5 ? 'bullish' : 
                 priceChangePercent < -5 ? 'bearish' : 'neutral';
    
    // Calcular média móvel dos últimos 7 dias
    const recent7Days = historicalData.slice(-7);
    const avg7Days = recent7Days.reduce((sum, item) => sum + item.prices.usd, 0) / recent7Days.length;
    
    // Volatilidade baseada no desvio padrão
    const prices = historicalData.map(item => item.prices.usd);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice * 100;
    
    return {
      analysis: {
        periodDays: days,
        dataPoints: historicalData.length,
        startPrice: oldest.prices.usd,
        endPrice: newest.prices.usd,
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        trend: trend,
        avg7Days: avg7Days,
        isAboveAvg: newest.prices.usd > avg7Days,
        volatility: volatility,
        startDate: oldest.timestamp,
        endDate: newest.timestamp
      },
      historicalData: historicalData
    };
  }

  /**
   * Obtém taxa de câmbio USD para BRL em tempo real
   */
  async getUsdToBrlRate() {
    try {
      const response = await axios.get(this.apiUrls.exchangeRate, { timeout: 3000 });
      return response.data.rates?.BRL || 5.20; // Fallback para 5.20 se não conseguir
    } catch (error) {
      logger.warn('⚠️ Erro ao obter taxa USD->BRL, usando fallback:', error.message);
      return 5.20; // Taxa aproximada de fallback
    }
  }

  /**
   * Fallback usando CryptoCompare API
   */
  async getCryptoPricesFromCryptoCompare() {
    try {
      const usdToBrl = await this.getUsdToBrlRate();
      
      const coins = ['BTC', 'ETH', 'ADA', 'DOT', 'MATIC'];
      const results = {};
      
      for (const coin of coins) {
        try {
          const response = await axios.get(`${this.apiUrls.cryptocompare}?fsym=${coin}&tsyms=USD`, {
            timeout: 3000
          });
          
          const usdPrice = response.data.USD;
          if (usdPrice) {
            const coinKey = coin === 'BTC' ? 'bitcoin' : 
                          coin === 'ETH' ? 'ethereum' :
                          coin === 'ADA' ? 'cardano' :
                          coin === 'DOT' ? 'polkadot' :
                          coin === 'MATIC' ? 'polygon' : coin.toLowerCase();
            
            results[coinKey] = {
              usd: usdPrice,
              brl: usdPrice * usdToBrl,
              usd_24h_change: 0, // CryptoCompare free não inclui variação
              usd_market_cap: null,
              usd_24h_vol: null,
              source: 'CryptoCompare'
            };
          }
        } catch (coinError) {
          logger.warn(`⚠️ Erro ao buscar ${coin} via CryptoCompare:`, coinError.message);
        }
      }

      return results;
    } catch (error) {
      logger.error('❌ Erro geral no CryptoCompare fallback:', error);
      return {};
    }
  }

  /**
   * Sistema de fallbacks múltiplos (20+ fontes) para obter cotações
   */
  async getCurrentPrices(customCoins = null) {
    // Se customCoins for fornecido, usar essas moedas; senão usar padrão
    const requiredCoins = customCoins || ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'polygon'];
    let result = {};
    let attemptCount = 0;
    
    // Lista ordenada de fallbacks por prioridade/confiabilidade
    const fallbackMethods = [
      { name: 'CoinGecko', method: () => this.getCryptoPricesFromCoinGecko(requiredCoins) },
      { name: 'CryptoCompare', method: () => this.getCryptoPricesFromCryptoCompare() },
      { name: 'Binance', method: () => this.getCryptoPricesFromBinance() },
      { name: 'Coinbase', method: () => this.getCryptoPricesFromCoinbase() },
      { name: 'Kraken', method: () => this.getCryptoPricesFromKraken() },
      { name: 'Huobi', method: () => this.getCryptoPricesFromHuobi() },
      { name: 'KuCoin', method: () => this.getCryptoPricesFromKuCoin() },
      { name: 'Gate.io', method: () => this.getCryptoPricesFromGate() },
      { name: 'OKX', method: () => this.getCryptoPricesFromOKX() },
      { name: 'Bitfinex', method: () => this.getCryptoPricesFromBitfinex() },
      { name: 'MEXC', method: () => this.getCryptoPricesFromMEXC() },
      { name: 'Bybit', method: () => this.getCryptoPricesFromBybit() },
      { name: 'HTX', method: () => this.getCryptoPricesFromHTX() },
      { name: 'CoinLore', method: () => this.getCryptoPricesFromCoinLore() },
      { name: 'Messari', method: () => this.getCryptoPricesFromMessari() },
      { name: 'MercadoBitcoin', method: () => this.getCryptoPricesFromMercadoBitcoin() },
      { name: 'Foxbit', method: () => this.getCryptoPricesFromFoxbit() },
      { name: 'BitcoinTrade', method: () => this.getCryptoPricesFromBitcoinTrade() },
      { name: 'NovaDAX', method: () => this.getCryptoPricesFromNovaDAX() },
      { name: 'Braziliex', method: () => this.getCryptoPricesFromBraziliex() }
    ];

    // Tentar cada fallback até obter dados completos
    for (const fallback of fallbackMethods) {
      try {
        attemptCount++;
        logger.info(`🔄 [${attemptCount}/20+] Tentando ${fallback.name} API...`);
        
        const fallbackData = await fallback.method();
        
        // Mesclar dados obtidos com resultado existente
        for (const coin of requiredCoins) {
          if (!result[coin] || typeof result[coin].usd !== 'number') {
            if (fallbackData[coin] && typeof fallbackData[coin].usd === 'number') {
              result[coin] = fallbackData[coin];
              logger.info(`✅ ${coin} obtido via ${fallback.name}`);
            }
          }
        }
        
        // Verificar se temos todos os dados necessários
        const hasAllCoins = requiredCoins.every(coin => 
          result[coin] && typeof result[coin].usd === 'number'
        );
        
        if (hasAllCoins) {
          logger.info(`✅ Dados completos obtidos via ${fallback.name} (tentativa ${attemptCount})`);
          return { ...result, timestamp: new Date().toISOString() };
        }
        
        const missingCoins = requiredCoins.filter(coin => !result[coin] || typeof result[coin].usd !== 'number');
        logger.info(`⚠️ ${fallback.name} - ainda faltando: ${missingCoins.join(', ')}`);
        
      } catch (error) {
        logger.warn(`⚠️ ${fallback.name} API falhou:`, error.message);
      }
    }

    // Fallback final: preços estáticos/estimados
    logger.warn('⚠️ Todos os fallbacks falharam, usando preços estáticos');
    const usdToBrl = await this.getUsdToBrlRate();
    
    // Preços estáticos para as principais criptomoedas
    const staticPricesData = {
      bitcoin: { usd: 118000 },
      ethereum: { usd: 3800 },
      cardano: { usd: 0.77 },
      polkadot: { usd: 3.8 },
      polygon: { usd: 0.9 },
      binancecoin: { usd: 720 },
      solana: { usd: 280 },
      ripple: { usd: 0.58 },
      dogecoin: { usd: 0.42 },
      avalanche: { usd: 50 },
      tron: { usd: 0.28 },
      chainlink: { usd: 28 },
      litecoin: { usd: 125 },
      'usd-coin': { usd: 1.0 },
      tether: { usd: 1.0 },
      stellar: { usd: 0.15 },
      monero: { usd: 185 },
      'ethereum-classic': { usd: 32 },
      vechain: { usd: 0.06 }
    };

    // Preencher dados ausentes com preços estáticos
    for (const coinId of requiredCoins) {
      const priceKey = this.mapCoinIdToPriceKey(coinId);
      if (!result[priceKey] || typeof result[priceKey].usd !== 'number') {
        const staticPrice = staticPricesData[priceKey] || { usd: 1.0 }; // Fallback para $1
        result[priceKey] = {
          usd: staticPrice.usd,
          brl: staticPrice.usd * usdToBrl,
          usd_24h_change: 0,
          usd_market_cap: null,
          usd_24h_vol: null,
          source: 'Static-Emergency-Fallback'
        };
        logger.warn(`⚠️ Usando preço estático para ${priceKey}: $${staticPrice.usd}`);
      }
    }

    logger.info(`✅ Dados finais montados após ${attemptCount} tentativas de fallback`);
    return { ...result, timestamp: new Date().toISOString() };
  }

  /**
   * CoinGecko API call 
   */
  async getCryptoPricesFromCoinGecko(coinIds = ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'matic-network']) {
    // Mapear coin IDs para os IDs da CoinGecko API
    const coinGeckoIds = coinIds.map(coinId => this.mapCoinIdToCoinGeckoId(coinId)).join(',');
    
    const response = await axios.get(`${this.apiUrls.coinGecko}?ids=${coinGeckoIds}&vs_currencies=usd,brl&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`, {
      timeout: 5000
    });
    
    const data = response.data;
    
    // Verificar se houve erro de rate limit ou dados inválidos
    if (data.status && data.status.error_code) {
      throw new Error(`CoinGecko API Error: ${data.status.error_message}`);
    }
    
    // Validar se temos dados válidos para as moedas solicitadas
    const requiredCoins = coinIds.map(coinId => this.mapCoinIdToCoinGeckoId(coinId));
    for (const coin of requiredCoins) {
      if (!data[coin] || typeof data[coin].usd === 'undefined') {
        throw new Error(`Dados incompletos para ${coin} na resposta da CoinGecko`);
      }
    }
    
    // Construir resposta dinamicamente baseado nas moedas solicitadas
    const result = {};
    for (const coinId of coinIds) {
      const coinGeckoId = this.mapCoinIdToCoinGeckoId(coinId);
      const priceKey = this.mapCoinIdToPriceKey(coinId);
      
      if (data[coinGeckoId]) {
        result[priceKey] = {
          usd: data[coinGeckoId].usd,
          brl: data[coinGeckoId].brl,
          usd_24h_change: data[coinGeckoId].usd_24h_change,
          usd_market_cap: data[coinGeckoId].usd_market_cap,
          usd_24h_vol: data[coinGeckoId].usd_24h_vol,
          source: 'CoinGecko'
        };
      }
    }
    
    return result;
  }

  /**
   * Binance API call
   */
  async getCryptoPricesFromBinance() {
    const usdToBrl = await this.getUsdToBrlRate();
    
    const [btcResponse, ethResponse, adaResponse, dotResponse, maticResponse] = await Promise.allSettled([
      axios.get(`${this.apiUrls.binance}?symbol=BTCUSDT`, { timeout: 5000 }),
      axios.get(`${this.apiUrls.binance}?symbol=ETHUSDT`, { timeout: 5000 }),
      axios.get(`${this.apiUrls.binance}?symbol=ADAUSDT`, { timeout: 5000 }),
      axios.get(`${this.apiUrls.binance}?symbol=DOTUSDT`, { timeout: 5000 }),
      axios.get(`${this.apiUrls.binance}?symbol=MATICUSDT`, { timeout: 5000 })
    ]);
    
    const results = {};
    
    if (btcResponse.status === 'fulfilled') {
      results.bitcoin = {
        usd: parseFloat(btcResponse.value.data.price),
        brl: parseFloat(btcResponse.value.data.price) * usdToBrl,
        usd_24h_change: 0,
        usd_market_cap: null,
        usd_24h_vol: null,
        source: 'Binance'
      };
    }
    
    if (ethResponse.status === 'fulfilled') {
      results.ethereum = {
        usd: parseFloat(ethResponse.value.data.price),
        brl: parseFloat(ethResponse.value.data.price) * usdToBrl,
        usd_24h_change: 0,
        usd_market_cap: null,
        usd_24h_vol: null,
        source: 'Binance'
      };
    }
    
    if (adaResponse.status === 'fulfilled') {
      results.cardano = {
        usd: parseFloat(adaResponse.value.data.price),
        brl: parseFloat(adaResponse.value.data.price) * usdToBrl,
        usd_24h_change: 0,
        usd_market_cap: null,
        usd_24h_vol: null,
        source: 'Binance'
      };
    }
    
    if (dotResponse.status === 'fulfilled') {
      results.polkadot = {
        usd: parseFloat(dotResponse.value.data.price),
        brl: parseFloat(dotResponse.value.data.price) * usdToBrl,
        usd_24h_change: 0,
        usd_market_cap: null,
        usd_24h_vol: null,
        source: 'Binance'
      };
    }
    
    if (maticResponse.status === 'fulfilled') {
      results.polygon = {
        usd: parseFloat(maticResponse.value.data.price),
        brl: parseFloat(maticResponse.value.data.price) * usdToBrl,
        usd_24h_change: 0,
        usd_market_cap: null,
        usd_24h_vol: null,
        source: 'Binance'
      };
    }
    
    return results;
  }

  // Implementações de fallback adicionais (métodos placeholder que falham graciosamente)
  async getCryptoPricesFromCoinbase() {
    // Coinbase tem API limitada para dados públicos
    try {
      const response = await axios.get(this.apiUrls.coinbase, { timeout: 3000 });
      // A API do Coinbase tem formato diferente, implementação simplificada
      return {}; // Retorna vazio por enquanto
    } catch (error) {
      return {};
    }
  }

  async getCryptoPricesFromKraken() {
    try {
      // Kraken exige símbolos específicos
      const usdToBrl = await this.getUsdToBrlRate();
      const response = await axios.get(`${this.apiUrls.kraken}?pair=XBTUSD,ETHUSD,ADAUSD,DOTUSD`, { timeout: 3000 });
      
      if (response.data?.result) {
        const results = {};
        const data = response.data.result;
        
        if (data.XXBTZUSD) {
          const price = parseFloat(data.XXBTZUSD.c[0]);
          results.bitcoin = {
            usd: price,
            brl: price * usdToBrl,
            usd_24h_change: 0,
            usd_market_cap: null,
            usd_24h_vol: null,
            source: 'Kraken'
          };
        }
        
        if (data.XETHZUSD) {
          const price = parseFloat(data.XETHZUSD.c[0]);
          results.ethereum = {
            usd: price,
            brl: price * usdToBrl,
            usd_24h_change: 0,
            usd_market_cap: null,
            usd_24h_vol: null,
            source: 'Kraken'
          };
        }
        
        return results;
      }
      return {};
    } catch (error) {
      return {};
    }
  }

  // Métodos placeholder para outras exchanges (implementação simplificada)
  async getCryptoPricesFromHuobi() { return {}; }
  async getCryptoPricesFromKuCoin() { return {}; }
  async getCryptoPricesFromGate() { return {}; }
  async getCryptoPricesFromOKX() { return {}; }
  async getCryptoPricesFromBitfinex() { return {}; }
  async getCryptoPricesFromMEXC() { return {}; }
  async getCryptoPricesFromBybit() { return {}; }
  async getCryptoPricesFromHTX() { return {}; }
  async getCryptoPricesFromCoinLore() { return {}; }
  async getCryptoPricesFromMessari() { return {}; }
  async getCryptoPricesFromMercadoBitcoin() { return {}; }
  async getCryptoPricesFromFoxbit() { return {}; }
  async getCryptoPricesFromBitcoinTrade() { return {}; }
  async getCryptoPricesFromNovaDAX() { return {}; }
  async getCryptoPricesFromBraziliex() { return {}; }

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
    const adaPrevious = this.lastPrices.get('cardano');
    const dotPrevious = this.lastPrices.get('polkadot');
    const maticPrevious = this.lastPrices.get('polygon');

    return `₿ *COTAÇÕES DE CRIPTOMOEDAS* 💰

📊 *Bitcoin (BTC)*
💵 USD: ${formatCurrency(prices.bitcoin.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.bitcoin.brl, 'brl')}
${formatChange(prices.bitcoin.usd, btcPrevious)}

📊 *Ethereum (ETH)*
💵 USD: ${formatCurrency(prices.ethereum.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.ethereum.brl, 'brl')}
${formatChange(prices.ethereum.usd, ethPrevious)}

📊 *Cardano (ADA)*
💵 USD: ${formatCurrency(prices.cardano.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.cardano.brl, 'brl')}
${formatChange(prices.cardano.usd, adaPrevious)}

📊 *Polkadot (DOT)*
💵 USD: ${formatCurrency(prices.polkadot.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.polkadot.brl, 'brl')}
${formatChange(prices.polkadot.usd, dotPrevious)}

📊 *Polygon (MATIC)*
💵 USD: ${formatCurrency(prices.polygon.usd, 'usd')}
💰 BRL: ${formatCurrency(prices.polygon.brl, 'brl')}
${formatChange(prices.polygon.usd, maticPrevious)}

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
    
    // Save to MongoDB
    this.saveMonitoringConfig(userId, config);
    
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
    
    // Remove from MongoDB
    this.deleteMonitoringConfig(userId);
    
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
      // Coletar todas as moedas que os usuários estão monitorando
      const allMonitoredCoins = new Set(['bitcoin', 'ethereum', 'cardano', 'polkadot', 'matic-network']); // Padrão
      
      for (const [userId, config] of this.activeMonitoring.entries()) {
        if (config.active && config.coins) {
          config.coins.forEach(coin => allMonitoredCoins.add(coin));
        }
      }
      
      const currentPrices = await this.getCurrentPrices(Array.from(allMonitoredCoins));
      
      // Armazenar histórico em memória para todas as moedas monitoradas
      for (const coinId of allMonitoredCoins) {
        const priceKey = this.mapCoinIdToPriceKey(coinId);
        if (currentPrices[priceKey] && currentPrices[priceKey].usd) {
          this.storePriceHistory(priceKey, currentPrices[priceKey].usd);
        }
      }
      
      // Armazenar histórico no MongoDB
      await this.savePriceHistoryToDB(currentPrices);
      
      // Verificar variações significativas para cada usuário
      logger.debug(`🔍 Verificando alertas para ${this.activeMonitoring.size} usuários ativos`);
      
      for (const [userId, config] of this.activeMonitoring.entries()) {
        if (!config.active || !config.notifications) {
          logger.debug(`⚠️ Usuário ${userId} tem config inativa ou notificações desabilitadas`);
          continue;
        }
        
        logger.debug(`👤 Verificando usuário ${userId}, moedas: ${config.coins.join(', ')}`);
        
        for (const coin of config.coins) {
          const variation = this.calculateVariationWithTimeframe(coin, config.timeframe);
          
          if (variation) {
            logger.debug(`📊 ${coin}: variação ${variation.variation.toFixed(2)}% (threshold: ${config.thresholdPercentage}%)`);
            
            if (this.shouldSendAlert(userId, coin, variation, config)) {
              logger.info(`🚨 ENVIANDO ALERTA para ${userId}: ${coin} ${variation.variation.toFixed(2)}%`);
              this.sendVariationAlert(userId, coin, variation, currentPrices, config);
            }
          } else {
            logger.debug(`📊 ${coin}: sem dados suficientes para calcular variação`);
          }
        }
      }
      
      // Atualizar últimos preços para todas as moedas monitoradas
      for (const coinId of allMonitoredCoins) {
        const priceKey = this.mapCoinIdToPriceKey(coinId);
        if (currentPrices[priceKey] && currentPrices[priceKey].usd) {
          this.lastPrices.set(priceKey, currentPrices[priceKey].usd);
        }
      }
      
    } catch (error) {
      logger.error('Erro ao verificar mudanças de preço:', error);
    }
  }

  /**
   * Verifica se deve enviar alerta baseado nas configurações do usuário
   */
  shouldSendAlert(userId, coin, variation, config) {
    // Verificar se notificações estão pausadas
    const pauseStatus = this.isUserNotificationsPaused(userId);
    if (pauseStatus.paused) {
      logger.debug(`❌ ${userId}-${coin}: notificações pausadas`);
      return false;
    }
    
    // Verificar threshold
    const absVariation = Math.abs(variation.variation);
    if (absVariation < config.thresholdPercentage) {
      logger.debug(`❌ ${userId}-${coin}: variação ${absVariation.toFixed(2)}% < threshold ${config.thresholdPercentage}%`);
      return false;
    }
    
    // Verificar direção do alerta
    if (variation.variation > 0 && !config.alertOnRise) {
      logger.debug(`❌ ${userId}-${coin}: alta (+${variation.variation.toFixed(2)}%) mas alertOnRise=false`);
      return false;
    }
    if (variation.variation < 0 && !config.alertOnFall) {
      logger.debug(`❌ ${userId}-${coin}: queda (${variation.variation.toFixed(2)}%) mas alertOnFall=false`);
      return false;
    }
    
    // Verificar cooldown
    const cooldownKey = `${userId}-${coin}`;
    const lastAlert = this.alertCooldown.get(cooldownKey);
    if (lastAlert) {
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      const remainingMs = cooldownMs - (Date.now() - lastAlert);
      if (remainingMs > 0) {
        logger.debug(`❌ ${userId}-${coin}: em cooldown por mais ${Math.ceil(remainingMs/60000)} minutos`);
        return false;
      }
    }
    
    logger.debug(`✅ ${userId}-${coin}: TODAS as condições atendidas para enviar alerta`);
    return true;
  }
  
  /**
   * Envia alerta de variação com configurações personalizadas
   */
  sendVariationAlert(userId, coin, variation, currentPrices, config) {
    const coinNames = {
      bitcoin: 'Bitcoin (BTC)',
      ethereum: 'Ethereum (ETH)',
      cardano: 'Cardano (ADA)',
      polkadot: 'Polkadot (DOT)',
      polygon: 'Polygon (MATIC)'
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
      availableCoins: ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'polygon'],
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

  /**
   * =====================================================================
   *                    GERENCIAMENTO DE PREFERÊNCIAS DE USUÁRIOS
   * =====================================================================
   */

  /**
   * Obtém lista das 20 criptomoedas mais atrativas
   */
  getTop20Cryptos() {
    return this.top20Cryptos;
  }

  /**
   * Obtém preferências de um usuário
   */
  async getUserPreferences(userId) {
    // Primeiro tentar cache em memória
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId);
    }

    // Buscar no MongoDB
    if (this.isConnected && this.userPrefsCollection) {
      try {
        const userPrefs = await this.userPrefsCollection.findOne({ userId });
        if (userPrefs) {
          this.userPreferences.set(userId, userPrefs);
          return userPrefs;
        }
      } catch (error) {
        logger.error(`❌ Erro ao buscar preferências do usuário ${userId}:`, error);
      }
    }

    // Retornar preferências padrão
    const defaultPrefs = {
      userId,
      coins: ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'matic-network'], // Padrão das 5 originais
      settings: {
        notifications: true,
        thresholdPercentage: 1.0,
        alertOnRise: true,
        alertOnFall: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.userPreferences.set(userId, defaultPrefs);
    return defaultPrefs;
  }

  /**
   * Salva preferências de um usuário
   */
  async setUserPreferences(userId, preferences) {
    const userPrefs = {
      userId,
      ...preferences,
      updatedAt: new Date()
    };

    // Salvar no cache
    this.userPreferences.set(userId, userPrefs);

    // Salvar no MongoDB
    if (this.isConnected && this.userPrefsCollection) {
      try {
        await this.userPrefsCollection.updateOne(
          { userId },
          { $set: userPrefs },
          { upsert: true }
        );
        logger.info(`✅ Preferências salvas para usuário ${userId}`);
      } catch (error) {
        logger.error(`❌ Erro ao salvar preferências do usuário ${userId}:`, error);
      }
    }

    return userPrefs;
  }

  /**
   * Método conveniente para salvar apenas as moedas do usuário
   */
  async saveUserPreferences(userId, coins) {
    const currentPrefs = await this.getUserPreferences(userId);
    
    return await this.setUserPreferences(userId, {
      ...currentPrefs,
      coins,
      updatedAt: new Date()
    });
  }

  /**
   * Adiciona uma moeda às preferências do usuário
   */
  async addCoinToUser(userId, coinId) {
    const prefs = await this.getUserPreferences(userId);
    
    if (!prefs.coins.includes(coinId)) {
      prefs.coins.push(coinId);
      await this.setUserPreferences(userId, prefs);
      logger.info(`✅ Moeda ${coinId} adicionada para usuário ${userId}`);
      return true;
    }
    
    return false; // Já estava na lista
  }

  /**
   * Remove uma moeda das preferências do usuário
   */
  async removeCoinFromUser(userId, coinId) {
    const prefs = await this.getUserPreferences(userId);
    const index = prefs.coins.indexOf(coinId);
    
    if (index > -1) {
      prefs.coins.splice(index, 1);
      await this.setUserPreferences(userId, prefs);
      logger.info(`✅ Moeda ${coinId} removida do usuário ${userId}`);
      return true;
    }
    
    return false; // Não estava na lista
  }

  /**
   * Define lista completa de moedas para um usuário
   */
  async setUserCoins(userId, coinIds) {
    const prefs = await this.getUserPreferences(userId);
    prefs.coins = coinIds;
    await this.setUserPreferences(userId, prefs);
    logger.info(`✅ Lista de moedas atualizada para usuário ${userId}: ${coinIds.join(', ')}`);
    return prefs;
  }

  /**
   * Obtém preços apenas das moedas selecionadas pelo usuário
   */
  async getUserCryptoPrices(userId) {
    const prefs = await this.getUserPreferences(userId);
    const allPrices = await this.getCurrentPrices();
    
    const userPrices = {};
    for (const coinId of prefs.coins) {
      // Mapear IDs para chaves usadas no getCurrentPrices
      const priceKey = this.mapCoinIdToPriceKey(coinId);
      if (allPrices[priceKey]) {
        userPrices[priceKey] = allPrices[priceKey];
      }
    }
    
    return {
      ...userPrices,
      timestamp: allPrices.timestamp,
      userCoins: prefs.coins
    };
  }

  /**
   * Mapeia IDs das moedas para os IDs da CoinGecko API
   */
  mapCoinIdToCoinGeckoId(coinId) {
    const mapping = {
      'bitcoin': 'bitcoin',
      'ethereum': 'ethereum', 
      'cardano': 'cardano',
      'polkadot': 'polkadot',
      'matic-network': 'matic-network',
      'binancecoin': 'binancecoin',
      'solana': 'solana',
      'ripple': 'ripple',
      'dogecoin': 'dogecoin',
      'avalanche-2': 'avalanche-2',
      'tron': 'tron',
      'chainlink': 'chainlink',
      'litecoin': 'litecoin',
      'polygon': 'matic-network', // Polygon usa matic-network na CoinGecko
      'usd-coin': 'usd-coin',
      'tether': 'tether',
      'stellar': 'stellar',
      'monero': 'monero',
      'ethereum-classic': 'ethereum-classic',
      'vechain': 'vechain'
    };
    return mapping[coinId] || coinId;
  }

  /**
   * Mapeia IDs das moedas para as chaves usadas no getCurrentPrices
   */
  mapCoinIdToPriceKey(coinId) {
    const mapping = {
      'bitcoin': 'bitcoin',
      'ethereum': 'ethereum', 
      'cardano': 'cardano',
      'polkadot': 'polkadot',
      'matic-network': 'polygon',
      'binancecoin': 'binancecoin',
      'solana': 'solana',
      'ripple': 'ripple',
      'dogecoin': 'dogecoin',
      'avalanche-2': 'avalanche',
      'chainlink': 'chainlink',
      'litecoin': 'litecoin',
      'uniswap': 'uniswap',
      'bitcoin-cash': 'bitcoin-cash'
    };
    
    return mapping[coinId] || coinId;
  }

  /**
   * Obtém estatísticas de uso das moedas
   */
  async getCoinUsageStats() {
    const stats = {};
    
    for (const [userId, prefs] of this.userPreferences.entries()) {
      for (const coinId of prefs.coins) {
        stats[coinId] = (stats[coinId] || 0) + 1;
      }
    }
    
    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([coinId, count]) => ({ coinId, users: count }));
  }

  /**
   * =====================================================================
   *                    MELHORIAS NO SISTEMA DE NOTIFICAÇÕES
   * =====================================================================
   */

  /**
   * Obtém usuários ativos para notificações de uma moeda específica
   */
  getActiveUsersForCoin(coinId) {
    const users = [];
    
    for (const [userId, config] of this.activeMonitoring.entries()) {
      if (config.active && config.notifications && config.coins.includes(coinId)) {
        users.push({
          userId,
          threshold: config.thresholdPercentage,
          alertOnRise: config.alertOnRise,
          alertOnFall: config.alertOnFall,
          cooldownMinutes: config.cooldownMinutes
        });
      }
    }
    
    return users;
  }

  /**
   * Obtém estatísticas de notificações por usuário
   */
  getUserNotificationStats(userId, days = 30) {
    const userAlerts = [];
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    // Simular busca de alertas históricos (seria melhor armazenar no MongoDB)
    const totalAlerts = 0; // Placeholder - implementar busca real no futuro
    
    return {
      userId,
      periodDays: days,
      totalAlerts,
      averagePerDay: totalAlerts / days,
      lastAlert: null,
      isActive: this.activeMonitoring.has(userId)
    };
  }

  /**
   * Pausa temporariamente notificações para um usuário
   */
  pauseUserNotifications(userId, minutes = 60) {
    const config = this.activeMonitoring.get(userId);
    if (config) {
      config.pausedUntil = Date.now() + (minutes * 60 * 1000);
      config.lastModified = new Date().toISOString();
      this.activeMonitoring.set(userId, config);
      
      logger.info(`Notificações pausadas para usuário ${userId} por ${minutes} minutos`);
      return true;
    }
    return false;
  }

  /**
   * Resume notificações pausadas para um usuário
   */
  resumeUserNotifications(userId) {
    const config = this.activeMonitoring.get(userId);
    if (config && config.pausedUntil) {
      delete config.pausedUntil;
      config.lastModified = new Date().toISOString();
      this.activeMonitoring.set(userId, config);
      
      logger.info(`Notificações resumidas para usuário ${userId}`);
      return true;
    }
    return false;
  }

  /**
   * Verifica se usuário está com notificações pausadas
   */
  isUserNotificationsPaused(userId) {
    const config = this.activeMonitoring.get(userId);
    if (config && config.pausedUntil) {
      if (Date.now() < config.pausedUntil) {
        return {
          paused: true,
          resumesAt: new Date(config.pausedUntil),
          remainingMinutes: Math.ceil((config.pausedUntil - Date.now()) / (60 * 1000))
        };
      } else {
        // Auto-resume se passou do tempo
        this.resumeUserNotifications(userId);
      }
    }
    return { paused: false };
  }

  /**
   * =====================================================================
   *                    ANÁLISE COMPARATIVA APRIMORADA
   * =====================================================================
   */

  /**
   * Obtém análise técnica básica de uma moeda
   */
  async getTechnicalAnalysis(symbol, days = 30) {
    const historicalData = await this.getHistoricalDataFromDB(symbol, days);
    
    if (historicalData.length < 10) {
      return {
        error: 'Dados insuficientes para análise técnica',
        dataPoints: historicalData.length,
        minimumRequired: 10
      };
    }
    
    const prices = historicalData.map(item => item.prices.usd);
    const latest = prices[prices.length - 1];
    
    // Médias móveis
    const sma7 = this.calculateSMA(prices, 7);
    const sma14 = this.calculateSMA(prices, 14);
    const sma30 = Math.min(prices.length, 30);
    const sma30Value = this.calculateSMA(prices, sma30);
    
    // RSI (Relative Strength Index) simplificado
    const rsi = this.calculateRSI(prices, 14);
    
    // Support e Resistance níveis básicos
    const support = Math.min(...prices.slice(-14));
    const resistance = Math.max(...prices.slice(-14));
    
    // Tendência baseada nas médias móveis
    const trend = sma7 > sma14 ? 'alta' : sma7 < sma14 ? 'baixa' : 'lateral';
    
    // Volatilidade (desvio padrão dos últimos 14 dias)
    const recent14 = prices.slice(-14);
    const mean14 = recent14.reduce((a, b) => a + b) / recent14.length;
    const volatility = Math.sqrt(recent14.reduce((sq, price) => sq + Math.pow(price - mean14, 2), 0) / recent14.length);
    const volatilityPercent = (volatility / mean14) * 100;
    
    return {
      symbol: symbol.toUpperCase(),
      currentPrice: latest,
      analysis: {
        trend,
        sma7: sma7,
        sma14: sma14,
        sma30: sma30Value,
        rsi: rsi,
        support: support,
        resistance: resistance,
        volatilityPercent: volatilityPercent,
        priceVsSMA7: ((latest - sma7) / sma7 * 100).toFixed(2) + '%',
        priceVsSMA14: ((latest - sma14) / sma14 * 100).toFixed(2) + '%'
      },
      signals: {
        bullish: sma7 > sma14 && latest > sma7 && rsi < 70,
        bearish: sma7 < sma14 && latest < sma7 && rsi > 30,
        overbought: rsi > 70,
        oversold: rsi < 30,
        nearSupport: Math.abs(latest - support) / support < 0.02,
        nearResistance: Math.abs(latest - resistance) / resistance < 0.02
      },
      dataPoints: historicalData.length,
      analyzedDays: days
    };
  }

  /**
   * Calcula média móvel simples
   */
  calculateSMA(prices, period) {
    if (prices.length < period) period = prices.length;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / slice.length;
  }

  /**
   * Calcula RSI (Relative Strength Index) simplificado
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50; // Neutro se dados insuficientes
    
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(change => change > 0);
    const losses = recentChanges.filter(change => change < 0).map(loss => Math.abs(loss));
    
    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Compara performance de múltiplas moedas
   */
  async compareCoinsPerformance(coinIds, days = 7) {
    const comparisons = [];
    
    for (const coinId of coinIds) {
      const analysis = await this.getComparisonAnalysis(coinId, days);
      if (analysis && analysis.analysis) {
        comparisons.push({
          coinId,
          symbol: coinId.toUpperCase(),
          performance: analysis.analysis.priceChangePercent,
          trend: analysis.analysis.trend,
          volatility: analysis.analysis.volatility,
          currentPrice: analysis.analysis.endPrice,
          dataPoints: analysis.analysis.dataPoints
        });
      }
    }
    
    // Ordenar por performance (melhor primeiro)
    comparisons.sort((a, b) => b.performance - a.performance);
    
    return {
      period: `${days} dias`,
      comparison: comparisons,
      summary: {
        bestPerformer: comparisons[0]?.coinId || null,
        worstPerformer: comparisons[comparisons.length - 1]?.coinId || null,
        averagePerformance: comparisons.reduce((sum, coin) => sum + coin.performance, 0) / comparisons.length
      },
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * =====================================================================
   *                    SISTEMA DE RELATÓRIOS E ESTATÍSTICAS
   * =====================================================================
   */

  /**
   * Gera relatório completo de uso do sistema
   */
  async generateUsageReport() {
    const totalUsers = this.activeMonitoring.size;
    const activeUsers = Array.from(this.activeMonitoring.values()).filter(config => config.active).length;
    const coinStats = await this.getCoinUsageStats();
    
    const thresholdDistribution = {};
    const timeframeDistribution = {};
    
    for (const [userId, config] of this.activeMonitoring.entries()) {
      const threshold = config.thresholdPercentage || 1.0;
      const range = threshold < 1 ? '<1%' : 
                   threshold < 2 ? '1-2%' : 
                   threshold < 5 ? '2-5%' : '>5%';
      thresholdDistribution[range] = (thresholdDistribution[range] || 0) + 1;
      
      const timeframe = config.timeframe || '1m';
      timeframeDistribution[timeframe] = (timeframeDistribution[timeframe] || 0) + 1;
    }
    
    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers
      },
      coins: {
        mostPopular: coinStats.slice(0, 5),
        totalTracked: coinStats.length
      },
      settings: {
        thresholdDistribution,
        timeframeDistribution
      },
      system: {
        isGlobalMonitoringActive: !!this.monitoringInterval,
        alertCacheSize: this.alertCooldown.size,
        priceHistorySize: Array.from(this.priceHistory.values()).reduce((sum, history) => sum + history.length, 0)
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Exporta dados históricos de um usuário para análise
   */
  async exportUserData(userId, days = 30) {
    const preferences = await this.getUserPreferences(userId);
    const monitoringConfig = this.activeMonitoring.get(userId);
    const notificationStats = this.getUserNotificationStats(userId, days);
    
    const historicalData = {};
    if (preferences && preferences.coins) {
      for (const coinId of preferences.coins) {
        const priceKey = this.mapCoinIdToPriceKey(coinId);
        historicalData[coinId] = await this.getHistoricalDataFromDB(priceKey.toUpperCase(), days);
      }
    }
    
    return {
      userId,
      exportDate: new Date().toISOString(),
      periodDays: days,
      preferences,
      monitoringConfig: monitoringConfig || null,
      notificationStats,
      historicalData,
      summary: {
        totalCoinsTracked: preferences?.coins?.length || 0,
        hasActiveMonitoring: !!monitoringConfig?.active,
        dataPoints: Object.values(historicalData).reduce((sum, data) => sum + data.length, 0)
      }
    };
  }

  /**
   * Limpa dados antigos do sistema (manutenção)
   */
  async cleanupOldData(daysToKeep = 90) {
    if (!this.isConnected) await this.connect();
    if (!this.isConnected) return { error: 'Não conectado ao MongoDB' };
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // Limpar histórico antigo de preços
      const deleteResult = await this.collection.deleteMany({
        timestamp: { $lt: cutoffDate }
      });
      
      // Limpar cache de cooldown antigo
      this.cleanupCooldownCache();
      
      // Limpar histórico em memória muito antigo
      for (const [coin, history] of this.priceHistory.entries()) {
        const recentHistory = history.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          return entryDate > cutoffDate;
        });
        this.priceHistory.set(coin, recentHistory);
      }
      
      logger.info(`Limpeza concluída: ${deleteResult.deletedCount} registros removidos do MongoDB`);
      
      return {
        success: true,
        deletedRecords: deleteResult.deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        daysKept: daysToKeep
      };
    } catch (error) {
      logger.error('Erro na limpeza de dados antigos:', error);
      return { error: error.message };
    }
  }

  /**
   * Obtém métricas de saúde do sistema
   */
  getSystemHealthMetrics() {
    const memoryUsage = process.memoryUsage();
    
    return {
      database: {
        connected: this.isConnected,
        collections: {
          cryptoHistory: !!this.collection,
          userPreferences: !!this.userPrefsCollection
        }
      },
      monitoring: {
        globalActive: !!this.monitoringInterval,
        activeUsers: this.activeMonitoring.size,
        totalUsers: this.userPreferences.size
      },
      cache: {
        priceHistory: {
          coins: this.priceHistory.size,
          totalDataPoints: Array.from(this.priceHistory.values()).reduce((sum, history) => sum + history.length, 0)
        },
        alertCooldown: this.alertCooldown.size,
        lastPrices: this.lastPrices.size
      },
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * =====================================================================
   *                    FERRAMENTAS DE DEBUG E TESTE
   * =====================================================================
   */

  /**
   * Força verificação de preços para debug (chama checkPriceChanges manualmente)
   */
  async forceCheckPrices() {
    logger.info('🔧 DEBUG: Forçando verificação manual de preços...');
    
    try {
      await this.checkPriceChanges();
      
      const metrics = {
        activeUsers: this.activeMonitoring.size,
        priceHistorySize: this.priceHistory.size,
        lastPricesSize: this.lastPrices.size,
        pendingAlerts: this.pendingAlerts?.length || 0,
        cooldownSize: this.alertCooldown.size
      };
      
      logger.info('🔧 DEBUG: Verificação forçada concluída', metrics);
      return metrics;
      
    } catch (error) {
      logger.error('🔧 DEBUG: Erro na verificação forçada:', error);
      throw error;
    }
  }

  /**
   * Simula um alerta de teste para debug
   */
  async simulateTestAlert(userId, coinId = 'bitcoin', variationPercent = 2.5) {
    logger.info(`🔧 DEBUG: Simulando alerta para ${userId}, moeda: ${coinId}, variação: ${variationPercent}%`);
    
    try {
      // Get user config or create default
      let config = this.activeMonitoring.get(userId);
      if (!config) {
        config = this.activateMonitoring(userId, {
          thresholdPercentage: 0.1, // Baixo para testes
          notifications: true
        });
      }
      
      // Simulate price data
      const currentPrice = coinId === 'bitcoin' ? 50000 : 3000;
      const previousPrice = currentPrice / (1 + (variationPercent / 100));
      
      const variation = {
        variation: variationPercent,
        current: currentPrice,
        previous: previousPrice,
        timestamp: new Date().toISOString(),
        timeframe: '1m',
        dataPoints: 1
      };
      
      const currentPrices = {
        [coinId]: {
          usd: currentPrice,
          brl: currentPrice * 5.2,
          source: 'TEST'
        }
      };
      
      // Force send alert
      this.sendVariationAlert(userId, coinId, variation, currentPrices, config);
      
      const pendingAlerts = this.getPendingAlerts();
      logger.info(`🔧 DEBUG: Alerta simulado criado. Alertas pendentes: ${pendingAlerts.length}`);
      
      return {
        alertCreated: true,
        pendingAlertsCount: pendingAlerts.length,
        userConfig: config,
        simulatedData: { variation, currentPrices }
      };
      
    } catch (error) {
      logger.error('🔧 DEBUG: Erro ao simular alerta:', error);
      throw error;
    }
  }

  /**
   * Debug: mostra status detalhado do monitoramento para um usuário
   */
  getDetailedMonitoringStatus(userId) {
    const config = this.activeMonitoring.get(userId);
    const pauseStatus = this.isUserNotificationsPaused(userId);
    const cooldownEntries = [];
    
    // Get cooldown entries for this user
    for (const [key, timestamp] of this.alertCooldown.entries()) {
      if (key.startsWith(userId + '-')) {
        const coin = key.substring(userId.length + 1);
        const remainingMs = (timestamp + (config?.cooldownMinutes || 15) * 60 * 1000) - Date.now();
        cooldownEntries.push({
          coin,
          remainingMs: Math.max(0, remainingMs),
          remainingMinutes: Math.max(0, Math.ceil(remainingMs / 60000))
        });
      }
    }
    
    return {
      userId,
      hasMonitoring: !!config,
      config: config || null,
      pauseStatus,
      cooldownEntries,
      priceHistory: {
        bitcoin: this.priceHistory.get('bitcoin')?.length || 0,
        ethereum: this.priceHistory.get('ethereum')?.length || 0,
        cardano: this.priceHistory.get('cardano')?.length || 0,
        polkadot: this.priceHistory.get('polkadot')?.length || 0,
        polygon: this.priceHistory.get('polygon')?.length || 0
      },
      lastPrices: {
        bitcoin: this.lastPrices.get('bitcoin'),
        ethereum: this.lastPrices.get('ethereum'),
        cardano: this.lastPrices.get('cardano'),
        polkadot: this.lastPrices.get('polkadot'),
        polygon: this.lastPrices.get('polygon')
      },
      isGlobalMonitoringActive: !!this.monitoringInterval,
      totalActiveUsers: this.activeMonitoring.size
    };
  }

  /**
   * Debug: reduz threshold temporariamente para testes
   */
  enableTestMode(userId, lowThreshold = 0.1) {
    const config = this.activeMonitoring.get(userId);
    if (config) {
      config.thresholdPercentage = lowThreshold;
      config.cooldownMinutes = 1; // Reduz cooldown para 1 minuto
      config.testMode = true;
      
      logger.info(`🔧 DEBUG: Modo de teste ativado para ${userId} (threshold: ${lowThreshold}%, cooldown: 1min)`);
      return true;
    }
    return false;
  }

  /**
   * Debug: força limpeza de cooldown para um usuário
   */
  clearUserCooldown(userId) {
    let cleared = 0;
    for (const key of this.alertCooldown.keys()) {
      if (key.startsWith(userId + '-')) {
        this.alertCooldown.delete(key);
        cleared++;
      }
    }
    logger.info(`🔧 DEBUG: Limpou ${cleared} entradas de cooldown para ${userId}`);
    return cleared;
  }

  /**
   * =====================================================================
   *                    ANÁLISE INTELIGENTE COM LLM
   * =====================================================================
   */

  /**
   * Gera análise e projeção usando LLM baseada nos dados históricos
   */
  async generateLLMAnalysis(coinSymbol, days = 30) {
    if (!this.llmService) {
      throw new Error('LLM Service não fornecido para análise inteligente');
    }

    logger.info(`🤖 Gerando análise LLM para ${coinSymbol} (${days} dias)`);

    try {
      // 1. Coletar dados históricos completos
      const historicalData = await this.getHistoricalDataFromDB(coinSymbol, days);
      const technicalAnalysis = await this.getTechnicalAnalysis(coinSymbol, days);
      const comparisonAnalysis = await this.getComparisonAnalysis(coinSymbol, days);

      if (historicalData.length < 5) {
        return {
          error: 'Dados insuficientes para análise LLM',
          dataPoints: historicalData.length,
          minimumRequired: 5
        };
      }

      // 2. Preparar dados estruturados para o LLM
      const analysisData = this.prepareDataForLLMAnalysis(coinSymbol, historicalData, technicalAnalysis, comparisonAnalysis);

      // 3. Construir prompt especializado
      const prompt = this.buildLLMAnalysisPrompt(analysisData);

      // 4. Chamar LLM para análise usando o endpoint Ollama existente
      const llmResponse = await this.llmService.generateText(prompt);

      // 5. Processar resposta do LLM
      const parsedAnalysis = this.parseLLMAnalysisResponse(llmResponse, analysisData);

      logger.info(`🤖 Análise LLM concluída para ${coinSymbol}`);

      return {
        coin: coinSymbol.toUpperCase(),
        analysisDate: new Date().toISOString(),
        dataPoints: historicalData.length,
        period: `${days} dias`,
        rawData: analysisData,
        llmAnalysis: parsedAnalysis,
        confidence: this.calculateAnalysisConfidence(analysisData),
        disclaimer: 'Esta análise é baseada em dados históricos e não constitui aconselhamento financeiro. Invista com responsabilidade.'
      };

    } catch (error) {
      logger.error(`❌ Erro na análise LLM para ${coinSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Análise automática de trading com decisões para múltiplas moedas do usuário
   */
  async generateAutomaticTradingAnalysis(userId, days = 7) {
    if (!this.llmService) {
      throw new Error('LLM Service não fornecido para análise de trading automática');
    }

    logger.info(`🤖 Gerando análise automática de trading para usuário ${userId} (${days} dias)`);

    try {
      // 1. Obter moedas configuradas pelo usuário
      const userPrefs = await this.getUserPreferences(userId);
      const coinsToAnalyze = userPrefs.coins || ['bitcoin', 'ethereum', 'cardano'];
      
      if (coinsToAnalyze.length === 0) {
        return {
          error: 'Nenhuma moeda configurada para análise',
          suggestion: 'Configure suas moedas favoritas primeiro'
        };
      }

      // 2. Analisar cada moeda
      const coinAnalyses = [];
      let totalSuccessful = 0;

      for (const coinId of coinsToAnalyze.slice(0, 5)) { // Limitar a 5 para performance
        try {
          logger.info(`📊 Analisando ${coinId}...`);
          
          // Obter dados históricos da base
          const historicalData = await this.getHistoricalDataFromDB(coinId, days);
          const technicalAnalysis = await this.getTechnicalAnalysis(coinId, days) || { analysis: null };
          
          if (historicalData.length < 3) {
            coinAnalyses.push({
              coin: coinId,
              error: 'Dados históricos insuficientes',
              recommendation: 'HOLD',
              confidence: 0,
              reasoning: 'Sem dados suficientes para análise'
            });
            continue;
          }

          // Preparar dados para análise
          const analysisData = this.prepareDataForLLMAnalysis(coinId, historicalData, technicalAnalysis, null);
          
          // Prompt especializado para trading automático
          const prompt = this.buildAutomaticTradingPrompt(analysisData);
          
          // Chamar LLM
          const llmResponse = await this.llmService.generateText(prompt);
          
          // Processar resposta
          const tradingDecision = this.parseAutomaticTradingResponse(llmResponse, analysisData);
          
          coinAnalyses.push({
            coin: coinId,
            ...tradingDecision,
            dataPoints: historicalData.length,
            analysisDate: new Date().toISOString()
          });
          
          totalSuccessful++;
          logger.info(`✅ Análise completa para ${coinId}: ${tradingDecision.recommendation}`);
          
        } catch (error) {
          logger.error(`❌ Erro na análise automática para ${coinId}:`, error);
          coinAnalyses.push({
            coin: coinId,
            error: error.message,
            recommendation: 'HOLD',
            confidence: 0,
            reasoning: 'Erro na análise'
          });
        }
      }

      // 3. Compilar análise geral do portfólio
      const portfolioSummary = this.generatePortfolioSummary(coinAnalyses);

      return {
        userId,
        analysisDate: new Date().toISOString(),
        period: `${days} dias`,
        coinsAnalyzed: coinsToAnalyze.length,
        successfulAnalyses: totalSuccessful,
        coinAnalyses,
        portfolioSummary,
        disclaimer: 'Esta análise é baseada em dados históricos e IA. NÃO constitui aconselhamento financeiro. Invista com responsabilidade.'
      };

    } catch (error) {
      logger.error(`❌ Erro na análise automática de trading para ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Prompt especializado para decisões de trading automático
   */
  buildAutomaticTradingPrompt(data) {
    return `Você é um analista de trading de criptomoedas especializado em decisões rápidas e precisas baseadas em dados históricos.

DADOS DA MOEDA: ${data.coin.toUpperCase()}

PREÇO ATUAL: $${data.currentPrice.toLocaleString()}
PERÍODO ANALISADO: ${data.statistics.dataPoints} pontos de dados

MÉTRICAS DE PREÇO:
- Mínimo: $${data.priceRange.min.toLocaleString()}
- Máximo: $${data.priceRange.max.toLocaleString()}
- Variação total: ${data.priceRange.totalChange.toFixed(2)}%
- Volatilidade: ${data.statistics.volatility.toFixed(2)}%

INDICADORES TÉCNICOS:
${data.technicalIndicators ? `
- RSI: ${data.technicalIndicators.rsi?.toFixed(1)} ${data.technicalIndicators.rsi > 70 ? '(SOBRECOMPRADO)' : data.technicalIndicators.rsi < 30 ? '(SOBREVENDIDO)' : '(NEUTRO)'}
- SMA 7: $${data.technicalIndicators.sma7?.toLocaleString()}
- Tendência: ${data.technicalIndicators.trend}
- Suporte: $${data.technicalIndicators.support?.toLocaleString()}
- Resistência: $${data.technicalIndicators.resistance?.toLocaleString()}
` : 'Indicadores limitados'}

TAREFA: Tome UMA decisão de trading clara e objetiva.

RESPOSTA OBRIGATÓRIA (use EXATAMENTE este formato):

DECISÃO: [COMPRAR/VENDER/HOLD]
CONFIANÇA: [1-10]
RAZÃO: [Uma frase explicando o principal motivo]
RISCO: [BAIXO/MÉDIO/ALTO]
TIMEFRAME: [1-7 dias para ação]

REGRAS:
- COMPRAR: Se tendência de alta clara, RSI < 70, boa entrada
- VENDER: Se tendência de queda, RSI > 70, sinais de reversão  
- HOLD: Se incerto, consolidação, ou dados insuficientes
- Seja conservador - prefira HOLD se não há sinais claros
- Confiança baixa para dados limitados`;
  }

  /**
   * Processa resposta do LLM para decisões de trading
   */
  parseAutomaticTradingResponse(llmResponse, originalData) {
    try {
      const response = llmResponse.toUpperCase();
      
      // Extrair decisão
      let recommendation = 'HOLD';
      if (response.includes('DECISÃO: COMPRAR') || response.includes('COMPRAR')) {
        recommendation = 'COMPRAR';
      } else if (response.includes('DECISÃO: VENDER') || response.includes('VENDER')) {
        recommendation = 'VENDER';
      }
      
      // Extrair confiança
      const confidenceMatch = response.match(/CONFIANÇA:\s*(\d+)/);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 5;
      
      // Extrair razão
      const reasonMatch = llmResponse.match(/RAZÃO:\s*([^\n\r]+)/i);
      const reasoning = reasonMatch ? reasonMatch[1].trim() : 'Análise baseada em indicadores técnicos';
      
      // Extrair risco
      const riskMatch = response.match(/RISCO:\s*(BAIXO|MÉDIO|ALTO)/);
      const risk = riskMatch ? riskMatch[1] : 'MÉDIO';
      
      // Extrair timeframe
      const timeframeMatch = response.match(/TIMEFRAME:\s*(\d+)/);
      const timeframe = timeframeMatch ? `${timeframeMatch[1]} dias` : '3-5 dias';

      return {
        recommendation,
        confidence: Math.min(Math.max(confidence, 1), 10),
        reasoning,
        risk,
        timeframe,
        currentPrice: originalData.currentPrice,
        volatility: originalData.statistics.volatility,
        rawResponse: llmResponse.substring(0, 500) // Para debug se necessário
      };
      
    } catch (error) {
      logger.error('❌ Erro ao processar resposta de trading:', error);
      return {
        recommendation: 'HOLD',
        confidence: 1,
        reasoning: 'Erro no processamento da análise',
        risk: 'ALTO',
        timeframe: '1-7 dias',
        currentPrice: originalData.currentPrice || 0,
        volatility: originalData.statistics?.volatility || 0
      };
    }
  }

  /**
   * Gera resumo geral do portfólio
   */
  generatePortfolioSummary(coinAnalyses) {
    const totalCoins = coinAnalyses.length;
    const buySignals = coinAnalyses.filter(c => c.recommendation === 'COMPRAR').length;
    const sellSignals = coinAnalyses.filter(c => c.recommendation === 'VENDER').length;
    const holdSignals = coinAnalyses.filter(c => c.recommendation === 'HOLD').length;
    
    const avgConfidence = coinAnalyses.reduce((sum, c) => sum + (c.confidence || 0), 0) / totalCoins;
    
    let marketSentiment = 'NEUTRO';
    if (buySignals > sellSignals && buySignals >= holdSignals) {
      marketSentiment = 'BULLISH';
    } else if (sellSignals > buySignals && sellSignals >= holdSignals) {
      marketSentiment = 'BEARISH';  
    }
    
    let recommendation = 'Diversifique e mantenha estratégia atual';
    if (buySignals >= totalCoins * 0.6) {
      recommendation = 'Considere aumentar posições em moedas selecionadas';
    } else if (sellSignals >= totalCoins * 0.6) {
      recommendation = 'Considere reduzir exposição e proteger capital';
    }

    return {
      totalCoins,
      signals: { buy: buySignals, sell: sellSignals, hold: holdSignals },
      averageConfidence: Math.round(avgConfidence * 10) / 10,
      marketSentiment,
      recommendation
    };
  }

  /**
   * Prepara dados estruturados para análise do LLM
   */
  prepareDataForLLMAnalysis(coinSymbol, historicalData, technicalAnalysis, comparisonAnalysis) {
    const prices = historicalData.map(item => item.prices.usd);
    const latest = prices[prices.length - 1];
    const oldest = prices[0];

    // Calcular métricas estatísticas
    const priceChanges = [];
    for (let i = 1; i < prices.length; i++) {
      priceChanges.push(((prices[i] - prices[i-1]) / prices[i-1]) * 100);
    }

    const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + Math.pow(change, 2), 0) / priceChanges.length);
    const avgDailyChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    
    // Detectar padrões
    const trends = this.detectPricePatterns(prices);
    const support_resistance = this.findSupportResistanceLevels(prices);
    
    // Preparar dados para o LLM
    return {
      coin: coinSymbol.toUpperCase(),
      currentPrice: latest,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
        totalChange: ((latest - oldest) / oldest) * 100
      },
      statistics: {
        volatility: volatility,
        avgDailyChange: avgDailyChange,
        dataPoints: prices.length,
        trendDirection: latest > oldest ? 'bullish' : 'bearish'
      },
      technicalIndicators: technicalAnalysis.analysis || null,
      patterns: trends,
      supportResistance: support_resistance,
      recentPrices: prices.slice(-10), // Últimos 10 preços
      comparison: comparisonAnalysis?.analysis || null
    };
  }

  /**
   * Constrói prompt especializado para análise de criptomoedas
   */
  buildLLMAnalysisPrompt(data) {
    return `Você é um analista especialista em criptomoedas com vasta experiência em análise técnica e fundamental. Analise os dados fornecidos e forneça uma recomendação precisa.

DADOS DA CRIPTOMOEDA: ${data.coin}

PREÇO ATUAL: $${data.currentPrice.toLocaleString()}

HISTÓRICO DE PREÇOS (${data.statistics.dataPoints} pontos):
- Preço mínimo: $${data.priceRange.min.toLocaleString()}
- Preço máximo: $${data.priceRange.max.toLocaleString()}
- Variação total: ${data.priceRange.totalChange.toFixed(2)}%
- Tendência geral: ${data.statistics.trendDirection}

MÉTRICAS ESTATÍSTICAS:
- Volatilidade: ${data.statistics.volatility.toFixed(2)}%
- Variação média diária: ${data.statistics.avgDailyChange.toFixed(2)}%

INDICADORES TÉCNICOS:
${data.technicalIndicators ? `
- Tendência: ${data.technicalIndicators.trend}
- RSI: ${data.technicalIndicators.rsi?.toFixed(1)} ${data.technicalIndicators.rsi > 70 ? '(Sobrecomprado)' : data.technicalIndicators.rsi < 30 ? '(Sobrevendido)' : '(Neutro)'}
- SMA 7 dias: $${data.technicalIndicators.sma7?.toLocaleString()}
- SMA 14 dias: $${data.technicalIndicators.sma14?.toLocaleString()}
- Volatilidade: ${data.technicalIndicators.volatilityPercent?.toFixed(2)}%
- Suporte: $${data.technicalIndicators.support?.toLocaleString()}
- Resistência: $${data.technicalIndicators.resistance?.toLocaleString()}
` : 'Dados técnicos insuficientes'}

ANÁLISE DE PADRÕES:
${JSON.stringify(data.patterns, null, 2)}

NÍVEIS DE SUPORTE E RESISTÊNCIA:
${JSON.stringify(data.supportResistance, null, 2)}

ÚLTIMOS 10 PREÇOS: $${data.recentPrices.map(p => p.toLocaleString()).join(', $')}

ANÁLISE SOLICITADA:
Com base nos dados históricos, análise técnica e padrões identificados, forneça:

1. RECOMENDAÇÃO PRINCIPAL (escolha UMA):
   - COMPRAR: Se os indicadores sugerem potencial de alta
   - VENDER: Se os indicadores sugerem potencial de queda
   - SEGURAR: Se a situação está incerta ou em consolidação

2. CONFIANÇA DA RECOMENDAÇÃO (1-10): Nível de confiança na sua análise

3. JUSTIFICATIVA (máximo 3 pontos): Principais fatores que levaram à recomendação

4. CENÁRIOS (3 cenários possíveis):
   - Otimista: Preço alvo e probabilidade
   - Realista: Preço alvo e probabilidade  
   - Pessimista: Preço alvo e probabilidade

5. PONTOS DE ENTRADA/SAÍDA:
   - Se COMPRAR: Preço ideal de entrada e stop loss
   - Se VENDER: Preço ideal de saída
   - Se SEGURAR: Níveis de observação

6. TIMEFRAME: Horizonte temporal da recomendação (curto/médio/longo prazo)

IMPORTANTE: Seja objetivo, preciso e baseie-se nos dados fornecidos. Evite recomendações genéricas.

FORMATO DA RESPOSTA (use exatamente este formato):
RECOMENDAÇÃO: [COMPRAR/VENDER/SEGURAR]
CONFIANÇA: [1-10]
JUSTIFICATIVA:
- [Ponto 1]
- [Ponto 2]  
- [Ponto 3]
CENÁRIO_OTIMISTA: $[preço] ([probabilidade]%)
CENÁRIO_REALISTA: $[preço] ([probabilidade]%)
CENÁRIO_PESSIMISTA: $[preço] ([probabilidade]%)
ENTRADA: $[preço]
STOP_LOSS: $[preço]
TIMEFRAME: [curto/médio/longo] prazo`;
  }

  /**
   * Analisa e extrai informações estruturadas da resposta do LLM
   */
  parseLLMAnalysisResponse(llmResponse, originalData) {
    try {
      const response = llmResponse.toLowerCase();
      
      // Extrair recomendação principal
      const recommendation = this.extractRecommendation(response);
      
      // Extrair nível de confiança
      const confidence = this.extractConfidence(response);
      
      // Extrair justificativas
      const justification = this.extractJustification(llmResponse);
      
      // Extrair cenários
      const scenarios = this.extractScenarios(llmResponse);
      
      // Extrair pontos de entrada/saída
      const tradingLevels = this.extractTradingLevels(llmResponse);
      
      // Extrair timeframe
      const timeframe = this.extractTimeframe(response);

      return {
        recommendation: recommendation,
        confidence: confidence,
        justification: justification,
        scenarios: scenarios,
        tradingLevels: tradingLevels,
        timeframe: timeframe,
        summary: this.generateAnalysisSummary(recommendation, confidence, scenarios),
        rawResponse: llmResponse,
        processedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Erro ao processar resposta do LLM:', error);
      return {
        recommendation: 'SEGURAR',
        confidence: 5,
        justification: ['Erro na análise automatizada'],
        scenarios: { optimistic: null, realistic: null, pessimistic: null },
        tradingLevels: { entry: null, stopLoss: null },
        timeframe: 'médio',
        summary: 'Análise inconclusiva devido a erro no processamento',
        rawResponse: llmResponse,
        error: error.message
      };
    }
  }

  /**
   * Extrai recomendação da resposta do LLM
   */
  extractRecommendation(response) {
    if (response.includes('comprar') || response.includes('buy')) return 'COMPRAR';
    if (response.includes('vender') || response.includes('sell')) return 'VENDER';
    return 'SEGURAR';
  }

  /**
   * Extrai nível de confiança
   */
  extractConfidence(response) {
    const confidenceMatch = response.match(/confiança.*?(\d+)/);
    if (confidenceMatch) {
      const conf = parseInt(confidenceMatch[1]);
      return Math.max(1, Math.min(10, conf)); // Entre 1-10
    }
    return 6; // Default médio
  }

  /**
   * Extrai justificativas
   */
  extractJustification(response) {
    const justifications = [];
    const lines = response.split('\n');
    let inJustification = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('justificativa')) {
        inJustification = true;
        continue;
      }
      
      if (inJustification) {
        if (line.startsWith('- ')) {
          justifications.push(line.substring(2).trim());
        } else if (line.toLowerCase().includes('cenário') || justifications.length >= 3) {
          break;
        }
      }
    }
    
    return justifications.length > 0 ? justifications : ['Análise baseada em dados técnicos e históricos'];
  }

  /**
   * Extrai cenários de preço
   */
  extractScenarios(response) {
    const scenarios = {};
    
    const optimisticMatch = response.match(/cenário_otimista.*?\$?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    const realisticMatch = response.match(/cenário_realista.*?\$?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    const pessimisticMatch = response.match(/cenário_pessimista.*?\$?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    
    if (optimisticMatch) scenarios.optimistic = parseFloat(optimisticMatch[1].replace(/,/g, ''));
    if (realisticMatch) scenarios.realistic = parseFloat(realisticMatch[1].replace(/,/g, ''));
    if (pessimisticMatch) scenarios.pessimistic = parseFloat(pessimisticMatch[1].replace(/,/g, ''));
    
    return scenarios;
  }

  /**
   * Extrai níveis de trading
   */
  extractTradingLevels(response) {
    const levels = {};
    
    const entryMatch = response.match(/entrada.*?\$?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    const stopLossMatch = response.match(/stop_loss.*?\$?(\d+(?:,\d+)*(?:\.\d+)?)/i);
    
    if (entryMatch) levels.entry = parseFloat(entryMatch[1].replace(/,/g, ''));
    if (stopLossMatch) levels.stopLoss = parseFloat(stopLossMatch[1].replace(/,/g, ''));
    
    return levels;
  }

  /**
   * Extrai timeframe
   */
  extractTimeframe(response) {
    if (response.includes('curto')) return 'curto';
    if (response.includes('longo')) return 'longo';
    return 'médio';
  }

  /**
   * Gera resumo da análise
   */
  generateAnalysisSummary(recommendation, confidence, scenarios) {
    const confidenceText = confidence >= 8 ? 'Alta confiança' : 
                          confidence >= 6 ? 'Confiança moderada' : 'Baixa confiança';
    
    let summary = `${recommendation} - ${confidenceText} (${confidence}/10)`;
    
    if (scenarios.realistic) {
      summary += ` - Projeção: $${scenarios.realistic.toLocaleString()}`;
    }
    
    return summary;
  }

  /**
   * Detecta padrões nos preços
   */
  detectPricePatterns(prices) {
    if (prices.length < 5) return { patterns: [], trend: 'insufficient_data' };

    const recent = prices.slice(-5);
    const older = prices.slice(-10, -5);
    
    // Detectar tendência
    const recentTrend = recent[recent.length-1] > recent[0] ? 'up' : 'down';
    const olderTrend = older.length > 0 ? (older[older.length-1] > older[0] ? 'up' : 'down') : 'neutral';
    
    const patterns = [];
    
    // Padrão de reversão
    if (recentTrend !== olderTrend) {
      patterns.push('reversal_pattern');
    }
    
    // Padrão de continuidade
    if (recentTrend === olderTrend) {
      patterns.push('continuation_pattern');
    }
    
    // Consolidação (baixa volatilidade)
    const maxRecent = Math.max(...recent);
    const minRecent = Math.min(...recent);
    const consolidationThreshold = 0.05; // 5%
    
    if ((maxRecent - minRecent) / minRecent < consolidationThreshold) {
      patterns.push('consolidation');
    }
    
    return {
      patterns,
      trend: recentTrend,
      strength: Math.abs(recent[recent.length-1] - recent[0]) / recent[0]
    };
  }

  /**
   * Encontra níveis de suporte e resistência
   */
  findSupportResistanceLevels(prices) {
    if (prices.length < 10) return { support: null, resistance: null };

    const sorted = [...prices].sort((a, b) => a - b);
    const length = sorted.length;
    
    // Suporte - área dos 25% menores preços
    const supportZone = sorted.slice(0, Math.floor(length * 0.25));
    const support = supportZone.reduce((sum, price) => sum + price, 0) / supportZone.length;
    
    // Resistência - área dos 25% maiores preços
    const resistanceZone = sorted.slice(Math.floor(length * 0.75));
    const resistance = resistanceZone.reduce((sum, price) => sum + price, 0) / resistanceZone.length;
    
    return {
      support: Math.round(support),
      resistance: Math.round(resistance),
      current_position: prices[prices.length-1] > support && prices[prices.length-1] < resistance ? 'middle' :
                       prices[prices.length-1] <= support ? 'near_support' : 'near_resistance'
    };
  }

  /**
   * Calcula confiança da análise baseada na qualidade dos dados
   */
  calculateAnalysisConfidence(data) {
    let confidence = 5; // Base
    
    // Mais dados = mais confiança
    if (data.statistics.dataPoints > 20) confidence += 1;
    if (data.statistics.dataPoints > 50) confidence += 1;
    
    // Baixa volatilidade = mais previsível
    if (data.statistics.volatility < 5) confidence += 1;
    
    // Tendência clara
    if (Math.abs(data.statistics.avgDailyChange) > 1) confidence += 1;
    
    // Indicadores técnicos disponíveis
    if (data.technicalIndicators) confidence += 1;
    
    return Math.max(1, Math.min(10, confidence));
  }
}

export default CryptoService;