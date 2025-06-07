import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProfileRaw, loginAndGetLiAt } from '../src/services/linkedinScraper.js';

// Basic test to ensure fetchProfileRaw returns success for a simple data URL

test('fetchProfileRaw extracts text from data URL', async () => {
  const html = '<html><body><h1>Title</h1><p>Example</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const res = await fetchProfileRaw(url, { timeoutMs: 5000 });
  assert.equal(res.success, true);
  assert.ok(res.rawText.includes('Title'));
});

// loginAndGetLiAt should return null when credentials are invalid

test('loginAndGetLiAt returns null for bad credentials', async () => {
  const cookie = await loginAndGetLiAt('invalid', 'invalid', 1000);
  assert.equal(cookie, null);
});
