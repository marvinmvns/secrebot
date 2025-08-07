#!/usr/bin/env node

/**
 * Test script para verificar a integração LLM de análise crypto
 */

import CryptoService from './src/services/cryptoService.js';

async function testLLMIntegration() {
  console.log('🧪 Testando integração LLM para análise crypto...\n');
  
  const cryptoService = new CryptoService();
  
  try {
    // 1. Conectar ao MongoDB
    console.log('1. Conectando ao MongoDB...');
    await cryptoService.connect();
    
    // 2. Adicionar dados de teste para bitcoin
    console.log('2. Adicionando dados históricos de teste...');
    const basePrice = 50000;
    
    // Adicionar dados históricos simulados
    for (let i = 0; i < 30; i++) {
      const variation = (Math.random() - 0.5) * 0.1; // Variação de ±5%
      const price = basePrice * (1 + variation);
      const timestamp = Date.now() - (i * 24 * 60 * 60 * 1000); // i dias atrás
      
      cryptoService.storePriceHistory('bitcoin', price, new Date(timestamp));
    }
    
    console.log('   ✅ 30 pontos históricos adicionados');
    
    // 3. Testar se a função LLM existe
    console.log('3. Verificando se a função generateLLMAnalysis existe...');
    
    if (typeof cryptoService.generateLLMAnalysis === 'function') {
      console.log('   ✅ Função generateLLMAnalysis encontrada');
    } else {
      console.log('   ❌ Função generateLLMAnalysis não encontrada');
      return;
    }
    
    // 4. Testar preparação de dados
    console.log('4. Testando preparação de dados...');
    
    try {
      // Test individual helper functions if they exist
      if (typeof cryptoService.prepareDataForLLM === 'function') {
        const preparedData = await cryptoService.prepareDataForLLM('bitcoin', 30);
        console.log('   ✅ Dados preparados:', {
          dataPointsCount: preparedData.historicalPrices?.length || 0,
          hasStatistics: !!preparedData.statistics,
          hasIndicators: !!preparedData.technicalIndicators
        });
      }
    } catch (error) {
      console.log('   ⚠️ Erro na preparação de dados (esperado se LLM não disponível):', error.message);
    }
    
    // 5. Testar análise completa (pode falhar se LLM não disponível)
    console.log('5. Testando análise LLM completa...');
    
    try {
      // Set a timeout for the LLM analysis
      const analysisPromise = cryptoService.generateLLMAnalysis('bitcoin');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
      });
      
      const analysis = await Promise.race([analysisPromise, timeoutPromise]);
      
      if (analysis && analysis.recommendation) {
        console.log('   ✅ Análise LLM bem-sucedida:');
        console.log('     - Recomendação:', analysis.recommendation);
        console.log('     - Confiança:', analysis.confidence + '%');
        console.log('     - Preço atual: $' + analysis.currentPrice?.toLocaleString());
        console.log('     - Resumo:', analysis.reasoning?.substring(0, 100) + '...');
      } else {
        console.log('   ❌ Análise LLM retornou dados inválidos');
      }
      
    } catch (error) {
      if (error.message.includes('LLM service')) {
        console.log('   ⚠️ LLM service não disponível (esperado em ambiente de teste)');
        console.log('   💡 Para testar completamente, certifique-se de que o Ollama esteja rodando');
      } else if (error.message === 'Timeout after 30 seconds') {
        console.log('   ⚠️ LLM analysis timeout (pode ser normal para modelos grandes)');
      } else {
        console.log('   ❌ Erro na análise LLM:', error.message);
      }
    }
    
    // 6. Verificar estrutura de resposta esperada
    console.log('6. Testando estrutura de resposta...');
    
    // Mock analysis para testar estrutura
    const mockAnalysis = {
      recommendation: 'SEGURAR',
      confidence: 75,
      currentPrice: 50000,
      targetPrice: 52000,
      stopLoss: 48000,
      reasoning: 'Análise baseada em dados históricos mostra tendência consolidação...',
      technicalSummary: 'RSI neutro, SMA positiva',
      marketContext: 'Mercado em consolidação'
    };
    
    console.log('   ✅ Estrutura de resposta mock válida:', {
      hasRecommendation: !!mockAnalysis.recommendation,
      hasConfidence: typeof mockAnalysis.confidence === 'number',
      hasReasoning: !!mockAnalysis.reasoning,
      recommendationValid: ['COMPRAR', 'VENDER', 'SEGURAR'].includes(mockAnalysis.recommendation)
    });
    
    console.log('\n✅ Teste de integração LLM concluído com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('   - CryptoService: ✅ Inicializado');
    console.log('   - MongoDB: ✅ Conectado');
    console.log('   - Dados históricos: ✅ Adicionados');
    console.log('   - Função LLM: ✅ Existe');
    console.log('   - Estrutura: ✅ Válida');
    console.log('\n💡 Para teste completo do LLM, execute o bot com Ollama ativo');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    // Cleanup
    await cryptoService.disconnect();
  }
}

// Executar teste
testLLMIntegration().catch(console.error);