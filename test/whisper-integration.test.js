import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import AudioTranscriber from '../src/services/audioTranscriber.js';
import { CONFIG } from '../src/config/index.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para criar um arquivo de áudio de teste simples
async function createTestAudioFile() {
  const testPath = path.join(__dirname, 'test_audio.wav');
  
  // Criar um arquivo WAV simples de 1 segundo de silêncio para teste
  // Header WAV + dados de silêncio
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
  
  // Dados de silêncio (zeros)
  buffer.fill(0, offset);
  
  await fs.writeFile(testPath, buffer);
  return testPath;
}

test('Teste completo de integração do Whisper', async (t) => {
  console.log('\n🧪 === TESTE COMPLETO DE INTEGRAÇÃO WHISPER ===\n');
  
  // 1. Verificar dependências
  await t.test('Verificar executável Whisper', async () => {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    logger.info(`🔍 Verificando executável: ${execPath}`);
    
    try {
      await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Executável Whisper encontrado e executável`);
    } catch (error) {
      console.error(`❌ Executável Whisper não encontrado: ${execPath}`);
      throw error;
    }
  });
  
  // 2. Verificar modelo
  await t.test('Verificar modelo Whisper', async () => {
    const modelFile = MODEL_OBJECT[CONFIG.audio.model];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    logger.info(`🔍 Verificando modelo: ${modelPath}`);
    
    try {
      const stats = await fs.stat(modelPath);
      console.log(`✅ Modelo encontrado: ${modelFile} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    } catch (error) {
      console.error(`❌ Modelo não encontrado: ${modelPath}`);
      throw error;
    }
  });
  
  // 3. Testar instanciação do AudioTranscriber
  await t.test('Instanciar AudioTranscriber', async () => {
    logger.info('🔍 Testando instanciação do AudioTranscriber...');
    
    try {
      const transcriber = new AudioTranscriber();
      assert.ok(transcriber, 'AudioTranscriber deve ser instanciado');
      assert.ok(transcriber.queue, 'Deve ter uma fila');
      assert.ok(transcriber.ollamaClient, 'Deve ter cliente Ollama');  
      console.log('✅ AudioTranscriber instanciado com sucesso'); 
    } catch (error) {
      console.error('❌ Erro ao instanciar AudioTranscriber:', error);
      throw error;  
    }
  });
  
  // 4. Testar comando Whisper básico
  await t.test('Testar comando Whisper --help', async () => {
    logger.info('🔍 Testando comando Whisper --help...');
    
    const transcriber = new AudioTranscriber();
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const proc = spawn(execPath, ['--help'], { 
        cwd: WHISPER_CPP_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Timeout: comando --help não respondeu'));
      }, 10000);
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0 || stdout.includes('usage')) {
          console.log('✅ Comando --help funcionou');
          resolve();
        } else {
          console.error('❌ Comando --help falhou');
          console.error('STDOUT:', stdout);
          console.error('STDERR:', stderr);
          reject(new Error(`Help command failed with code ${code}`));
        }
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  });
  
  // 5. Testar transcrição com arquivo de teste
  await t.test('Testar transcrição com arquivo real', async () => {
    logger.info('🔍 Testando transcrição com arquivo de áudio...');
    
    const transcriber = new AudioTranscriber();
    let testAudioPath;
    
    try {
      // Criar arquivo de teste
      testAudioPath = await createTestAudioFile();
      console.log(`📁 Arquivo de teste criado: ${testAudioPath}`);
      
      // Verificar se o arquivo foi criado
      const stats = await fs.stat(testAudioPath);
      console.log(`📊 Tamanho do arquivo: ${stats.size} bytes`);
      
      // Ler o arquivo como buffer
      const audioBuffer = await fs.readFile(testAudioPath);
      console.log(`🔄 Buffer de áudio: ${audioBuffer.length} bytes`);
      
      // Testar transcrição
      const result = await transcriber.transcribe(audioBuffer, 'wav');
      console.log(`✅ Transcrição concluída: "${result}"`);
      
      // Resultado pode ser vazio para silêncio, mas não deve dar erro
      assert.ok(typeof result === 'string', 'Resultado deve ser uma string');
      
    } catch (error) {
      console.error('❌ Erro na transcrição:', error);
      console.error('Stack:', error.stack);
      throw error;
    } finally {
      // Limpar arquivo de teste
      if (testAudioPath) {
        try {
          await fs.unlink(testAudioPath);
          console.log('🧹 Arquivo de teste removido');
        } catch (e) {
          console.warn('⚠️  Não foi possível remover arquivo de teste:', e.message);
        }
      }
    }
  });
  
  console.log('\n✅ === TODOS OS TESTES DE INTEGRAÇÃO PASSARAM ===\n');
});

test('Teste de configurações detalhadas', async () => {
  logger.info('🔍 Verificando todas as configurações...');
  
  console.log('\n📋 === CONFIGURAÇÕES ATUAIS ===');
  console.log('CONFIG.audio:', JSON.stringify(CONFIG.audio, null, 2));
  console.log('WHISPER_CPP_PATH:', WHISPER_CPP_PATH);
  console.log('WHISPER_CPP_MAIN_PATH:', WHISPER_CPP_MAIN_PATH);
  console.log('MODEL_OBJECT:', JSON.stringify(MODEL_OBJECT, null, 2));
  
  // Verificar todas as constantes importantes
  assert.ok(WHISPER_CPP_PATH, 'WHISPER_CPP_PATH deve estar definido');
  assert.ok(WHISPER_CPP_MAIN_PATH, 'WHISPER_CPP_MAIN_PATH deve estar definido');
  assert.ok(MODEL_OBJECT, 'MODEL_OBJECT deve estar definido');
  assert.ok(CONFIG.audio, 'CONFIG.audio deve estar definido');
  
  console.log('✅ Todas as configurações estão válidas');
});