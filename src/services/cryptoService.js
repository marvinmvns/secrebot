import axios from 'axios';
import { MongoClient } from 'mongodb';
import { CONFIG } from '../config/index.js';
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
    
    // MongoDB connection
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
    
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
  async getCurrentPrices() {
    const requiredCoins = ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'polygon'];
    let result = {};
    let attemptCount = 0;
    
    // Lista ordenada de fallbacks por prioridade/confiabilidade
    const fallbackMethods = [
      { name: 'CoinGecko', method: () => this.getCryptoPricesFromCoinGecko() },
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
    const staticPrices = {
      bitcoin: { usd: 118000, brl: 118000 * usdToBrl, source: 'Static-Emergency-Fallback' },
      ethereum: { usd: 3800, brl: 3800 * usdToBrl, source: 'Static-Emergency-Fallback' },
      cardano: { usd: 0.77, brl: 0.77 * usdToBrl, source: 'Static-Emergency-Fallback' },
      polkadot: { usd: 3.8, brl: 3.8 * usdToBrl, source: 'Static-Emergency-Fallback' },
      polygon: { usd: 0.9, brl: 0.9 * usdToBrl, source: 'Static-Emergency-Fallback' }
    };

    // Preencher dados ausentes com preços estáticos
    for (const coin of requiredCoins) {
      if (!result[coin] || typeof result[coin].usd !== 'number') {
        result[coin] = {
          usd: staticPrices[coin].usd,
          brl: staticPrices[coin].brl,
          usd_24h_change: 0,
          usd_market_cap: null,
          usd_24h_vol: null,
          source: staticPrices[coin].source
        };
        logger.warn(`⚠️ Usando preço estático para ${coin}: $${staticPrices[coin].usd}`);
      }
    }

    logger.info(`✅ Dados finais montados após ${attemptCount} tentativas de fallback`);
    return { ...result, timestamp: new Date().toISOString() };
  }

  /**
   * CoinGecko API call 
   */
  async getCryptoPricesFromCoinGecko() {
    const response = await axios.get(`${this.apiUrls.coinGecko}?ids=bitcoin,ethereum,cardano,polkadot,matic-network&vs_currencies=usd,brl&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`, {
      timeout: 5000
    });
    
    const data = response.data;
    
    // Verificar se houve erro de rate limit ou dados inválidos
    if (data.status && data.status.error_code) {
      throw new Error(`CoinGecko API Error: ${data.status.error_message}`);
    }
    
    // Validar se temos dados válidos para todas as moedas
    const requiredCoins = ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'matic-network'];
    for (const coin of requiredCoins) {
      if (!data[coin] || typeof data[coin].usd === 'undefined') {
        throw new Error(`Dados incompletos para ${coin} na resposta da CoinGecko`);
      }
    }
    
    return {
      bitcoin: {
        usd: data.bitcoin.usd,
        brl: data.bitcoin.brl,
        usd_24h_change: data.bitcoin.usd_24h_change,
        usd_market_cap: data.bitcoin.usd_market_cap,
        usd_24h_vol: data.bitcoin.usd_24h_vol,
        source: 'CoinGecko'
      },
      ethereum: {
        usd: data.ethereum.usd,
        brl: data.ethereum.brl,
        usd_24h_change: data.ethereum.usd_24h_change,
        usd_market_cap: data.ethereum.usd_market_cap,
        usd_24h_vol: data.ethereum.usd_24h_vol,
        source: 'CoinGecko'
      },
      cardano: {
        usd: data.cardano.usd,
        brl: data.cardano.brl,
        usd_24h_change: data.cardano.usd_24h_change,
        usd_market_cap: data.cardano.usd_market_cap,
        usd_24h_vol: data.cardano.usd_24h_vol,
        source: 'CoinGecko'
      },
      polkadot: {
        usd: data.polkadot.usd,
        brl: data.polkadot.brl,
        usd_24h_change: data.polkadot.usd_24h_change,
        usd_market_cap: data.polkadot.usd_market_cap,
        usd_24h_vol: data.polkadot.usd_24h_vol,
        source: 'CoinGecko'
      },
      polygon: {
        usd: data['matic-network'].usd,
        brl: data['matic-network'].brl,
        usd_24h_change: data['matic-network'].usd_24h_change,
        usd_market_cap: data['matic-network'].usd_market_cap,
        usd_24h_vol: data['matic-network'].usd_24h_vol,
        source: 'CoinGecko'
      }
    };
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
      
      // Armazenar histórico em memória
      this.storePriceHistory('bitcoin', currentPrices.bitcoin.usd);
      this.storePriceHistory('ethereum', currentPrices.ethereum.usd);
      this.storePriceHistory('cardano', currentPrices.cardano.usd);
      this.storePriceHistory('polkadot', currentPrices.polkadot.usd);
      this.storePriceHistory('polygon', currentPrices.polygon.usd);
      
      // Armazenar histórico no MongoDB
      await this.savePriceHistoryToDB(currentPrices);
      
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
      this.lastPrices.set('cardano', currentPrices.cardano.usd);
      this.lastPrices.set('polkadot', currentPrices.polkadot.usd);
      this.lastPrices.set('polygon', currentPrices.polygon.usd);
      
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
}

export default CryptoService;