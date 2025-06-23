import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { nodewhisper } from 'nodejs-whisper';
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

  #formatFromMime(mime) {
    if (!mime) return null;
    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('mpeg')) return 'mp3';
    if (mime.includes('mp4')) return 'mp4';
    return null;
  }

  async transcribe(audioBuffer, mimeType = null) {
    return this.queue.add(async () => {
      console.log('🎤 Iniciando transcrição de áudio...');
      const timestamp = Date.now();
      const tempOutputPath = path.join(__dirname, `audio_${timestamp}.wav`);

      try {
        await new Promise((resolve, reject) => {
          const inputStream = Readable.from(audioBuffer);
          let command = ffmpeg(inputStream);
          const format = this.#formatFromMime(mimeType);
          if (format) {
            command = command.inputFormat(format);
          }
          command
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
      
      // A função nodewhisper pode precisar ser chamada de forma diferente dependendo da versão
      await nodewhisper(tempOutputPath, options); 
      
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
