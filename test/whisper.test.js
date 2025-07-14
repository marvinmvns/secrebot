import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { CONFIG } from '../src/config/index.js';
import AudioTranscriber from '../src/services/audioTranscriber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create minimal test audio file
async function createTestAudio() {
  const testPath = path.join(__dirname, 'test-audio.wav');
  const sampleRate = 16000;
  const duration = 1;
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // WAV Header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * 2, offset); offset += 4;
  buffer.writeUInt16LE(2, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Add simple tone instead of silence
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000;
    buffer.writeInt16LE(sample, offset + i * 2);
  }
  
  await fs.writeFile(testPath, buffer);
  return testPath;
}

describe('Whisper Setup', () => {
  test('executable exists and is accessible', async () => {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
    assert.ok(true, 'Whisper executable found');
  });

  test('model exists and is valid', async () => {
    const modelFile = MODEL_OBJECT[CONFIG.audio.model];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    const stats = await fs.stat(modelPath);
    assert.ok(stats.isFile() && stats.size > 0, 'Model file is valid');
  });

  test('configuration is valid', () => {
    assert.ok(CONFIG.audio.model, 'Audio model configured');
    assert.ok(CONFIG.audio.language, 'Audio language configured');
    assert.ok(CONFIG.audio.timeoutMs > 0, 'Timeout configured');
  });
});

describe('AudioTranscriber', () => {
  test('instantiates correctly', () => {
    const transcriber = new AudioTranscriber();
    assert.ok(transcriber.queue, 'Has queue');
    assert.ok(transcriber.ollamaClient, 'Has Ollama client');
  });

  test('transcribes audio buffer', async () => {
    const transcriber = new AudioTranscriber();
    const testPath = await createTestAudio();
    
    try {
      const audioBuffer = await fs.readFile(testPath);
      const result = await transcriber.transcribe(audioBuffer, 'wav');
      assert.equal(typeof result, 'string', 'Returns string result');
    } finally {
      await fs.unlink(testPath);
    }
  });

  test('handles transcription with summary', async () => {
    const transcriber = new AudioTranscriber();
    const testPath = await createTestAudio();
    
    try {
      const audioBuffer = await fs.readFile(testPath);
      const result = await transcriber.transcribeAndSummarize(audioBuffer, 'wav');
      
      assert.ok(result.transcription !== undefined, 'Has transcription');
      assert.ok(result.summary !== undefined, 'Has summary');
      assert.ok(result.combined !== undefined, 'Has combined result');
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        assert.ok(true, 'Ollama unavailable - test skipped');
      } else {
        throw error;
      }
    } finally {
      await fs.unlink(testPath);
    }
  });

  test('processes multiple requests via queue', async () => {
    const transcriber = new AudioTranscriber();
    const testPath = await createTestAudio();
    
    try {
      const audioBuffer = await fs.readFile(testPath);
      const promises = Array(3).fill().map(() => 
        transcriber.transcribe(audioBuffer, 'wav')
      );
      
      const results = await Promise.all(promises);
      assert.equal(results.length, 3, 'Processes all requests');
      results.forEach(result => 
        assert.equal(typeof result, 'string', 'Each result is string')
      );
    } finally {
      await fs.unlink(testPath);
    }
  });
});