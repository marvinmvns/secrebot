import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YTDlpWrapPkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = YTDlpWrapPkg;
import SubtitleProcessor from './SubtitleProcessor.js';
import TextSummarizer from './TextSummarizer.js';
import AudioTranscriber from '../audioTranscriber.js';
import { CONFIG } from '../../config/index.js';
import Utils from '../../utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class VideoProcessor {
  constructor(options = {}) {
    this.ytdlpPath = options.ytdlpPath || CONFIG.video.ytdlpPath || '/usr/bin/yt-dlp';
    this.ytdlp = new YTDlpWrap(this.ytdlpPath);
    this.tempDir = options.tempDir || path.join(__dirname, '../../temp');
    this.subtitleProcessor = new SubtitleProcessor();
    this.textSummarizer = new TextSummarizer(options.summarizerOptions || {});
    this.transcriber = options.transcriber || new AudioTranscriber();
    this.defaultOptions = {
      languages: ['pt', 'en'],
      subtitleFormat: 'srt',
      timeout: 600000,
      maxFileSizeMB: 500,
      preferManualSubs: true,
      summaryLength: 3
    };
  }

  async processVideo(url, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    await this.ensureTempDir();
    const metadata = await this.getVideoMetadata(url);
    let text = await this.extractSubtitles(url, config);
    let source = 'subtitles';
    if (!text) {
      text = await this.transcribeWithWhisper(url, config);
      source = 'whisper';
    }
    text = this.cleanText(text);
    const summary = await this.textSummarizer.summarize(text, config.summaryLength);
    return {
      metadata: {
        title: metadata.title,
        duration: metadata.duration,
        url,
        subtitleSource: source
      },
      transcription: text,
      summary: summary.text
    };
  }

  async transcribeVideo(url, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    await this.ensureTempDir();
    const metadata = await this.getVideoMetadata(url);
    const text = await this.transcribeWithWhisper(url, config);
    return {
      metadata: {
        title: metadata.title,
        duration: metadata.duration,
        url
      },
      transcription: this.cleanText(text)
    };
  }

  async ensureTempDir() {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  async getVideoMetadata(url) {
    const info = await Utils.getVideoInfo(url, this.ytdlpPath);
    return {
      title: info.title || 'n/a',
      duration: info.duration || 0,
      filesize: info.filesize
    };
  }

  async extractSubtitles(url, config) {
    const outFile = path.join(this.tempDir, `subs_%(id)s.%(ext)s`);
    const args = [
      url,
      '--skip-download',
      '--write-subs',
      '--sub-langs', config.languages.join(','),
      '--sub-format', config.subtitleFormat,
      '-o', outFile
    ];
    if (!config.preferManualSubs) {
      args.push('--write-auto-subs');
    }
    try {
      await Promise.race([
        this.ytdlp.execPromise(args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout na extra\u00e7\u00e3o de legendas')), config.timeout)
        )
      ]);
      const files = await fs.readdir(this.tempDir);
      const sub = files.find((f) => f.startsWith('subs_') && (f.endsWith('.srt') || f.endsWith('.vtt')));
      if (!sub) return null;
      const content = await fs.readFile(path.join(this.tempDir, sub), 'utf8');
      await fs.unlink(path.join(this.tempDir, sub)).catch(() => {});
      return content;
    } catch {
      return null;
    }
  }

  async transcribeWithWhisper(url, config) {
    const audioPath = path.join(this.tempDir, `audio_${Date.now()}.wav`);
    await this.ytdlp.execPromise([
      url,
      '--extract-audio',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--postprocessor-args', '-ar 16000 -ac 1',
      '-o', audioPath
    ]);
    const audio = await fs.readFile(audioPath);
    await fs.unlink(audioPath).catch(() => {});
    const text = await this.transcriber.transcribe(audio, 'audio/wav');
    return text;
  }

  cleanText(text) {
    return text
      .replace(/\[.*?\]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
