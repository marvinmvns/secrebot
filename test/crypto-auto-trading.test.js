#!/usr/bin/env node

/**
 * Test script para verificar a funcionalidade de trading automático
 */

import CryptoService from '../src/services/cryptoService.js';
import LLMService from '../src/services/llmService.js';
import test from 'node:test';
import assert from 'node:assert';

test('CryptoService - Trading Automático', async () => {
  const mockLLMService = {
    generateText: async (prompt) => {
      // Mock response no formato esperado
      return `DECISÃO: COMPRAR
CONFIANÇA: 7
RAZÃO: Tendência de alta clara com RSI em nível saudável
RISCO: MÉDIO
TIMEFRAME: 3 dias`;
    }
  };
  
  const cryptoService = new CryptoService(mockLLMService);
  const testUserId = 'test_auto_trading_user';
  
  try {
    // Configurar preferências do usuário
    await cryptoService.setUserPreferences(testUserId, {
      coins: ['bitcoin', 'ethereum'],
      settings: { notifications: true }
    });
    
    // Simular dados históricos
    cryptoService.storePriceHistory('bitcoin', 50000);
    cryptoService.storePriceHistory('bitcoin', 51000);
    cryptoService.storePriceHistory('bitcoin', 52000);
    
    cryptoService.storePriceHistory('ethereum', 3000);
    cryptoService.storePriceHistory('ethereum', 3100);
    cryptoService.storePriceHistory('ethereum', 3200);
    
    // Testar análise automática de trading
    const analysis = await cryptoService.generateAutomaticTradingAnalysis(testUserId, 3);
    
    // Verificações
    assert(analysis.userId === testUserId, 'UserID deve corresponder');
    assert(analysis.coinAnalyses.length === 2, 'Deve analisar 2 moedas configuradas');
    assert(analysis.portfolioSummary, 'Deve ter resumo do portfólio');
    assert(analysis.portfolioSummary.totalCoins === 2, 'Deve mostrar total de moedas');
    assert(analysis.disclaimer, 'Deve incluir disclaimer');
    
    // Verificar análise individual das moedas
    const bitcoinAnalysis = analysis.coinAnalyses.find(c => c.coin === 'bitcoin');
    const ethereumAnalysis = analysis.coinAnalyses.find(c => c.coin === 'ethereum');
    
    assert(bitcoinAnalysis, 'Deve ter análise do Bitcoin');
    assert(ethereumAnalysis, 'Deve ter análise do Ethereum');
    
    // Verificar campos obrigatórios
    assert(['COMPRAR', 'VENDER', 'HOLD'].includes(bitcoinAnalysis.recommendation), 'Recomendação deve ser válida');
    assert(bitcoinAnalysis.confidence >= 1 && bitcoinAnalysis.confidence <= 10, 'Confiança deve estar entre 1-10');
    assert(bitcoinAnalysis.reasoning, 'Deve ter reasoning');
    assert(['BAIXO', 'MÉDIO', 'ALTO'].includes(bitcoinAnalysis.risk), 'Risco deve ser válido');
    
    console.log('✅ Teste de trading automático passou');
    console.log(`   📊 Analisou ${analysis.coinAnalyses.length} moedas`);
    console.log(`   🎯 Sentimento: ${analysis.portfolioSummary.marketSentiment}`);
    console.log(`   💡 Recomendação: ${analysis.portfolioSummary.recommendation}`);
    
  } catch (error) {
    console.error('❌ Erro no teste de trading automático:', error);
    throw error;
  }
});

test('CryptoService - Parsing de Resposta LLM', async () => {
  const mockLLMService = { generateText: async () => '' };
  const cryptoService = new CryptoService(mockLLMService);
  
  // Teste de parsing com resposta válida
  const validResponse = `DECISÃO: VENDER
CONFIANÇA: 8
RAZÃO: RSI sobrecomprado indicando possível correção
RISCO: ALTO
TIMEFRAME: 2 dias`;
  
  const mockData = {
    currentPrice: 45000,
    statistics: { volatility: 15 }
  };
  
  const parsed = cryptoService.parseAutomaticTradingResponse(validResponse, mockData);
  
  assert(parsed.recommendation === 'VENDER', 'Deve extrair recomendação corretamente');
  assert(parsed.confidence === 8, 'Deve extrair confiança corretamente');
  assert(parsed.reasoning.includes('RSI sobrecomprado'), 'Deve extrair reasoning corretamente');
  assert(parsed.risk === 'ALTO', 'Deve extrair risco corretamente');
  assert(parsed.timeframe === '2 dias', 'Deve extrair timeframe corretamente');
  
  console.log('✅ Teste de parsing LLM passou');
});

test('CryptoService - Resumo de Portfólio', async () => {
  const mockLLMService = { generateText: async () => '' };
  const cryptoService = new CryptoService(mockLLMService);
  
  const mockAnalyses = [
    { recommendation: 'COMPRAR', confidence: 8 },
    { recommendation: 'COMPRAR', confidence: 7 },
    { recommendation: 'VENDER', confidence: 6 },
    { recommendation: 'HOLD', confidence: 5 }
  ];
  
  const summary = cryptoService.generatePortfolioSummary(mockAnalyses);
  
  assert(summary.totalCoins === 4, 'Deve contar todas as moedas');
  assert(summary.signals.buy === 2, 'Deve contar sinais de compra');
  assert(summary.signals.sell === 1, 'Deve contar sinais de venda');
  assert(summary.signals.hold === 1, 'Deve contar sinais de hold');
  assert(summary.averageConfidence === 6.5, 'Deve calcular confiança média');
  assert(summary.marketSentiment === 'BULLISH', 'Deve identificar sentimento bullish');
  
  console.log('✅ Teste de resumo de portfólio passou');
});