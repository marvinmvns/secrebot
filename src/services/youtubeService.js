import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadAudio(youtubeUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const stream = ytdl(youtubeUrl, { quality: 'highestaudio' });
    ffmpeg(stream)
      .audioBitrate(128)
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}

async function transcribeWithWhisper(audioPath, model = 'small') {
  return new Promise((resolve, reject) => {
    const cmd = `whisper "${audioPath}" --model ${model} --language auto --output_format txt --verbose false`;
    exec(cmd, (err) => {
      if (err) return reject(err);
      const txtFile = audioPath.replace(path.extname(audioPath), '.txt');
      fs.readFile(txtFile, 'utf8', (e, data) => {
        if (e) return reject(e);
        resolve(data);
      });
    });
  });
}

async function fetchTranscript(url) {
  const audioFile = path.join(__dirname, `audio_${Date.now()}.wav`);
  try {
    await downloadAudio(url, audioFile);
    const text = await transcribeWithWhisper(audioFile, 'small');
    return text;
  } finally {
    fs.unlink(audioFile, () => {});
    const txtFile = audioFile.replace(path.extname(audioFile), '.txt');
    fs.unlink(txtFile, () => {});
  }
}

export default { fetchTranscript };
