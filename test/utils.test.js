import { test } from 'node:test';
import assert from 'node:assert/strict';
import Utils from '../src/utils/index.js';

// Test countTokens

test('countTokens returns number of tokens for a string', () => {
  const str = 'hello world';
  const tokens = Utils.countTokens(str);
  assert.equal(typeof tokens, 'number');
  assert.ok(tokens > 0);
});

// Test formatRecipientId

test('formatRecipientId appends @c.us and removes non digits', () => {
  assert.equal(Utils.formatRecipientId('12345'), '12345@c.us');
  assert.equal(Utils.formatRecipientId('1-23.45@c.us'), '12345@c.us');
});

// Test extractJSON

test('extractJSON returns JSON snippet from text', () => {
  const text = 'prefix {"a":1} suffix';
  assert.equal(Utils.extractJSON(text), '{"a":1}');
});

// Test isVoltarCommand

test('isVoltarCommand recognizes variations', () => {
  assert.ok(Utils.isVoltarCommand('!voltar'));
  assert.ok(Utils.isVoltarCommand('0'));
  assert.ok(Utils.isVoltarCommand('Voltar'));
  assert.ok(!Utils.isVoltarCommand('foo'));
});

// Test limitContext

test('limitContext trims context to maxTokens', () => {
  const context = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'first message' },
    { role: 'assistant', content: 'second message' }
  ];
  const limited = Utils.limitContext(context, 2); // force trimming
  assert.ok(limited.length < context.length);
  assert.deepEqual(limited[0], context[0]); // keep system message
});

// Test checkFileExists
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

test('checkFileExists detects existing file', async () => {
  const tmpPath = path.join(tmpdir(), `file_${Date.now()}`);
  await fs.writeFile(tmpPath, 'a');
  const exists = await Utils.checkFileExists(tmpPath);
  assert.equal(exists, true);
  await fs.unlink(tmpPath);
});

test('checkFileExists detects missing file', async () => {
  const tmpPath = path.join(tmpdir(), `missing_${Date.now()}`);
  const exists = await Utils.checkFileExists(tmpPath);
  assert.equal(exists, false);
});

