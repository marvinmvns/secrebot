import fs from 'fs';
import path from 'path';
import { config, applyConfig } from '../config/config.js';

const EXPORT_PATH = path.resolve('mongo-config.json');

export function exportMongoConfig(filePath = EXPORT_PATH) {
  const mongoConfig = config.mongo;
  fs.writeFileSync(filePath, JSON.stringify(mongoConfig, null, 2), 'utf-8');
  return filePath;
}

export function importMongoConfig(filePath = EXPORT_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo de configuração não encontrado: ' + filePath);
  }
  const mongoConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  applyConfig({ mongo: mongoConfig });
  return mongoConfig;
} 