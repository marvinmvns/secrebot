import pLimit from 'p-limit';
import si from 'systeminformation';
import { CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

class JobQueue {
  constructor(concurrency = 1, memoryThresholdGB = 0) {
    this.limit = pLimit(concurrency);
    this.memoryThreshold = memoryThresholdGB > 0 ? memoryThresholdGB * 1024 * 1024 * 1024 : 0;
  }

  async waitForMemory() {
    if (!this.memoryThreshold) return;
    while (true) {
      try {
        const mem = await si.mem();
        const used = mem.total - mem.available;
        if (used < this.memoryThreshold) break;
      } catch (err) {
        logger.error('Erro ao verificar memória', err);
        break;
      }
      await new Promise(res => setTimeout(res, CONFIG.queues.memoryCheckInterval));
    }
  }

  add(task) {
    return this.limit(async () => {
      await this.waitForMemory();
      return task();
    });
  }
}

export default JobQueue;
