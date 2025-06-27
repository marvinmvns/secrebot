import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ValidationError, NotFoundError, handleError } from '../src/utils/errorHandler.js';

test('AppError should be properly constructed', () => {
  const error = new AppError('Test error', 400);
  
  assert.equal(error.message, 'Test error');
  assert.equal(error.statusCode, 400);
  assert.equal(error.isOperational, true);
  assert.equal(error.name, 'AppError');
});

test('ValidationError should extend AppError', () => {
  const error = new ValidationError('Validation failed');
  
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.message, 'Validation failed');
});

test('NotFoundError should extend AppError', () => {
  const error = new NotFoundError('Resource not found');
  
  assert.ok(error instanceof AppError);
  assert.equal(error.statusCode, 404);
  assert.equal(error.message, 'Resource not found');
});

test('handleError should wrap regular errors', () => {
  const originalError = new Error('Regular error');
  const handledError = handleError(originalError);
  
  assert.ok(handledError instanceof AppError);
  assert.equal(handledError.message, 'Regular error');
});

test('handleError should pass through AppErrors', () => {
  const appError = new AppError('App error', 500);
  const handledError = handleError(appError);
  
  assert.equal(handledError, appError);
});