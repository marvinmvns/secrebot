import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { CONFIG } from '../src/config/index.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para criar arquivo WAV simples
async function createTestWav() {
  const testPath = path.join(__dirname, 'debug_test.wav');
  
  // Arquivo WAV mínimo - 1 segundo, 16kHz, mono
  const sampleRate = 16000;
  const duration = 1; // 1 segundo
  const numSamples = sampleRate * duration;
  const bytesPerSample = 2;
  const numChannels = 1;
  
  const dataSize = numSamples * bytesPerSample * numChannels;
  const fileSize = 44 + dataSize;
  
  const buffer = Buffer.alloc(fileSize);
  let offset = 0;
  
  // WAV Header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // PCM
  buffer.writeUInt16LE(1, offset); offset += 2; // Audio format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset); offset += 4;
  buffer.writeUInt16LE(numChannels * bytesPerSample, offset); offset += 2;
  buffer.writeUInt16LE(16, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  
  // Dados de silêncio
  buffer.fill(0, offset);
  
  await fs.writeFile(testPath, buffer);
  return testPath;
}

test('Debug Whisper - Teste Direto do Executável', async () => {
  console.log('\n🔧 === DEBUG WHISPER EXECUTÁVEL ===\n');
  
  const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
  const modelFile = MODEL_OBJECT[CONFIG.audio.model];
  const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
  
  console.log('📋 Configurações:');
  console.log(`  Executável: ${execPath}`);
  console.log(`  Modelo: ${modelPath}`);
  console.log(`  Idioma: ${CONFIG.audio.language}`);
  console.log(`  Timeout: ${CONFIG.audio.timeoutMs}ms`);
  
  // Verificar se executável existe
  try {
    await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
    console.log('✅ Executável encontrado e é executável');
  } catch (error) {
    console.error('❌ Problema com executável:', error.message);
    throw error;
  }
  
  // Verificar se modelo existe
  try {
    const stats = await fs.stat(modelPath);
    console.log(`✅ Modelo encontrado (${Math.round(stats.size / 1024 / 1024)}MB)`);
  } catch (error) {
    console.error('❌ Problema com modelo:', error.message);
    throw error;
  }
  
  // Criar arquivo de teste
  const testPath = await createTestWav();
  console.log(`✅ Arquivo de teste criado: ${testPath}`);
  
  try {
    // Testar comando Whisper diretamente
    const args = ['-m', modelPath, '-f', testPath, '-otxt', '-l', CONFIG.audio.language];
    
    console.log(`🚀 Executando: ${execPath} ${args.join(' ')}`);
    
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(execPath, args, { 
        cwd: WHISPER_CPP_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      const timeout = setTimeout(() => {
        console.log('⏰ Timeout - matando processo...');
        proc.kill('SIGKILL');
        reject(new Error('Timeout após 30 segundos'));
      }, 30000); // 30 segundos
      
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log('📤 STDOUT:', text.trim());
      });
      
      proc.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        console.log('📥 STDERR:', text.trim());
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Erro do processo:', error);
        reject(error);
      });
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`🏁 Processo finalizou com código: ${code}`);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Processo falhou com código ${code}: ${stderr}`));
        }
      });
    });
    
    console.log('✅ Whisper executou com sucesso!');
    
    // Verificar se arquivo de transcrição foi gerado
    const transcriptionPath = `${testPath}.txt`;
    try {
      const transcription = await fs.readFile(transcriptionPath, 'utf8');
      console.log(`✅ Transcrição gerada: "${transcription.trim()}"`);
      
      // Limpar arquivo de transcrição
      await fs.unlink(transcriptionPath);
    } catch (error) {
      console.log('⚠️  Arquivo de transcrição não encontrado:', error.message);
    }
    
  } finally {
    // Limpar arquivo de teste
    await fs.unlink(testPath);
    console.log('🧹 Arquivo de teste removido');
  }
  
  console.log('\n✅ === DEBUG CONCLUÍDO ===\n');
});

test('Debug Whisper - Teste com AudioTranscriber', async () => {
  console.log('\n🔧 === DEBUG AUDIOTRANSCRIBER ===\n');
  
  // Importar aqui para evitar problemas de importação
  const AudioTranscriber = (await import('../src/services/audioTranscriber.js')).default;
  
  const transcriber = new AudioTranscriber();
  const testPath = await createTestWav();
  
  try {
    console.log('🎯 Testando transcrição via AudioTranscriber...');
    
    const audioBuffer = await fs.readFile(testPath);
    console.log(`📊 Buffer size: ${audioBuffer.length} bytes`);
    
    // Usar timeout menor para debug
    const originalTimeout = CONFIG.audio.timeoutMs;
    CONFIG.audio.timeoutMs = 45000; // 45 segundos
    
    const startTime = Date.now();
    const result = await transcriber.transcribe(audioBuffer, 'wav');
    const endTime = Date.now();
    
    CONFIG.audio.timeoutMs = originalTimeout; // Restaurar
    
    console.log(`✅ Transcrição concluída em ${endTime - startTime}ms`);
    console.log(`📝 Resultado: "${result}"`);
    
    assert.ok(typeof result === 'string', 'Resultado deve ser uma string');
    
  } catch (error) {
    console.error('❌ Erro na transcrição:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await fs.unlink(testPath);
  }
  
  console.log('\n✅ === DEBUG AUDIOTRANSCRIBER CONCLUÍDO ===\n');
});