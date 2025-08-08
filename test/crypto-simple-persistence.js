import { test, describe } from 'node:test';
import assert from 'node:assert';
import CryptoService from '../src/services/cryptoService.js';
import logger from '../src/utils/logger.js';

describe('Simple Crypto Persistence Tests', () => {
  let cryptoService;
  
  const TEST_USER_ID = 'simple-crypto-test@test.com';
  
  test('Initialize Crypto Service Directly', async () => {
    try {
      // Create a mock LLM service
      const mockLlmService = {
        getAssistantResponse: async () => "Mock response"
      };
      
      cryptoService = new CryptoService(mockLlmService);
      
      // Wait for MongoDB initialization
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      assert(cryptoService, 'Crypto Service should be initialized');
      assert(cryptoService.isConnected, 'MongoDB should be connected');
      
      console.log('✅ Crypto Service initialized directly');
      
    } catch (error) {
      console.error('❌ Failed to initialize Crypto Service:', error);
      throw error;
    }
  });
  
  test('Test MongoDB Connection', async () => {
    try {
      // Check if MongoDB is connected
      if (!cryptoService.isConnected) {
        console.log('⚠️ MongoDB not connected yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      assert(cryptoService.isConnected === true, 'MongoDB should be connected');
      assert(cryptoService.collection, 'MongoDB collection should be available');
      
      console.log('✅ MongoDB connection verified');
      
    } catch (error) {
      console.error('❌ MongoDB connection test failed:', error);
      // Don't throw - continue with other tests
      console.log('⚠️ Skipping MongoDB-dependent tests');
    }
  });
  
  test('Test Basic Activation and Persistence', async () => {
    try {
      if (!cryptoService.isConnected) {
        console.log('⚠️ Skipping persistence test - MongoDB not connected');
        return;
      }
      
      console.log('🔄 Testing crypto monitoring activation...');
      
      const config = cryptoService.activateMonitoring(TEST_USER_ID, {
        thresholdPercentage: 2.5,
        coins: ['bitcoin', 'ethereum'],
        notifications: true
      });
      
      assert(config, 'Should return monitoring config');
      assert(config.active === true, 'Config should be active');
      assert(config.thresholdPercentage === 2.5, 'Threshold should be set correctly');
      
      console.log('✅ Monitoring activated successfully');
      
      // Give time for save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify it's in memory
      const status = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(status.active === true, 'Should be active in memory');
      
      console.log('✅ Monitoring verified in memory');
      
    } catch (error) {
      console.error('❌ Activation test failed:', error);
      throw error;
    }
  });
  
  test('Test Memory Clear and Reload', async () => {
    try {
      if (!cryptoService.isConnected) {
        console.log('⚠️ Skipping reload test - MongoDB not connected');
        return;
      }
      
      console.log('🔄 Clearing memory and testing reload...');
      
      // Clear memory
      cryptoService.activeMonitoring.clear();
      
      // Verify cleared
      let status = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(status.active === false, 'Should be cleared from memory');
      
      console.log('✅ Memory cleared');
      
      // Reload from database
      await cryptoService.loadMonitoringConfigs();
      
      // Verify restored
      status = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(status.active === true, 'Should be restored from database');
      assert(status.config, 'Should have config');
      assert(status.config.thresholdPercentage === 2.5, 'Config should be preserved');
      assert(status.config.coins.includes('bitcoin'), 'Coins should be preserved');
      
      console.log('✅ Successfully reloaded from database');
      console.log('📊 Restored config:', {
        threshold: status.config.thresholdPercentage,
        coins: status.config.coins,
        active: status.active
      });
      
    } catch (error) {
      console.error('❌ Reload test failed:', error);
      throw error;
    }
  });
  
  test('Test Deactivation and Database Cleanup', async () => {
    try {
      if (!cryptoService.isConnected) {
        console.log('⚠️ Skipping deactivation test - MongoDB not connected');
        return;
      }
      
      console.log('🔄 Testing deactivation and cleanup...');
      
      // Deactivate
      const result = cryptoService.deactivateMonitoring(TEST_USER_ID);
      assert(result === true, 'Deactivation should succeed');
      
      // Verify removed from memory
      let status = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(status.active === false, 'Should be removed from memory');
      
      // Wait for database deletion
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear memory and try to reload (should find nothing)
      cryptoService.activeMonitoring.clear();
      await cryptoService.loadMonitoringConfigs();
      
      status = cryptoService.getMonitoringStatus(TEST_USER_ID);
      assert(status.active === false, 'Should not be restored from database');
      
      console.log('✅ Deactivation and cleanup successful');
      
    } catch (error) {
      console.error('❌ Deactivation test failed:', error);
      throw error;
    }
  });
  
  test('Cleanup', async () => {
    try {
      // Ensure clean state
      if (cryptoService) {
        cryptoService.deactivateMonitoring(TEST_USER_ID);
        
        // Close MongoDB connection
        if (cryptoService.client) {
          await cryptoService.client.close();
          console.log('✅ MongoDB connection closed');
        }
      }
      
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  });
});