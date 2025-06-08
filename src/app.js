import Scheduler from './services/scheduler.js';
import LLMService from './services/llmService.js';
import AudioTranscriber from './services/audioTranscriber.js';
import TtsService from './services/ttsService.js'; // Importar o novo serviço TTS
import WhatsAppBot from './core/whatsAppBot.js';
import RestAPI from './api/restApi.js';
import ConfigService from './services/configService.js';
import { applyConfig } from './config/index.js';

let scheduler;

// ============ Inicialização ============
async function main() {
  try {
    console.log('🚀 Iniciando aplicação...');

    // Banner inicial
    console.log(`
╔═══════════════════════════════════════╗
║     🤖 WhatsApp Bot Assistant 🤖      ║
║         Versão 2.1 - Com Voz          ║
╚═══════════════════════════════════════╝
    `);

    // Inicializar serviços
    console.log('📦 Inicializando serviços...');
    scheduler = new Scheduler();
    await scheduler.connect(); // Conectar ao MongoDB

    const configService = new ConfigService(scheduler.db);
    const dbConfig = await configService.init();
    applyConfig(dbConfig);

    const llmService = new LLMService();
    const transcriber = new AudioTranscriber();
    const ttsService = new TtsService(); // Instanciar o serviço TTS

    // Inicializar bot, passando todos os serviços
    console.log('🤖 Inicializando WhatsApp Bot...');
    const bot = new WhatsAppBot(scheduler, llmService, transcriber, ttsService);
    await bot.initialize(); // Inicializar cliente WhatsApp

    // Inicializar API REST
    console.log('🌐 Inicializando API REST...');
    const api = new RestAPI(bot, configService); // Passar a instância do bot e configService para a API
    api.start(); // Iniciar servidor Express

    console.log('\n✅ Aplicação iniciada com sucesso!');
    console.log('📱 Escaneie o QR Code para conectar o WhatsApp (se necessário)');

  } catch (err) {
    console.error('❌ Erro fatal na inicialização:', err);
    process.exit(1); // Encerrar em caso de erro crítico na inicialização
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Tratamento de sinais do sistema para encerramento gracioso
const gracefulShutdown = async (signal) => {
  console.log(`\n👋 Recebido sinal ${signal}. Encerrando aplicação...`);
  if (scheduler) {
    await scheduler.disconnect();
  }
  console.log('🏁 Aplicação encerrada.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Comando kill

// Iniciar aplicação
main();
