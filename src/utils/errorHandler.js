import logger from './logger.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message) {
    super(message, 500);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message, service) {
    super(`${service}: ${message}`, 502);
    this.service = service;
  }
}

export function handleError(error, context = '') {
  const contextStr = context ? `[${context}] ` : '';
  
  if (error instanceof AppError) {
    logger.error(`${contextStr}${error.message}`, {
      statusCode: error.statusCode,
      stack: error.stack
    });
  } else {
    logger.error(`${contextStr}Unexpected error: ${error.message}`, {
      stack: error.stack
    });
  }
  
  return error instanceof AppError ? error : new AppError(error.message);
}

export function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

export async function gracefulShutdown(signal, resources = []) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    await Promise.all(resources.map(async (resource) => {
      if (resource && typeof resource.disconnect === 'function') {
        await resource.disconnect();
      }
    }));
    
    logger.success('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
}