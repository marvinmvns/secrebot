import { MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

class JobQueueMonitor extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.db = null;
    this.collection = null;
    this.jobs = new Map(); // In-memory job tracking
    this.isConnected = false;
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      const mongoUri = process.env.MONGO_URI || CONFIG.mongodb?.uri || 'mongodb://localhost:27017/secrebot';
      this.client = new MongoClient(mongoUri);
      await this.client.connect();
      this.db = this.client.db();
      this.collection = this.db.collection('job_queue');
      this.isConnected = true;
      
      // Create indexes for efficient querying
      await this.collection.createIndex({ status: 1, createdAt: 1 });
      await this.collection.createIndex({ type: 1, status: 1 });
      await this.collection.createIndex({ jobId: 1 }, { unique: true });
      
      logger.info('🔧 JobQueueMonitor database initialized');
      
      // Resume pending jobs on startup
      await this.resumePendingJobs();
    } catch (error) {
      logger.error('❌ Error initializing JobQueueMonitor database:', error);
      this.isConnected = false;
    }
  }

  generateJobId(type, data = {}) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const hash = this.hashData(data);
    return `${type}_${timestamp}_${hash}_${random}`;
  }

  hashData(data) {
    return JSON.stringify(data).split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      return hash & hash;
    }, 0).toString(36).substr(0, 8);
  }

  async createJob(type, data, options = {}) {
    const jobId = this.generateJobId(type, data);
    const job = {
      jobId,
      type,
      data,
      status: 'pending',
      priority: options.priority || 'medium',
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      timeout: options.timeout || 600000, // 10 minutes default
      result: null,
      error: null,
      metadata: {
        userAgent: options.userAgent,
        clientIp: options.clientIp,
        sessionId: options.sessionId
      }
    };

    // Store in memory
    this.jobs.set(jobId, job);

    // Persist to database if connected
    if (this.isConnected) {
      try {
        await this.collection.insertOne(job);
      } catch (error) {
        logger.error(`❌ Error persisting job ${jobId}:`, error);
      }
    }

    logger.info(`📝 Job created: ${jobId} (${type})`);
    this.emit('jobCreated', job);
    return job;
  }

  async updateJobStatus(jobId, status, result = null, error = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn(`⚠️ Job ${jobId} not found in memory`);
      return null;
    }

    job.status = status;
    job.updatedAt = new Date();
    
    if (result !== null) {
      job.result = result;
    }
    
    if (error !== null) {
      job.error = error;
      job.attempts = (job.attempts || 0) + 1;
    }

    // Update in memory
    this.jobs.set(jobId, job);

    // Update in database if connected
    if (this.isConnected) {
      try {
        await this.collection.updateOne(
          { jobId },
          { 
            $set: { 
              status, 
              updatedAt: job.updatedAt,
              result: job.result,
              error: job.error,
              attempts: job.attempts
            }
          }
        );
      } catch (dbError) {
        logger.error(`❌ Error updating job ${jobId} in database:`, dbError);
      }
    }

    logger.info(`🔄 Job ${jobId} status updated: ${status}`);
    this.emit('jobUpdated', job);
    return job;
  }

  async getJob(jobId) {
    // Try memory first
    let job = this.jobs.get(jobId);
    if (job) return job;

    // Try database if connected
    if (this.isConnected) {
      try {
        job = await this.collection.findOne({ jobId });
        if (job) {
          this.jobs.set(jobId, job); // Cache in memory
        }
      } catch (error) {
        logger.error(`❌ Error retrieving job ${jobId}:`, error);
      }
    }

    return job;
  }

  async getAllJobs(filter = {}, limit = 100, offset = 0) {
    const jobs = [];
    
    if (this.isConnected) {
      try {
        const cursor = this.collection
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(offset);
        
        await cursor.forEach(job => jobs.push(job));
      } catch (error) {
        logger.error('❌ Error retrieving jobs from database:', error);
      }
    }
    
    // If no database results, fall back to memory
    if (jobs.length === 0) {
      const memoryJobs = Array.from(this.jobs.values())
        .filter(job => {
          if (filter.status && job.status !== filter.status) return false;
          if (filter.type && job.type !== filter.type) return false;
          return true;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(offset, offset + limit);
      
      jobs.push(...memoryJobs);
    }

    return jobs;
  }

  async getJobStats() {
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      by_type: {}
    };

    if (this.isConnected) {
      try {
        const pipeline = [
          {
            $group: {
              _id: { status: '$status', type: '$type' },
              count: { $sum: 1 }
            }
          }
        ];

        const aggregation = await this.collection.aggregate(pipeline).toArray();
        
        aggregation.forEach(item => {
          const { status, type } = item._id;
          const count = item.count;
          
          stats.total += count;
          stats[status] = (stats[status] || 0) + count;
          
          if (!stats.by_type[type]) {
            stats.by_type[type] = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
          }
          stats.by_type[type][status] = count;
          stats.by_type[type].total += count;
        });
      } catch (error) {
        logger.error('❌ Error getting job stats:', error);
      }
    }

    // Fall back to memory stats if database is not available
    if (stats.total === 0) {
      Array.from(this.jobs.values()).forEach(job => {
        stats.total++;
        stats[job.status] = (stats[job.status] || 0) + 1;
        
        if (!stats.by_type[job.type]) {
          stats.by_type[job.type] = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
        }
        stats.by_type[job.type][job.status]++;
        stats.by_type[job.type].total++;
      });
    }

    return stats;
  }

  async retryJob(jobId) {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.attempts >= job.maxAttempts) {
      throw new Error(`Job ${jobId} has exceeded maximum retry attempts (${job.maxAttempts})`);
    }

    await this.updateJobStatus(jobId, 'pending');
    logger.info(`🔄 Job ${jobId} queued for retry (attempt ${job.attempts + 1}/${job.maxAttempts})`);
    
    this.emit('jobRetry', job);
    return job;
  }

  async deleteJob(jobId) {
    // Remove from memory
    this.jobs.delete(jobId);

    // Remove from database if connected
    if (this.isConnected) {
      try {
        await this.collection.deleteOne({ jobId });
      } catch (error) {
        logger.error(`❌ Error deleting job ${jobId}:`, error);
      }
    }

    logger.info(`🗑️ Job ${jobId} deleted`);
    this.emit('jobDeleted', { jobId });
  }

  async resumePendingJobs() {
    if (!this.isConnected) return;

    try {
      const pendingJobs = await this.collection.find({ 
        status: { $in: ['pending', 'processing'] }
      }).toArray();

      logger.info(`🔄 Found ${pendingJobs.length} jobs to resume`);

      for (const job of pendingJobs) {
        // Reset processing jobs to pending for retry
        if (job.status === 'processing') {
          await this.updateJobStatus(job.jobId, 'pending');
        }
        
        // Load into memory
        this.jobs.set(job.jobId, job);
      }

      this.emit('jobsResumed', pendingJobs.length);
    } catch (error) {
      logger.error('❌ Error resuming pending jobs:', error);
    }
  }

  async cleanup(olderThanDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let memoryCleanedCount = 0;
    let databaseCleanedCount = 0;

    // Clean memory
    for (const [jobId, job] of this.jobs) {
      if (job.createdAt < cutoffDate && job.status === 'completed') {
        this.jobs.delete(jobId);
        memoryCleanedCount++;
      }
    }

    // Clean database
    if (this.isConnected) {
      try {
        const result = await this.collection.deleteMany({
          createdAt: { $lt: cutoffDate },
          status: 'completed'
        });
        
        databaseCleanedCount = result.deletedCount;
        logger.info(`🧹 Cleaned up ${result.deletedCount} completed jobs older than ${olderThanDays} days`);
      } catch (error) {
        logger.error('❌ Error cleaning up old jobs:', error);
      }
    }

    return {
      memoryCleanedCount,
      databaseCleanedCount,
      totalCleanedCount: memoryCleanedCount + databaseCleanedCount
    };
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('🔌 JobQueueMonitor database connection closed');
    }
  }
}

// Singleton instance
let jobQueueMonitorInstance = null;

export function getJobQueueMonitor() {
  if (!jobQueueMonitorInstance) {
    jobQueueMonitorInstance = new JobQueueMonitor();
  }
  return jobQueueMonitorInstance;
}

export default JobQueueMonitor;