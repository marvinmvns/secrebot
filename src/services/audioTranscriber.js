import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import ffmpeg from 'fluent-ffmpeg';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, __dirname } from '../config/index.js'; // Ajustar caminho se necessário
import JobQueue from './jobQueue.js';

// ============ Transcritor de Áudio ============
class AudioTranscriber {
  constructor() {
    this.queue = new JobQueue(
      CONFIG.queues.whisperConcurrency,
      CONFIG.queues.memoryThresholdGB
    );
  }

  async runWhisper(filePath, options) {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    const modelFile = MODEL_OBJECT[options.modelName];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    const args = ['-m', modelPath, '-f', filePath, '-otxt', '-l', options.whisperOptions.language];

    return new Promise((resolve, reject) => {
      const proc = spawn(execPath, args, { cwd: WHISPER_CPP_PATH });
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Whisper process timed out'));
      }, CONFIG.audio.timeoutMs);

      proc.stderr.on('data', d => {
        stderr += d.toString();
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `Whisper exited with code ${code}`));
        }
      });
    });
  }

  async transcribe(audioBuffer, inputFormat = 'ogg') {
    return this.queue.add(async () => {
      console.log('🎤 Iniciando transcrição de áudio...');
      const timestamp = Date.now();
      const tempOutputPath = path.join(__dirname, `audio_${timestamp}.wav`);

      try {
        await new Promise((resolve, reject) => {
          const inputStream = Readable.from(audioBuffer);
          ffmpeg(inputStream)
            .inputFormat(inputFormat)
            .outputOptions(`-ar ${CONFIG.audio.sampleRate}`)
            .toFormat('wav')
            .on('error', (err) => {
              console.error('Erro no FFMPEG:', err);
              reject(err);
            })
            .on('end', resolve)
            .save(tempOutputPath);
        });
      
      const options = {
        modelName: CONFIG.audio.model,
        autoDownloadModelName: CONFIG.audio.model,
        verbose: true,
        removeWavFileAfterTranscription: false, // Manter false para debug se necessário
        withCuda: false, // Definir como true se CUDA estiver disponível e configurado
        whisperOptions: { 
          outputInText: true, 
          language: CONFIG.audio.language 
        }
      };
      
      // Executa o Whisper com controle de timeout
      await this.runWhisper(tempOutputPath, options);
      
      const transcriptionPath = `${tempOutputPath}.txt`;
      const transcription = await fs.readFile(transcriptionPath, 'utf8');
      
      // Usa o método estático de Utils para limpar arquivos
      await Utils.cleanupFile(tempOutputPath);
      await Utils.cleanupFile(transcriptionPath);
      
      console.log('✅ Transcrição concluída.');
      return transcription.trim();
    } catch (err) {
      console.error('❌ Erro na transcrição de áudio:', err);
      // Tenta limpar o arquivo temporário mesmo em caso de erro
      await Utils.cleanupFile(tempOutputPath);
      throw err; // Re-lança o erro para ser tratado no nível superior
    }
    });
  }
}

export default AudioTranscriber;
