import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Innertube } from 'youtubei.js';
import AudioTranscriber from './audioTranscriber.js';
import Utils from '../utils/index.js';

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

async function downloadAudioBuffer(youtubeUrl) {
  const outputPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
  const attemptYtDlp = () => new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=webm]/bestaudio/best',
      '--no-playlist',
      '-o', outputPath,
      youtubeUrl
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', async (code) => {
      if (code !== 0) {
        await fs.unlink(outputPath).catch(() => {});
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
        reject(new Error(msg));
        return;
      }
      try {
        const data = await fs.readFile(outputPath);
        await fs.unlink(outputPath);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
  });

  return await attemptYtDlp();
}

async function downloadTranscriptWithYtDlp(youtubeUrl) {
  const tempDir = path.join(__dirname, `subs_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, 'subs.%(ext)s');
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--skip-download',
      '--write-auto-sub',
      '--sub-format', 'vtt',
      '--sub-langs', 'pt-BR,pt,en',
      '-o', outputTemplate,
      youtubeUrl
    ]);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);
    proc.on('close', async (code) => {
      if (code !== 0) {
        await fs.rm(tempDir, { recursive: true, force: true });
        const msg = stderr.trim() || `yt-dlp exited with code ${code}`;
        reject(new Error(msg));
        return;
      }
      try {
        const files = await fs.readdir(tempDir);
        const file = files.find((f) => f.endsWith('.vtt'));
        if (!file) throw new Error('Transcript not found');
        const text = await fs.readFile(path.join(tempDir, file), 'utf8');
        await fs.rm(tempDir, { recursive: true, force: true });
        const plain = text
          .replace(/^WEBVTT.*\n/gm, '')
          .replace(/\d+:\d+:\d+\.\d+ --> .*\n/g, '')
          .replace(/<[^>]+>/g, '')
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' ');
        resolve(plain);
      } catch (err) {
        await fs.rm(tempDir, { recursive: true, force: true });
        reject(err);
      }
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
      return segments.map((s) => s.text).join(' ');
    }
  } catch (err) {
    console.warn('Transcrição via YouTube.js falhou, tentando yt-dlp:', err.message);
  }
  try {
    return await downloadTranscriptWithYtDlp(url);
  } catch (err) {
    console.warn('Transcrição via yt-dlp falhou, utilizando Whisper:', err.message);
  }
  const audioBuffer = await downloadAudioBuffer(url);
  const transcript = await transcriber.transcribe(audioBuffer);
  return transcript;
}

export default { fetchTranscript };
