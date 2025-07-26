import { getMetricsService } from '../services/metricsService.js';
import logger from '../utils/logger.js';

/**
 * Express middleware to collect HTTP metrics
 */
export function httpMetricsMiddleware() {
  const metricsService = getMetricsService();
  
  return (req, res, next) => {
    if (!metricsService.enabled) {
      return next();
    }

    const startTime = Date.now();
    
    // Override res.end to capture response metrics
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      
      // Get route pattern (remove query params and normalize)
      const route = req.route?.path || req.path || req.url;
      const normalizedRoute = normalizeRoute(route);
      const category = categorizeEndpoint(normalizedRoute);
      
      // Record metrics
      metricsService.recordHttpRequest(
        req.method,
        normalizedRoute,
        res.statusCode,
        duration,
        category
      );
      
      // Call original end
      originalEnd.apply(this, args);
    };
    
    next();
  };
}

/**
 * Normalize route patterns to avoid high cardinality
 */
function normalizeRoute(route) {
  if (!route) return '/unknown';
  
  // Remove query parameters
  const pathOnly = route.split('?')[0];
  
  // Replace common dynamic segments
  return pathOnly
    .replace(/\/\d+/g, '/:id')           // Replace numeric IDs
    .replace(/\/[a-f0-9]{24}/g, '/:id')  // Replace MongoDB ObjectIds
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // Replace UUIDs
    .replace(/\/[\w-]+@[\w.-]+\.[a-z]{2,}/g, '/:email') // Replace emails
    .toLowerCase();
}

/**
 * Categorize API endpoints for better monitoring
 */
function categorizeEndpoint(route) {
  const path = route.toLowerCase();
  
  if (path.includes('/api/chat')) return 'core_apis';
  if (path.includes('/api/transcribe')) return 'core_apis';
  if (path.includes('/api/video')) return 'core_apis';
  if (path.includes('/health') || path.includes('/metrics')) return 'core_apis';
  
  if (path.includes('/api/flow')) return 'flow_management';
  
  if (path.includes('/api/system') || path.includes('/api/processing') || path.includes('/api/config')) return 'system_management';
  
  if (path.includes('/api/linkedin') || path.includes('/api/whisper-api') || path.includes('/api/ollama-api')) return 'integrations';
  
  if (path.includes('/api/observabilidade')) return 'observability';
  
  if (path.includes('/describe') || path.includes('/calories') || path.includes('/summarize')) return 'content_processing';
  
  return 'other';
}

/**
 * WhatsApp bot metrics middleware
 */
export function whatsappMetricsWrapper(originalHandler) {
  const metricsService = getMetricsService();
  
  return async function(msg) {
    if (!metricsService.enabled) {
      return originalHandler.call(this, msg);
    }

    const contactId = msg.from;
    const command = extractCommand(msg.body);
    const startTime = Date.now();
    
    try {
      // Record message received
      metricsService.recordWhatsAppMessage(contactId, command, 'received');
      
      // Execute original handler
      const result = await originalHandler.call(this, msg);
      
      // Record success metrics
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordWhatsAppMessage(contactId, command, 'success');
      metricsService.recordWhatsAppCommandDuration(contactId, command, duration);
      
      return result;
    } catch (error) {
      // Record error metrics
      const duration = (Date.now() - startTime) / 1000;
      metricsService.recordWhatsAppMessage(contactId, command, 'error');
      metricsService.recordWhatsAppCommandDuration(contactId, command, duration);
      metricsService.recordError('whatsapp_command_error', 'whatsapp_bot', contactId);
      
      logger.error(`❌ WhatsApp command error for ${contactId} (${command}):`, error);
      throw error;
    }
  };
}

/**
 * Extract command from WhatsApp message body
 */
function extractCommand(body) {
  if (!body) return 'unknown';
  
  const text = body.trim().toLowerCase();
  
  // Check for explicit commands
  if (text.startsWith('!')) {
    return text.split(' ')[0];
  }
  
  // Check for numeric shortcuts
  if (/^\d+(\.\d+)*$/.test(text)) {
    return `shortcut_${text}`;
  }
  
  // Check for common patterns
  if (text.includes('transcrever') || text.includes('transcrição')) {
    return 'transcription';
  }
  if (text.includes('resumir') || text.includes('resumo')) {
    return 'summary';
  }
  if (text.includes('agenda') || text.includes('lembrete')) {
    return 'schedule';
  }
  if (text.includes('menu') || text.includes('ajuda')) {
    return 'help';
  }
  
  // Default to message type
  return 'message';
}

/**
 * LLM service metrics wrapper
 */
