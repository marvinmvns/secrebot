import pLimit from 'p-limit';

class JobQueue {
  constructor(concurrency = 1) {
    this.limit = pLimit(concurrency);
  }

  add(task) {
    return this.limit(task);
  }
}

export default JobQueue;
