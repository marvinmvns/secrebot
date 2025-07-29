import { test } from 'node:test';
import assert from 'node:assert';
import { ChatGPTAPIClient } from '../src/services/chatgptApiClient.js';

test('ChatGPTAPIClient - Instanciação', () => {
  const client = new ChatGPTAPIClient('https://api.openai.com', 'test-key');
  
  assert(client instanceof ChatGPTAPIClient, 'Deve instanciar ChatGPTAPIClient');
  assert.strictEqual(client.baseURL, 'https://api.openai.com', 'URL deve estar correta');
  assert.strictEqual(client.apiKey, 'test-key', 'API Key deve estar configurada');
  assert.strictEqual(client.isHealthy, false, 'Deve iniciar como não saudável');
  assert.strictEqual(client.retryCount, 0, 'Retry count deve ser 0');
  assert.strictEqual(client.activeRequests, 0, 'Active requests deve ser 0');
});

test('ChatGPTAPIClient - Métodos básicos', async () => {
  const client = new ChatGPTAPIClient('https://api.openai.com', 'test-key');
  
  // Test queue estimation
  const queueInfo = await client.getQueueEstimate();
  assert(typeof queueInfo.queueLength === 'number', 'Queue length deve ser número');
  assert(typeof queueInfo.averageProcessingTime === 'number', 'Average processing time deve ser número');
  
  // Test processing status
  const status = client.getProcessingStatus();
  assert(typeof status.activeRequests === 'number', 'Active requests deve ser número');
  assert(typeof status.totalRequests === 'number', 'Total requests deve ser número');
  assert(Array.isArray(status.requestHistory), 'Request history deve ser array');
  
  // Test load score
  const loadScore = client.getLoadScore();
  assert(typeof loadScore === 'number', 'Load score deve ser número');
  assert(loadScore >= 0, 'Load score deve ser não negativo');
});

test('ChatGPTAPIClient - Update metrics', () => {
  const client = new ChatGPTAPIClient('https://api.openai.com', 'test-key');
  
  // Simular algumas requisições
  client.updateMetrics(1000);
  client.updateMetrics(1500);
  client.updateMetrics(800);
  
  assert.strictEqual(client.requestHistory.length, 3, 'Deve ter 3 registros no histórico');
  assert(client.averageResponseTime > 0, 'Average response time deve ser maior que 0');
  
  const expectedAvg = Math.round((1000 + 1500 + 800) / 3);
  assert.strictEqual(client.averageResponseTime, expectedAvg, 'Average deve ser calculado corretamente');
});

test('ChatGPTAPIClient - Recent request count', () => {
  const client = new ChatGPTAPIClient('https://api.openai.com', 'test-key');
  
  // Adicionar algumas requisições com timestamps recentes
  const now = Date.now();
  client.requestHistory.push(
    { timestamp: now - 60000, responseTime: 1000 }, // 1 min ago (should be included)
    { timestamp: now - 240000, responseTime: 1000 }, // 4 min ago (should be included)
    { timestamp: now - 600000, responseTime: 1000 } // 10 min ago (should be excluded)
  );
  
  const recentCount = client.getRecentRequestCount();
  assert.strictEqual(recentCount, 2, 'Deve contar apenas as últimas 2 requisições (últimos 5 min)');
});

test('ChatGPTAPIClient - Configuração sem API Key', () => {
  const client = new ChatGPTAPIClient('https://api.openai.com');
  
  assert.strictEqual(client.apiKey, undefined, 'API Key deve ser undefined');
  assert.strictEqual(client.isHealthy, false, 'Deve estar não saudável sem API Key');
});

test('ChatGPTAPIClient - Configuração de URL', () => {
  // Test with URL that already has /v1
  const client1 = new ChatGPTAPIClient('https://api.openai.com/v1', 'test-key');
  assert(client1.client.baseURL.includes('/v1'), 'URL com /v1 deve ser preservada');
  
  // Test with URL without /v1
  const client2 = new ChatGPTAPIClient('https://api.openai.com', 'test-key');
  assert(client2.client.baseURL.includes('/v1'), 'URL sem /v1 deve ter /v1 adicionado');
});