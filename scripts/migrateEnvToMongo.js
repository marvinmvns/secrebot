import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { CONFIG, updateConfigFromEnv } from '../src/config/index.js';
import ConfigService from '../src/services/configService.js';

async function main() {
  dotenv.config();
  updateConfigFromEnv();

  const client = new MongoClient(CONFIG.mongo.uri);
  await client.connect();
  const db = client.db(CONFIG.mongo.dbName);
  const configService = new ConfigService(db);
  await configService.setConfig(CONFIG);
  console.log('Configuration migrated to MongoDB');
  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
