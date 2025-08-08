#!/usr/bin/env node

/**
 * Script de teste para verificar se os alertas de crypto estão funcionando
 */

import CryptoService from '../src/services/cryptoService.js';

async function testCryptoAlerts() {
  console.log('🧪 Iniciando teste de alertas crypto...\n');
  
  const cryptoService = new CryptoService();
  const testUserId = 'test_user_debug';
  
  try {
    // 1. Conectar ao MongoDB
    console.log('1. Conectando ao MongoDB...');
    await cryptoService.connect();
    
    // 2. Ativar monitoramento com threshold baixo para teste
    console.log('2. Ativando monitoramento...');
    const config = cryptoService.activateMonitoring(testUserId, {
      thresholdPercentage: 0.1, // 0.1% para facilitar testes
      notifications: true,
      cooldownMinutes: 1 // 1 minuto de cooldown
    });
    console.log('   Config:', config);
    
    // 3. Verificar status
    console.log('\n3. Verificando status...');
    const status = cryptoService.getDetailedMonitoringStatus(testUserId);
    console.log('   Status detalhado:', JSON.stringify(status, null, 2));
    
    // 4. Simular preços para criar histórico
    console.log('\n4. Simulando preços para criar histórico...');
    const basePrice = 50000;
    for (let i = 0; i < 3; i++) {
      const price = basePrice + (i * 10); // Pequena variação
      cryptoService.storePriceHistory('bitcoin', price);
      console.log(`   Preço ${i + 1}: $${price}`);
    }
    
    // 5. Testar cálculo de variação
    console.log('\n5. Testando cálculo de variação...');
    const variation = cryptoService.calculateVariationWithTimeframe('bitcoin', '1m');
    console.log('   Variação:', variation);
    
    // 6. Verificar se deveria enviar alerta
    if (variation) {
      console.log('\n6. Verificando critérios para alerta...');
      const shouldAlert = cryptoService.shouldSendAlert(testUserId, 'bitcoin', variation, config);
      console.log('   Deveria enviar alerta:', shouldAlert);
    }
    
    // 7. Simular alerta de teste
    console.log('\n7. Simulando alerta de teste...');
    const alertResult = await cryptoService.simulateTestAlert(testUserId, 'bitcoin', 2.5);
    console.log('   Resultado:', alertResult);
    
    // 8. Verificar alertas pendentes
    console.log('\n8. Verificando alertas pendentes...');
    const pendingAlerts = cryptoService.getPendingAlerts();
    console.log('   Alertas pendentes:', pendingAlerts.length);
    pendingAlerts.forEach((alert, i) => {
      console.log(`   Alerta ${i + 1}:`, alert.message.substring(0, 100) + '...');
    });
    
    // 9. Forçar verificação de preços
    console.log('\n9. Forçando verificação de preços...');
    const metrics = await cryptoService.forceCheckPrices();
    console.log('   Métricas:', metrics);
    
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    // Cleanup
    cryptoService.deactivateMonitoring(testUserId);
    await cryptoService.disconnect();
  }
}

// Executar teste
testCryptoAlerts().catch(console.error);