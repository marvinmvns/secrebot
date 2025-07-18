#!/usr/bin/env node

/**
 * Script para testar diretamente a seleção de clientes do WhisperAPIPool
 */

import WhisperAPIPool from './src/services/whisperApiPool.js';

async function testWhisperSelection() {
  console.log('🧪 Teste de Seleção do WhisperAPIPool');
  console.log('===================================\n');

  try {
    // Mock config service que pega configuração do MongoDB
    const mockConfigService = {
      async getConfig() {
        // Retorna null para usar a configuração padrão do arquivo
        return null;
      }
    };

    const pool = new WhisperAPIPool(mockConfigService);
    
    // Aguarda inicialização
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`📊 Pool inicializado com ${pool.clients.length} clientes`);
    console.log(`📊 currentIndex inicial: ${pool.currentIndex}`);
    
    if (pool.clients.length === 0) {
      console.log('❌ Nenhum cliente configurado');
      return;
    }

    console.log('\nClientes configurados:');
    pool.clients.forEach((client, i) => {
      console.log(`  ${i + 1}. ${client.baseURL} (prioridade: ${client.endpoint.priority}, healthy: ${client.isHealthy})`);
    });

    console.log('\n🔄 Testando 8 seleções consecutivas...');
    console.log('====================================');
    
    for (let i = 1; i <= 8; i++) {
      try {
        const client = await pool.selectBestClient();
        console.log(`Seleção ${i}: ${client.baseURL} (currentIndex após: ${pool.currentIndex})`);
        
        // Pequeno delay para simular processamento
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`Seleção ${i}: ERRO - ${error.message}`);
      }
    }

    pool.destroy();
    console.log('\n✅ Teste concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testWhisperSelection();