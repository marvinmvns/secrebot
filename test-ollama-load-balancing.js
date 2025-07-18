#!/usr/bin/env node

/**
 * Script de teste para demonstrar o balanceamento de carga do Ollama API
 * Este script simula múltiplas requisições e mostra como elas são distribuídas
 */

import OllamaAPIPool from './src/services/ollamaApiPool.js';
import logger from './src/utils/logger.js';

console.log('🚀 Iniciando teste de balanceamento do Ollama API\n');

// Configuração de teste
const testConfig = {
  ollamaApi: {
    enabled: true,
    mode: 'api',
    endpoints: [
      { url: 'http://localhost:11434', enabled: true, priority: 1, maxRetries: 2, type: 'ollama' },
      { url: 'http://localhost:11435', enabled: true, priority: 2, maxRetries: 2, type: 'ollama' },
      { url: 'http://localhost:8080', enabled: true, priority: 3, maxRetries: 2, type: 'rkllama' }
    ],
    loadBalancing: {
      strategy: 'round_robin', // Vamos testar com round-robin
      healthCheckInterval: 30000
    }
  }
};

// Mock ConfigService para teste
const mockConfigService = {
  async getConfig() {
    return testConfig;
  }
};

async function testLoadBalancing() {
  console.log('🔧 Criando pool de teste com 3 endpoints (2 Ollama + 1 RKLLama)...');
  const pool = new OllamaAPIPool(mockConfigService);
  
  // Aguarda inicialização
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock clients para simular endpoints funcionando
  pool.clients = [
    { 
      baseURL: 'http://localhost:11434', 
      endpoint: { priority: 1, maxRetries: 2, type: 'ollama' },
      isHealthy: true,
      retryCount: 0,
      activeRequests: 1,
      totalRequests: 15,
      runningModels: ['llama2', 'codellama'],
      constructor: { name: 'OllamaAPIClient' },
      getLoadScore() { 
        const activeRequestsScore = this.activeRequests * 2;
        const runningModelsScore = this.runningModels.length;
        return activeRequestsScore + runningModelsScore;
      },
      getProcessingStatus() {
        return {
          activeRequests: this.activeRequests,
          totalRequests: this.totalRequests,
          averageResponseTime: 1500 + Math.floor(Math.random() * 1000),
          recentRequests: Math.floor(Math.random() * 5)
        };
      },
      async listRunningModels() { 
        // Simula mudança nos modelos em execução
        this.activeRequests = Math.floor(Math.random() * 3);
        this.runningModels = Math.random() > 0.5 ? ['llama2'] : ['llama2', 'codellama'];
        return { models: this.runningModels };
      }
    },
    { 
      baseURL: 'http://localhost:11435', 
      endpoint: { priority: 2, maxRetries: 2, type: 'ollama' },
      isHealthy: true,
      retryCount: 0,
      activeRequests: 0,
      totalRequests: 8,
      runningModels: ['mistral'],
      constructor: { name: 'OllamaAPIClient' },
      getLoadScore() { 
        const activeRequestsScore = this.activeRequests * 2;
        const runningModelsScore = this.runningModels.length;
        return activeRequestsScore + runningModelsScore;
      },
      getProcessingStatus() {
        return {
          activeRequests: this.activeRequests,
          totalRequests: this.totalRequests,
          averageResponseTime: 1200 + Math.floor(Math.random() * 800),
          recentRequests: Math.floor(Math.random() * 3)
        };
      },
      async listRunningModels() { 
        this.activeRequests = Math.floor(Math.random() * 2);
        this.runningModels = Math.random() > 0.3 ? ['mistral'] : [];
        return { models: this.runningModels };
      }
    },
    { 
      baseURL: 'http://localhost:8080', 
      endpoint: { priority: 3, maxRetries: 2, type: 'rkllama' },
      isHealthy: true,
      retryCount: 0,
      activeRequests: 2,
      totalRequests: 22,
      runningModels: ['llama-3-8b'],
      constructor: { name: 'RKLlamaAPIClient' },
      getLoadScore() { 
        const activeRequestsScore = this.activeRequests * 2;
        const runningModelsScore = this.runningModels.length;
        return activeRequestsScore + runningModelsScore;
      },
      getProcessingStatus() {
        return {
          activeRequests: this.activeRequests,
          totalRequests: this.totalRequests,
          averageResponseTime: 2000 + Math.floor(Math.random() * 1500),
          recentRequests: Math.floor(Math.random() * 4)
        };
      },
      async listRunningModels() { 
        this.activeRequests = Math.floor(Math.random() * 4);
        this.runningModels = ['llama-3-8b']; // RKLLama sempre tem um modelo carregado
        return { models: this.runningModels };
      }
    }
  ];

  console.log('\n📊 Testando estratégia Round Robin:');
  console.log('====================================');
  
  // Testa 6 seleções para ver o padrão round-robin
  for (let i = 1; i <= 6; i++) {
    try {
      const client = await pool.selectBestClient();
      const processingStatus = client.getProcessingStatus();
      const clientType = client.constructor.name === 'RKLlamaAPIClient' ? 'RKLLama' : 'Ollama';
      console.log(`Req ${i}: ${client.baseURL} (${clientType}) - ativo: ${processingStatus.activeRequests}, score: ${client.getLoadScore().toFixed(1)}`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  console.log('\n📊 Testando estratégia Queue Length:');
  console.log('===================================');
  
  // Muda para queue_length
  testConfig.ollamaApi.loadBalancing.strategy = 'queue_length';
  
  // Testa 5 seleções para ver seleção por menor carga
  for (let i = 1; i <= 5; i++) {
    try {
      const client = await pool.selectBestClient();
      const processingStatus = client.getProcessingStatus();
      const clientType = client.constructor.name === 'RKLlamaAPIClient' ? 'RKLLama' : 'Ollama';
      console.log(`Req ${i}: ${client.baseURL} (${clientType}) - ativo: ${processingStatus.activeRequests}, score: ${client.getLoadScore().toFixed(1)}`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  console.log('\n📊 Testando estratégia Priority:');
  console.log('===============================');
  
  // Muda para priority
  testConfig.ollamaApi.loadBalancing.strategy = 'priority';
  
  // Testa 3 seleções para ver seleção por prioridade
  for (let i = 1; i <= 3; i++) {
    try {
      const client = await pool.selectBestClient();
      const clientType = client.constructor.name === 'RKLlamaAPIClient' ? 'RKLLama' : 'Ollama';
      console.log(`Req ${i}: ${client.baseURL} (${clientType}) - prioridade: ${client.endpoint.priority}`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  console.log('\n🎯 Simulando requisições mistas (generate + chat):');
  console.log('==============================================');
  
  // Volta para queue_length para simulação realista
  testConfig.ollamaApi.loadBalancing.strategy = 'queue_length';
  
  // Simula diferentes tipos de requisições
  const requestTypes = ['generate', 'chat', 'generate', 'chat', 'generate'];
  for (let i = 0; i < requestTypes.length; i++) {
    try {
      const client = await pool.selectBestClient();
      const processingStatus = client.getProcessingStatus();
      const clientType = client.constructor.name === 'RKLlamaAPIClient' ? 'RKLLama' : 'Ollama';
      console.log(`${requestTypes[i].toUpperCase()} #${i+1}: ${client.baseURL} (${clientType}) - ativo: ${processingStatus.activeRequests}, total: ${processingStatus.totalRequests}`);
      
      // Simula mudança na carga após a requisição
      client.activeRequests += 1;
      client.totalRequests += 1;
    } catch (error) {
      console.log(`${requestTypes[i].toUpperCase()} #${i+1}: ERRO - ${error.message}`);
    }
  }

  console.log('\n🎯 Estatísticas finais:');
  console.log('=====================');
  const status = await pool.getPoolStatus();
  console.log(`Total de endpoints: ${status.totalEndpoints}`);
  console.log(`Endpoints saudáveis: ${status.healthyEndpoints}`);
  console.log(`Estratégia atual: ${status.strategy}`);
  
  console.log('\nEndpoints:');
  status.endpoints.forEach((ep, i) => {
    const clientType = ep.type || 'Ollama';
    const healthStatus = ep.healthy ? '✅ Saudável' : '❌ Não saudável';
    const processingInfo = ep.processing ? ` (ativo: ${ep.processing.activeRequests})` : '';
    console.log(`  ${i + 1}. ${ep.url} (${clientType}) - ${healthStatus}${processingInfo}`);
  });

  pool.destroy();
  console.log('\n✅ Teste de balanceamento do Ollama API concluído com sucesso!');
}

// Executa o teste
testLoadBalancing().catch(error => {
  console.error('❌ Erro no teste:', error);
  process.exit(1);
});