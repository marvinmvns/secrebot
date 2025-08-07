import { test } from 'node:test';
import assert from 'node:assert';
import CryptoService from '../src/services/cryptoService.js';

test('CryptoService - Instanciação', () => {
  const cryptoService = new CryptoService();
  
  assert(cryptoService instanceof CryptoService, 'Deve instanciar CryptoService');
  assert(cryptoService.priceHistory instanceof Map, 'Deve ter Map para histórico');
  assert(cryptoService.activeMonitoring instanceof Map, 'Deve ter Map para monitoramento ativo');
  assert(cryptoService.lastPrices instanceof Map, 'Deve ter Map para últimos preços');
});

test('CryptoService - Ativação/Desativação de Monitoramento', () => {
  const cryptoService = new CryptoService();
  const userId = 'test_user_123';
  
  // Verificar status inicial
  let status = cryptoService.getMonitoringStatus(userId);
  assert.strictEqual(status.active, false, 'Deve estar inativo inicialmente');
  
  // Ativar monitoramento
  const activated = cryptoService.activateMonitoring(userId);
  assert(activated && typeof activated === 'object', 'Deve ativar com sucesso e retornar configuração');
  
  status = cryptoService.getMonitoringStatus(userId);
  assert.strictEqual(status.active, true, 'Deve estar ativo após ativação');
  assert.strictEqual(status.config.thresholdPercentage, 1.0, 'Deve ter threshold padrão de 1%');
  
  // Desativar monitoramento
  const deactivated = cryptoService.deactivateMonitoring(userId);
  assert.strictEqual(deactivated, true, 'Deve desativar com sucesso');
  
  status = cryptoService.getMonitoringStatus(userId);
  assert.strictEqual(status.active, false, 'Deve estar inativo após desativação');
});

test('CryptoService - Armazenamento de Histórico', () => {
  const cryptoService = new CryptoService();
  
  // Armazenar alguns preços
  cryptoService.storePriceHistory('bitcoin', 50000);
  cryptoService.storePriceHistory('bitcoin', 51000);
  cryptoService.storePriceHistory('ethereum', 3000);
  
  const btcHistory = cryptoService.priceHistory.get('bitcoin');
  const ethHistory = cryptoService.priceHistory.get('ethereum');
  
  assert.strictEqual(btcHistory.length, 2, 'Deve ter 2 registros de Bitcoin');
  assert.strictEqual(ethHistory.length, 1, 'Deve ter 1 registro de Ethereum');
  assert.strictEqual(btcHistory[0].price, 50000, 'Primeiro preço deve ser 50000');
  assert.strictEqual(btcHistory[1].price, 51000, 'Segundo preço deve ser 51000');
});

test('CryptoService - Cálculo de Variação', () => {
  const cryptoService = new CryptoService();
  
  // Adicionar dois preços para calcular variação
  cryptoService.storePriceHistory('bitcoin', 50000);
  cryptoService.storePriceHistory('bitcoin', 51000);
  
  const variation = cryptoService.calculateVariation('bitcoin');
  
  assert(variation !== null, 'Deve calcular variação');
  assert.strictEqual(variation.current, 51000, 'Preço atual deve ser 51000');
  assert.strictEqual(variation.previous, 50000, 'Preço anterior deve ser 50000');
  assert.strictEqual(variation.variation, 2, 'Variação deve ser 2%');
});

test('CryptoService - Formatação de Alertas', () => {
  const cryptoService = new CryptoService();
  const userId = 'test_user';
  
  const variation = {
    variation: 2.5,
    current: 52500,
    previous: 51300
  };
  
  const currentPrices = {
    bitcoin: { usd: 52500, brl: 273000 },
    ethereum: { usd: 3100, brl: 16120 }
  };
  
  const config = {
    thresholdPercentage: 1.0,
    timeframe: '1m'
  };
  
  // Simular envio de alerta
  cryptoService.sendVariationAlert(userId, 'bitcoin', variation, currentPrices, config);
  
  const pendingAlerts = cryptoService.getPendingAlerts();
  
  assert.strictEqual(pendingAlerts.length, 1, 'Deve ter 1 alerta pendente');
  assert.strictEqual(pendingAlerts[0].userId, userId, 'User ID deve estar correto');
  assert(pendingAlerts[0].message.includes('SUBIU'), 'Mensagem deve indicar subida');
  assert(pendingAlerts[0].message.includes('2.50%'), 'Mensagem deve mostrar percentual');
});

test('CryptoService - Estrutura de Configuração de APIs', () => {
  const cryptoService = new CryptoService();
  
  assert(cryptoService.apiUrls.coinGecko, 'Deve ter URL do CoinGecko');
  assert(cryptoService.apiUrls.binance, 'Deve ter URL do Binance');
  assert(cryptoService.config.checkInterval, 'Deve ter intervalo de verificação');
  assert(cryptoService.config.defaultThreshold, 'Deve ter threshold padrão');
});