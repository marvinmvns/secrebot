import { getJobQueueMonitor } from './jobQueueMonitor.js';
import logger from '../utils/logger.js';

class JobInterceptor {
  constructor() {
    this.jobQueueMonitor = getJobQueueMonitor();
  }

  // Registra um job quando o processamento inicia
  async registerJobStart(type, data, options = {}) {
    try {
      const job = await this.jobQueueMonitor.createJob(type, data, {
        priority: options.priority || 'medium',
        maxAttempts: options.maxAttempts || 3,
        timeout: options.timeout || 600000,
        userAgent: options.userAgent,
        clientIp: options.clientIp,
        sessionId: options.sessionId
      });

      // Marca imediatamente como processing
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'processing');
      
      return job.jobId;
    } catch (error) {
      logger.error('❌ Erro ao registrar início do job:', error);
      return null;
    }
  }

  // Registra o sucesso de um job
  async registerJobSuccess(jobId, result, endpoint = null) {
    if (!jobId) return;
    
    try {
      const resultData = {
        result,
        endpoint,
        completedAt: new Date().toISOString()
      };
      
      await this.jobQueueMonitor.updateJobStatus(jobId, 'completed', resultData);
      logger.debug(`✅ Job ${jobId} completed successfully`);
    } catch (error) {
      logger.error(`❌ Erro ao registrar sucesso do job ${jobId}:`, error);
    }
  }

  // Registra a falha de um job
  async registerJobFailure(jobId, error, endpoint = null) {
    if (!jobId) return;
    
    try {
      const errorData = {
        message: error.message || error,
        stack: error.stack,
        endpoint,
        timestamp: new Date().toISOString()
      };
      
      await this.jobQueueMonitor.updateJobStatus(jobId, 'failed', null, errorData);
      logger.debug(`❌ Job ${jobId} failed: ${error.message || error}`);
    } catch (dbError) {
      logger.error(`❌ Erro ao registrar falha do job ${jobId}:`, dbError);
    }
  }

  // Wrapper para funções assíncronas que automaticamente registra o job
  async wrapFunction(type, originalFunction, data, options = {}) {
    const jobId = await this.registerJobStart(type, data, options);
    
    try {
      const result = await originalFunction(data);
      await this.registerJobSuccess(jobId, result, options.endpoint);
      return result;
    } catch (error) {
      await this.registerJobFailure(jobId, error, options.endpoint);
      throw error; // Re-throw para manter comportamento original
    }
  }
}

// Singleton instance
let jobInterceptorInstance = null;

export function getJobInterceptor() {
  if (!jobInterceptorInstance) {
    jobInterceptorInstance = new JobInterceptor();
  }
  return jobInterceptorInstance;
}

export default JobInterceptor;