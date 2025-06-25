import { CONFIG } from '../config/index.js';

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], val);
    } else {
      target[key] = val;
    }
  }
}

class ConfigService {
  constructor(db) {
    this.collection = db.collection('config');
  }

  async init() {
    let doc = await this.collection.findOne({ _id: 'app' });
    if (!doc) {
      const defaults = JSON.parse(JSON.stringify(CONFIG));
      await this.collection.insertOne({ _id: 'app', values: defaults });
      return defaults;
    }
    return doc.values;
  }

  async getConfig() {
    const doc = await this.collection.findOne({ _id: 'app' });
    return doc ? doc.values : null;
  }

  async setConfig(values) {
    await this.collection.updateOne({ _id: 'app' }, { $set: { values } }, { upsert: true });
  }

  applyToRuntime(values) {
    if (!values) return;
    deepMerge(CONFIG, values);
  }
}

export default ConfigService;
