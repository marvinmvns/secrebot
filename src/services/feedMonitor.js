import YTDlpWrapPkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = YTDlpWrapPkg;
import VideoProcessor from './video/VideoProcessor.js';
import JobQueue from './jobQueue.js';
import Utils from '../utils/index.js';
import { CONFIG } from '../config/index.js';

export default class FeedMonitor {
  constructor(db, bot, llmService) {
    this.db = db;
    this.subs = db.collection('feedSubscriptions');
    this.items = db.collection('feedItems');
    this.bot = bot;
    this.llmService = llmService;
    this.videoProcessor = bot.videoProcessor || new VideoProcessor({ transcriber: bot.transcriber });
    this.ytdlp = new YTDlpWrap();
    this.queue = new JobQueue(CONFIG.queues.whisperConcurrency, CONFIG.queues.memoryThresholdGB);
  }

  async collectionExists(name) {
     console.error(`❌ entrou 4  `);
    const cols = await this.db.listCollections({ name }).toArray();
    return cols.length > 0;
  }

  async ensureCollections() {
    if (!(await this.collectionExists('feedSubscriptions'))) {
      await this.db.createCollection('feedSubscriptions');
    }
    if (!(await this.collectionExists('feedItems'))) {
      await this.db.createCollection('feedItems');
    }
  }

  async init() {
    await this.ensureCollections();
    await this.subs.createIndex({ phone: 1, channelId: 1 }, { unique: true });
    await this.items.createIndex({ channelId: 1, published: 1 });
  }

  start() {

    this.checkFeeds();
    setInterval(() => this.checkFeeds(), CONFIG.feeds.checkInterval);
  }

  async extractChannelId(url) {
    try {
      console.error(`❌ entrou 8 `);
      const info = await this.ytdlp.getVideoInfo(url);
      return info.channel_id || info.uploader_id || null;
    } catch (err) {
      console.error('FeedMonitor: erro ao obter channel_id');
      return this.parseChannelIdFromUrl(url);
    }
  }

  parseChannelIdFromUrl(url) {
    console.error(`❌ entrou 9 `);
    try {
      const u = new URL(url);
      const channelMatch = u.pathname.match(/\/channel\/([\w-]+)/);
      if (channelMatch) return channelMatch[1];
      return null;
    } catch {
      return null;
    }
  }

  normalizeChannelUrl(channelId) {
    console.error(`❌ entrou 10  `);
    return `https://www.youtube.com/channel/${channelId}`;
  }

  async addSubscription(contactId, link) {
    console.error(`❌ entrou 11  `);
    const phone = contactId.replace(/\D/g, '');
    const channelId = await this.extractChannelId(link);
    if (!channelId) throw new Error('Channel ID não encontrado');
    await this.subs.updateOne(
      { phone, channelId },
      {
        $setOnInsert: {
          phone,
          channelId,
          addedAt: new Date(),
          lastChecked: new Date(0),
          queueKey: null
        }
      },
      { upsert: true }
    );
    return channelId;
  }

  async listSubscriptions(contactId) {
    console.error(`❌ entrou 12  `);
    const phone = contactId.replace(/\D/g, '');
    const subs = await this.subs.find({ phone }).toArray();
    return subs.map(s => s.channelId);
  }

  async removeSubscription(contactId, channelId) {
    console.error(`❌ entrou 13  `);
    const phone = contactId.replace(/\D/g, '');
    const res = await this.subs.deleteOne({ phone, channelId });
    return res.deletedCount > 0;
  }

  async checkFeeds() {
    console.error(`❌ entrou 14  `);
    const threshold = new Date(Date.now() - 60 * 60 * 1000);
    const subs = await this.subs.find({
      $or: [{ lastChecked: null }, { lastChecked: { $lte: threshold } }]
    }).toArray();
    for (const sub of subs) {
      console.error(`❌ entrou 15  `);
      await this.processSubscription(sub);
    }
  }

  parseFeed(xml) {
    console.error(`❌ entrou 16  `);
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = entryRegex.exec(xml))) {
      const entry = m[1];
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/);
      if (idMatch) {
        entries.push({ videoId: idMatch[1], published: pubMatch ? pubMatch[1] : null });
      }
    }
    return entries;
  }

  async processSubscription(sub) {
    console.error(`❌ entrou 17 `);
    const now = new Date();
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${sub.channelId}`;
    try {
      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const entries = this.parseFeed(xml);
      for (const { videoId, published } of entries) {
        const exists = await this.items.findOne({ _id: videoId });
        if (!exists) {
          await this.items.insertOne({
            _id: videoId,
            channelId: sub.channelId,
            published: published ? new Date(published) : now,
            summaryStatus: 'pending'
          });
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          this.queue.add(() => this.summarizeAndSend(videoUrl, sub.phone, videoId));
        }
      }
      await this.subs.updateOne({ _id: sub._id }, { $set: { lastChecked: now } });
    } catch (err) {
      console.error('FeedMonitor: erro ao processar feed');
    }
  }

  async summarizeAndSend(videoUrl, phone, videoId) {
    console.error(`❌ entrou 18  `);
    try {
      const { transcription } = await this.videoProcessor.transcribeVideo(videoUrl);
      const text = transcription.slice(0, 8000);
      const summary = await this.llmService.getVideoSummary(phone, text);
      await this.bot.getClient().sendMessage(
        Utils.formatRecipientId(phone),
        `📺 Novo vídeo resumido:\n${summary}`
      );
      await this.items.deleteOne({ _id: videoId });
    } catch (err) {
      console.error('FeedMonitor: erro ao resumir video');
      await this.items.updateOne({ _id: videoId }, { $set: { summaryStatus: 'failed' } });
    }
  }
}
