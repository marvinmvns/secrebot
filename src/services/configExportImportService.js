import fs from 'fs';
import path from 'path';
import { config, applyConfig } from '../config/config.js';
import ConfigService from './configService.js';

const EXPORT_PATH = path.resolve('config-export.json');

// Exporta todas as configurações (objeto values completo)
export async function exportFullConfig(filePath = EXPORT_PATH) {
  const configService = new ConfigService();
  const fullConfig = await configService.getConfig();
  fs.writeFileSync(filePath, JSON.stringify(fullConfig, null, 2), 'utf-8');
  return filePath;
}

// Importa todas as configurações (objeto values completo ou só mongo)
export async function importFullConfig(filePath = EXPORT_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Arquivo de configuração não encontrado: ' + filePath);
  }
  const imported = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const configService = new ConfigService();
  // Se for só o bloco mongo, importa só ele
  if (imported.mongo) {
    applyConfig({ mongo: imported.mongo });
    const current = await configService.getConfig();
    current.mongo = imported.mongo;
    await configService.setConfig(current);
    return { mongo: imported.mongo };
  }
  // Se for o objeto completo, importa tudo
  if (imported.values) {
    await configService.setConfig(imported.values);
    applyConfig(imported.values);
    return imported.values;
  }
  // Se for o objeto direto (sem values), importa tudo
  await configService.setConfig(imported);
  applyConfig(imported);
  return imported;
} 