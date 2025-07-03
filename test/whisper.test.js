import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { spawn } from 'child_process';
import { CONFIG } from '../src/config/index.js';
import AudioTranscriber from '../src/services/audioTranscriber.js';

test('deve verificar se o executável Whisper existe', async () => {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    
    try {
      await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Executável Whisper encontrado: ${execPath}`);
    } catch (error) {
      assert.fail(`❌ Executável Whisper não encontrado ou não é executável: ${execPath}`);
    }
  });

  test('deve verificar se os modelos configurados estão disponíveis', async () => {
    const modelFile = MODEL_OBJECT[CONFIG.audio.model];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    
    assert.ok(modelFile, `Modelo '${CONFIG.audio.model}' não encontrado no MODEL_OBJECT`);
    
    try {
      const stats = await fs.stat(modelPath);
      assert.ok(stats.isFile(), `Modelo não é um arquivo válido: ${modelPath}`);
      assert.ok(stats.size > 0, `Modelo tem tamanho zero: ${modelPath}`);
      console.log(`✅ Modelo Whisper '${CONFIG.audio.model}' encontrado: ${modelPath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    } catch (error) {
      assert.fail(`❌ Modelo Whisper '${CONFIG.audio.model}' não encontrado: ${modelPath}`);
    }
  });

  test('deve listar todos os modelos disponíveis', async () => {
    const modelsDir = path.join(WHISPER_CPP_PATH, 'models');
    
    try {
      const files = await fs.readdir(modelsDir);
      const modelFiles = files.filter(file => file.endsWith('.bin'));
      
      console.log(`\n📋 Modelos Whisper disponíveis (${modelFiles.length}):`);
      for (const modelFile of modelFiles) {
        const modelPath = path.join(modelsDir, modelFile);
        const stats = await fs.stat(modelPath);
        const sizeInMB = Math.round(stats.size / 1024 / 1024);
        console.log(`  - ${modelFile} (${sizeInMB}MB)`);
      }
      
      assert.ok(modelFiles.length > 0, 'Nenhum modelo Whisper encontrado');
    } catch (error) {
      assert.fail(`Erro ao listar modelos: ${error.message}`);
    }
  });

  test('deve testar o comando Whisper com ajuda', async (t) => {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Timeout: Comando Whisper não respondeu em 10s'));
      }, 10000);

      const proc = spawn(execPath, ['--help'], { 
        cwd: WHISPER_CPP_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      
      proc.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0 || (stdout.includes('whisper') && stdout.includes('usage'))) {
          console.log('✅ Comando Whisper --help funcionou corretamente');
          resolve();
        } else {
          console.log('STDOUT:', stdout);
          console.log('STDERR:', stderr);
          reject(new Error(`Comando Whisper falhou com código ${code}`));
        }
      });
    });
  });

  test('deve verificar se há modelos pequenos para teste rápido', async () => {
    const modelsDir = path.join(WHISPER_CPP_PATH, 'models');
    const smallModels = ['ggml-tiny.bin', 'ggml-tiny.en.bin', 'ggml-base.bin', 'ggml-base.en.bin'];
    
    let foundSmallModel = false;
    let availableModel = null;
    
    for (const modelFile of smallModels) {
      const modelPath = path.join(modelsDir, modelFile);
      try {
        await fs.access(modelPath);
        foundSmallModel = true;
        availableModel = modelFile;
        break;
      } catch (error) {
        // Modelo não encontrado, continua procurando
      }
    }
    
    if (foundSmallModel) {
      console.log(`✅ Modelo pequeno encontrado para testes: ${availableModel}`);
    } else {
      console.log('⚠️  Nenhum modelo pequeno encontrado. Considere baixar "tiny" ou "base" para testes mais rápidos.');
      console.log('💡 Para baixar um modelo pequeno, use: npm run download-whisper-model tiny');
    }
    
    // Este teste não falha, apenas informa
    assert.ok(true, 'Verificação de modelos pequenos concluída');
  });

test('deve instanciar AudioTranscriber sem erros', () => {
    try {
      const transcriber = new AudioTranscriber();
      assert.ok(transcriber, 'AudioTranscriber deve ser instanciado');
      assert.ok(transcriber.queue, 'AudioTranscriber deve ter uma fila');
      assert.ok(transcriber.ollamaClient, 'AudioTranscriber deve ter cliente Ollama');
      console.log('✅ AudioTranscriber instanciado com sucesso');
    } catch (error) {
      assert.fail(`Erro ao instanciar AudioTranscriber: ${error.message}`);
    }
  });

  test('deve validar configurações do Whisper', () => {
    assert.ok(CONFIG.audio, 'Configuração de áudio deve existir');
    assert.ok(CONFIG.audio.model, 'Modelo de áudio deve estar configurado');
    assert.ok(CONFIG.audio.language, 'Idioma deve estar configurado');
    assert.ok(CONFIG.audio.sampleRate, 'Taxa de amostragem deve estar configurada');
    assert.ok(CONFIG.audio.timeoutMs, 'Timeout deve estar configurado');
    
    console.log(`✅ Configurações Whisper validadas:`);
    console.log(`  - Modelo: ${CONFIG.audio.model}`);
    console.log(`  - Idioma: ${CONFIG.audio.language}`);
    console.log(`  - Sample Rate: ${CONFIG.audio.sampleRate}Hz`);
    console.log(`  - Timeout: ${CONFIG.audio.timeoutMs}ms`);
  });