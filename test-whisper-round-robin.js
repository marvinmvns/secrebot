#!/usr/bin/env node

/**
 * Script de teste para diagnosticar o problema no balanceamento Round Robin do Whisper API
 */

import WhisperAPIPool from './src/services/whisperApiPool.js';
import logger from './src/utils/logger.js';

console.log('🔍 Diagnóstico do balanceamento Round Robin do Whisper API\n');

// Configuração de teste com 3 endpoints
const testConfig = {
  whisperApi: {
    enabled: true,
    endpoints: [
      { url: 'http://192.168.31.100:3001', enabled: true, priority: 1, maxRetries: 2 },
      { url: 'http://192.168.31.101:3001', enabled: true, priority: 2, maxRetries: 2 },
      { url: 'http://192.168.31.102:3001', enabled: true, priority: 3, maxRetries: 2 }
    ],
    loadBalancing: {
      strategy: 'round_robin',
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

async function testRoundRobin() {
  console.log('🔧 Criando pool de teste com 3 endpoints...');
  const pool = new WhisperAPIPool(mockConfigService);
  
  // Aguarda inicialização
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Mock clients para simular endpoints funcionando
  pool.clients = [
    { 
      baseURL: 'http://192.168.31.100:3001', 
      endpoint: { priority: 1, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 2,
      avgProcessingTime: 1500,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        // Simula variação na fila
        this.queueLength = Math.floor(Math.random() * 3);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    },
    { 
      baseURL: 'http://192.168.31.101:3001', 
      endpoint: { priority: 2, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 1,
      avgProcessingTime: 1200,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        this.queueLength = Math.floor(Math.random() * 2);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    },
    { 
      baseURL: 'http://192.168.31.102:3001', 
      endpoint: { priority: 3, maxRetries: 2 },
      isHealthy: true,
      retryCount: 0,
      queueLength: 0,
      avgProcessingTime: 1800,
      getLoadScore() { return this.queueLength + (this.avgProcessingTime / 1000); },
      async getQueueEstimate() { 
        this.queueLength = Math.floor(Math.random() * 4);
        return { queueLength: this.queueLength, averageProcessingTime: this.avgProcessingTime };
      }
    }
  ];

  console.log('\n📊 Estado inicial dos clientes:');
  pool.clients.forEach((client, i) => {
    console.log(`  ${i + 1}. ${client.baseURL} - fila: ${client.queueLength}, score: ${client.getLoadScore().toFixed(1)}`);
  });

  console.log(`\n🔍 Valor inicial do currentIndex: ${pool.currentIndex}`);

  console.log('\n🔄 Testando seleção Round Robin (10 requisições):');
  console.log('==================================================');
  
  const selections = [];
  for (let i = 1; i <= 10; i++) {
    try {
      const client = await pool.selectBestClient();
      selections.push(client.baseURL);
      console.log(`Req ${i}: ${client.baseURL} (currentIndex após: ${pool.currentIndex})`);
    } catch (error) {
      console.log(`Req ${i}: ERRO - ${error.message}`);
    }
  }

  // Analisa distribuição
  console.log('\n📈 Análise da distribuição:');
  console.log('========================');
  const distribution = {};
  selections.forEach(url => {
    distribution[url] = (distribution[url] || 0) + 1;
  });
  
  Object.entries(distribution).forEach(([url, count]) => {
    const percentage = ((count / selections.length) * 100).toFixed(1);
    console.log(`${url}: ${count} requisições (${percentage}%)`);
  });

  const isBalanced = Object.values(distribution).every(count => count >= 2);
  if (isBalanced) {
    console.log('\n✅ Distribuição parece equilibrada');
  } else {
    console.log('\n❌ Distribuição NÃO está equilibrada - possível problema no Round Robin');
  }

  // Teste direto do método selectRoundRobin
  console.log('\n🧪 Teste direto do método selectRoundRobin:');
  console.log('==========================================');
  
  // Reset currentIndex para teste limpo
  pool.currentIndex = 0;
  console.log(`Reset currentIndex para: ${pool.currentIndex}`);
  
  for (let i = 1; i <= 6; i++) {
    const client = pool.selectRoundRobin(pool.clients);
    console.log(`Teste ${i}: ${client.baseURL} (currentIndex: ${pool.currentIndex})`);
  }

  pool.destroy();
  console.log('\n🏁 Diagnóstico concluído!');
}

// Executa o teste
testRoundRobin().catch(error => {
  console.error('❌ Erro no diagnóstico:', error);
  process.exit(1);
});