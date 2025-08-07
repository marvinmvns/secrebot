import { getJobQueueMonitor } from './jobQueueMonitor.js';
import logger from '../utils/logger.js';

class JobQueueWrapper {
  constructor() {
    this.jobQueueMonitor = getJobQueueMonitor();
  }

  async wrapWithJobQueue(type, originalFunction, data, options = {}) {
    // Create job in queue
    const job = await this.jobQueueMonitor.createJob(type, data, {
      priority: options.priority || 'medium',
      maxAttempts: options.maxAttempts || 3,
      timeout: options.timeout || 600000, // 10 minutes default
      userAgent: options.userAgent,
      clientIp: options.clientIp,
      sessionId: options.sessionId
    });

    try {
      // Update job status to processing
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'processing');
      
      logger.info(`🔄 Starting job ${job.jobId} (${type})`);
      
      // Execute the original function
      const result = await originalFunction(data);
      
      // Update job status to completed
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'completed', result);
      
      logger.info(`✅ Job ${job.jobId} completed successfully`);
      
      return {
        success: true,
        jobId: job.jobId,
        result
      };
      
    } catch (error) {
      logger.error(`❌ Job ${job.jobId} failed:`, error);
      
      // Update job status to failed
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'failed', null, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // If job can be retried and hasn't exceeded max attempts, mark as pending for retry
      const updatedJob = await this.jobQueueMonitor.getJob(job.jobId);
      if (updatedJob && updatedJob.attempts < updatedJob.maxAttempts) {
        logger.info(`🔄 Job ${job.jobId} will retry (attempt ${updatedJob.attempts + 1}/${updatedJob.maxAttempts})`);
      }
      
      throw {
        success: false,
        jobId: job.jobId,
        error: error.message,
        canRetry: updatedJob && updatedJob.attempts < updatedJob.maxAttempts
      };
    }
  }

  // Wrapper for Whisper transcription
  async wrapWhisperTranscription(audioTranscriber, audioBuffer, options = {}) {
    return this.wrapWithJobQueue(
      'whisper-transcription',
      async (data) => {
        return await audioTranscriber.transcribe(data.audioBuffer, data.options);
      },
      { audioBuffer, options },
      {
        priority: options.priority || 'medium',
        timeout: options.timeout || 900000, // 15 minutes for transcription
        userAgent: options.userAgent,
        clientIp: options.clientIp,
        sessionId: options.sessionId
      }
    );
  }

  // Wrapper for Ollama completion
  async wrapOllamaCompletion(llmService, prompt, options = {}) {
    return this.wrapWithJobQueue(
      'ollama-completion',
      async (data) => {
        return await llmService.getAssistantResponse(data.mode || 'web', data.prompt, data.options);
      },
      { prompt, mode: options.mode || 'web', options },
      {
        priority: options.priority || 'medium',
        timeout: options.timeout || 1200000, // 20 minutes for LLM
        userAgent: options.userAgent,
        clientIp: options.clientIp,
        sessionId: options.sessionId
      }
    );
  }

  // Wrapper for Ollama chat
  async wrapOllamaChat(llmService, messages, options = {}) {
    return this.wrapWithJobQueue(
      'ollama-chat',
      async (data) => {
        return await llmService.getChatResponse(data.messages, data.options);
      },
      { messages, options },
      {
        priority: options.priority || 'medium',
        timeout: options.timeout || 1200000, // 20 minutes for LLM
        userAgent: options.userAgent,
        clientIp: options.clientIp,
        sessionId: options.sessionId
      }
    );
  }

  // Process pending jobs (for restart recovery)
  async processPendingJobs(audioTranscriber, llmService) {
    try {
      const pendingJobs = await this.jobQueueMonitor.getAllJobs({ status: 'pending' }, 1000, 0);
      
      logger.info(`🔄 Processing ${pendingJobs.length} pending jobs`);

      for (const job of pendingJobs) {
        try {
          switch (job.type) {
            case 'whisper-transcription':
              if (audioTranscriber) {
                await this.processWhisperJob(job, audioTranscriber);
              }
              break;
            
            case 'ollama-completion':
              if (llmService) {
                await this.processOllamaCompletionJob(job, llmService);
              }
              break;
            
            case 'ollama-chat':
              if (llmService) {
                await this.processOllamaChatJob(job, llmService);
              }
              break;
            
            default:
              logger.warn(`⚠️ Unknown job type: ${job.type} for job ${job.jobId}`);
          }
        } catch (error) {
          logger.error(`❌ Error processing pending job ${job.jobId}:`, error);
        }
      }
    } catch (error) {
      logger.error('❌ Error processing pending jobs:', error);
    }
  }

  async processWhisperJob(job, audioTranscriber) {
    try {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'processing');
      
      const { audioBuffer, options } = job.data;
      const audioBufferFromData = Buffer.from(audioBuffer.data || audioBuffer);
      
      const result = await audioTranscriber.transcribe(audioBufferFromData, options);
      
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'completed', result);
      logger.info(`✅ Whisper job ${job.jobId} completed during recovery`);
      
    } catch (error) {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'failed', null, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async processOllamaCompletionJob(job, llmService) {
    try {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'processing');
      
      const { prompt, mode, options } = job.data;
      const result = await llmService.getAssistantResponse(mode || 'web', prompt, options);
      
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'completed', result);
      logger.info(`✅ Ollama completion job ${job.jobId} completed during recovery`);
      
    } catch (error) {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'failed', null, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async processOllamaChatJob(job, llmService) {
    try {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'processing');
      
      const { messages, options } = job.data;
      const result = await llmService.getChatResponse(messages, options);
      
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'completed', result);
      logger.info(`✅ Ollama chat job ${job.jobId} completed during recovery`);
      
    } catch (error) {
      await this.jobQueueMonitor.updateJobStatus(job.jobId, 'failed', null, {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  // Retry a specific job
  async retryJob(jobId, audioTranscriber, llmService) {
    try {
      const job = await this.jobQueueMonitor.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.attempts >= job.maxAttempts) {
        throw new Error(`Job ${jobId} has exceeded maximum retry attempts`);
      }

      await this.jobQueueMonitor.updateJobStatus(jobId, 'pending');
      
      // Process the job based on its type
      switch (job.type) {
        case 'whisper-transcription':
          if (audioTranscriber) {
            await this.processWhisperJob(job, audioTranscriber);
          }
          break;
        
        case 'ollama-completion':
          if (llmService) {
            await this.processOllamaCompletionJob(job, llmService);
          }
          break;
        
        case 'ollama-chat':
          if (llmService) {
            await this.processOllamaChatJob(job, llmService);
          }
          break;
        
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      return job;
    } catch (error) {
      logger.error(`❌ Error retrying job ${jobId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let jobQueueWrapperInstance = null;

export function getJobQueueWrapper() {
  if (!jobQueueWrapperInstance) {
    jobQueueWrapperInstance = new JobQueueWrapper();
  }
  return jobQueueWrapperInstance;
}

export default JobQueueWrapper;