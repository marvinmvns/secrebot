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
    () => runYtDlp(['-x', '--audio-format', 'mp3', '--no-playlist'], 'mp3'),
    () => runYtDlp(['-x', '--audio-format', 'wav', '--no-playlist'], 'wav'),
    attemptYtdl,
    () => runYtDlp(['-f', 'bestaudio[ext=webm]/bestaudio/best', '--no-playlist'], 'ogg')
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      if (!shouldUseYtDlp(err)) break;
    }
  }
  throw lastErr;
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
    const info = await yt.getInfo(id);
    const transcriptInfo = await info.getTranscript();
    const segments = transcriptInfo?.transcript?.content?.body?.initial_segments || [];
    if (segments.length) {
      return segments.map((s) => s.snippet?.text ?? s.text).join(' ');
    }
  } catch (err) {
    console.warn('Transcrição via YouTube.js falhou, utilizando Whisper:', err.message);
  }
  const { buffer, format } = await downloadAudioBuffer(url);
  const transcript = await transcriber.transcribe(buffer, format);
  return transcript;
}

async function fetchTranscriptWhisperOnly(url) {
  const wavBuffer = await downloadWavBuffer(url);
  const transcript = await transcriber.transcribe(wavBuffer, 'wav');
  return transcript;
}

export default { fetchTranscript, fetchTranscriptWhisperOnly, shouldUseYtDlp };
