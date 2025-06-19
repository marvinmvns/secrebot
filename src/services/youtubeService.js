import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import AudioTranscriber from './audioTranscriber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transcriber = new AudioTranscriber();

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
    proc.on('error', reject);
    proc.on('close', async (code) => {
      if (code !== 0) {
        await fs.unlink(outputPath).catch(() => {});
        reject(new Error(`yt-dlp exited with code ${code}`));
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
  const audioBuffer = await downloadAudioBuffer(url);
  const transcript = await transcriber.transcribe(audioBuffer);
  return transcript;
}

export default { fetchTranscript };
