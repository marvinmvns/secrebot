import { test } from 'node:test';
import assert from 'node:assert/strict';

// Simulated flow for the !resumirvideo2 command
const resumirVideo2Flow = {
  failTranscript: false,
  failLlm: false,

  async fetchTranscriptWhisperOnly() {
    if (this.failTranscript) {
      throw new Error('transcript_error');
    }
    return 'transcript';
  },

  async getAssistantResponse() {
    if (this.failLlm) {
      throw new Error('llm_error');
    }
    return 'summary';
  },

  async handleCommand() {
    try {
      const transcript = await this.fetchTranscriptWhisperOnly('url');
      const summary = await this.getAssistantResponse('user', transcript);
      return { success: true, summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

test('resumirvideo2 succeeds when no errors occur', async () => {
  const result = await resumirVideo2Flow.handleCommand();
  assert.equal(result.success, true);
  assert.equal(result.summary, 'summary');
});

test('resumirvideo2 handles transcript errors', async () => {
  resumirVideo2Flow.failTranscript = true;
  const result = await resumirVideo2Flow.handleCommand();
  assert.equal(result.success, false);
  assert.equal(result.error, 'transcript_error');
  resumirVideo2Flow.failTranscript = false;
});

test('resumirvideo2 handles llm errors', async () => {
  resumirVideo2Flow.failLlm = true;
  const result = await resumirVideo2Flow.handleCommand();
  assert.equal(result.success, false);
  assert.equal(result.error, 'llm_error');
  resumirVideo2Flow.failLlm = false;
});
