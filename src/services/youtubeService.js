import { YoutubeTranscript } from 'youtube-transcript';
import { google } from 'googleapis';
import { CONFIG } from '../config/index.js';

class YoutubeService {
  constructor(db, llmService, bot) {
    this.llmService = llmService;
    this.bot = bot;
    this.collection = db.collection('youtubeSchedules');
    this.youtube = google.youtube({ version: 'v3', auth: CONFIG.youtube.apiKey });
    this.tasks = new Map();
  }

  async summarizeVideo(contactId, url) {
    const transcript = await YoutubeTranscript.fetchTranscript(url).then(arr => arr.map(t => t.text).join(' ')).catch(() => '');
    if (!transcript) return null;
    const text = transcript.slice(0, 8000);
    const summary = await this.llmService.getAssistantResponse(contactId, `Resuma em português o vídeo a seguir:\n\n${text}`);
    return summary;
  }

  async sendVideoSummary(contactId, url) {
    const summary = await this.summarizeVideo(contactId, url);
    if (summary) {
      await this.bot.sendResponse(contactId, summary);
    } else {
      await this.bot.sendResponse(contactId, '❌ Não foi possível obter a transcrição.');
    }
  }

  extractChannelId(url) {
    const match = url.match(/channel\/(.[^/?]+)/);
    if (match) return match[1];
    const handle = url.match(/@(.[^/?]+)/);
    if (handle) return handle[1];
    return null;
  }

  async fetchLatestVideoId(channelId) {
    const res = await this.youtube.search.list({
      channelId,
      part: 'id',
      order: 'date',
      maxResults: 1,
      type: 'video'
    });
    return res.data.items && res.data.items[0] ? res.data.items[0].id.videoId : null;
  }

  scheduleChecks(doc) {
    doc.times.forEach(t => {
      const scheduleNext = () => {
        const [h, m] = t.split(':').map(Number);
        const now = new Date();
        let next = new Date();
        next.setHours(h, m, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const ms = next.getTime() - now.getTime();
        const id = setTimeout(async () => {
          await this.checkChannel(doc);
          scheduleNext();
        }, ms);
        this.tasks.set(doc.contactId + t, id);
      };
      scheduleNext();
    });
  }

  async checkChannel(doc) {
    const channelId = this.extractChannelId(doc.channelUrl);
    if (!channelId) return;
    const latest = await this.fetchLatestVideoId(channelId);
    if (latest && latest !== doc.lastVideoId) {
      const summary = await this.summarizeVideo(doc.contactId, `https://www.youtube.com/watch?v=${latest}`);
      if (summary) await this.bot.sendResponse(doc.contactId, summary);
      doc.lastVideoId = latest;
      await this.collection.updateOne({ _id: doc._id }, { $set: { lastVideoId: latest } });
    }
  }

  async addSchedule(contactId, channelUrl, times) {
    const doc = { contactId, channelUrl, times, lastVideoId: null };
    const res = await this.collection.insertOne(doc);
    doc._id = res.insertedId;
    this.scheduleChecks(doc);
  }

  async cancelSchedule(contactId) {
    await this.collection.deleteMany({ contactId });
    for (const [key, id] of this.tasks.entries()) {
      if (key.startsWith(contactId)) {
        clearTimeout(id);
        this.tasks.delete(key);
      }
    }
  }
}

export default YoutubeService;
