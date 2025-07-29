
import { strict as assert } from 'assert';
import TtsService from '../src/services/ttsService.js';
// import { CONFIG } from '../src/config/index.js'; // No longer directly import CONFIG
import fs from 'fs/promises';
import path from 'path';

async function testTtsService() {
  console.log('Running TTS Service tests...');

  // Simulate a config object that would be passed from ApplicationFactory
  const simulatedConfig = {
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY || '',
      voiceId: process.env.ELEVENLABS_VOICE_ID || '',
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
      similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.75')
    },
    piper: {
      enabled: process.env.PIPER_ENABLED === 'true' || !!process.env.PIPER_MODEL,
      executable: process.env.PIPER_EXECUTABLE || 'piper',
      model: process.env.PIPER_MODEL || ''
    }
  };

  // Test 1: Service instantiation and initialization
  try {
    const ttsService = new TtsService(simulatedConfig);
    await ttsService.initialize(); // Call initialize after instantiation
    assert.ok(ttsService, 'TtsService should instantiate');
    console.log('  ✓ Test 1 passed: Service instantiation and initialization');
  } catch (error) {
    console.error('  ✗ Test 1 failed: Service instantiation and initialization', error);
    return;
  }

  // Test 2: Piper audio generation
  if (simulatedConfig.piper.enabled) {
    try {
      const ttsService = new TtsService(simulatedConfig);
      await ttsService.initialize(); // Initialize again for this test case
      const text = 'Olá, mundo!';
      const audioBuffer = await ttsService.generateAudio(text);
      assert.ok(audioBuffer, 'generateAudio should return a buffer');
      assert.ok(audioBuffer.length > 0, 'Audio buffer should not be empty');
      
      // Optional: Save the audio file for manual verification
      const outputPath = path.join('/tmp', 'test_output.ogg');
      await fs.writeFile(outputPath, audioBuffer);
      console.log(`  ✓ Test 2 passed: Piper audio generation (file saved to ${outputPath})`);
    } catch (error) {
      console.error('  ✗ Test 2 failed: Piper audio generation', error);
    }
  } else {
    console.log('  - Test 2 skipped: Piper is not enabled in simulated config');
  }
}

testTtsService();
