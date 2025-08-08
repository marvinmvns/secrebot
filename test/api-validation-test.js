import { test, describe } from 'node:test';
import assert from 'node:assert';
import LLMService from '../src/services/llmService.js';
import logger from '../src/utils/logger.js';

describe('API Response Validation Tests', () => {
  let llmService;

  test('Initialize LLM Service', async () => {
    llmService = new LLMService();
    assert(llmService, 'LLM Service should be initialized');
  });

  describe('ChatGPT Response Validation', () => {
    test('Should validate standard ChatGPT response', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Hello from ChatGPT!'
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'chatgpt');
        assert(mockResponse.message.content === 'Hello from ChatGPT!');
        console.log('✅ ChatGPT standard response validation passed');
      } catch (error) {
        assert.fail(`ChatGPT validation failed: ${error.message}`);
      }
    });

    test('Should convert OpenAI API format to expected format', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Hello from OpenAI API!'
          }
        }]
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'chatgpt');
        assert(mockResponse.message.content === 'Hello from OpenAI API!');
        console.log('✅ ChatGPT OpenAI API format conversion passed');
      } catch (error) {
        assert.fail(`ChatGPT API format conversion failed: ${error.message}`);
      }
    });

    test('Should handle result wrapper from API pool', async () => {
      const mockResponse = {
        result: {
          message: {
            role: 'assistant',
            content: 'Hello from API Pool!'
          }
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'chatgpt');
        assert(mockResponse.message.content === 'Hello from API Pool!');
        console.log('✅ ChatGPT result wrapper validation passed');
      } catch (error) {
        assert.fail(`ChatGPT result wrapper validation failed: ${error.message}`);
      }
    });
  });

  describe('Ollama Response Validation', () => {
    test('Should validate standard Ollama response', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Hello from Ollama!'
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'ollama');
        assert(mockResponse.message.content === 'Hello from Ollama!');
        console.log('✅ Ollama standard response validation passed');
      } catch (error) {
        assert.fail(`Ollama validation failed: ${error.message}`);
      }
    });

    test('Should convert Ollama generate format', async () => {
      const mockResponse = {
        response: 'Hello from Ollama generate!'
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'ollama');
        assert(mockResponse.message.content === 'Hello from Ollama generate!');
        console.log('✅ Ollama generate format conversion passed');
      } catch (error) {
        assert.fail(`Ollama generate format conversion failed: ${error.message}`);
      }
    });

    test('Should handle result wrapper from API pool', async () => {
      const mockResponse = {
        result: {
          message: {
            role: 'assistant',
            content: 'Hello from Ollama Pool!'
          }
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'ollama');
        assert(mockResponse.message.content === 'Hello from Ollama Pool!');
        console.log('✅ Ollama result wrapper validation passed');
      } catch (error) {
        assert.fail(`Ollama result wrapper validation failed: ${error.message}`);
      }
    });
  });

  describe('RKLlama Response Validation', () => {
    test('Should validate standard RKLlama response', async () => {
      const mockResponse = {
        message: {
          role: 'assistant',
          content: 'Hello from RKLlama!'
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'rkllama');
        assert(mockResponse.message.content === 'Hello from RKLlama!');
        console.log('✅ RKLlama standard response validation passed');
      } catch (error) {
        assert.fail(`RKLlama validation failed: ${error.message}`);
      }
    });

    test('Should convert RKLlama text format', async () => {
      const mockResponse = {
        text: 'Hello from RKLlama text!'
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'rkllama');
        assert(mockResponse.message.content === 'Hello from RKLlama text!');
        console.log('✅ RKLlama text format conversion passed');
      } catch (error) {
        assert.fail(`RKLlama text format conversion failed: ${error.message}`);
      }
    });

    test('Should handle result wrapper from API pool', async () => {
      const mockResponse = {
        result: {
          message: {
            role: 'assistant',
            content: 'Hello from RKLlama Pool!'
          }
        }
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'rkllama');
        assert(mockResponse.message.content === 'Hello from RKLlama Pool!');
        console.log('✅ RKLlama result wrapper validation passed');
      } catch (error) {
        assert.fail(`RKLlama result wrapper validation failed: ${error.message}`);
      }
    });
  });

  describe('Error Handling', () => {
    test('Should handle null response', async () => {
      try {
        llmService.validateResponseStructure(null, 'ollama');
        assert.fail('Should have thrown error for null response');
      } catch (error) {
        assert(error.message.includes('null or undefined'));
        console.log('✅ Null response error handling passed');
      }
    });

    test('Should handle invalid ChatGPT response', async () => {
      const mockResponse = {
        invalid: 'structure'
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'chatgpt');
        assert.fail('Should have thrown error for invalid ChatGPT response');
      } catch (error) {
        assert(error.message.includes('Response missing valid'));
        console.log('✅ Invalid ChatGPT response error handling passed');
      }
    });

    test('Should handle invalid Ollama response', async () => {
      const mockResponse = {
        invalid: 'structure'
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'ollama');
        assert.fail('Should have thrown error for invalid Ollama response');
      } catch (error) {
        assert(error.message.includes('Response missing valid'));
        console.log('✅ Invalid Ollama response error handling passed');
      }
    });

    test('Should handle invalid RKLlama response', async () => {
      const mockResponse = {
        invalid: 'structure'
      };

      try {
        llmService.validateResponseStructure(mockResponse, 'rkllama');
        assert.fail('Should have thrown error for invalid RKLlama response');
      } catch (error) {
        assert(error.message.includes('Response missing valid'));
        console.log('✅ Invalid RKLlama response error handling passed');
      }
    });
  });
});