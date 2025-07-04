import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { Innertube } from 'youtubei.js';
import AudioTranscriber from './audioTranscriber.js';
import Utils from '../utils/index.js';
import { CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transcriber = new AudioTranscriber();
let ytClientPromise;

async function initClient() {
  if (!ytClientPromise) {
    ytClientPromise = Innertube.create({ generate_session_locally: true });
  }
  return ytClientPromise;
}

function shouldUseYtDlp(err) {
  return /Could not extract functions|nsig extraction failed/i.test(String(err));
}

async function downloadAudioBuffer(youtubeUrl) {
  const base = path.join(__dirname, `audio_${Date.now()}`);

  const runYtDlp = (args, ext) => new Promise((resolve, reject) => {
    const outputPath = `${base}.${ext}`;
    const proc = spawn('yt-dlp', [...args, '-o', outputPath, youtubeUrl]);

    let stderr = '';
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', async code => {
      if (code !== 0) {
        await fs.unlink(outputPath).catch(() => {});
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
        reject(new Error(msg));
        return;
      }
      try {
        const data = await fs.readFile(outputPath);
        await fs.unlink(outputPath);
        resolve({ buffer: data, format: ext });
      } catch (err) {
        reject(err);
      }
    });
  });

  const attemptYtdl = () => new Promise((resolve, reject) => {
    const outputPath = `${base}.ogg`;
    const stream = ytdl(youtubeUrl, { quality: 'highestaudio' });
    ffmpeg(stream)
      .audioBitrate(128)
      .toFormat('ogg')
      .save(outputPath)
      .on('end', async () => {
        try {
          const data = await fs.readFile(outputPath);
          await fs.unlink(outputPath);
          resolve({ buffer: data, format: 'ogg' });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async err => {
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
  });

  const attempts = [
    { name: 'yt-dlp MP3', fn: () => runYtDlp(['-x', '--audio-format', 'mp3', '--no-playlist'], 'mp3') },
    { name: 'yt-dlp WAV', fn: () => runYtDlp(['-x', '--audio-format', 'wav', '--no-playlist'], 'wav') },
    { name: 'ytdl-core + ffmpeg', fn: attemptYtdl },
    { name: 'yt-dlp fallback', fn: () => runYtDlp(['-f', 'bestaudio[ext=webm]/bestaudio/best', '--no-playlist'], 'ogg') }
  ];

  let lastErr;
  for (const { name, fn } of attempts) {
    try {
      logger.verbose(`🔄 Tentando download de áudio via ${name}`);
      const result = await fn();
      logger.success(`✅ Download de áudio bem-sucedido via ${name} (${result.format})`);
      return result;
    } catch (err) {
      logger.warn(`⚠️ Download via ${name} falhou: ${err.message}`);
      lastErr = err;
      if (!shouldUseYtDlp(err)) {
        logger.verbose('❌ Erro não recuperável, interrompendo tentativas de download');
        break;
      }
    }
  }
  
  logger.error(`❌ Todas as tentativas de download de áudio falharam`);
  throw new Error(`Falha no download de áudio: ${lastErr.message}`);
}

async function downloadWavBuffer(youtubeUrl) {
  const { buffer, format } = await downloadAudioBuffer(youtubeUrl);
  const outputPath = path.join(__dirname, `audio_${Date.now()}_wav.wav`);
  return new Promise((resolve, reject) => {
    ffmpeg(Readable.from(buffer))
      .inputFormat(format)
      .outputOptions('-ar', String(CONFIG.audio.sampleRate))
      .toFormat('wav')
      .save(outputPath)
      .on('end', async () => {
        try {
          const data = await fs.readFile(outputPath);
          await fs.unlink(outputPath);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', async err => {
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
  });
}

async function fetchTranscript(url) {
  const yt = await initClient();
  const id = Utils.extractYouTubeId(url) || url;
  
  try {
    logger.verbose(`📡 Tentando obter transcrição via YouTube API para: ${id}`);
    const info = await yt.getInfo(id);
    const transcriptInfo = await info.getTranscript();
    const segments = transcriptInfo?.transcript?.content?.body?.initial_segments || [];
    
    if (segments.length) {
      const transcript = segments.map((s) => s.snippet?.text ?? s.text).join(' ');
      logger.success(`✅ Transcrição obtida via YouTube API (${transcript.length} caracteres)`);
      return transcript;
    } else {
      logger.warn('⚠️ Nenhum segmento de transcrição encontrado na API do YouTube');
    }
  } catch (err) {
    logger.warn(`⚠️ Transcrição via YouTube.js falhou: ${err.message}`);
    logger.verbose('🔄 Iniciando fallback para Whisper');
  }
  
  try {
    const { buffer, format } = await downloadAudioBuffer(url);
    logger.verbose(`🎵 Áudio baixado com sucesso (${format}), iniciando transcrição via Whisper`);
    const transcript = await transcriber.transcribe(buffer, format);
    logger.success(`✅ Transcrição obtida via Whisper (${transcript.length} caracteres)`);
    return transcript;
  } catch (whisperErr) {
    logger.error(`❌ Erro na transcrição via Whisper: ${whisperErr.message}`);
    throw new Error(`Falha na transcrição: API do YouTube indisponível e Whisper falhou - ${whisperErr.message}`);
  }
}

async function fetchTranscriptWhisperOnly(url) {
  try {
    logger.verbose(`🎙️ Iniciando transcrição via Whisper para: ${url}`);
    const wavBuffer = await downloadWavBuffer(url);
    logger.verbose(`🎵 Áudio convertido para WAV, iniciando transcrição`);
    const transcript = await transcriber.transcribe(wavBuffer, 'wav');
    logger.success(`✅ Transcrição via Whisper concluída (${transcript.length} caracteres)`);
    return transcript;
  } catch (err) {
    logger.error(`❌ Erro na transcrição via Whisper: ${err.message}`);
    throw new Error(`Falha na transcrição via Whisper: ${err.message}`);
  }
}

export default { fetchTranscript, fetchTranscriptWhisperOnly, shouldUseYtDlp };
