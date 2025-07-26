import client from 'prom-client';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class MetricsService {
  constructor() {
    this.enabled = false;
    this.register = null;
    
    // Check if monitoring is explicitly disabled via feature toggle
    // If no config is set, enable by default for observability screen
    const monitoringEnabled = CONFIG.monitoring?.enabled !== false;
    const metricsEnabled = CONFIG.monitoring?.metrics?.enabled !== false;
    
    if (CONFIG.monitoring?.enabled === false || CONFIG.monitoring?.metrics?.enabled === false) {
      logger.info('📊 MetricsService disabled by feature toggle');
      return;
    }

    this.enabled = true;
    
    // Create a Registry to register the metrics
    this.register = new client.Registry();
    
    // Add a default label which is added to all metrics
    this.register.setDefaultLabels({
      app_name: 'secrebot',
      version: '1.0.0'
    });

    // Enable collection of default metrics
    client.collectDefaultMetrics({ 
      register: this.register,
      timeout: 5000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    this.initializeCustomMetrics();
    logger.info('📊 MetricsService initialized with Prometheus client');
  }

  initializeCustomMetrics() {
    // === API METRICS ===
    
    // HTTP Request duration histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'secrebot_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    // HTTP Request total counter
    this.httpRequestsTotal = new client.Counter({
      name: 'secrebot_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'category']
    });

    // API category metrics
    this.apiCategoryRequestsTotal = new client.Counter({
      name: 'secrebot_api_category_requests_total',
      help: 'Total requests by API category',
      labelNames: ['category', 'status_code']
    });

    this.apiCategoryDuration = new client.Histogram({
      name: 'secrebot_api_category_duration_seconds',
      help: 'Request duration by API category',
      labelNames: ['category'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    // === WHATSAPP BOT METRICS ===
    
    // WhatsApp messages processed
    this.whatsappMessagesTotal = new client.Counter({
      name: 'secrebot_whatsapp_messages_total',
      help: 'Total WhatsApp messages processed',
      labelNames: ['user_id', 'command', 'status']
    });

    // WhatsApp command duration
    this.whatsappCommandDuration = new client.Histogram({
      name: 'secrebot_whatsapp_command_duration_seconds',
      help: 'Duration of WhatsApp command processing',
      labelNames: ['user_id', 'command'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120]
    });

    // Active users gauge
    this.activeUsers = new client.Gauge({
      name: 'secrebot_active_users',
      help: 'Number of active users in the last hour'
    });

    // === LLM METRICS ===
    
    // LLM requests
    this.llmRequestsTotal = new client.Counter({
      name: 'secrebot_llm_requests_total',
      help: 'Total LLM requests',
      labelNames: ['user_id', 'model', 'endpoint', 'status']
    });

    // LLM request duration
    this.llmRequestDuration = new client.Histogram({
      name: 'secrebot_llm_request_duration_seconds',
      help: 'Duration of LLM requests',
      labelNames: ['user_id', 'model', 'endpoint'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    });

    // LLM tokens
    this.llmTokensTotal = new client.Counter({
      name: 'secrebot_llm_tokens_total',
      help: 'Total tokens processed by LLM',
      labelNames: ['user_id', 'model', 'type'] // type: input/output
    });

    // LLM cost estimation
    this.llmCostTotal = new client.Counter({
      name: 'secrebot_llm_cost_total',
      help: 'Estimated LLM cost in USD',
      labelNames: ['user_id', 'model']
    });

    // === WHISPER METRICS ===
    
    // Whisper transcription requests
    this.whisperRequestsTotal = new client.Counter({
      name: 'secrebot_whisper_requests_total',
      help: 'Total Whisper transcription requests',
      labelNames: ['user_id', 'mode', 'endpoint', 'status'] // mode: local/api
    });

    // Whisper request duration
    this.whisperRequestDuration = new client.Histogram({
      name: 'secrebot_whisper_request_duration_seconds',
      help: 'Duration of Whisper transcription requests',
      labelNames: ['user_id', 'mode', 'endpoint'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    });

    // Audio file size processed
    this.whisperAudioSize = new client.Histogram({
      name: 'secrebot_whisper_audio_size_bytes',
      help: 'Size of audio files processed by Whisper',
      labelNames: ['user_id', 'mode'],
      buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600] // 1KB to 100MB
    });

    // === ENDPOINT HEALTH METRICS ===
    
    // Endpoint health status
    this.endpointHealth = new client.Gauge({
      name: 'secrebot_endpoint_health',
      help: 'Health status of endpoints (1=healthy, 0=unhealthy)',
      labelNames: ['endpoint', 'type'] // type: ollama/whisper
    });

    // Endpoint response time
    this.endpointResponseTime = new client.Histogram({
      name: 'secrebot_endpoint_response_time_seconds',
      help: 'Response time of endpoints',
      labelNames: ['endpoint', 'type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    // === SYSTEM METRICS ===
    
    // Memory usage per user session
    this.sessionMemoryUsage = new client.Gauge({
      name: 'secrebot_session_memory_bytes',
      help: 'Memory usage per user session',
      labelNames: ['user_id']
    });

    // Queue lengths
    this.queueLength = new client.Gauge({
      name: 'secrebot_queue_length',
      help: 'Length of processing queues',
      labelNames: ['queue_type'] // llm, whisper, etc.
    });

    // Error rates
    this.errorRate = new client.Counter({
      name: 'secrebot_errors_total',
      help: 'Total errors by type',
      labelNames: ['error_type', 'service', 'user_id']
    });

    // Register all metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestsTotal);
    this.register.registerMetric(this.apiCategoryRequestsTotal);
    this.register.registerMetric(this.apiCategoryDuration);
    this.register.registerMetric(this.whatsappMessagesTotal);
    this.register.registerMetric(this.whatsappCommandDuration);
    this.register.registerMetric(this.activeUsers);
    this.register.registerMetric(this.llmRequestsTotal);
    this.register.registerMetric(this.llmRequestDuration);
    this.register.registerMetric(this.llmTokensTotal);
    this.register.registerMetric(this.llmCostTotal);
    this.register.registerMetric(this.whisperRequestsTotal);
    this.register.registerMetric(this.whisperRequestDuration);
    this.register.registerMetric(this.whisperAudioSize);
    this.register.registerMetric(this.endpointHealth);
    this.register.registerMetric(this.endpointResponseTime);
    this.register.registerMetric(this.sessionMemoryUsage);
    this.register.registerMetric(this.queueLength);
    this.register.registerMetric(this.errorRate);

    // Track active users (cleanup old users every hour)
    this.activeUsersList = new Map(); // userId -> lastActivity timestamp
    setInterval(() => this.cleanupActiveUsers(), 60000); // Check every minute
  }

  // === HTTP METRICS ===
  recordHttpRequest(method, route, statusCode, duration, category = 'other') {
    if (!this.enabled) return;
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode, category });
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    
    // Record category-specific metrics
    this.apiCategoryRequestsTotal.inc({ category, status_code: statusCode });
    this.apiCategoryDuration.observe({ category }, duration);
  }

  // === WHATSAPP METRICS ===
  recordWhatsAppMessage(userId, command, status) {
    if (!this.enabled) return;
    this.whatsappMessagesTotal.inc({ user_id: userId, command, status });
    this.trackActiveUser(userId);
  }

  recordWhatsAppCommandDuration(userId, command, duration) {
    if (!this.enabled) return;
    this.whatsappCommandDuration.observe({ user_id: userId, command }, duration);
  }

  trackActiveUser(userId) {
    if (!this.enabled) return;
    this.activeUsersList.set(userId, Date.now());
    this.activeUsers.set(this.activeUsersList.size);
  }

  cleanupActiveUsers() {
    if (!this.enabled) return;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [userId, lastActivity] of this.activeUsersList.entries()) {
      if (lastActivity < oneHourAgo) {
        this.activeUsersList.delete(userId);
      }
    }
    this.activeUsers.set(this.activeUsersList.size);
  }

  // === LLM METRICS ===
  recordLLMRequest(userId, model, endpoint, status, duration, inputTokens = 0, outputTokens = 0) {
    if (!this.enabled) return;
    this.llmRequestsTotal.inc({ user_id: userId, model, endpoint, status });
    this.llmRequestDuration.observe({ user_id: userId, model, endpoint }, duration);
    
    if (inputTokens > 0) {
      this.llmTokensTotal.inc({ user_id: userId, model, type: 'input' }, inputTokens);
    }
    if (outputTokens > 0) {
      this.llmTokensTotal.inc({ user_id: userId, model, type: 'output' }, outputTokens);
    }

    // Estimate cost (rough estimation based on common pricing)
    const cost = this.estimateLLMCost(model, inputTokens, outputTokens);
    if (cost > 0) {
      this.llmCostTotal.inc({ user_id: userId, model }, cost);
    }
  }

  estimateLLMCost(model, inputTokens, outputTokens) {
    // Rough cost estimation (in USD) - adjust based on actual pricing
    const costs = {
      'llama2': { input: 0.0000001, output: 0.0000002 }, // Very cheap for local
      'codellama': { input: 0.0000001, output: 0.0000002 },
      'mistral': { input: 0.0000002, output: 0.0000004 },
      'gemma': { input: 0.0000001, output: 0.0000002 },
      'phi3': { input: 0.0000001, output: 0.0000002 }
    };

    const modelCost = costs[model] || { input: 0.0000001, output: 0.0000002 };
    return (inputTokens * modelCost.input) + (outputTokens * modelCost.output);
  }

  // === WHISPER METRICS ===
  recordWhisperRequest(userId, mode, endpoint, status, duration, audioSize = 0) {
    if (!this.enabled) return;
    this.whisperRequestsTotal.inc({ user_id: userId, mode, endpoint, status });
    this.whisperRequestDuration.observe({ user_id: userId, mode, endpoint }, duration);
    
    if (audioSize > 0) {
      this.whisperAudioSize.observe({ user_id: userId, mode }, audioSize);
    }
  }

  // === ENDPOINT HEALTH ===
  recordEndpointHealth(endpoint, type, isHealthy, responseTime = null) {
    if (!this.enabled) return;
    this.endpointHealth.set({ endpoint, type }, isHealthy ? 1 : 0);
    
    if (responseTime !== null) {
      this.endpointResponseTime.observe({ endpoint, type }, responseTime);
    }
  }

  // === SYSTEM METRICS ===
  recordSessionMemory(userId, memoryBytes) {
    if (!this.enabled) return;
    this.sessionMemoryUsage.set({ user_id: userId }, memoryBytes);
  }

  recordQueueLength(queueType, length) {
    if (!this.enabled) return;
    this.queueLength.set({ queue_type: queueType }, length);
  }

  recordError(errorType, service, userId = 'unknown') {
    if (!this.enabled) return;
    this.errorRate.inc({ error_type: errorType, service, user_id: userId });
  }

  // === METRICS EXPORT ===
  async getMetrics() {
    if (!this.enabled) return '';
    try {
      return await this.register.metrics();
    } catch (error) {
      logger.error('❌ Error getting metrics:', error);
      throw error;
    }
  }

  getRegister() {
    if (!this.enabled) return null;
    return this.register;
  }

  // === UTILITY METHODS ===
  
  // Create a timer for measuring duration
  startTimer(histogram, labels = {}) {
    if (!this.enabled) return { end: () => {} };
    return histogram.startTimer(labels);
  }

  // Record custom metric
  recordCustomMetric(metricName, value, labels = {}) {
    if (!this.enabled) return;
    try {
      const metric = this.register.getSingleMetric(metricName);
      if (metric) {
        if (metric.type === 'counter') {
          metric.inc(labels, value);
        } else if (metric.type === 'gauge') {
          metric.set(labels, value);
        } else if (metric.type === 'histogram') {
          metric.observe(labels, value);
        }
      }
    } catch (error) {
      logger.error(`❌ Error recording custom metric ${metricName}:`, error);
    }
  }

  // Health check for metrics service
  isHealthy() {
    if (!this.enabled) return true; // Always healthy if disabled
    try {
      // Simple health check - ensure we can get metrics
      this.register.metrics();
      return true;
    } catch (error) {
      logger.error('❌ MetricsService health check failed:', error);
      return false;
    }
  }

  // Get metrics summary for dashboard
  async getMetricsSummary() {
    if (!this.enabled) return null;

    try {
      const metrics = await this.register.metrics();
      const summary = {
        httpRequests: 0,
        llmRequests: 0,
        whisperRequests: 0,
        whatsappMessages: 0
      };

      // Parse metrics to get totals
      const lines = metrics.split('\n');
      for (const line of lines) {
        if (line.startsWith('secrebot_http_requests_total')) {
          const match = line.match(/secrebot_http_requests_total.*?(\d+(?:\.\d+)?)/);
          if (match) summary.httpRequests += parseFloat(match[1]);
        } else if (line.startsWith('secrebot_llm_requests_total')) {
          const match = line.match(/secrebot_llm_requests_total.*?(\d+(?:\.\d+)?)/);
          if (match) summary.llmRequests += parseFloat(match[1]);
        } else if (line.startsWith('secrebot_whisper_requests_total')) {
          const match = line.match(/secrebot_whisper_requests_total.*?(\d+(?:\.\d+)?)/);
          if (match) summary.whisperRequests += parseFloat(match[1]);
        } else if (line.startsWith('secrebot_whatsapp_messages_total')) {
          const match = line.match(/secrebot_whatsapp_messages_total.*?(\d+(?:\.\d+)?)/);
          if (match) summary.whatsappMessages += parseFloat(match[1]);
        }
      }

      return summary;
    } catch (error) {
      logger.error('❌ Error getting metrics summary:', error);
      return null;
    }
  }

  // Reset all metrics (useful for testing)
  reset() {
    if (!this.enabled) return;
    this.register.resetMetrics();
    this.activeUsersList.clear();
    this.activeUsers.set(0);
    logger.info('📊 All metrics reset');
  }

  // Enable metrics collection dynamically
  async enable() {
    if (this.enabled) {
      logger.info('📊 MetricsService already enabled');
      return;
    }

    try {
      this.enabled = true;
      
      // Reinitialize if not done before
      if (!this.register) {
        this.register = new client.Registry();
        this.register.setDefaultLabels({
          app_name: 'secrebot',
          version: '1.0.0'
        });

        client.collectDefaultMetrics({ 
          register: this.register,
          timeout: 5000,
          gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
        });

        this.initializeCustomMetrics();
      }

      logger.info('📊 MetricsService enabled dynamically');
    } catch (error) {
      logger.error('❌ Error enabling MetricsService:', error);
      this.enabled = false;
      throw error;
    }
  }

  // Disable metrics collection dynamically
  async disable() {
    if (!this.enabled) {
      logger.info('📊 MetricsService already disabled');
      return;
    }

    try {
      this.enabled = false;
      
      // Clear metrics but keep registry for potential re-enable
      if (this.register) {
        this.register.resetMetrics();
      }
      
      if (this.activeUsersList) {
        this.activeUsersList.clear();
      }

      logger.info('📊 MetricsService disabled dynamically');
    } catch (error) {
      logger.error('❌ Error disabling MetricsService:', error);
      throw error;
    }
  }
}

// Singleton instance
let metricsServiceInstance = null;

export function getMetricsService() {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

export default MetricsService;