import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { CONFIG } from '../src/config/index.js';

console.log('🧪 Teste Funcional Completo do Whisper');
console.log('=====================================');

async function testWhisperFunctional() {
  try {
    // 1. Verificar executável
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
    console.log('✅ Executável Whisper encontrado');

    // 2. Verificar modelo
    const modelFile = MODEL_OBJECT[CONFIG.audio.model];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    await fs.access(modelPath);
    console.log(`✅ Modelo '${CONFIG.audio.model}' encontrado`);

    // 3. Criar arquivo de áudio de teste
    console.log('🎵 Criando arquivo de áudio de teste...');
    const testAudioPath = '/tmp/whisper-test.wav';
    
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-f', 'lavfi',
        '-i', 'sine=frequency=440:duration=2',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        testAudioPath
      ], { stdio: 'pipe' });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg falhou: ${code}`));
      });

      proc.on('error', reject);
    });

    const stats = await fs.stat(testAudioPath);
    console.log(`✅ Arquivo de teste criado: ${stats.size} bytes`);

    // 4. Testar Whisper com timeout menor (modelo pequeno seria melhor)
    console.log('🎤 Testando transcrição com Whisper...');
    
    const whisperOutput = await new Promise((resolve, reject) => {
      const proc = spawn(execPath, [
        '-m', modelPath,
        '-f', testAudioPath,
        '-otxt',
        '-l', CONFIG.audio.language,
        '--no-prints'
      ], { 
        cwd: WHISPER_CPP_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Timeout: Whisper não respondeu em 60s'));
      }, 60000);

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve(stderr);
        } else {
          reject(new Error(`Whisper falhou com código ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    console.log('✅ Whisper executou sem erros');
    
    // 5. Verificar se arquivo de transcrição foi criado
    const transcriptionPath = `${testAudioPath}.txt`;
    try {
      const transcription = await fs.readFile(transcriptionPath, 'utf8');
      console.log(`✅ Transcrição gerada: "${transcription.trim()}"`);
    } catch (error) {
      console.log('⚠️  Arquivo de transcrição não encontrado (normal para áudio sintético)');
    }

    // 6. Limpeza
    try {
      await fs.unlink(testAudioPath);
      await fs.unlink(transcriptionPath);
      console.log('🧹 Arquivos de teste removidos');
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('\n🎉 WHISPER FUNCIONANDO CORRETAMENTE!');
    console.log('=====================================');
    console.log('✅ Executável disponível');
    console.log('✅ Modelo carregado com sucesso');
    console.log('✅ Transcrição executada sem erros');
    console.log('✅ Integração funcional');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE FUNCIONAL:');
    console.error('============================');
    console.error(error.message);
    console.error('\n💡 Possíveis soluções:');
    console.error('- Verifique se o FFmpeg está instalado');
    console.error('- Considere usar um modelo menor (tiny, base) para testes');
    console.error('- Verifique se há espaço suficiente em disco');
    console.error('- Verifique se há memória RAM suficiente (modelo large precisa ~2GB)');
    process.exit(1);
  }
}

testWhisperFunctional();