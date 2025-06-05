import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { nodewhisper } from 'nodejs-whisper';
import ffmpeg from 'fluent-ffmpeg';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, __dirname } from '../config/index.js'; // Ajustar caminho se necessário

// ============ Transcritor de Áudio ============
class AudioTranscriber {
  async transcribe(audioBuffer) {
    console.log('🎤 Iniciando transcrição de áudio...');
    const timestamp = Date.now();
    const tempOutputPath = path.join(__dirname, `audio_${timestamp}.wav`);

    try {
      await new Promise((resolve, reject) => {
        const inputStream = Readable.from(audioBuffer);
        ffmpeg(inputStream)
          .inputFormat('ogg')
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
  }
}

export default AudioTranscriber;
