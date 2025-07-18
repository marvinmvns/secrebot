#!/usr/bin/env node

/**
 * Teste real do balanceamento Round Robin do Whisper API
 * Este script simula requisições para verificar se estão sendo distribuídas
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importa o AudioTranscriber diretamente para testar
async function testRoundRobinDistribution() {
  console.log('🧪 Teste Real do Round Robin do Whisper API');
  console.log('=============================================\n');

  try {
    // Simula 6 transcrições sequenciais para ver a distribuição
    console.log('🎯 Simulando 6 requisições de transcrição...\n');
    
    // Cria um arquivo de áudio pequeno e falso para teste
    const testAudioBuffer = Buffer.from('fake-audio-content-for-testing');
    
    // Vamos interceptar os logs para capturar qual endpoint foi selecionado
    const selections = [];
    
    // Patch do logger para capturar seleções
    const originalLog = console.log;
    console.log = function(...args) {
      const message = args.join(' ');
      if (message.includes('Cliente selecionado:') && message.includes('whisper')) {
        const match = message.match(/Cliente selecionado: (http:\/\/[^)]+)/);
        if (match) {
          selections.push(match[1]);
        }
      }
      // Chama o log original apenas para mensagens importantes
      if (message.includes('🎯') || message.includes('✅') || message.includes('❌') || message.includes('📊')) {
        originalLog.apply(console, args);
      }
    };

    // Como não podemos fazer transcrições reais, vamos testar diretamente o pool
    const { getDynamicConfig } = await import('./src/config/index.js');
    const WhisperAPIPool = (await import('./src/services/whisperApiPool.js')).default;
    
    // Mock config service para pegar a configuração atual
    const mockConfigService = {
      async getConfig() {
        // Retorna configuração atual do MongoDB ou null para usar padrão
        return null;
      }
    };

    const pool = new WhisperAPIPool(mockConfigService);
    
    // Aguarda inicialização
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (pool.clients.length === 0) {
      console.log('❌ Nenhum cliente Whisper configurado');
      return;
    }

    console.log(`📊 Encontrados ${pool.clients.length} endpoints configurados`);
    console.log('Endpoints:');
    pool.clients.forEach((client, i) => {
      console.log(`  ${i + 1}. ${client.baseURL} (prioridade: ${client.endpoint.priority})`);
    });

    console.log('\n🔄 Testando seleção de clientes (6 requisições):');
    console.log('===============================================');

    const actualSelections = [];
    for (let i = 1; i <= 6; i++) {
      try {
        const client = await pool.selectBestClient();
        actualSelections.push(client.baseURL);
        console.log(`Req ${i}: ${client.baseURL} (currentIndex após: ${pool.currentIndex})`);
      } catch (error) {
        console.log(`Req ${i}: ERRO - ${error.message}`);
      }
    }

    // Análise da distribuição
    console.log('\n📈 Análise da distribuição:');
    console.log('==========================');
    const distribution = {};
    actualSelections.forEach(url => {
      distribution[url] = (distribution[url] || 0) + 1;
    });
    
    let totalRequests = actualSelections.length;
    Object.entries(distribution).forEach(([url, count]) => {
      const percentage = ((count / totalRequests) * 100).toFixed(1);
      console.log(`${url}: ${count} requisições (${percentage}%)`);
    });

    // Verifica se a distribuição está equilibrada
    const uniqueEndpoints = Object.keys(distribution).length;
    const expectedPerEndpoint = Math.floor(totalRequests / pool.clients.length);
    const isBalanced = Object.values(distribution).every(count => count >= expectedPerEndpoint);
    
    if (isBalanced && uniqueEndpoints >= 2) {
      console.log('\n✅ SUCESSO: Round Robin está funcionando corretamente!');
      console.log('   As requisições estão sendo distribuídas entre os endpoints.');
    } else {
      console.log('\n❌ PROBLEMA: Round Robin NÃO está distribuindo adequadamente');
      console.log(`   Endpoints únicos usados: ${uniqueEndpoints}/${pool.clients.length}`);
    }

    pool.destroy();
    
    // Restaura console.log
    console.log = originalLog;

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executa o teste
testRoundRobinDistribution().catch(console.error);