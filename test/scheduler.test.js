import { test } from 'node:test';
import assert from 'node:assert/strict';

import Scheduler from '../src/services/scheduler.js';
import { CONFIG } from '../src/config/index.js';

test('getDynamicConcurrency returns current value when disabled', async () => {
  const scheduler = new Scheduler();
  const original = CONFIG.scheduler.dynamic.enabled;
  CONFIG.scheduler.dynamic.enabled = false;
  scheduler.currentConcurrency = 3;
  const val = await scheduler.getDynamicConcurrency();
  assert.equal(val, 3);
  CONFIG.scheduler.dynamic.enabled = original;
});

