import YTDlpWrapPkg from 'yt-dlp-wrap';
const { default: YTDlpWrap } = YTDlpWrapPkg;
import VideoProcessor from './video/VideoProcessor.js';
import JobQueue from './jobQueue.js';
import Utils from '../utils/index.js';
import { CONFIG } from '../config/index.js';

export default class FeedMonitor {
  constructor(db, bot, llmService) {
    this.subs = db.collection('feedSubscriptions');
    this.items = db.collection('feedItems');
    this.bot = bot;
    this.llmService = llmService;
    this.videoProcessor = bot.videoProcessor || new VideoProcessor({ transcriber: bot.transcriber });
    this.ytdlp = new YTDlpWrap();
    this.queue = new JobQueue(CONFIG.queues.whisperConcurrency, CONFIG.queues.memoryThresholdGB);
  }

  start() {
    this.checkFeeds();
    setInterval(() => this.checkFeeds(), 60 * 60 * 1000);
  }

  async extractChannelId(url) {
    try {
      const info = await this.ytdlp.getVideoInfo(url);
      return info.channel_id || info.uploader_id || null;
    } catch (err) {
      console.error('FeedMonitor: erro ao obter channel_id', err);
      return null;
    }
  }

  normalizeChannelUrl(channelId) {
    return `https://www.youtube.com/channel/${channelId}`;
  }

  async addSubscription(contactId, link) {
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

  async checkFeeds() {
    const threshold = new Date(Date.now() - 60 * 60 * 1000);
    const subs = await this.subs.find({
      $or: [{ lastChecked: null }, { lastChecked: { $lte: threshold } }]
    }).toArray();
    for (const sub of subs) {
      await this.processSubscription(sub);
    }
  }

  parseFeed(xml) {
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
      console.error('FeedMonitor: erro ao processar feed', err);
    }
  }

  async summarizeAndSend(videoUrl, phone, videoId) {
    try {
      const { transcription } = await this.videoProcessor.transcribeVideo(videoUrl);
      const text = transcription.slice(0, 8000);
      const summary = await this.llmService.getVideoSummary(phone, text);
      await this.bot.getClient().sendMessage(
        Utils.formatRecipientId(phone),
        `📺 Novo vídeo resumido:\n${summary}`
      );
      await this.items.updateOne({ _id: videoId }, { $set: { summaryStatus: 'done' } });
    } catch (err) {
      console.error('FeedMonitor: erro ao resumir video', err);
      await this.items.updateOne({ _id: videoId }, { $set: { summaryStatus: 'failed' } });
    }
  }
}
