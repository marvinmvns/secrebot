import { test } from 'node:test';
import assert from 'node:assert/strict';
import JobQueue from '../src/services/jobQueue.js';

// Simple test to ensure queue limits concurrency

test('JobQueue executes tasks respecting concurrency', async () => {
  const queue = new JobQueue(1);
  let active = 0;
  const order = [];

  const task = async () => {
    active++;
    order.push(active);
    await new Promise(res => setTimeout(res, 10));
    active--;
  };

  await Promise.all([queue.add(task), queue.add(task)]);
  assert.deepEqual(order, [1,1]);
});
