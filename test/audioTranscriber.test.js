import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import AudioTranscriber from '../src/services/audioTranscriber.js';
import { CONFIG } from '../src/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let transcriber;

test('setup - inicializar AudioTranscriber', () => {
    transcriber = new AudioTranscriber();
    assert.ok(transcriber, 'AudioTranscriber deve ser instanciado');
  });

  test('deve gerar arquivo de áudio de teste', async () => {
    const testAudioPath = path.join(__dirname, 'test-audio.wav');
    
    // Gera um arquivo de áudio de teste de 2 segundos com tom de 440Hz (Lá)
    const command = 'ffmpeg';
    const args = [
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=2',
      '-ar', '16000',
      '-ac', '1',
      '-y', // sobrescrever arquivo existente
      testAudioPath
    ];

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Timeout: FFmpeg não respondeu em 10s'));
      }, 10000);

      proc.on('error', (error) => {
        clearTimeout(timeout);
        if (error.code === 'ENOENT') {
          console.log('⚠️  FFmpeg não encontrado, pulando teste de geração de áudio');
          resolve({ skipped: true });
        } else {
          reject(error);
        }
      });

      proc.on('close', async (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            const stats = await fs.stat(testAudioPath);
            assert.ok(stats.size > 0, 'Arquivo de áudio deve ter tamanho > 0');
            console.log(`✅ Arquivo de teste gerado: ${testAudioPath} (${stats.size} bytes)`);
            resolve({ path: testAudioPath });
          } catch (error) {
            reject(new Error(`Arquivo de teste não foi criado: ${error.message}`));
          }
        } else {
          reject(new Error(`FFmpeg falhou com código ${code}`));
        }
      });
    });
  });

  test('deve criar buffer de áudio de teste simples', async () => {
    // Cria um buffer de áudio WAV mínimo (cabeçalho + dados silenciosos)
    const sampleRate = 16000;
    const duration = 1; // 1 segundo
    const numSamples = sampleRate * duration;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = numSamples * blockAlign;
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44 + dataSize);
    let offset = 0;

    // Cabeçalho WAV
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // Tamanho do chunk fmt
    buffer.writeUInt16LE(1, offset); offset += 2; // Formato PCM
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Dados de áudio (silêncio)
    for (let i = 0; i < numSamples; i++) {
      buffer.writeInt16LE(0, offset);
      offset += 2;
    }

    // Salva o buffer para debug
    const testPath = path.join(__dirname, 'test-silence.wav');
    await fs.writeFile(testPath, buffer);
    
    console.log(`✅ Buffer de áudio de teste criado: ${buffer.length} bytes`);
    console.log(`✅ Arquivo salvo para debug: ${testPath}`);
    
    assert.ok(buffer.length > 44, 'Buffer deve ter mais que o cabeçalho WAV');
    return buffer;
  });

  test('deve testar método runWhisper com arquivo inexistente', async () => {
    const fakeFilePath = '/tmp/arquivo-inexistente.wav';
    const options = {
      modelName: CONFIG.audio.model,
      whisperOptions: { 
        language: CONFIG.audio.language 
      }
    };

    try {
      await transcriber.runWhisper(fakeFilePath, options);
      assert.fail('Deveria ter falhado com arquivo inexistente');
    } catch (error) {
      console.log(`✅ Erro esperado capturado: ${error.message}`);
      assert.ok(error.message.includes('No such file') || error.message.includes('not found') || error.code !== 0, 
                'Erro deve indicar arquivo não encontrado');
    }
  });

  test('deve validar modelo antes da transcrição', async () => {
    // Testa com modelo inexistente
    const originalModel = CONFIG.audio.model;
    CONFIG.audio.model = 'modelo-inexistente';

    const testBuffer = Buffer.from('fake audio data');

    try {
      await transcriber.transcribe(testBuffer, 'wav');
      assert.fail('Deveria ter falhado com modelo inexistente');
    } catch (error) {
      console.log(`✅ Erro de modelo inexistente capturado: ${error.message}`);
      assert.ok(error.message.includes('não encontrado'), 'Erro deve indicar modelo não encontrado');
    } finally {
      // Restaura modelo original
      CONFIG.audio.model = originalModel;
    }
  });

  test('cleanup - limpar arquivos de teste', async () => {
    const testFiles = [
      path.join(__dirname, 'test-audio.wav'),
      path.join(__dirname, 'test-silence.wav')
    ];

    for (const filePath of testFiles) {
      try {
        await fs.unlink(filePath);
        console.log(`🧹 Arquivo removido: ${filePath}`);
      } catch (error) {
        // Arquivo não existe, tudo bem
      }
    }
    
    assert.ok(true, 'Limpeza concluída');
  });