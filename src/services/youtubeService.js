import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import AudioTranscriber from './audioTranscriber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transcriber = new AudioTranscriber();

async function downloadAudioBuffer(youtubeUrl) {
  const outputPath = path.join(__dirname, `audio_${Date.now()}.ogg`);
  return new Promise((resolve, reject) => {
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
}

async function fetchTranscript(url) {
  const audioBuffer = await downloadAudioBuffer(url);
  const transcript = await transcriber.transcribe(audioBuffer);
  return transcript;
}

export default { fetchTranscript };
