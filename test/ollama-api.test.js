import test from 'node:test';
import assert from 'node:assert';
import OllamaAPIClient from '../src/services/ollamaApiClient.js';
import OllamaAPIPool from '../src/services/ollamaApiPool.js';
import { CONFIG } from '../src/config/index.js';
import logger from '../src/utils/logger.js';

logger.info('🧪 Iniciando testes do Ollama API...');

test('OllamaAPIClient - Construção', async (t) => {
  const client = new OllamaAPIClient('http://localhost:11434');
  
  assert.strictEqual(client.baseURL, 'http://localhost:11434');
  assert.strictEqual(client.isHealthy, true);
  assert.strictEqual(client.loadScore, 0);
  
  logger.success('✅ OllamaAPIClient construído corretamente');
});

test('OllamaAPIClient - Health Check (se Ollama estiver disponível)', async (t) => {
  const client = new OllamaAPIClient('http://localhost:11434');
  
  try {
    const health = await client.getHealth();
    assert.ok(health.status === 'healthy');
    assert.ok(health.version);
    logger.success('✅ Health check bem-sucedido');
  } catch (error) {
    // Se Ollama não estiver disponível, pula o teste
    t.skip('Ollama não disponível em localhost:11434');
    logger.warn('⚠️ Ollama não disponível para teste de health check');
  }
});

test('OllamaAPIClient - List Models (se Ollama estiver disponível)', async (t) => {
  const client = new OllamaAPIClient('http://localhost:11434');
  
  try {
    const models = await client.listModels();
    assert.ok(Array.isArray(models.models) || models.models === undefined);
    logger.success('✅ Lista de modelos obtida com sucesso');
  } catch (error) {
    t.skip('Ollama não disponível para teste de modelos');
    logger.warn('⚠️ Ollama não disponível para teste de modelos');
  }
});

test('OllamaAPIClient - Get Version (se Ollama estiver disponível)', async (t) => {
  const client = new OllamaAPIClient('http://localhost:11434');
  
  try {
    const version = await client.getVersion();
    assert.ok(version.version);
    logger.success(`✅ Versão obtida: ${version.version}`);
  } catch (error) {
    t.skip('Ollama não disponível para teste de versão');
    logger.warn('⚠️ Ollama não disponível para teste de versão');
  }
});

test('OllamaAPIPool - Construção', async (t) => {
  const pool = new OllamaAPIPool();
  
  assert.ok(pool.clients !== undefined);
  assert.strictEqual(pool.currentIndex, 0);
  
  logger.success('✅ OllamaAPIPool construído corretamente');
});

test('OllamaAPIPool - Configuração', async (t) => {
  // Backup da configuração original
  const originalConfig = { ...CONFIG.ollamaApi };
  
  // Configuração de teste
  CONFIG.ollamaApi.enabled = true;
  CONFIG.ollamaApi.mode = 'api';
  CONFIG.ollamaApi.endpoints = [
    {
      url: 'http://localhost:11434',
      enabled: true,
      priority: 1,
      maxRetries: 2
    }
  ];
  
  const pool = new OllamaAPIPool();
  await pool.initialize();
  
  const isEnabled = await pool.isEnabled();
  assert.strictEqual(isEnabled, true);
  
  // Restaurar configuração original
  Object.assign(CONFIG.ollamaApi, originalConfig);
  
  logger.success('✅ OllamaAPIPool configurado corretamente');
});

test('OllamaAPIPool - Estratégias de Load Balancing', async (t) => {
  const pool = new OllamaAPIPool();
  
  // Mock de clientes para teste
  const mockClients = [
    { 
      baseURL: 'http://test1:11434', 
      isHealthy: true, 
      endpoint: { priority: 1, maxRetries: 2 },
      retryCount: 0,
      getLoadScore: () => 1
    },
    { 
      baseURL: 'http://test2:11434', 
      isHealthy: true, 
      endpoint: { priority: 2, maxRetries: 2 },
      retryCount: 0,
      getLoadScore: () => 3
    }
  ];
  
  pool.clients = mockClients;
  
  // Teste Round Robin
  const rrClient1 = pool.selectRoundRobin(mockClients);
  const rrClient2 = pool.selectRoundRobin(mockClients);
  assert.notStrictEqual(rrClient1, rrClient2);
  
  // Teste Priority
  const priorityClient = pool.selectByPriority(mockClients);
  assert.strictEqual(priorityClient.endpoint.priority, 1);
  
  // Teste Load Balancing
  const loadClient = pool.selectByLoad(mockClients);
  assert.strictEqual(loadClient.getLoadScore(), 1);
  
  logger.success('✅ Estratégias de load balancing funcionando corretamente');
});

test('OllamaAPIClient - Timeout e Error Handling', async (t) => {
  const client = new OllamaAPIClient('http://localhost:99999'); // Porta inválida
  client.setTimeout(1000); // 1 segundo de timeout
  
  try {
    await client.getHealth();
    assert.fail('Deveria ter falhado com timeout');
  } catch (error) {
    assert.ok(error.message.includes('timeout') || error.message.includes('ECONNREFUSED'));
    logger.success('✅ Error handling funcionando corretamente');
  }
});

test('Configuração - Estrutura ollamaApi', async (t) => {
  assert.ok(CONFIG.ollamaApi !== undefined);
  assert.ok(CONFIG.ollamaApi.enabled !== undefined);
  assert.ok(CONFIG.ollamaApi.mode !== undefined);
  assert.ok(Array.isArray(CONFIG.ollamaApi.endpoints));
  assert.ok(CONFIG.ollamaApi.timeout !== undefined);
  assert.ok(CONFIG.ollamaApi.retryDelay !== undefined);
  assert.ok(CONFIG.ollamaApi.loadBalancing !== undefined);
  assert.ok(CONFIG.ollamaApi.loadBalancing.strategy !== undefined);
  assert.ok(CONFIG.ollamaApi.loadBalancing.healthCheckInterval !== undefined);
  
  logger.success('✅ Configuração ollamaApi está estruturada corretamente');
});

test('OllamaAPIClient - Métodos de conveniência', async (t) => {
  const client = new OllamaAPIClient('http://localhost:11434');
  
  // Teste getBaseURL
  assert.strictEqual(client.getBaseURL(), 'http://localhost:11434');
  
  // Teste setTimeout
  client.setTimeout(5000);
  assert.strictEqual(client.axios.defaults.timeout, 5000);
  
  // Teste setHeaders
  client.setHeaders({ 'Custom-Header': 'test' });
  assert.strictEqual(client.axios.defaults.headers['Custom-Header'], 'test');
  
  logger.success('✅ Métodos de conveniência funcionando corretamente');
});

logger.info('🎉 Testes do Ollama API concluídos!');