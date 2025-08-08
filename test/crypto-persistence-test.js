import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ApplicationFactory } from '../src/core/applicationFactory.js';
import logger from '../src/utils/logger.js';

describe('Crypto Monitoring Persistence Tests', () => {
  let appFactory;
  let cryptoService;
  
  const TEST_USER_ID = 'crypto-persistence-test@test.com';
  
  test('Initialize Application Factory', async () => {
    try {
      appFactory = new ApplicationFactory();
      const services = await appFactory.initializeApplication();
      cryptoService = services.cryptoService;
      
      assert(cryptoService, 'Crypto Service should be available');
      console.log('✅ Application Factory initialized successfully');
      
      // Wait for MongoDB initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('❌ Failed to initialize Application Factory:', error);
      throw error;
    }
  });
  
  test('Activate Crypto Monitoring', async () => {
    try {
      console.log('🔄 Activating crypto monitoring...');
      
      const config = cryptoService.activateMonitoring(TEST_USER_ID, {
        thresholdPercentage: 5.0,
        coins: ['bitcoin', 'ethereum'],
        notifications: true,
        alertOnRise: true,
        alertOnFall: true,
        cooldownMinutes: 15
      });
      
      assert(config, 'Should return monitoring config');
      assert(config.active === true, 'Config should be active');
      assert(config.thresholdPercentage === 5.0, 'Threshold should be set');
      assert(Array.isArray(config.coins), 'Coins should be array');
      assert(config.coins.includes('bitcoin'), 'Should include bitcoin');
      assert(config.coins.includes('ethereum'), 'Should include ethereum');
      
      console.log('✅ Crypto monitoring activated successfully');
      console.log('📊 Config:', JSON.stringify({
        active: config.active,
        threshold: config.thresholdPercentage,
        coins: config.coins,
        notifications: config.notifications
      }, null, 2));
      
      // Give time for MongoDB save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('❌ Failed to activate crypto monitoring:', error);
      throw error;
    }
  });
  
  test('Verify Monitoring is Active in Memory', async () => {
    try {
      const isMonitoring = cryptoService.isMonitoringActive(TEST_USER_ID);
      assert(isMonitoring === true, 'Monitoring should be active in memory');
      
      const config = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(config, 'Should have monitoring config');
      assert(config.active === true, 'Config should be active');
      
      console.log('✅ Monitoring verified active in memory');
      
    } catch (error) {
      console.error('❌ Failed to verify monitoring in memory:', error);
      throw error;
    }
  });
  
  test('Simulate Application Restart - Clear Memory', async () => {
    try {
      console.log('🔄 Simulating app restart by clearing memory...');
      
      // Clear the in-memory activeMonitoring Map to simulate restart
      cryptoService.activeMonitoring.clear();
      
      // Verify memory is cleared
      const isMonitoring = cryptoService.isMonitoringActive(TEST_USER_ID);
      assert(isMonitoring === false, 'Memory should be cleared');
      
      console.log('✅ Memory cleared - simulating restart condition');
      
    } catch (error) {
      console.error('❌ Failed to clear memory:', error);
      throw error;
    }
  });
  
  test('Reload Monitoring from Database', async () => {
    try {
      console.log('💾 Reloading monitoring configs from database...');
      
      // Call the load method directly
      await cryptoService.loadMonitoringConfigs();
      
      // Verify the config was loaded back into memory
      const isMonitoring = cryptoService.isMonitoringActive(TEST_USER_ID);
      assert(isMonitoring === true, 'Monitoring should be restored from database');
      
      const config = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(config, 'Should have monitoring config');
      assert(config.active === true, 'Config should be active');
      assert(config.thresholdPercentage === 5.0, 'Threshold should be preserved');
      assert(Array.isArray(config.coins), 'Coins should be array');
      assert(config.coins.includes('bitcoin'), 'Should include bitcoin');
      assert(config.coins.includes('ethereum'), 'Should include ethereum');
      
      console.log('✅ Monitoring config successfully restored from database');
      console.log('📊 Restored config:', JSON.stringify({
        active: config.active,
        threshold: config.thresholdPercentage,
        coins: config.coins,
        notifications: config.notifications
      }, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to reload from database:', error);
      throw error;
    }
  });
  
  test('Test Monitoring Update Persistence', async () => {
    try {
      console.log('🔄 Testing monitoring config update...');
      
      // Update the monitoring configuration
      const updatedConfig = cryptoService.activateMonitoring(TEST_USER_ID, {
        thresholdPercentage: 3.0, // Changed from 5.0
        coins: ['bitcoin', 'ethereum', 'cardano'], // Added cardano
        notifications: true,
        alertOnRise: false, // Changed from true
        alertOnFall: true,
        cooldownMinutes: 10 // Changed from 15
      });
      
      assert(updatedConfig.thresholdPercentage === 3.0, 'Threshold should be updated');
      assert(updatedConfig.coins.includes('cardano'), 'Should include new coin');
      assert(updatedConfig.alertOnRise === false, 'Alert setting should be updated');
      assert(updatedConfig.cooldownMinutes === 10, 'Cooldown should be updated');
      
      // Give time for save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear memory and reload to test persistence
      cryptoService.activeMonitoring.clear();
      await cryptoService.loadMonitoringConfigs();
      
      const reloadedConfig = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(reloadedConfig.thresholdPercentage === 3.0, 'Updated threshold should persist');
      assert(reloadedConfig.coins.includes('cardano'), 'New coin should persist');
      assert(reloadedConfig.alertOnRise === false, 'Updated alert setting should persist');
      assert(reloadedConfig.cooldownMinutes === 10, 'Updated cooldown should persist');
      
      console.log('✅ Config update persistence verified');
      
    } catch (error) {
      console.error('❌ Failed to test update persistence:', error);
      throw error;
    }
  });
  
  test('Test Monitoring Deactivation Persistence', async () => {
    try {
      console.log('🔄 Testing monitoring deactivation...');
      
      // Deactivate monitoring
      const result = cryptoService.deactivateMonitoring(TEST_USER_ID);
      assert(result === true, 'Deactivation should succeed');
      
      // Verify removed from memory
      const isMonitoring = cryptoService.isMonitoringActive(TEST_USER_ID);
      assert(isMonitoring === false, 'Should not be monitoring in memory');
      
      // Give time for database delete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear memory and try to reload
      cryptoService.activeMonitoring.clear();
      await cryptoService.loadMonitoringConfigs();
      
      // Verify not restored from database
      const stillMonitoring = cryptoService.isMonitoringActive(TEST_USER_ID);
      assert(stillMonitoring === false, 'Should not be restored from database');
      
      console.log('✅ Monitoring deactivation persistence verified');
      
    } catch (error) {
      console.error('❌ Failed to test deactivation persistence:', error);
      throw error;
    }
  });
  
  test('Cleanup', async () => {
    try {
      // Ensure clean state
      cryptoService.deactivateMonitoring(TEST_USER_ID);
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  });
});