import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import CryptoMLService from '../src/services/cryptoMLService.js';
import CryptoService from '../src/services/cryptoService.js';

describe('CryptoMLService', () => {
  let cryptoMLService;
  let cryptoService;

  beforeEach(async () => {
    cryptoService = new CryptoService();
    cryptoMLService = new CryptoMLService(cryptoService);
  });

  afterEach(async () => {
    if (cryptoMLService && cryptoMLService.isConnected) {
      await cryptoMLService.disconnect();
    }
    if (cryptoService && cryptoService.isConnected) {
      await cryptoService.disconnect();
    }
    
    // Limpa cache de modelos
    cryptoMLService?.clearTrainedModels();
  });

  describe('Inicialização', () => {
    test('deve inicializar com configurações corretas', () => {
      assert.ok(cryptoMLService);
      assert.ok(cryptoMLService.modelConfig);
      assert.ok(cryptoMLService.modelConfig.xgboost);
      assert.ok(cryptoMLService.modelConfig.lstm);
      assert.ok(cryptoMLService.modelConfig.tft);
      assert.ok(cryptoMLService.modelConfig.reinforcement);
      assert.ok(cryptoMLService.modelConfig.ensemble);
    });

    test('deve ter cache de modelos vazio inicialmente', () => {
      const models = cryptoMLService.listTrainedModels();
      assert.strictEqual(models.length, 0);
    });
  });

  describe('Preparação de Dados', () => {
    test('deve calcular RSI corretamente', () => {
      const mockData = [
        { price: 100 },
        { price: 105 },
        { price: 102 },
        { price: 108 },
        { price: 110 }
      ];
      
      const rsi = cryptoMLService.calculateRSI(mockData);
      assert.ok(rsi >= 0 && rsi <= 100);
    });

    test('deve calcular média móvel corretamente', () => {
      const mockData = [
        { price: 100 },
        { price: 200 },
        { price: 300 }
      ];
      
      const ma = cryptoMLService.calculateMA(mockData);
      assert.strictEqual(ma, 200); // (100 + 200 + 300) / 3
    });

    test('deve calcular volatilidade', () => {
      const mockData = [
        { price: 100 },
        { price: 110 },
        { price: 95 },
        { price: 105 }
      ];
      
      const volatility = cryptoMLService.calculateVolatility(mockData);
      assert.ok(volatility >= 0);
    });

    test('deve normalizar dados corretamente', () => {
      const mockData = [
        { price: 100, volume: 1000 },
        { price: 200, volume: 2000 },
        { price: 300, volume: 3000 }
      ];
      
      const normalized = cryptoMLService.normalizeData(mockData);
      
      // Valores normalizados devem estar entre 0 e 1
      normalized.forEach(item => {
        assert.ok(item.price_normalized >= 0 && item.price_normalized <= 1);
        assert.ok(item.volume_normalized >= 0 && item.volume_normalized <= 1);
      });
    });

    test('deve criar sequências para LSTM', () => {
      const mockData = Array.from({ length: 70 }, (_, i) => ({
        price_normalized: i / 100,
        volume_normalized: (i + 10) / 100,
        rsi_normalized: Math.random(),
        volatility_normalized: Math.random()
      }));
      
      const sequences = cryptoMLService.createSequences(mockData, 60);
      assert.ok(sequences.length > 0);
      
      sequences.forEach(seq => {
        assert.ok(Array.isArray(seq.sequence));
        assert.strictEqual(seq.sequence.length, 60);
        assert.ok(typeof seq.target === 'number');
      });
    });
  });

  describe('Treinamento de Modelos', () => {
    test('deve simular treinamento XGBoost', async () => {
      // Mock de dados históricos suficientes
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      // Mock do cryptoService
      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      const result = await cryptoMLService.trainGradientBoostingModel('bitcoin');
      
      assert.ok(result);
      assert.strictEqual(result.type, 'xgboost');
      assert.ok(result.performance);
      assert.ok(result.performance.accuracy >= 0 && result.performance.accuracy <= 100);
      assert.ok(Array.isArray(result.predictions));
    });

    test('deve simular treinamento LSTM', async () => {
      const mockHistoricalData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      const result = await cryptoMLService.trainLSTMModel('ethereum');
      
      assert.ok(result);
      assert.strictEqual(result.type, 'LSTM');
      assert.ok(result.performance.loss >= 0);
      assert.ok(result.performance.val_loss >= 0);
      assert.ok(Array.isArray(result.predictions));
    });

    test('deve simular treinamento TFT', async () => {
      const mockHistoricalData = Array.from({ length: 80 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 3000 + Math.random() * 1000,
        volume: 500000 + Math.random() * 250000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      const result = await cryptoMLService.trainTFTModel('cardano');
      
      assert.ok(result);
      assert.strictEqual(result.type, 'TFT');
      assert.ok(result.performance.mape >= 0);
      assert.ok(result.performance.smape >= 0);
      assert.ok(Array.isArray(result.performance.attention_weights));
      assert.ok(Array.isArray(result.predictions));
    });

    test('deve simular treinamento Reinforcement Learning', async () => {
      const mockHistoricalData = Array.from({ length: 60 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 1000 + Math.random() * 500,
        volume: 100000 + Math.random() * 50000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      const result = await cryptoMLService.trainRLModel('polkadot', { algorithm: 'PPO' });
      
      assert.ok(result);
      assert.strictEqual(result.type, 'PPO');
      assert.ok(typeof result.performance.total_return === 'number');
      assert.ok(result.performance.sharpe_ratio >= 0);
      assert.ok(result.performance.win_rate >= 0 && result.performance.win_rate <= 100);
      assert.ok(result.strategy);
    });

    test('deve simular treinamento Ensemble', async () => {
      const mockHistoricalData = Array.from({ length: 120 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 500 + Math.random() * 200,
        volume: 200000 + Math.random() * 100000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      const result = await cryptoMLService.trainEnsembleModel('polygon');
      
      assert.ok(result);
      assert.strictEqual(result.type, 'Ensemble');
      assert.ok(result.performance.accuracy >= 0);
      assert.ok(result.performance.improvement >= 0);
      assert.ok(Array.isArray(result.weights));
    });
  });

  describe('Status de Treinamento', () => {
    test('deve trackear status de treinamento', async () => {
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      // Inicia treinamento em background
      const trainingPromise = cryptoMLService.trainGradientBoostingModel('bitcoin');
      
      // Verifica status durante o treinamento
      const statusDuringTraining = cryptoMLService.getTrainingStatus('bitcoin', 'xgboost');
      assert.strictEqual(statusDuringTraining.status, 'training');
      
      await trainingPromise;
      
      // Verifica status após conclusão
      const statusAfterTraining = cryptoMLService.getTrainingStatus('bitcoin', 'xgboost');
      assert.strictEqual(statusAfterTraining.status, 'completed');
    });

    test('deve listar modelos treinados', async () => {
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      await cryptoMLService.trainGradientBoostingModel('bitcoin');
      await cryptoMLService.trainLSTMModel('ethereum');
      
      const trainedModels = cryptoMLService.listTrainedModels();
      
      assert.strictEqual(trainedModels.length, 2);
      assert.ok(trainedModels.find(m => m.symbol === 'bitcoin' && m.type === 'xgboost'));
      assert.ok(trainedModels.find(m => m.symbol === 'ethereum' && m.type === 'LSTM'));
    });
  });

  describe('Previsões', () => {
    test('deve fazer previsões com modelo treinado', async () => {
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      // Treina modelo primeiro
      await cryptoMLService.trainGradientBoostingModel('bitcoin');
      
      // Faz previsão
      const prediction = await cryptoMLService.predict('bitcoin', 'xgboost', 5);
      
      assert.ok(prediction);
      assert.strictEqual(prediction.symbol, 'bitcoin');
      assert.strictEqual(prediction.modelType, 'xgboost');
      assert.strictEqual(prediction.horizon, 5);
      assert.ok(Array.isArray(prediction.predictions));
      assert.strictEqual(prediction.predictions.length, 5);
      
      // Verifica estrutura das previsões
      prediction.predictions.forEach((pred, index) => {
        assert.strictEqual(pred.day, index + 1);
        assert.ok(typeof pred.predicted_price === 'number');
        assert.ok(typeof pred.confidence === 'number');
        assert.ok(['alta', 'baixa'].includes(pred.direction));
        assert.ok(typeof pred.change_percent === 'number');
      });
    });

    test('deve falhar ao fazer previsão sem modelo treinado', async () => {
      try {
        await cryptoMLService.predict('bitcoin', 'xgboost', 7);
        assert.fail('Deveria ter lançado erro');
      } catch (error) {
        assert.ok(error.message.includes('não encontrado'));
      }
    });
  });

  describe('Gerenciamento de Cache', () => {
    test('deve limpar modelos treinados', async () => {
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      await cryptoMLService.trainGradientBoostingModel('bitcoin');
      
      let models = cryptoMLService.listTrainedModels();
      assert.strictEqual(models.length, 1);
      
      cryptoMLService.clearTrainedModels();
      
      models = cryptoMLService.listTrainedModels();
      assert.strictEqual(models.length, 0);
    });

    test('deve limpar modelos antigos', async () => {
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        price: 50000 + Math.random() * 10000,
        volume: 1000000 + Math.random() * 500000
      }));

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      // Treina modelo
      await cryptoMLService.trainGradientBoostingModel('bitcoin');
      
      // Simula modelo antigo alterando data manualmente
      const models = Array.from(cryptoMLService.trainedModels.entries());
      if (models.length > 0) {
        const [key, model] = models[0];
        model.trainedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 dias atrás
        cryptoMLService.trainedModels.set(key, model);
      }
      
      // Limpa modelos antigos (30 dias)
      await cryptoMLService.cleanupOldModels(30);
      
      const remainingModels = cryptoMLService.listTrainedModels();
      assert.strictEqual(remainingModels.length, 0);
    });
  });

  describe('Validação de Entrada', () => {
    test('deve falhar com dados históricos insuficientes', async () => {
      const mockHistoricalData = [
        { timestamp: new Date(), price: 50000, volume: 1000000 }
      ];

      cryptoService.getHistoricalDataFromDB = async () => mockHistoricalData;
      
      try {
        await cryptoMLService.trainGradientBoostingModel('bitcoin');
        assert.fail('Deveria ter lançado erro');
      } catch (error) {
        assert.ok(error.message.includes('insuficientes'));
      }
    });

    test('deve falhar sem cryptoService configurado', async () => {
      const mlServiceSemCrypto = new CryptoMLService();
      
      try {
        await mlServiceSemCrypto.trainGradientBoostingModel('bitcoin');
        assert.fail('Deveria ter lançado erro');
      } catch (error) {
        assert.ok(error.message.includes('não configurado'));
      }
    });
  });

  describe('Utilitários de Mock', () => {
    test('deve gerar previsões mock', () => {
      const mockData = [
        { price: 50000 },
        { price: 51000 },
        { price: 49000 }
      ];
      
      const predictions = cryptoMLService.generateMockPredictions(mockData);
      
      assert.ok(Array.isArray(predictions));
      predictions.forEach(pred => {
        assert.ok(pred.timestamp instanceof Date);
        assert.ok(typeof pred.predicted_price === 'number');
        assert.ok(typeof pred.confidence === 'number');
      });
    });

    test('deve gerar séries temporais mock', () => {
      const series = cryptoMLService.generateMockTimeSeries(10, true);
      
      assert.strictEqual(series.length, 10);
      series.forEach((point, index) => {
        assert.strictEqual(point.step, index + 1);
        assert.ok(typeof point.value === 'number');
        assert.ok(typeof point.confidence_lower === 'number');
        assert.ok(typeof point.confidence_upper === 'number');
      });
    });

    test('deve gerar pesos de atenção', () => {
      const weights = cryptoMLService.generateAttentionWeights();
      
      assert.ok(Array.isArray(weights));
      weights.forEach(weight => {
        assert.ok(typeof weight.feature === 'string');
        assert.ok(typeof weight.weight === 'number');
        assert.ok(weight.weight >= 0 && weight.weight <= 1);
      });
    });

    test('deve gerar estratégia de trading', () => {
      const strategy = cryptoMLService.generateTradingStrategy();
      
      assert.ok(Array.isArray(strategy.entry_signals));
      assert.ok(Array.isArray(strategy.exit_signals));
      assert.ok(typeof strategy.position_sizing === 'string');
      assert.ok(typeof strategy.risk_management === 'string');
    });
  });
});