import { MongoClient } from 'mongodb';
import { CONFIG } from '../src/config/index.js';

async function ensureCollection(db, name) {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) {
    await db.createCollection(name);
  }
  return db.collection(name);
}

async function main() {
  const client = new MongoClient(CONFIG.mongo.uri);
  await client.connect();
  const db = client.db(CONFIG.mongo.dbName);

  const configCol = db.collection('config');
  if (!(await configCol.findOne({ _id: 'app' }))) {
    await configCol.insertOne({ _id: 'app', values: CONFIG });
  }

  const sched = await ensureCollection(db, CONFIG.mongo.collectionName);
  await sched.createIndex({ recipient: 1, status: 1 });
  await sched.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });

  const subs = await ensureCollection(db, 'feedSubscriptions');
  const items = await ensureCollection(db, 'feedItems');
  await subs.createIndex({ phone: 1, channelId: 1 }, { unique: true });
  await items.createIndex({ channelId: 1, published: 1 });

  console.log('Database initialized');
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
