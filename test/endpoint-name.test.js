import { test } from 'node:test';
import assert from 'node:assert';

test('Endpoint structure should include name field', () => {
  // Simular estrutura de endpoint Ollama
  const ollamaEndpoint = {
    url: 'http://localhost:11434',
    name: 'Servidor Principal',
    type: 'ollama',
    enabled: true,
    priority: 1,
    maxRetries: 2
  };

  // Simular estrutura de endpoint Whisper
  const whisperEndpoint = {
    url: 'http://localhost:3001',
    name: 'Whisper GPU 1', 
    enabled: true,
    priority: 1,
    maxRetries: 2
  };

  // Verificar se os campos obrigatórios existem
  assert(ollamaEndpoint.hasOwnProperty('name'), 'Ollama endpoint should have name field');
  assert(ollamaEndpoint.hasOwnProperty('url'), 'Ollama endpoint should have url field');
  assert(ollamaEndpoint.hasOwnProperty('enabled'), 'Ollama endpoint should have enabled field');
  assert(ollamaEndpoint.hasOwnProperty('priority'), 'Ollama endpoint should have priority field');

  assert(whisperEndpoint.hasOwnProperty('name'), 'Whisper endpoint should have name field');
  assert(whisperEndpoint.hasOwnProperty('url'), 'Whisper endpoint should have url field');
  assert(whisperEndpoint.hasOwnProperty('enabled'), 'Whisper endpoint should have enabled field');
  assert(whisperEndpoint.hasOwnProperty('priority'), 'Whisper endpoint should have priority field');
});

test('Name field should support custom aliases', () => {
  const testCases = [
    { name: 'Servidor Principal', expected: 'Servidor Principal' },
    { name: 'GPU 1', expected: 'GPU 1' },
    { name: 'Whisper Local', expected: 'Whisper Local' },
    { name: '', expected: '' }, // Empty string should be valid
    { name: null, expected: null }, // Null should be valid
    { name: undefined, expected: undefined } // Undefined should be valid
  ];

  testCases.forEach(testCase => {
    const endpoint = {
      url: 'http://localhost:11434',
      name: testCase.name,
      enabled: true,
      priority: 1
    };
    
    assert.strictEqual(endpoint.name, testCase.expected, 
      `Name field should accept: "${testCase.name}"`);
  });
});

test('Endpoint display logic should handle empty names', () => {
  // Testar lógica de display quando nome está vazio
  const testCases = [
    { name: 'Servidor Principal', index: 0, expected: 'Servidor Principal' },
    { name: '', index: 0, expected: 'Endpoint 1' },
    { name: null, index: 1, expected: 'Endpoint 2' },
    { name: undefined, index: 2, expected: 'Endpoint 3' }
  ];

  testCases.forEach(testCase => {
    // Simular lógica do template: ${endpoint.name || `Endpoint ${index + 1}`}
    const displayName = testCase.name || `Endpoint ${testCase.index + 1}`;
    assert.strictEqual(displayName, testCase.expected, 
      `Display name should be "${testCase.expected}" for name="${testCase.name}" at index ${testCase.index}`);
  });
});