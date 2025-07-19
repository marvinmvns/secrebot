#!/usr/bin/env node

/**
 * Script de teste para demonstrar o balanceamento de carga do Whisper API
 * Este script simula múltiplas requisições e mostra como elas são distribuídas
 */

import WhisperAPIPool from '../src/services/whisperApiPool.js';
import logger from '../src/utils/logger.js';

console.log('🚀 Iniciando teste de balanceamento do Whisper API\n');

// Configuração de teste
const testConfig = {
  whisperApi: {
    enabled: true,
    mode: 'api',
    endpoints: [
      { url: 'http://localhost:3001', enabled: true, priority: 1, maxRetries: 2 },
      { url: 'http://localhost:3002', enabled: true, priority: 2, maxRetries: 2 },
      { url: 'http://localhost:3003', enabled: true, priority: 3, maxRetries: 2 }
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
  console.log('🔧 Criando pool de teste com 3 endpoints...');
  const pool = new WhisperAPIPool(mockConfigService);
  
  // Aguarda inicialização
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock clients para simular endpoints funcionando
  pool.clients = [
    { 
      baseURL: 'http://localhost:3001', 
      endpoint: { priority: 1, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 2,
      avgProcessingTime: 1500,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        // Simula mudança na fila
        this.queueLength = Math.floor(Math.random() * 5);
        this.avgProcessingTime = 1000 + Math.floor(Math.random() * 2000);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    },
    { 
      baseURL: 'http://localhost:3002', 
      endpoint: { priority: 2, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 1,
      avgProcessingTime: 2000,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        this.queueLength = Math.floor(Math.random() * 5);
        this.avgProcessingTime = 1000 + Math.floor(Math.random() * 2000);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    },
    { 
      baseURL: 'http://localhost:3003', 
      endpoint: { priority: 3, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 3,
      avgProcessingTime: 1800,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        this.queueLength = Math.floor(Math.random() * 5);
        this.avgProcessingTime = 1000 + Math.floor(Math.random() * 2000);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    }
  ];

  console.log('\n📊 Testando estratégia Round Robin:');
  console.log('====================================');
  
  // Testa 6 seleções para ver o padrão round-robin
  for (let i = 1; i <= 6; i++) {
    try {
      const client = await pool.selectBestClient();
      console.log(`Req ${i}: ${client.baseURL} (fila: ${client.queueLength}, score: ${client.getLoadScore().toFixed(1)})`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  console.log('\n📊 Testando estratégia Queue Length:');
  console.log('===================================');
  
  // Muda para queue_length
  testConfig.whisperApi.loadBalancing.strategy = 'queue_length';
  
  // Testa 5 seleções para ver seleção por menor carga
  for (let i = 1; i <= 5; i++) {
    try {
      const client = await pool.selectBestClient();
      console.log(`Req ${i}: ${client.baseURL} (fila: ${client.queueLength}, score: ${client.getLoadScore().toFixed(1)})`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  console.log('\n📊 Testando estratégia Priority:');
  console.log('===============================');
  
  // Muda para priority
  testConfig.whisperApi.loadBalancing.strategy = 'priority';
  
  // Testa 3 seleções para ver seleção por prioridade
  for (let i = 1; i <= 3; i++) {
    try {
      const client = await pool.selectBestClient();
      console.log(`Req ${i}: ${client.baseURL} (prioridade: ${client.endpoint.priority})`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
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
    console.log(`  ${i + 1}. ${ep.url} - ${ep.healthy ? '✅ Saudável' : '❌ Não saudável'} (fila: ${ep.queueLength || 0})`);
  });

  pool.destroy();
  console.log('\n✅ Teste de balanceamento concluído com sucesso!');
}

// Executa o teste
testLoadBalancing().catch(error => {
  console.error('❌ Erro no teste:', error);
  process.exit(1);
});