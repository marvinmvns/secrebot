import os from 'os';
import { nodewhisper } from 'nodejs-whisper';
import { CONFIG } from '../config/index.js';

// Detecta número de núcleos de CPU e ajusta variáveis de ambiente
const cpuCount = os.cpus().length || 1;
process.env.OMP_NUM_THREADS = String(cpuCount);
process.env.MKL_NUM_THREADS = String(cpuCount);

/**
 * Transcreve um arquivo de áudio usando o nodejs-whisper.
 * @param {string} filePath Caminho para o arquivo de áudio.
 * @returns {Promise<string>} Texto transcrito.
 */
export async function transcribe(filePath) {
  const start = Date.now();
  try {
    console.log(`🎤 Transcrevendo: ${filePath}`);
    const text = await nodewhisper(filePath, {
      modelName: CONFIG.audio.model,
      autoDownloadModelName: CONFIG.audio.model,
      withCuda: false,
      removeWavFileAfterTranscription: false,
      whisperOptions: {
        outputInText: true,
        language: CONFIG.audio.language,
      },
    });
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`✅ Transcrição concluída em ${duration}s`);
    return text.trim();
  } catch (err) {
    console.error('❌ Erro na transcrição:', err.message);
    throw err;
  }
}