export function llmMetricsWrapper(originalMethod) {
  const metricsService = getMetricsService();
  
  return async function(contactId, text, type, systemPrompt, ...args) {
    if (!metricsService.enabled) {
      return originalMethod.call(this, contactId, text, type, systemPrompt, ...args);
    }

    const startTime = Date.now();
    const model = this.constructor.name === 'LLMService' ? 'ollama' : 'unknown';
    const endpoint = this.ollama?.config?.host || 'local';
    
    try {
      const result = await originalMethod.call(this, contactId, text, type, systemPrompt, ...args);
      
      const duration = (Date.now() - startTime) / 1000;
      
      // Estimate tokens (rough approximation)
      const inputTokens = Math.ceil((text + systemPrompt).length / 4);
      const outputTokens = Math.ceil((result || '').length / 4);
      
      metricsService.recordLLMRequest(
        contactId,
        model,
        endpoint,
        'success',
        duration,
        inputTokens,
        outputTokens
      );
      
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordLLMRequest(
        contactId,
        model,
        endpoint,
        'error',
        duration
      );
      
      metricsService.recordError('llm_request_error', 'llm_service', contactId);
      throw error;
    }
  };
}

/**
 * Whisper service metrics wrapper
 */
export function whisperMetricsWrapper(originalMethod) {
  const metricsService = getMetricsService();
  
  return async function(audioBuffer, inputFormat = 'ogg', ...args) {
    if (!metricsService.enabled) {
      return originalMethod.call(this, audioBuffer, inputFormat, ...args);
    }

    const startTime = Date.now();
    const audioSize = audioBuffer?.length || 0;
    const mode = this.whisperApiPool?.hasHealthyEndpoints() ? 'api' : 'local';
    const endpoint = mode === 'api' ? 'api_pool' : 'local';
    const userId = this.currentUserId || 'unknown'; // Should be set by calling context
    
    try {
      const result = await originalMethod.call(this, audioBuffer, inputFormat, ...args);
      
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordWhisperRequest(
        userId,
        mode,
        endpoint,
        'success',
        duration,
        audioSize
      );
      
      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      
      metricsService.recordWhisperRequest(
        userId,
        mode,
        endpoint,
        'error',
        duration,
        audioSize
      );
      
      metricsService.recordError('whisper_request_error', 'whisper_service', userId);
      throw error;
    }
  };
}

/**
 * Endpoint health monitoring wrapper
 */
export function endpointHealthWrapper(checkFunction, endpointUrl, type) {
  const metricsService = getMetricsService();
  
  return async function(...args) {
    if (!metricsService.enabled) {
      return checkFunction.apply(this, args);
    }

    const startTime = Date.now();
    
    try {
      const result = await checkFunction.apply(this, args);
      const responseTime = (Date.now() - startTime) / 1000;
      
      const isHealthy = result === true || (result && result.healthy !== false);
      
      metricsService.recordEndpointHealth(
        endpointUrl,
        type,
        isHealthy,
        responseTime
      );
      
      return result;
    } catch (error) {
      const responseTime = (Date.now() - startTime) / 1000;
      
      metricsService.recordEndpointHealth(
        endpointUrl,
        type,
        false,
        responseTime
      );
      
      throw error;
    }
  };
}

/**
 * Queue length monitoring
 */
export function monitorQueueLength(queueName, getQueueLength) {
  const metricsService = getMetricsService();
  
  if (!metricsService.enabled) return;
  
  setInterval(() => {
    try {
      const length = getQueueLength();
      metricsService.recordQueueLength(queueName, length);
    } catch (error) {
      logger.error(`❌ Error monitoring queue length for ${queueName}:`, error);
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Memory usage monitoring per user session
 */
export function monitorSessionMemory(sessionManager) {
  const metricsService = getMetricsService();
  
  if (!metricsService.enabled) return;
  
  setInterval(() => {
    try {
      if (sessionManager && typeof sessionManager.getAllSessions === 'function') {
        const sessions = sessionManager.getAllSessions();
        
        for (const [userId, session] of sessions) {
          const memoryUsage = JSON.stringify(session).length * 2; // Rough estimate in bytes
          metricsService.recordSessionMemory(userId, memoryUsage);
        }
      }
    } catch (error) {
      logger.error('❌ Error monitoring session memory:', error);
    }
  }, 30000); // Check every 30 seconds
}

export default {
  httpMetricsMiddleware,
  whatsappMetricsWrapper,
  llmMetricsWrapper,
  whisperMetricsWrapper,
  endpointHealthWrapper,
  monitorQueueLength,
  monitorSessionMemory
};