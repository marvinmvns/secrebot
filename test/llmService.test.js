import { test } from 'node:test';
import assert from 'node:assert/strict';
import LLMService from '../src/services/llmService.js';
import { CHAT_MODES, CONFIG } from '../src/config/index.js';

class FakeCollection {
  constructor() { this.data = []; }
  async insertOne(doc) { this.data.push(doc); }
  find(query) {
    const arr = this.data.filter(d => d.contactId === query.contactId);
    return { sort: () => ({ toArray: async () => arr }) };
  }
  async deleteMany(query) {
    this.data = this.data.filter(d => d.contactId !== query.contactId);
  }
  async createIndex() {}
}

test('chat stores messages in Mongo collection', async () => {
  const svc = new LLMService();
  svc.collection = new FakeCollection();
  svc.ollama.chat = async () => ({ message: { content: 'ok' } });
  await svc.chat('u1', 'hello', CHAT_MODES.ASSISTANT, 'hi');
  assert.equal(svc.collection.data.length, 2);
  assert.equal(svc.collection.data[0].role, 'user');
  assert.equal(svc.collection.data[1].role, 'assistant');
});

test('chat summarizes when context too long', async () => {
  const svc = new LLMService();
  svc.collection = new FakeCollection();
  svc.ollama.chat = async () => ({ message: { content: 'ok' } });
  svc.summarizer.summarize = async () => ({ text: 'sum' });
  CONFIG.llm.maxTokens = 2;
  await svc.saveMessage('u2', 'user', 'a b c d e');
  await svc.chat('u2', 'x y z', CHAT_MODES.ASSISTANT, 'hi');
  assert.equal(svc.collection.data[0].role, 'system');
  assert.ok(svc.collection.data.some(d => d.content.includes('sum')));
});
