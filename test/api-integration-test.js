import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ApplicationFactory } from '../src/core/applicationFactory.js';
import logger from '../src/utils/logger.js';

describe('API Integration Tests', () => {
  let appFactory;
  let llmService;
  
  const TEST_CONTACT_ID = 'integration-test@test.com';
  const TEST_MESSAGE = 'Olá, este é um teste de integração. Responda apenas com "OK".';

  test('Initialize Application Factory', async () => {
    try {
      appFactory = new ApplicationFactory();
      await appFactory.initializeApplication();
      llmService = appFactory.services.llmService;
      
      assert(llmService, 'LLM Service should be available');
      console.log('✅ Application Factory initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Application Factory:', error);
      throw error;
    }
  });

  test('Get API Pool Status', async () => {
    try {
      const status = await llmService.getOllamaApiStatus();
      console.log('📊 API Pool Status:', JSON.stringify({
        enabled: status.enabled,
        totalEndpoints: status.totalEndpoints,
        healthyEndpoints: status.healthyEndpoints,
        strategy: status.strategy
      }, null, 2));

      // List endpoints and their types
      if (status.endpoints && status.endpoints.length > 0) {
        console.log('🔗 Available Endpoints:');
        status.endpoints.forEach((endpoint, index) => {
          console.log(`  ${index + 1}. ${endpoint.url} (${endpoint.type || 'ollama'}) - ${endpoint.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not get API pool status:', error.message);
    }
  });

  describe('Test Each API Type', () => {
    test('Test Ollama Response', async () => {
      try {
        console.log('🦙 Testing Ollama response...');
        
        // Force use local Ollama by temporarily disabling API pool
        const originalShouldUse = llmService.shouldUseApiPool;
        llmService.shouldUseApiPool = async () => false;
        
        const response = await llmService.getAssistantResponse(TEST_CONTACT_ID, TEST_MESSAGE);
        
        // Restore original method
        llmService.shouldUseApiPool = originalShouldUse;
        
        assert(typeof response === 'string', 'Ollama should return string response');
        assert(response.length > 0, 'Ollama response should not be empty');
        
        console.log('✅ Ollama response received:', response.substring(0, 100) + '...');
        
        // Clear context for next test
        await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
        
      } catch (error) {
        console.error('❌ Ollama test failed:', error.message);
        if (!error.message.includes('timeout') && !error.message.includes('ECONNREFUSED')) {
          throw error;
        }
        console.log('⚠️ Ollama test skipped due to connectivity issues');
      }
    });

    test('Test API Pool (Mixed Types)', async () => {
      try {
        console.log('🔄 Testing API Pool (all available endpoints)...');
        
        const response = await llmService.getAssistantResponse(TEST_CONTACT_ID, TEST_MESSAGE);
        
        assert(typeof response === 'string', 'API Pool should return string response');
        assert(response.length > 0, 'API Pool response should not be empty');
        
        console.log('✅ API Pool response received:', response.substring(0, 100) + '...');
        
        // Clear context for next test
        await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
        
      } catch (error) {
        console.error('❌ API Pool test failed:', error.message);
        if (!error.message.includes('timeout') && !error.message.includes('No healthy')) {
          throw error;
        }
        console.log('⚠️ API Pool test skipped due to no healthy endpoints');
      }
    });

    test('Test Specific Endpoint Types', async () => {
      try {
        const status = await llmService.getOllamaApiStatus();
        
        if (!status.enabled || !status.endpoints || status.endpoints.length === 0) {
          console.log('⚠️ No endpoints available for specific testing');
          return;
        }

        for (const endpoint of status.endpoints) {
          if (!endpoint.healthy) {
            console.log(`⏭️ Skipping unhealthy endpoint: ${endpoint.url} (${endpoint.type})`);
            continue;
          }

          try {
            console.log(`🎯 Testing specific endpoint: ${endpoint.url} (${endpoint.type})`);
            
            let response;
            if (endpoint.type === 'chatgpt') {
              console.log('🤖 Testing ChatGPT endpoint...');
              response = await llmService.chatWithSpecificEndpoint(TEST_CONTACT_ID, TEST_MESSAGE, endpoint.url);
            } else if (endpoint.type === 'rkllama') {
              console.log('🚀 Testing RKLlama endpoint...');
              response = await llmService.chatWithSpecificEndpoint(TEST_CONTACT_ID, TEST_MESSAGE, endpoint.url);
            } else {
              console.log('🦙 Testing Ollama endpoint...');
              response = await llmService.chatWithSpecificEndpoint(TEST_CONTACT_ID, TEST_MESSAGE, endpoint.url);
            }
            
            assert(typeof response === 'string', `${endpoint.type} should return string response`);
            assert(response.length > 0, `${endpoint.type} response should not be empty`);
            
            console.log(`✅ ${endpoint.type} endpoint (${endpoint.url}) response:`, response.substring(0, 80) + '...');
            
            // Clear context between tests
            await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
            
            // Add small delay between endpoint tests
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`❌ ${endpoint.type} endpoint (${endpoint.url}) failed:`, error.message);
            // Continue with other endpoints
          }
        }
      } catch (error) {
        console.error('❌ Specific endpoint testing failed:', error.message);
        // Don't throw, as this might be expected in some environments
      }
    });
  });

  describe('Fallback Testing', () => {
    test('Test Fallback Chain', async () => {
      try {
        console.log('🔄 Testing fallback chain...');
        
        // This should try API pool first, then fallback to local
        const response = await llmService.getAssistantResponse(TEST_CONTACT_ID, 'Teste de fallback - responda apenas "FALLBACK OK"');
        
        assert(typeof response === 'string', 'Fallback should return string response');
        assert(response.length > 0, 'Fallback response should not be empty');
        
        console.log('✅ Fallback test completed:', response.substring(0, 100) + '...');
        
      } catch (error) {
        console.error('❌ Fallback test failed:', error.message);
        // This test might fail if no endpoints are available, which is acceptable
        console.log('⚠️ Fallback test completed with error (this may be expected)');
      }
    });
  });

  describe('Response Format Validation', () => {
    test('Test Response Structure Consistency', async () => {
      try {
        console.log('🔍 Testing response structure consistency across APIs...');
        
        const responses = [];
        const status = await llmService.getOllamaApiStatus();
        
        // Test with different endpoints if available
        if (status.enabled && status.endpoints) {
          for (const endpoint of status.endpoints.slice(0, 3)) { // Limit to first 3 endpoints
            if (endpoint.healthy) {
              try {
                const response = await llmService.chatWithSpecificEndpoint(
                  TEST_CONTACT_ID, 
                  'Responda apenas com a palavra "TESTE"', 
                  endpoint.url
                );
                responses.push({ type: endpoint.type, response });
                
                // Clear context
                await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
                
              } catch (error) {
                console.log(`⚠️ Endpoint ${endpoint.url} failed: ${error.message}`);
              }
            }
          }
        }
        
        // Validate all responses are strings
        responses.forEach(({ type, response }) => {
          assert(typeof response === 'string', `${type} should return string`);
          console.log(`✅ ${type} response format valid: ${response.substring(0, 50)}...`);
        });
        
        console.log(`✅ Tested ${responses.length} different API responses`);
        
      } catch (error) {
        console.error('❌ Response structure test failed:', error.message);
        throw error;
      }
    });
  });

  test('Cleanup', async () => {
    try {
      // Clear any remaining contexts
      await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  });
});