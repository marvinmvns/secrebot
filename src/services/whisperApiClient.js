import fs from 'fs/promises';
import FormData from 'form-data';
import axios from 'axios';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class WhisperAPIClient {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.axios = axios.create({ 
      baseURL,
      timeout: CONFIG.whisperApi.timeout
    });
    this.lastHealthCheck = 0;
    this.isHealthy = true;
    this.queueLength = 0;
    this.avgProcessingTime = 0;
    
    // Request tracking for processing status
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.requestHistory = [];
    this.totalProcessed = 0;
  }

  // ============ Request Tracking ============
  _startRequest(type = 'transcribe') {
    this.activeRequests++;
    this.totalRequests++;
    const requestId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request = {
      id: requestId,
      type,
      startTime: new Date().toISOString(),
      endTime: null,
      duration: null,
      active: true
    };
    
    this.requestHistory.push(request);
    
    // Keep only last 10 requests in history
    if (this.requestHistory.length > 10) {
      this.requestHistory = this.requestHistory.slice(-10);
    }
    
    return requestId;
  }

  _endRequest(requestId) {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    this.totalProcessed++;
    
    const request = this.requestHistory.find(r => r.id === requestId);
    if (request) {
      request.endTime = new Date().toISOString();
      request.duration = new Date(request.endTime) - new Date(request.startTime);
      request.active = false;
    }
  }

  getProcessingStatus() {
    const recent = this.requestHistory.filter(r => !r.active && r.duration !== null);
    const avgResponseTime = recent.length > 0 
      ? recent.reduce((sum, r) => sum + r.duration, 0) / recent.length 
      : 0;

    return {
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      totalProcessed: this.totalProcessed,
      averageResponseTime: Math.round(avgResponseTime),
      requestHistory: this.requestHistory.slice(-10)
    };
  }

  async transcribeFile(filePath, options = {}) {
    const requestId = this._startRequest('transcribe');
    
    try {
      logger.debug(`🔄 Iniciando transcrição via API: ${this.baseURL}`);
      
      const formData = new FormData();
      formData.append('audio', await fs.readFile(filePath));
      
      // Merge global whisperOptions with provided options
      const mergedOptions = { ...CONFIG.whisperApi.whisperOptions, ...options };
      
      if (mergedOptions.language) formData.append('language', mergedOptions.language);
      if (mergedOptions.translateToEnglish !== undefined) formData.append('translate', String(mergedOptions.translateToEnglish));
      if (mergedOptions.cleanup !== undefined) formData.append('cleanup', String(mergedOptions.cleanup));
      
      // Add whisperOptions parameters
      if (mergedOptions.outputInCsv) formData.append('outputInCsv', 'true');
      if (mergedOptions.outputInJson) formData.append('outputInJson', 'true');
      if (mergedOptions.outputInJsonFull) formData.append('outputInJsonFull', 'true');
      if (mergedOptions.outputInLrc) formData.append('outputInLrc', 'true');
      if (mergedOptions.outputInSrt) formData.append('outputInSrt', 'true');
      if (mergedOptions.outputInText) formData.append('outputInText', 'true');
      if (mergedOptions.outputInVtt) formData.append('outputInVtt', 'true');
      if (mergedOptions.outputInWords) formData.append('outputInWords', 'true');
      if (mergedOptions.splitOnWord !== undefined) formData.append('splitOnWord', String(mergedOptions.splitOnWord));
      if (mergedOptions.timestamps_length !== undefined) formData.append('timestamps_length', String(mergedOptions.timestamps_length));
      if (mergedOptions.removeTimestamps !== undefined) formData.append('removeTimestamps', String(mergedOptions.removeTimestamps));

      const response = await this.axios.post('/transcribe', formData, {
        headers: formData.getHeaders(),
        timeout: CONFIG.whisperApi.timeout
      });

      logger.debug(`✅ Upload realizado com sucesso para ${this.baseURL}`);
      this._endRequest(requestId);
      return response.data;
    } catch (error) {
      this._endRequest(requestId);
      logger.error(`❌ Falha no upload para ${this.baseURL}:`, error.message);
      throw new Error(`Transcription upload failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async transcribeBuffer(audioBuffer, filename, options = {}) {
    const requestId = this._startRequest('transcribe');
    
    try {
      logger.debug(`🔄 Iniciando transcrição via API (buffer): ${this.baseURL}`);
      
      const formData = new FormData();
      formData.append('audio', audioBuffer, { filename });
      
      // Merge global whisperOptions with provided options
      const mergedOptions = { ...CONFIG.whisperApi.whisperOptions, ...options };
      
      if (mergedOptions.language) formData.append('language', mergedOptions.language);
      if (mergedOptions.translateToEnglish !== undefined) formData.append('translate', String(mergedOptions.translateToEnglish));
      if (mergedOptions.cleanup !== undefined) formData.append('cleanup', String(mergedOptions.cleanup));
      
      // Add whisperOptions parameters
      if (mergedOptions.outputInCsv) formData.append('outputInCsv', 'true');
      if (mergedOptions.outputInJson) formData.append('outputInJson', 'true');
      if (mergedOptions.outputInJsonFull) formData.append('outputInJsonFull', 'true');
      if (mergedOptions.outputInLrc) formData.append('outputInLrc', 'true');
      if (mergedOptions.outputInSrt) formData.append('outputInSrt', 'true');
      if (mergedOptions.outputInText) formData.append('outputInText', 'true');
      if (mergedOptions.outputInVtt) formData.append('outputInVtt', 'true');
      if (mergedOptions.outputInWords) formData.append('outputInWords', 'true');
      if (mergedOptions.splitOnWord !== undefined) formData.append('splitOnWord', String(mergedOptions.splitOnWord));
      if (mergedOptions.timestamps_length !== undefined) formData.append('timestamps_length', String(mergedOptions.timestamps_length));
      if (mergedOptions.removeTimestamps !== undefined) formData.append('removeTimestamps', String(mergedOptions.removeTimestamps));

      const response = await this.axios.post('/transcribe', formData, {
        headers: formData.getHeaders(),
        timeout: CONFIG.whisperApi.timeout
      });

      logger.debug(`✅ Upload realizado com sucesso (buffer) para ${this.baseURL}`);
      this._endRequest(requestId);
      return response.data;
    } catch (error) {
      this._endRequest(requestId);
      logger.error(`❌ Falha no upload (buffer) para ${this.baseURL}:`, error.message);
      throw new Error(`Transcription upload failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getJobStatus(jobId) {
    try {
      const response = await this.axios.get(`/status/${jobId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Job not found');
      }
      throw new Error(`Status check failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async waitForCompletion(jobId, pollInterval = 2000, maxWaitTime = CONFIG.whisperApi.timeout) {
    const startTime = Date.now();
    
    logger.debug(`⏳ Aguardando conclusão do job ${jobId} no endpoint ${this.baseURL}`);
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getJobStatus(jobId);
      
      if (status.status === 'completed') {
        logger.success(`✅ Transcrição concluída para job ${jobId}`);
        return status;
      }
      
      if (status.status === 'failed') {
        throw new Error(`Transcription failed: ${status.error}`);
      }
      
      logger.debug(`📊 Job ${jobId} status: ${status.status}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Transcription timeout after ${maxWaitTime}ms`);
  }

  async transcribeAndWait(filePath, options = {}) {
    logger.debug(`🎤 Iniciando transcrição completa para: ${filePath}`);
    
    const uploadResult = await this.transcribeFile(filePath, options);
    logger.debug(`📋 Job enfileirado com ID: ${uploadResult.jobId}, tempo estimado: ${uploadResult.estimatedWaitTime}s`);
    
    const result = await this.waitForCompletion(uploadResult.jobId);
    logger.success('🎉 Transcrição completa concluída!');
    
    return result;
  }

  async transcribeBufferAndWait(audioBuffer, filename, options = {}) {
    logger.debug(`🎤 Iniciando transcrição completa (buffer) para: ${filename}`);
    
    const uploadResult = await this.transcribeBuffer(audioBuffer, filename, options);
    logger.debug(`📋 Job enfileirado com ID: ${uploadResult.jobId}, tempo estimado: ${uploadResult.estimatedWaitTime}s`);
    
    const result = await this.waitForCompletion(uploadResult.jobId);
    logger.success('🎉 Transcrição completa (buffer) concluída!');
    
    return result;
  }

  async getEstimate(duration, format = '.wav') {
    try {
      const response = await this.axios.get('/estimate', {
        params: { duration, format }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Estimate failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getQueueEstimate() {
    try {
      const response = await this.axios.get('/queue-estimate');
      this.queueLength = response.data.queueLength || 0;
      this.avgProcessingTime = response.data.averageProcessingTime || 0;
      return response.data;
    } catch (error) {
      throw new Error(`Queue estimate failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getHealth() {
    try {
      const response = await this.axios.get('/health', { timeout: 10000 });
      this.isHealthy = true;
      this.lastHealthCheck = Date.now();
      
      if (response.data.queue) {
        this.queueLength = response.data.queue.pendingJobs || 0;
      }
      
      return response.data;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      logger.warn(`⚠️ Health check falhou para ${this.baseURL}: ${error.message}`);
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  async getSupportedFormats() {
    try {
      const response = await this.axios.get('/formats');
      return response.data;
    } catch (error) {
      throw new Error(`Formats request failed: ${error.message}`);
    }
  }

  async checkHealth() {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastHealthCheck;
    
    if (timeSinceLastCheck > CONFIG.whisperApi.loadBalancing.healthCheckInterval) {
      try {
        await this.getHealth();
      } catch (error) {
        logger.warn(`⚠️ Health check automático falhou para ${this.baseURL}`);
      }
    }
    
    return this.isHealthy;
  }

  getQueueLength() {
    return this.queueLength;
  }

  getAvgProcessingTime() {
    return this.avgProcessingTime;
  }

  getLoadScore() {
    // Factor in active requests from this client to the server
    return this.queueLength + (this.avgProcessingTime / 1000) + this.activeRequests;
  }
}

export default WhisperAPIClient;