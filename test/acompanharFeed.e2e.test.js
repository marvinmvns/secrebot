import { test } from 'node:test';
import assert from 'node:assert/strict';
import FeedMonitor from '../src/services/feedMonitor.js';

class MemoryCollection {
  constructor() { this.docs = []; }
  async createIndex() {}
  async insertOne(doc) { this.docs.push({ ...doc }); }
  async findOne(query) {
    return this.docs.find(d => Object.entries(query).every(([k,v]) => d[k] === v));
  }
  find(query = {}) {
    const docs = this.docs.filter(d => {
      return Object.entries(query).every(([k,v]) => {
        if (k === '$or') {
          return v.some(cond => Object.entries(cond).every(([ck,cv]) => {
            if (cv && cv.$lte !== undefined) return d[ck] <= cv.$lte;
            return d[ck] === cv;
          }));
        }
        if (v && v.$lte !== undefined) return d[k] <= v.$lte;
        return d[k] === v;
      });
    });
    return { toArray: async () => docs };
  }
  async updateOne(query, update, opts = {}) {
    const doc = await this.findOne(query);
    if (doc) {
      if (update.$set) Object.assign(doc, update.$set);
    } else if (opts.upsert) {
      this.docs.push({ ...query, ...(update.$setOnInsert||{}), ...(update.$set||{}) });
    }
  }
  async deleteOne(query) {
    const i = this.docs.findIndex(d => Object.entries(query).every(([k,v]) => d[k] === v));
    if (i >= 0) { this.docs.splice(i,1); return { deletedCount:1 }; }
    return { deletedCount:0 };
  }
}

class MemoryDB {
  constructor() { this.store = new Map(); }
  collection(name) { if(!this.store.has(name)) this.store.set(name,new MemoryCollection()); return this.store.get(name); }
  listCollections(filter={}) { const names=[...this.store.keys()].filter(n=>!filter.name||n===filter.name); return { toArray: async () => names.map(name=>({name})) }; }
  async createCollection(name){ this.collection(name); }
}

test('!acompanharfeedresumido end to end', async () => {
  const db = new MemoryDB();
  const messages = [];
  const bot = {
    videoProcessor: { transcribeVideo: async () => ({ transcription: 'texto do video' }) },
    transcriber: {},
    getClient() { return { sendMessage: (id,msg) => messages.push(msg) }; }
  };
  const llm = { getVideoSummary: async () => 'resumo' };
  const feedXml = '<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><entry><yt:videoId>vid123</yt:videoId></entry></feed>';
  const fetchMock = async () => ({ ok: true, text: async () => feedXml });

  const monitor = new FeedMonitor(db, bot, llm, fetchMock);
  // execute queued tasks immediately
  monitor.queue.add = async (fn) => fn();
  await monitor.init();
  await monitor.addSubscription('559999', 'https://www.youtube.com/channel/CHAN');

  const sub = (await monitor.subs.find({}).toArray())[0];
  await monitor.processSubscription(sub);

  assert.equal(messages.length, 1);
  assert.ok(messages[0].includes('Novo vídeo resumido'));
});
