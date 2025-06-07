import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrapeProfile, loginAndGetLiAt } from '../src/services/linkedinScraper.js';

// These tests use short timeouts to avoid long waits in CI.

test('scrapeProfile fails for invalid URL', async () => {
  const res = await scrapeProfile('https://example.com/404', { timeoutMs: 1000 });
  assert.equal(res.success, false);
});

test('loginAndGetLiAt returns null for bad credentials', async () => {
  const cookie = await loginAndGetLiAt('fake', 'fake', 1000).catch(() => null);
  assert.equal(cookie, null);
});
