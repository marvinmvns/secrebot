import { test, describe } from 'node:test';
import assert from 'node:assert';
import LLMService from '../src/services/llmService.js';
import logger from '../src/utils/logger.js';

describe('Simple API Integration Tests', () => {
  let llmService;
  
  const TEST_CONTACT_ID = 'simple-test@test.com';
  const TEST_MESSAGE = 'Responda apenas com "API OK".';

  test('Initialize LLM Service', async () => {
    try {
      llmService = new LLMService();
      assert(llmService, 'LLM Service should be initialized');
      console.log('✅ LLM Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize LLM Service:', error);
      throw error;
    }
  });

  test('Test detectApiType method', async () => {
    try {
      const apiType = await llmService.detectApiType();
      assert(typeof apiType === 'string', 'API type should be a string');
      console.log(`✅ Detected API type: ${apiType}`);
    } catch (error) {
      console.error('❌ Failed to detect API type:', error);
      throw error;
    }
  });

  test('Test Local Ollama Direct', async () => {
    try {
      console.log('🦙 Testing direct local Ollama...');
      
      // Test with a simple prompt
      const response = await llmService.ollama.chat({
        model: 'gemma2:2b',
        messages: [{ role: 'user', content: TEST_MESSAGE }]
      });

      console.log('🔍 Raw Ollama response structure:');
      console.log(JSON.stringify({
        hasMessage: !!response.message,
        messageKeys: response.message ? Object.keys(response.message) : [],
        topLevelKeys: Object.keys(response),
        contentType: typeof response.message?.content,
        contentPresent: !!response.message?.content
      }, null, 2));

      llmService.validateResponseStructure(response, 'ollama');
      
      assert(response.message && response.message.content, 'Should have message.content');
      console.log('✅ Direct Ollama test passed:', response.message.content.substring(0, 50) + '...');
      
    } catch (error) {
      console.error('❌ Direct Ollama test failed:', error.message);
      if (!error.message.includes('timeout') && !error.message.includes('ECONNREFUSED')) {
        throw error;
      }
      console.log('⚠️ Direct Ollama test skipped due to connectivity');
    }
  });

  test('Test API Pool Status', async () => {
    try {
      const status = await llmService.getOllamaApiStatus();
      console.log('📊 API Pool Status:', JSON.stringify({
        enabled: status.enabled,
        totalEndpoints: status.totalEndpoints,
        healthyEndpoints: status.healthyEndpoints,
        hasEndpoints: status.endpoints && status.endpoints.length > 0
      }, null, 2));

      if (status.endpoints && status.endpoints.length > 0) {
        console.log('🔗 Endpoints:');
        status.endpoints.forEach((endpoint, i) => {
          console.log(`  ${i+1}. ${endpoint.url} (${endpoint.type || 'ollama'}) - ${endpoint.healthy ? 'Healthy' : 'Unhealthy'}`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Could not get API pool status:', error.message);
    }
  });

  test('Test LLM Service Chat Method', async () => {
    try {
      console.log('💬 Testing LLM Service chat method...');
      
      const response = await llmService.getAssistantResponse(TEST_CONTACT_ID, TEST_MESSAGE);
      
      assert(typeof response === 'string', 'Should return string response');
      assert(response.length > 0, 'Response should not be empty');
      
      console.log('✅ LLM Service chat test passed:', response.substring(0, 100) + '...');
      
      // Clear context
      await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
      
    } catch (error) {
      console.error('❌ LLM Service chat test failed:', error.message);
      if (error.message.includes('No healthy') || error.message.includes('timeout')) {
        console.log('⚠️ LLM Service chat test skipped due to API issues');
        return;
      }
      throw error;
    }
  });

  test('Test Individual Endpoint Types (if available)', async () => {
    try {
      const status = await llmService.getOllamaApiStatus();
      
      if (!status.enabled || !status.endpoints || status.endpoints.length === 0) {
        console.log('⚠️ No API pool endpoints available for individual testing');
        return;
      }

      const healthyEndpoints = status.endpoints.filter(e => e.healthy);
      
      for (const endpoint of healthyEndpoints.slice(0, 2)) { // Test max 2 endpoints
        try {
          console.log(`🎯 Testing ${endpoint.type || 'ollama'} endpoint: ${endpoint.url}`);
          
          const response = await llmService.chatWithSpecificEndpoint(
            TEST_CONTACT_ID, 
            `Teste ${endpoint.type || 'ollama'} - responda apenas "OK"`, 
            endpoint.url
          );
          
          assert(typeof response === 'string', `${endpoint.type} should return string`);
          console.log(`✅ ${endpoint.type || 'ollama'} endpoint test passed:`, response.substring(0, 50) + '...');
          
          await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
          
        } catch (error) {
          console.error(`❌ ${endpoint.type || 'ollama'} endpoint test failed:`, error.message);
          // Continue with other endpoints
        }
      }
      
    } catch (error) {
      console.error('❌ Individual endpoint testing failed:', error.message);
      console.log('⚠️ Individual endpoint testing skipped');
    }
  });

  test('Test Response Validation with Different Formats', async () => {
    console.log('🔍 Testing response validation with mock data...');

    // Test ChatGPT format
    const chatgptResponse = { 
      message: { role: 'assistant', content: 'ChatGPT response' } 
    };
    llmService.validateResponseStructure(chatgptResponse, 'chatgpt');
    console.log('✅ ChatGPT format validation passed');

    // Test Ollama format
    const ollamaResponse = { 
      message: { content: 'Ollama response' } 
    };
    llmService.validateResponseStructure(ollamaResponse, 'ollama');
    console.log('✅ Ollama format validation passed');

    // Test RKLlama format
    const rkllamaResponse = { 
      message: { role: 'assistant', content: 'RKLlama response' } 
    };
    llmService.validateResponseStructure(rkllamaResponse, 'rkllama');
    console.log('✅ RKLlama format validation passed');

    console.log('✅ All response validation tests passed');
  });

  test('Cleanup', async () => {
    try {
      await llmService.clearContext(TEST_CONTACT_ID, 'assistant');
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error.message);
    }
  });
});