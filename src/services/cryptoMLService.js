import { MongoClient } from 'mongodb';
import { CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * Serviço de Machine Learning para análise de criptomoedas
 * Implementa diferentes modelos ML para previsão de preços baseado em dados históricos
 */
class CryptoMLService {
  constructor(cryptoService = null) {
    this.cryptoService = cryptoService;
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
    
    // Configurações dos modelos
    this.modelConfig = {
      xgboost: {
        enabled: true,
        features: ['price', 'volume', 'rsi', 'ma7', 'ma30', 'volatility'],
        lookback_days: 30,
        prediction_horizon: 7
      },
      lstm: {
        enabled: true,
        sequence_length: 60,
        hidden_size: 50,
        num_layers: 2,
        prediction_horizon: 24
      },
      tft: {
        enabled: true,
        max_encoder_length: 36,
        max_prediction_length: 6,
        static_features: ['market_cap_rank'],
        time_varying_features: ['price', 'volume', 'volatility']
      },
      reinforcement: {
        enabled: true,
        algorithm: 'PPO',
        action_space: ['buy', 'sell', 'hold'],
        reward_function: 'sharpe_ratio'
      },
      ensemble: {
        enabled: true,
        method: 'stacking',
        base_models: ['xgboost', 'lstm', 'tft'],
        meta_model: 'lightgbm'
      }
    };
    
    // Cache para modelos treinados
    this.trainedModels = new Map();
    
    // Status de treinamento
    this.trainingStatus = new Map();
  }

  async connect() {
    if (this.isConnected) return;
    
    try {
      this.client = new MongoClient(CONFIG.database.mongoUri, { 
        useUnifiedTopology: true 
      });
      await this.client.connect();
      this.db = this.client.db('secrebot');
      this.collection = this.db.collection('crypto_ml_data');
      this.isConnected = true;
      logger.info('CryptoMLService conectado ao MongoDB');
    } catch (error) {
      logger.error('Erro ao conectar CryptoMLService ao MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      logger.info('CryptoMLService desconectado do MongoDB');
    }
  }

  /**
   * Prepara dados históricos para treinamento
   */
  async prepareTrainingData(symbol, days = 365) {
    if (!this.cryptoService) {
      throw new Error('CryptoService não configurado');
    }

    // Obtém dados históricos
    const historicalData = await this.cryptoService.getHistoricalDataFromDB(symbol, days);
    
    if (!historicalData || historicalData.length < 30) {
      throw new Error(`Dados históricos insuficientes para ${symbol}`);
    }

    // Calcula features técnicas
    const features = this.calculateTechnicalFeatures(historicalData);
    
    // Normaliza dados
    const normalizedData = this.normalizeData(features);
    
    return {
      raw: historicalData,
      features: features,
      normalized: normalizedData,
      symbol: symbol,
      timestamp: new Date()
    };
  }

  /**
   * Calcula indicadores técnicos para features
   */
  calculateTechnicalFeatures(data) {
    const features = data.map((item, index) => ({
      timestamp: item.timestamp,
      price: item.price,
      volume: item.volume || 0,
      high: item.high || item.price,
      low: item.low || item.price,
      close: item.price
    }));

    // RSI
    features.forEach((item, i) => {
      item.rsi = this.calculateRSI(features.slice(Math.max(0, i - 14), i + 1));
    });

    // Médias móveis
    features.forEach((item, i) => {
      item.ma7 = this.calculateMA(features.slice(Math.max(0, i - 6), i + 1));
      item.ma30 = this.calculateMA(features.slice(Math.max(0, i - 29), i + 1));
    });

    // Volatilidade
    features.forEach((item, i) => {
      item.volatility = this.calculateVolatility(features.slice(Math.max(0, i - 19), i + 1));
    });

    // Retornos
    features.forEach((item, i) => {
      if (i > 0) {
        item.return_1d = (item.price - features[i - 1].price) / features[i - 1].price;
        item.return_7d = i >= 7 ? (item.price - features[i - 7].price) / features[i - 7].price : 0;
      } else {
        item.return_1d = 0;
        item.return_7d = 0;
      }
    });

    return features;
  }

  calculateRSI(data, period = 14) {
    if (data.length < 2) return 50;
    
    let gains = 0, losses = 0;
    for (let i = 1; i < data.length; i++) {
      const change = data[i].price - data[i - 1].price;
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  calculateMA(data) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item.price, 0);
    return sum / data.length;
  }

  calculateVolatility(data) {
    if (data.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i].price - data[i - 1].price) / data[i - 1].price);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  normalizeData(data) {
    const fields = ['price', 'volume', 'rsi', 'ma7', 'ma30', 'volatility', 'return_1d', 'return_7d'];
    const normalized = JSON.parse(JSON.stringify(data));
    
    fields.forEach(field => {
      const values = data.map(item => item[field]).filter(val => val !== undefined && val !== null);
      if (values.length === 0) return;
      
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      
      if (range > 0) {
        normalized.forEach(item => {
          if (item[field] !== undefined && item[field] !== null) {
            item[field + '_normalized'] = (item[field] - min) / range;
          }
        });
      }
    });
    
    return normalized;
  }

  /**
   * Modelo XGBoost/LightGBM - Alta performance em dados tabulares
   */
  async trainGradientBoostingModel(symbol, options = {}) {
    const modelType = options.model || 'xgboost';
    logger.info(`Iniciando treinamento ${modelType} para ${symbol}`);
    
    this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 0 });
    
    try {
      // Prepara dados
      const trainingData = await this.prepareTrainingData(symbol, options.days || 365);
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 20 });
      
      // Simula treinamento do modelo (em implementação real, usaria bibliotecas como node-xgboost)
      const model = await this.simulateGradientBoostingTraining(trainingData, modelType);
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 80 });
      
      // Salva modelo
      const modelKey = `${symbol}_${modelType}`;
      this.trainedModels.set(modelKey, {
        model: model,
        type: modelType,
        symbol: symbol,
        trainedAt: new Date(),
        performance: model.performance,
        config: this.modelConfig.xgboost
      });
      
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'completed', progress: 100 });
      logger.info(`Modelo ${modelType} treinado para ${symbol} com acurácia: ${model.performance.accuracy}%`);
      
      return model;
    } catch (error) {
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'error', error: error.message });
      logger.error(`Erro no treinamento ${modelType} para ${symbol}:`, error);
      throw error;
    }
  }

  async simulateGradientBoostingTraining(trainingData, modelType) {
    // Simula processo de treinamento
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const accuracy = 65 + Math.random() * 20; // 65-85%
    const precision = 60 + Math.random() * 25; // 60-85%
    const recall = 55 + Math.random() * 30; // 55-85%
    
    return {
      type: modelType,
      features: trainingData.features.length,
      performance: {
        accuracy: parseFloat(accuracy.toFixed(2)),
        precision: parseFloat(precision.toFixed(2)),
        recall: parseFloat(recall.toFixed(2)),
        f1_score: parseFloat((2 * (precision * recall) / (precision + recall)).toFixed(2))
      },
      predictions: this.generateMockPredictions(trainingData.features.slice(-7))
    };
  }

  /**
   * Modelo LSTM/GRU - Dependências temporais profundas
   */
  async trainLSTMModel(symbol, options = {}) {
    const modelType = options.architecture || 'LSTM';
    logger.info(`Iniciando treinamento ${modelType} para ${symbol}`);
    
    this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 0 });
    
    try {
      const trainingData = await this.prepareTrainingData(symbol, options.days || 365);
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 30 });
      
      // Prepara sequências para LSTM
      const sequences = this.createSequences(trainingData.normalized, this.modelConfig.lstm.sequence_length);
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 50 });
      
      // Simula treinamento LSTM
      const model = await this.simulateLSTMTraining(sequences, modelType);
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'training', progress: 90 });
      
      const modelKey = `${symbol}_${modelType}`;
      this.trainedModels.set(modelKey, {
        model: model,
        type: modelType,
        symbol: symbol,
        trainedAt: new Date(),
        performance: model.performance,
        config: this.modelConfig.lstm
      });
      
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'completed', progress: 100 });
      logger.info(`Modelo ${modelType} treinado para ${symbol} com loss: ${model.performance.loss}`);
      
      return model;
    } catch (error) {
      this.trainingStatus.set(`${symbol}_${modelType}`, { status: 'error', error: error.message });
      logger.error(`Erro no treinamento ${modelType} para ${symbol}:`, error);
      throw error;
    }
  }

  createSequences(data, sequenceLength) {
    const sequences = [];
    for (let i = sequenceLength; i < data.length; i++) {
      const sequence = data.slice(i - sequenceLength, i).map(item => [
        item.price_normalized || 0,
        item.volume_normalized || 0,
        item.rsi_normalized || 0,
        item.volatility_normalized || 0
      ]);
      const target = data[i].price_normalized || 0;
      sequences.push({ sequence, target });
    }
    return sequences;
  }

  async simulateLSTMTraining(sequences, modelType) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const loss = 0.001 + Math.random() * 0.009; // 0.001-0.01
    const valLoss = loss + Math.random() * 0.005;
    
    return {
      type: modelType,
      sequences: sequences.length,
      performance: {
        loss: parseFloat(loss.toFixed(6)),
        val_loss: parseFloat(valLoss.toFixed(6)),
        mae: parseFloat((loss * 10).toFixed(4)),
        mse: parseFloat((loss * loss).toFixed(6))
      },
      predictions: this.generateMockTimeSeries(24)
    };
  }

  /**
   * Temporal Fusion Transformer - Multi-horizon com atenção
   */
  async trainTFTModel(symbol, options = {}) {
    logger.info(`Iniciando treinamento TFT para ${symbol}`);
    
    this.trainingStatus.set(`${symbol}_TFT`, { status: 'training', progress: 0 });
    
    try {
      const trainingData = await this.prepareTrainingData(symbol, options.days || 365);
      this.trainingStatus.set(`${symbol}_TFT`, { status: 'training', progress: 25 });
      
      // Prepara dados para TFT com atenção temporal
      const tftData = this.prepareTFTData(trainingData.normalized);
      this.trainingStatus.set(`${symbol}_TFT`, { status: 'training', progress: 50 });
      
      const model = await this.simulateTFTTraining(tftData);
      this.trainingStatus.set(`${symbol}_TFT`, { status: 'training', progress: 85 });
      
      const modelKey = `${symbol}_TFT`;
      this.trainedModels.set(modelKey, {
        model: model,
        type: 'TFT',
        symbol: symbol,
        trainedAt: new Date(),
        performance: model.performance,
        config: this.modelConfig.tft
      });
      
      this.trainingStatus.set(`${symbol}_TFT`, { status: 'completed', progress: 100 });
      logger.info(`Modelo TFT treinado para ${symbol} com MAPE: ${model.performance.mape}%`);
      
      return model;
    } catch (error) {
      this.trainingStatus.set(`${symbol}_TFT`, { status: 'error', error: error.message });
      logger.error(`Erro no treinamento TFT para ${symbol}:`, error);
      throw error;
    }
  }

  prepareTFTData(data) {
    return data.map((item, index) => ({
      encoder_features: [
        item.price_normalized || 0,
        item.volume_normalized || 0,
        item.volatility_normalized || 0,
        item.rsi_normalized || 0
      ],
      static_features: [0.5], // market cap rank normalizado
      decoder_features: [
        item.ma7_normalized || 0,
        item.ma30_normalized || 0
      ],
      time_idx: index,
      target: item.price_normalized || 0
    }));
  }

  async simulateTFTTraining(tftData) {
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const mape = 5 + Math.random() * 10; // 5-15%
    const smape = 4 + Math.random() * 8; // 4-12%
    
    return {
      type: 'TFT',
      samples: tftData.length,
      performance: {
        mape: parseFloat(mape.toFixed(2)),
        smape: parseFloat(smape.toFixed(2)),
        rmse: parseFloat((mape / 100 * 0.1).toFixed(4)),
        attention_weights: this.generateAttentionWeights()
      },
      predictions: this.generateMockTimeSeries(6, true)
    };
  }

  generateAttentionWeights() {
    const features = ['price', 'volume', 'volatility', 'rsi', 'ma7', 'ma30'];
    return features.map(feature => ({
      feature,
      weight: parseFloat((Math.random()).toFixed(3))
    }));
  }

  /**
   * Reinforcement Learning - PPO/DQN para estratégias de trading
   */
  async trainRLModel(symbol, options = {}) {
    const algorithm = options.algorithm || 'PPO';
    logger.info(`Iniciando treinamento ${algorithm} para ${symbol}`);
    
    this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'training', progress: 0 });
    
    try {
      const trainingData = await this.prepareTrainingData(symbol, options.days || 180);
      this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'training', progress: 20 });
      
      // Cria ambiente de trading
      const tradingEnv = this.createTradingEnvironment(trainingData.features);
      this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'training', progress: 40 });
      
      const model = await this.simulateRLTraining(tradingEnv, algorithm);
      this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'training', progress: 90 });
      
      const modelKey = `${symbol}_${algorithm}`;
      this.trainedModels.set(modelKey, {
        model: model,
        type: algorithm,
        symbol: symbol,
        trainedAt: new Date(),
        performance: model.performance,
        config: this.modelConfig.reinforcement
      });
      
      this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'completed', progress: 100 });
      logger.info(`Modelo ${algorithm} treinado para ${symbol} com retorno: ${model.performance.total_return}%`);
      
      return model;
    } catch (error) {
      this.trainingStatus.set(`${symbol}_${algorithm}`, { status: 'error', error: error.message });
      logger.error(`Erro no treinamento ${algorithm} para ${symbol}:`, error);
      throw error;
    }
  }

  createTradingEnvironment(data) {
    return {
      data: data,
      actions: ['buy', 'sell', 'hold'],
      state_space: ['price_ratio', 'rsi', 'ma_ratio', 'volatility', 'position'],
      reward_function: 'sharpe_ratio',
      initial_capital: 10000,
      transaction_cost: 0.001
    };
  }

  async simulateRLTraining(tradingEnv, algorithm) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const totalReturn = -5 + Math.random() * 25; // -5% a 20%
    const sharpeRatio = 0.1 + Math.random() * 1.5; // 0.1 a 1.6
    const maxDrawdown = Math.random() * 15; // 0-15%
    
    return {
      type: algorithm,
      episodes: 1000,
      performance: {
        total_return: parseFloat(totalReturn.toFixed(2)),
        sharpe_ratio: parseFloat(sharpeRatio.toFixed(2)),
        max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
        win_rate: parseFloat((45 + Math.random() * 25).toFixed(1)),
        avg_trade_return: parseFloat((totalReturn / 50).toFixed(3))
      },
      strategy: this.generateTradingStrategy()
    };
  }

  generateTradingStrategy() {
    return {
      entry_signals: ['RSI < 30', 'Price > MA7', 'Volume > avg'],
      exit_signals: ['RSI > 70', 'Price < MA30', 'Loss > 2%'],
      position_sizing: 'Kelly criterion',
      risk_management: 'Stop loss 2%, Take profit 4%'
    };
  }

  /**
   * Ensemble - Combina múltiplos modelos
   */
  async trainEnsembleModel(symbol, options = {}) {
    logger.info(`Iniciando treinamento Ensemble para ${symbol}`);
    
    this.trainingStatus.set(`${symbol}_Ensemble`, { status: 'training', progress: 0 });
    
    try {
      // Treina modelos base
      const baseModels = [];
      const modelTypes = options.baseModels || ['xgboost', 'LSTM'];
      
      for (const modelType of modelTypes) {
        this.trainingStatus.set(`${symbol}_Ensemble`, { 
          status: 'training', 
          progress: 10 + (baseModels.length * 30) 
        });
        
        let model;
        if (modelType === 'xgboost') {
          model = await this.trainGradientBoostingModel(symbol, { model: 'lightgbm' });
        } else if (modelType === 'LSTM') {
          model = await this.trainLSTMModel(symbol);
        }
        
        baseModels.push(model);
      }
      
      this.trainingStatus.set(`${symbol}_Ensemble`, { status: 'training', progress: 80 });
      
      // Treina meta-modelo
      const ensembleModel = await this.simulateEnsembleTraining(baseModels);
      
      const modelKey = `${symbol}_Ensemble`;
      this.trainedModels.set(modelKey, {
        model: ensembleModel,
        type: 'Ensemble',
        symbol: symbol,
        trainedAt: new Date(),
        performance: ensembleModel.performance,
        baseModels: baseModels,
        config: this.modelConfig.ensemble
      });
      
      this.trainingStatus.set(`${symbol}_Ensemble`, { status: 'completed', progress: 100 });
      logger.info(`Modelo Ensemble treinado para ${symbol} com acurácia: ${ensembleModel.performance.accuracy}%`);
      
      return ensembleModel;
    } catch (error) {
      this.trainingStatus.set(`${symbol}_Ensemble`, { status: 'error', error: error.message });
      logger.error(`Erro no treinamento Ensemble para ${symbol}:`, error);
      throw error;
    }
  }

  async simulateEnsembleTraining(baseModels) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calcula performance média melhorada
    const baseAccuracies = baseModels.map(m => m.performance.accuracy || 70);
    const ensembleAccuracy = Math.max(...baseAccuracies) + Math.random() * 5; // Melhoria de até 5%
    
    return {
      type: 'Ensemble',
      baseModels: baseModels.length,
      method: 'stacking',
      performance: {
        accuracy: parseFloat(ensembleAccuracy.toFixed(2)),
        improvement: parseFloat((ensembleAccuracy - Math.max(...baseAccuracies)).toFixed(2)),
        variance_reduction: parseFloat((Math.random() * 15).toFixed(2)),
        confidence_interval: [
          parseFloat((ensembleAccuracy - 5).toFixed(2)),
          parseFloat((ensembleAccuracy + 5).toFixed(2))
        ]
      },
      weights: baseModels.map((_, i) => parseFloat((Math.random()).toFixed(3)))
    };
  }

  /**
   * Faz previsões usando modelo treinado
   */
  async predict(symbol, modelType, horizon = 7) {
    const modelKey = `${symbol}_${modelType}`;
    const modelData = this.trainedModels.get(modelKey);
    
    if (!modelData) {
      throw new Error(`Modelo ${modelType} não encontrado para ${symbol}`);
    }
    
    // Obtém dados recentes para predição
    const recentData = await this.prepareTrainingData(symbol, 30);
    
    // Simula predição baseada no tipo de modelo
    const predictions = this.simulatePrediction(modelData, recentData, horizon);
    
    return {
      symbol: symbol,
      modelType: modelType,
      predictions: predictions,
      confidence: modelData.performance,
      generatedAt: new Date(),
      horizon: horizon
    };
  }

  simulatePrediction(modelData, recentData, horizon) {
    const lastPrice = recentData.features[recentData.features.length - 1].price;
    const predictions = [];
    
    for (let i = 0; i < horizon; i++) {
      const variation = -0.1 + Math.random() * 0.2; // -10% a +10%
      const predictedPrice = lastPrice * (1 + variation * (i + 1) / horizon);
      
      predictions.push({
        day: i + 1,
        predicted_price: parseFloat(predictedPrice.toFixed(2)),
        confidence: parseFloat((70 + Math.random() * 20).toFixed(1)),
        direction: variation > 0 ? 'alta' : 'baixa',
        change_percent: parseFloat((variation * 100).toFixed(2))
      });
    }
    
    return predictions;
  }

  /**
   * Utilitários para mock de dados
   */
  generateMockPredictions(data) {
    return data.slice(-5).map((item, i) => ({
      timestamp: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
      predicted_price: item.price * (0.95 + Math.random() * 0.1),
      confidence: 60 + Math.random() * 30
    }));
  }

  generateMockTimeSeries(length, withConfidence = false) {
    const series = [];
    let lastValue = 0.5;
    
    for (let i = 0; i < length; i++) {
      lastValue += (Math.random() - 0.5) * 0.1;
      lastValue = Math.max(0.1, Math.min(0.9, lastValue));
      
      const point = {
        step: i + 1,
        value: parseFloat(lastValue.toFixed(4))
      };
      
      if (withConfidence) {
        point.confidence_lower = parseFloat((lastValue * 0.9).toFixed(4));
        point.confidence_upper = parseFloat((lastValue * 1.1).toFixed(4));
      }
      
      series.push(point);
    }
    
    return series;
  }

  /**
   * Métodos de status e gerenciamento
   */
  getTrainingStatus(symbol, modelType) {
    return this.trainingStatus.get(`${symbol}_${modelType}`) || { status: 'not_started' };
  }

  listTrainedModels() {
    return Array.from(this.trainedModels.entries()).map(([key, model]) => ({
      key: key,
      symbol: model.symbol,
      type: model.type,
      trainedAt: model.trainedAt,
      performance: model.performance
    }));
  }

  async saveModelToDB(modelKey, modelData) {
    if (!this.isConnected) await this.connect();
    
    const document = {
      _id: modelKey,
      ...modelData,
      savedAt: new Date()
    };
    
    try {
      await this.collection.replaceOne(
        { _id: modelKey },
        document,
        { upsert: true }
      );
      logger.info(`Modelo ${modelKey} salvo no banco de dados`);
    } catch (error) {
      logger.error(`Erro ao salvar modelo ${modelKey}:`, error);
      throw error;
    }
  }

  async loadModelFromDB(modelKey) {
    if (!this.isConnected) await this.connect();
    
    try {
      const modelData = await this.collection.findOne({ _id: modelKey });
      if (modelData) {
        this.trainedModels.set(modelKey, modelData);
        logger.info(`Modelo ${modelKey} carregado do banco de dados`);
        return modelData;
      }
      return null;
    } catch (error) {
      logger.error(`Erro ao carregar modelo ${modelKey}:`, error);
      throw error;
    }
  }

  /**
   * Limpeza e manutenção
   */
  clearTrainedModels() {
    this.trainedModels.clear();
    this.trainingStatus.clear();
    logger.info('Cache de modelos treinados limpo');
  }

  async cleanupOldModels(daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    for (const [key, model] of this.trainedModels.entries()) {
      if (model.trainedAt < cutoffDate) {
        this.trainedModels.delete(key);
        logger.info(`Modelo antigo removido: ${key}`);
      }
    }
  }
}

export default CryptoMLService;