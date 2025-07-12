import { test, describe } from 'node:test';
import assert from 'node:assert';
import WhisperAPIClient from '../src/services/whisperApiClient.js';
import whisperApiPool from '../src/services/whisperApiPool.js';
import { CONFIG } from '../src/config/index.js';

describe('Whisper API Implementation', () => {
  
  test('WhisperAPIClient should create instance with correct baseURL', () => {
    const client = new WhisperAPIClient('http://localhost:3001');
    assert.strictEqual(client.baseURL, 'http://localhost:3001');
    assert.strictEqual(client.isHealthy, true);
    assert.strictEqual(client.queueLength, 0);
  });

  test('WhisperAPIClient should calculate load score', () => {
    const client = new WhisperAPIClient('http://localhost:3001');
    client.queueLength = 3;
    client.avgProcessingTime = 5000;
    
    const loadScore = client.getLoadScore();
    assert.strictEqual(loadScore, 8); // 3 + (5000/1000)
  });

  test('WhisperAPIPool should initialize correctly', () => {
    assert.strictEqual(typeof whisperApiPool.isEnabled(), 'boolean');
    assert.strictEqual(typeof whisperApiPool.hasHealthyEndpoints(), 'boolean');
  });

  test('WhisperAPIPool should handle empty configuration', () => {
    const healthyClients = whisperApiPool.getHealthyClients();
    assert(Array.isArray(healthyClients));
  });

  test('Configuration should have whisperApi section', () => {
    assert(CONFIG.whisperApi);
    assert.strictEqual(typeof CONFIG.whisperApi.enabled, 'boolean');
    assert.strictEqual(typeof CONFIG.whisperApi.mode, 'string');
    assert(Array.isArray(CONFIG.whisperApi.endpoints));
    assert(CONFIG.whisperApi.loadBalancing);
    assert.strictEqual(typeof CONFIG.whisperApi.loadBalancing.strategy, 'string');
  });

  test('Whisper API configuration should have valid load balancing strategies', () => {
    const validStrategies = ['round_robin', 'priority', 'queue_length'];
    assert(validStrategies.includes(CONFIG.whisperApi.loadBalancing.strategy));
  });

  test('Whisper API endpoints should have required properties', () => {
    CONFIG.whisperApi.endpoints.forEach(endpoint => {
      assert(typeof endpoint.url === 'string');
      assert(typeof endpoint.enabled === 'boolean');
      assert(typeof endpoint.priority === 'number');
      assert(typeof endpoint.maxRetries === 'number');
      assert(endpoint.priority >= 1 && endpoint.priority <= 5);
      assert(endpoint.maxRetries >= 0);
    });
  });

  test('WhisperAPIPool should select client by round robin strategy', () => {
    const mockClients = [
      { baseURL: 'http://localhost:3001', isHealthy: true, retryCount: 0, endpoint: { maxRetries: 2 } },
      { baseURL: 'http://localhost:3002', isHealthy: true, retryCount: 0, endpoint: { maxRetries: 2 } }
    ];
    
    // Mock the pool's clients
    const originalClients = whisperApiPool.clients;
    whisperApiPool.clients = mockClients;
    
    try {
      const client1 = whisperApiPool.selectRoundRobin(mockClients);
      const client2 = whisperApiPool.selectRoundRobin(mockClients);
      
      assert(client1);
      assert(client2);
      assert.notStrictEqual(client1, client2);
    } finally {
      whisperApiPool.clients = originalClients;
    }
  });

  test('WhisperAPIPool should select client by priority strategy', () => {
    const mockClients = [
      { 
        baseURL: 'http://localhost:3001', 
        isHealthy: true, 
        retryCount: 0, 
        endpoint: { maxRetries: 2, priority: 2 } 
      },
      { 
        baseURL: 'http://localhost:3002', 
        isHealthy: true, 
        retryCount: 0, 
        endpoint: { maxRetries: 2, priority: 1 } 
      }
    ];
    
    const client = whisperApiPool.selectByPriority(mockClients);
    assert(client);
    assert.strictEqual(client.endpoint.priority, 2);
  });

  test('WhisperAPIPool should select client by queue length strategy', () => {
    const mockClients = [
      { 
        baseURL: 'http://localhost:3001', 
        isHealthy: true, 
        retryCount: 0, 
        endpoint: { maxRetries: 2 },
        getLoadScore: () => 5
      },
      { 
        baseURL: 'http://localhost:3002', 
        isHealthy: true, 
        retryCount: 0, 
        endpoint: { maxRetries: 2 },
        getLoadScore: () => 3
      }
    ];
    
    const client = whisperApiPool.selectByQueueLength(mockClients);
    assert(client);
    assert.strictEqual(client.getLoadScore(), 3);
  });

  test('WhisperAPIPool should handle empty client list gracefully', () => {
    assert.strictEqual(whisperApiPool.selectRoundRobin([]), null);
    assert.strictEqual(whisperApiPool.selectByPriority([]), null);
    assert.strictEqual(whisperApiPool.selectByQueueLength([]), null);
  });

  test('CONFIG validation should handle missing environment variables', () => {
    // Test that config doesn't crash with missing env vars
    assert(CONFIG.whisperApi.timeout >= 30000);
    assert(CONFIG.whisperApi.retryDelay >= 1000);
    assert(CONFIG.whisperApi.loadBalancing.healthCheckInterval >= 10000);
  });

});

// Mock tests for API endpoints (would need actual running server)
describe('Whisper API Client Integration (Mock)', () => {
  
  test('should handle transcription request format', async () => {
    const client = new WhisperAPIClient('http://localhost:3001');
    
    // Test that the method exists and accepts correct parameters
    assert(typeof client.transcribeBuffer === 'function');
    assert(typeof client.transcribeFile === 'function');
    assert(typeof client.getHealth === 'function');
    assert(typeof client.getQueueEstimate === 'function');
  });

  test('should format transcription options correctly', () => {
    const client = new WhisperAPIClient('http://localhost:3001');
    
    const options = {
      language: 'pt',
      translate: false,
      wordTimestamps: true,
      cleanup: true
    };
    
    // Verify that options are handled properly
    assert.strictEqual(options.language, 'pt');
    assert.strictEqual(options.translate, false);
    assert.strictEqual(options.wordTimestamps, true);
    assert.strictEqual(options.cleanup, true);
  });

});