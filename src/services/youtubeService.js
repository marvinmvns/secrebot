import ytdl from 'ytdl-core';
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

function fetchTranscriptPython(url) {
  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '../../scripts/get_transcript.py');
    const proc = spawn('python3', [script, url]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || stdout.trim() || `python exited with code ${code}`));
      }
      try {
        const data = JSON.parse(stdout.trim());
        if (data.error) return reject(new Error(data.error));
        resolve(data.text);
      } catch (e) {
        reject(e);
      }
    });
  });
}

async function initClient() {
  if (!ytClientPromise) {
    ytClientPromise = Innertube.create({ generate_session_locally: true });
  }
  return ytClientPromise;
}

async function downloadAudioBuffer(youtubeUrl) {
  const outputPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
  const attemptYtdl = () => new Promise((resolve, reject) => {
    const stream = ytdl(youtubeUrl, { quality: 'highestaudio' });
    ffmpeg(stream)
      .audioBitrate(128)
      .toFormat('ogg')
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
      .on('error', async (err) => {
        await fs.unlink(outputPath).catch(() => {});
        reject(err);
      });
  });

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

  try {
    return await attemptYtdl();
  } catch (err) {
    if (/Could not extract functions/.test(String(err))) {
      try {
        return await attemptYtDlp();
      } catch (e) {
        throw e;
      }
    }
    throw err;
  }
}

async function fetchTranscript(url) {
  try {
    return await fetchTranscriptPython(url);
  } catch (err) {
    console.warn('Transcrição via Python falhou:', err.message);
  }
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
    console.warn('Transcrição via YouTube.js falhou, utilizando Whisper:', err.message);
  }
  const audioBuffer = await downloadAudioBuffer(url);
  const transcript = await transcriber.transcribe(audioBuffer);
  return transcript;
}

export default { fetchTranscript };
