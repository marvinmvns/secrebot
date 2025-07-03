import { test } from 'node:test';
import assert from 'node:assert/strict';
import logger from '../src/utils/logger.js';

test('Logger should format messages correctly', () => {
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (message) => {
    capturedOutput = message;
  };
  
  logger.info('Test message');
  
  console.log = originalLog;
  
  assert.ok(capturedOutput.includes('ℹ️'));
  assert.ok(capturedOutput.includes('Test message'));
  assert.ok(capturedOutput.includes('INFO'));
});

test('Logger should respect log levels', () => {
  const originalLevel = logger.currentLevel;
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (message) => {
    capturedOutput = message;
  };
  
  logger.currentLevel = 'ERROR';
  logger.debug('Debug message');
  
  console.log = originalLog;
  logger.currentLevel = originalLevel;
  
  assert.equal(capturedOutput, '');
});

test('Logger banner should format correctly', () => {
  const originalLog = console.log;
  let capturedOutput = '';
  
  console.log = (message) => {
    capturedOutput = message;
  };
  
  logger.banner('Test App', 'v1.0');
  
  console.log = originalLog;
  
  assert.ok(capturedOutput.includes('🤖 Test App'));
  assert.ok(capturedOutput.includes('v1.0'));
});

test('Logger should serialize Error objects', () => {
  const originalError = console.error;
  let capturedOutput = '';

  console.error = (message) => {
    capturedOutput = message;
  };

  const err = new Error('Something went wrong');
  logger.error('Failure', err);

  console.error = originalError;

  assert.ok(capturedOutput.includes('Something went wrong'));
  assert.ok(capturedOutput.includes('Failure'));
});