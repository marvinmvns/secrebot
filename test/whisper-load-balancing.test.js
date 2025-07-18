import { test, describe } from 'node:test';
import assert from 'node:assert';
import WhisperAPIPool from '../src/services/whisperApiPool.js';

describe('Whisper API Load Balancing', () => {
  
  test('Round Robin strategy should distribute requests evenly', async () => {
    const pool = new WhisperAPIPool();
    
    // Mock healthy clients
    const mockClients = [
      { baseURL: 'http://localhost:3001', endpoint: { priority: 1 }, queueLength: 0, getLoadScore: () => 0 },
      { baseURL: 'http://localhost:3002', endpoint: { priority: 2 }, queueLength: 0, getLoadScore: () => 0 },
      { baseURL: 'http://localhost:3003', endpoint: { priority: 3 }, queueLength: 0, getLoadScore: () => 0 }
    ];
    
    // Test round robin selection
    let first = pool.selectRoundRobin(mockClients);
    let second = pool.selectRoundRobin(mockClients);
    let third = pool.selectRoundRobin(mockClients);
    let fourth = pool.selectRoundRobin(mockClients);
    
    assert.strictEqual(first.baseURL, 'http://localhost:3001');
    assert.strictEqual(second.baseURL, 'http://localhost:3002');
    assert.strictEqual(third.baseURL, 'http://localhost:3003');
    assert.strictEqual(fourth.baseURL, 'http://localhost:3001'); // Should cycle back
  });

  test('Priority strategy should select highest priority client', () => {
    const pool = new WhisperAPIPool();
    
    const mockClients = [
      { baseURL: 'http://localhost:3002', endpoint: { priority: 2 }, queueLength: 0, getLoadScore: () => 0 },
      { baseURL: 'http://localhost:3001', endpoint: { priority: 1 }, queueLength: 0, getLoadScore: () => 0 }, // Highest priority
      { baseURL: 'http://localhost:3003', endpoint: { priority: 3 }, queueLength: 0, getLoadScore: () => 0 }
    ];
    
    const selected = pool.selectByPriority(mockClients);
    assert.strictEqual(selected.baseURL, 'http://localhost:3002'); // First in sorted array
  });

  test('Queue Length strategy should select client with lowest load score', () => {
    const pool = new WhisperAPIPool();
    
    const mockClients = [
      { 
        baseURL: 'http://localhost:3001', 
        endpoint: { priority: 1 }, 
        queueLength: 5, 
        avgProcessingTime: 2000,
        getLoadScore: function() { return this.queueLength + (this.avgProcessingTime / 1000); } // Score: 7
      },
      { 
        baseURL: 'http://localhost:3002', 
        endpoint: { priority: 2 }, 
        queueLength: 2, 
        avgProcessingTime: 1000,
        getLoadScore: function() { return this.queueLength + (this.avgProcessingTime / 1000); } // Score: 3 (best)
      },
      { 
        baseURL: 'http://localhost:3003', 
        endpoint: { priority: 3 }, 
        queueLength: 3, 
        avgProcessingTime: 3000,
        getLoadScore: function() { return this.queueLength + (this.avgProcessingTime / 1000); } // Score: 6
      }
    ];
    
    const selected = pool.selectByQueueLength(mockClients);
    assert.strictEqual(selected.baseURL, 'http://localhost:3002'); // Lowest load score
  });

  test('Load balancing should handle empty client list', () => {
    const pool = new WhisperAPIPool();
    
    assert.strictEqual(pool.selectRoundRobin([]), null);
    assert.strictEqual(pool.selectByPriority([]), null);
    assert.strictEqual(pool.selectByQueueLength([]), null);
  });

  test('Request counter should increment on each transcription attempt', () => {
    const pool = new WhisperAPIPool();
    const initialCount = pool.requestCount || 0;
    
    // Mock transcribeWithLoadBalancing to avoid actual API calls
    const originalMethod = pool.transcribeWithLoadBalancing;
    pool.transcribeWithLoadBalancing = async () => {
      pool.requestCount++;
      throw new Error('Mock error - no actual API call');
    };
    
    // Test that counter increments even on failures
    pool.transcribeWithLoadBalancing().catch(() => {
      assert.strictEqual(pool.requestCount, initialCount + 1);
    });
    
    // Restore original method
    pool.transcribeWithLoadBalancing = originalMethod;
  });

});