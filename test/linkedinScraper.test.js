import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scrapeProfile,
  loginAndGetLiAt,
  scrapeProfileWithAutoLogin
} from '../src/services/linkedinScraper.js';

// These tests use short timeouts to avoid long waits in CI.

test('scrapeProfile fails for invalid URL', async () => {
  const res = await scrapeProfile('https://example.com/404', { liAt: 'dummy', timeoutMs: 1000, maxRetries: 1 });
  assert.equal(res.success, false);
});

test('loginAndGetLiAt returns null for bad credentials', async () => {
  const cookie = await loginAndGetLiAt('fake', 'fake', 1000).catch(() => null);
  assert.equal(cookie, null);
});

test('scrapeProfileWithAutoLogin triggers login on invalid cookie', async () => {
  let loginCalled = false;
  const stubScrape = async (url, opts) => {
    if (!loginCalled) {
      return { success: false, error: 'Too Many Redirects' };
    }
    return { success: true };
  };
  const stubLogin = async () => {
    loginCalled = true;
    return 'newCookie';
  };
  const res = await scrapeProfileWithAutoLogin('https://linkedin.com', {
    liAt: 'bad',
    user: 'user',
    pass: 'pass',
    scrapeFn: stubScrape,
    loginFn: stubLogin,
    timeoutMs: 1000
  });
  assert.equal(loginCalled, true);
  assert.equal(res.success, true);
  assert.equal(res.newLiAt, 'newCookie');
});

test('scrapeProfileWithAutoLogin returns result when no credentials', async () => {
  const stubScrape = async () => ({ success: false, error: 'Too Many Requests' });
  const res = await scrapeProfileWithAutoLogin('https://linkedin.com', {
    liAt: 'bad',
    scrapeFn: stubScrape,
    timeoutMs: 1000
  });
  assert.equal(res.success, false);
});
