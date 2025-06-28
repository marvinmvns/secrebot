import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs/promises';
import path from 'path';
import { Ollama } from 'ollama';
import si from 'systeminformation';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

async function parsePdfBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}
import mammoth from 'mammoth';

import Utils from '../utils/index.js';
import {
  CONFIG,
  COMMANDS,
  NUMERIC_SHORTCUTS,
  CHAT_MODES,
  MENU_MESSAGE,
  MODE_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  PROMPTS,
  __dirname
} from '../config/index.js';
const ollamaClient = new Ollama({ host: CONFIG.llm.host });

// Importar o serviço TTS
import TtsService from '../services/ttsService.js';
import CalorieService from '../services/calorieService.js';
import { loginAndGetLiAt } from '../services/linkedinScraper.js';
import YouTubeService from '../services/youtubeService.js';

// ============ Bot do WhatsApp ============
class WhatsAppBot {
  // CORREÇÃO: Adicionar ttsService ao construtor e atribuí-lo
  constructor(scheduler, llmService, transcriber, ttsService) {
    this.scheduler = scheduler;
    this.llmService = llmService;
    this.transcriber = transcriber;
    this.ttsService = ttsService; // CORREÇÃO: Atribuir o serviço TTS
    this.chatModes = new Map();
    this.userPreferences = new Map(); // Para armazenar preferências (ex: { voiceResponse: true/false })
    this.linkedinSessions = new Map(); // contato -> li_at
    this.awaitingLinkedinCreds = new Map();
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
      // ffmpegPath: '/usr/bin/ffmpeg', // Descomentar se necessário para áudio opus
    });
    this.setupEvents();
  }

  getClient() {
    return this.client;
  }

  getScheduler() {
    return this.scheduler;
  }

  // --- Métodos de Preferência do Usuário ---
  getUserPreference(contactId, key, defaultValue = false) {
    const prefs = this.userPreferences.get(contactId) || {};
    return prefs[key] === undefined ? defaultValue : prefs[key];
  }

  setUserPreference(contactId, key, value) {
    const prefs = this.userPreferences.get(contactId) || {};
    prefs[key] = value;
    this.userPreferences.set(contactId, prefs);
    console.log(`🔧 Preferência [${key}=${value}] definida para ${contactId}`);
  }

  toggleVoicePreference(contactId) {
    const currentValue = this.getUserPreference(contactId, 'voiceResponse', false);
    this.setUserPreference(contactId, 'voiceResponse', !currentValue);
    return !currentValue; // Retorna o novo valor
  }
  // --- Fim Métodos de Preferência ---

  setupEvents() {
    this.client.on('qr', qr => {
      qrcode.generate(qr, { small: true });
      console.log('📱 QR Code gerado. Escaneie para login.');
    });

    this.client.on('ready', () => {
      console.log('✅ Cliente WhatsApp pronto!');
      this.startScheduler();
    });

    this.client.on('authenticated', () => console.log('🔐 WhatsApp autenticado.'));
    this.client.on('auth_failure', msg => {
      console.error('❌ Falha na autenticação:', msg);
      process.exit(1);
    });

    this.client.on('disconnected', reason => {
      console.error('🔌 WhatsApp desconectado:', reason);
      process.exit(1);
    });

    this.client.on('message', async msg => {
      try {
        // if (msg.isStatus || msg.from.includes('@g.us')) return; // Opcional: Ignorar status/grupos
        await this.handleMessage(msg);
      } catch (err) {
        console.error('❌ Erro ao processar mensagem:', err);
        if (this.client.info) {
            await this.sendResponse(msg.from, ERROR_MESSAGES.GENERIC);
        }
      }
    });
  }

  startScheduler() {
    this.scheduler.processScheduledMessages(this.client);
    setInterval(
      () => this.scheduler.processScheduledMessages(this.client),
      CONFIG.scheduler.interval
    );
    console.log(`⏰ Scheduler iniciado com intervalo de ${CONFIG.scheduler.interval / 1000}s.`);
  }

  async initialize() {
    try {
      await this.client.initialize();
    } catch (err) {
      console.error('❌ Erro na inicialização do WhatsApp:', err);
      throw err;
    }
  }

  isMainCommand(text) {
    const lower = text.toLowerCase();
    const commands = Object.values(COMMANDS).sort((a, b) => b.length - a.length);
    return commands.some(cmd => lower.startsWith(cmd));
  }

  getCurrentMode(contactId) {
    return this.chatModes.get(contactId) || null;
  }

  setMode(contactId, mode) {
    if (mode) {
      this.chatModes.set(contactId, mode);
      console.log(`🔧 Modo para ${contactId} definido para: ${mode}`);
    } else {
      const currentMode = this.chatModes.get(contactId);
      if (currentMode) {
          this.llmService.clearContext(contactId, currentMode);
          console.log(`🧹 Contexto LLM para modo ${currentMode} de ${contactId} limpo.`);
      }
      this.chatModes.delete(contactId);
      console.log(`🔧 Modo para ${contactId} removido.`);
    }
  }

  // Método unificado para enviar respostas (texto ou voz)
  async sendResponse(contactId, textContent, forceText = false) {
    const useVoice = this.getUserPreference(contactId, 'voiceResponse', false) && !forceText;

    // CORREÇÃO: A verificação 'this.ttsService' garante que o serviço foi injetado
    if (useVoice && this.ttsService && (this.ttsService.client || this.ttsService.piperEnabled)) { // Verifica também Piper
      try {
        console.log(`🗣️ Gerando resposta em áudio para ${contactId}...`);
        const audioBuffer = await this.ttsService.generateAudio(textContent);
        const audioBase64 = audioBuffer.toString('base64');
        // Tentar enviar como audio/ogg (opus) primeiro, pode ser mais compatível
        const media = new MessageMedia('audio/ogg; codecs=opus', audioBase64, 'response.ogg');
        await this.client.sendMessage(contactId, media, { sendAudioAsVoice: true });
        console.log(`✅ Áudio enviado para ${contactId}`);
      } catch (ttsError) {
        console.error(`❌ Erro ao gerar/enviar áudio TTS para ${contactId}:`, ttsError);
        // Fallback para texto se TTS falhar
        await this.client.sendMessage(contactId, ERROR_MESSAGES.TTS_FAILED); // Envia erro em texto
        await this.client.sendMessage(contactId, textContent); // Envia conteúdo original em texto
      }
    } else {
      // Enviar como texto se a preferência for texto, se TTS falhou na inicialização, ou se forçado
      await this.client.sendMessage(contactId, textContent);
    }
  }

  // Método para enviar mensagens de erro (usa sendResponse)
  async sendErrorMessage(contactId, message, forceText = false) {
      await this.sendResponse(contactId, message, forceText);
  }

  async handleMessage(msg) {
    const contactId = msg.from;
    const text = msg.body?.trim() || '';
    const lowerText = text.toLowerCase();

    console.log(`💬 Mensagem de ${contactId}: ${text || '[Mídia]'}`);

    if (this.awaitingLinkedinCreds.get(contactId)) {
      const [user, pass] = text.split(/[:\s]+/);
      try {
        const cookie = await loginAndGetLiAt(user, pass, CONFIG.linkedin.timeoutMs);
        if (cookie) {
          this.linkedinSessions.set(contactId, cookie);
          await this.sendResponse(contactId, '✅ Login do LinkedIn salvo!');
        } else {
          await this.sendResponse(contactId, '❌ Falha ao obter cookie li_at');
        }
      } catch (err) {
        await this.sendResponse(contactId, '❌ Erro no login: ' + err.message);
      }
      this.awaitingLinkedinCreds.delete(contactId);
      return;
    }

    if (Utils.isVoltarCommand(text)) {
      this.setMode(contactId, null);
      await this.sendResponse(contactId, MENU_MESSAGE);
      return;
    }

    const currentMode = this.getCurrentMode(contactId);

    if (!currentMode && NUMERIC_SHORTCUTS[text]) {
      const command = NUMERIC_SHORTCUTS[text];
      console.log(`🔢 Atalho numérico ${text} mapeado para ${command}`);
      await this.handleMessage({ ...msg, body: command });
      return;
    }

    if (this.isMainCommand(lowerText)) {
        await this.handleCommand(msg, contactId, lowerText, text);
        return;
    }

    if (msg.hasMedia) {
        if (msg.type === 'image') {
            await this.handleImageMessage(msg, contactId, lowerText);
            return;
        } else if (msg.type === 'audio' || msg.type === 'ptt') {
            await this.handleAudioMessage(msg, contactId);
            return;
        }
    }

    if (currentMode) {
        await this.processMessageByMode(contactId, text, msg);
        return;
    }

    console.log(`❓ Mensagem não reconhecida de ${contactId}, exibindo menu.`);
    await this.sendResponse(contactId, MENU_MESSAGE);
  }

  async handleCommand(msg, contactId, lowerText, originalText) {
      const commandHandlers = {
          [COMMANDS.MENU]: async () => {
              this.setMode(contactId, null);
              await this.sendResponse(contactId, MENU_MESSAGE);
          },
          [COMMANDS.AJUDA]: async () => {
              this.setMode(contactId, null);
              await this.sendResponse(contactId, MENU_MESSAGE);
          },
          [COMMANDS.DEEP]: () => this.handleDeepCommand(contactId, originalText),
          [COMMANDS.AGENDA]: () => this.handleAgendabotCommand(contactId, originalText),
          [COMMANDS.TRANSCREVER]: () => this.handleTranscreverCommand(contactId),
          [COMMANDS.LINKEDIN]: () => this.handleLinkedinCommand(contactId, originalText),
          [COMMANDS.LISTAR]: () => this.handleListarCommand(contactId),
          [COMMANDS.DELETAR]: () => this.handleDeletarCommand(contactId),
          [COMMANDS.VOZ]: () => this.handleVozCommand(contactId),
          [COMMANDS.RECURSO]: () => this.handleRecursoCommand(contactId),
          [COMMANDS.RESUMIR]: () => this.handleResumirCommand(msg, contactId),
          [COMMANDS.RESUMIRVIDEO]: () => this.handleResumirVideoCommand(msg, contactId),
          [COMMANDS.IMPORTAR_AGENDA]: () => this.handleImportarAgendaCommand(msg, contactId),
          [COMMANDS.FOTO]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.CALORIAS]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          }
      };

      const sortedHandlers = Object.entries(commandHandlers).sort((a, b) => b[0].length - a[0].length);
      for (const [command, handler] of sortedHandlers) {
          if (lowerText.startsWith(command)) {
              console.log(`⚙️ Executando comando ${command} para ${contactId}`);
              await handler();
              return;
          }
      }

      console.warn(`⚠️ Comando ${lowerText} não encontrado nos handlers.`);
      await this.sendResponse(contactId, MENU_MESSAGE);
  }

  async handleVozCommand(contactId) {
      const voiceEnabled = this.toggleVoicePreference(contactId);
      const message = voiceEnabled ? SUCCESS_MESSAGES.VOICE_ENABLED : SUCCESS_MESSAGES.VOICE_DISABLED;
      // Enviar confirmação sempre em texto para clareza
      await this.sendResponse(contactId, message, true);
  }

async handleRecursoCommand(contactId) {
  try {
    await this.sendResponse(contactId, '🔍 Coletando informações detalhadas do sistema...', true);
    
    // Coleta paralela de todas as informações
    const [
      cpu,
      cpuTemp,
      cpuSpeed,
      mem,
      osInfo,
      load,
      diskLayout,
      fsSize,
      networkInterfaces,
      networkStats,
      processes,
      graphics,
      system,
      time,
      dockerInfo,
      services
    ] = await Promise.all([
      si.cpu(),
      si.cpuTemperature().catch(() => ({ main: null })),
      si.cpuCurrentSpeed().catch(() => ({ avg: null })),
      si.mem(),
      si.osInfo(),
      si.currentLoad(),
      si.diskLayout(),
      si.fsSize(),
      si.networkInterfaces(),
      si.networkStats().catch(() => []),
      si.processes(),
      si.graphics().catch(() => ({ controllers: [] })),
      si.system(),
      si.time(),
      si.dockerInfo().catch(() => ({ containers: 0, containersRunning: 0 })),
      si.services('*').catch(() => [])
    ]);

    // Formatação de memória
    const formatBytes = (bytes) => {
      const gb = bytes / 1024 / 1024 / 1024;
      return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
    };

    // Formatação de uptime
    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}d ${hours}h ${minutes}m`;
    };

    // CPU detalhada
    const cpuInfo = [
      `🖥️ *CPU:* ${cpu.manufacturer} ${cpu.brand}`,
      `⚙️ *Arquitetura:* ${cpu.arch} | *Núcleos:* ${cpu.physicalCores} físicos, ${cpu.cores} lógicos`,
      `🔢 *Velocidade:* ${cpuSpeed.avg ? `${cpuSpeed.avg.toFixed(2)} GHz` : 'N/A'}`,
      cpuTemp.main ? `🌡️ *Temperatura:* ${cpuTemp.main.toFixed(1)}°C` : '',
      `📊 *Uso atual:* ${load.currentLoad.toFixed(1)}%`,
      `📈 *Carga média:* ${load.avgLoad ? load.avgLoad.toFixed(2) : 'N/A'}`
    ].filter(Boolean).join('\n');

    // Memória detalhada
    const memInfo = [
      `\n💾 *MEMÓRIA*`,
      `🧠 *RAM:* ${formatBytes(mem.used)} / ${formatBytes(mem.total)} (${((mem.used / mem.total) * 100).toFixed(1)}%)`,
      `📦 *Disponível:* ${formatBytes(mem.available)}`,
      `💱 *Swap:* ${formatBytes(mem.swapused)} / ${formatBytes(mem.swaptotal)}`,
      `🎯 *Cache:* ${formatBytes(mem.cached)}`,
      `🔄 *Buffer:* ${formatBytes(mem.buffers)}`
    ].join('\n');

    // Disco detalhado
    const diskInfo = [];
    diskInfo.push('\n💿 *ARMAZENAMENTO*');
    
    // Informações físicas dos discos
    diskLayout.forEach(disk => {
      if (disk.size > 0) {
        diskInfo.push(`📀 ${disk.name}: ${formatBytes(disk.size)} (${disk.type || 'Unknown'})`);
      }
    });

    // Uso do sistema de arquivos
    fsSize.forEach(fs => {
      if (fs.size > 0 && !fs.mount.includes('docker') && !fs.mount.includes('snap')) {
        const usePercent = ((fs.used / fs.size) * 100).toFixed(1);
        diskInfo.push(`  └ ${fs.fs}: ${formatBytes(fs.used)}/${formatBytes(fs.size)} (${usePercent}%) em ${fs.mount}`);
      }
    });

    // Rede detalhada
    const netInfo = ['\n🌐 *REDE*'];
    const activeInterfaces = networkInterfaces.filter(iface => 
      iface.ip4 && iface.operstate === 'up' && !iface.internal
    );
    
    activeInterfaces.forEach(iface => {
      netInfo.push(`🔌 ${iface.iface}: ${iface.ip4} (${iface.mac})`);
      const stats = networkStats.find(s => s.iface === iface.iface);
      if (stats) {
        netInfo.push(`  ↓ RX: ${formatBytes(stats.rx_bytes)} | ↑ TX: ${formatBytes(stats.tx_bytes)}`);
      }
    });

    // Sistema e processos
    const systemInfo = [
      `\n🖥️ *SISTEMA*`,
      `🏢 *Host:* ${system.manufacturer} ${system.model}`,
      `🔧 *OS:* ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
      `🏷️ *Kernel:* ${osInfo.kernel}`,
      `⏱️ *Uptime:* ${formatUptime(time.uptime)}`,
      `🚀 *Boot:* ${new Date(Date.now() - time.uptime * 1000).toLocaleString('pt-BR')}`
    ].join('\n');

    // Processos
    const processInfo = [
      `\n📊 *PROCESSOS*`,
      `🔢 *Total:* ${processes.all}`,
      `✅ *Rodando:* ${processes.running}`,
      `😴 *Dormindo:* ${processes.sleeping}`,
      `🛑 *Parados:* ${processes.stopped}`,
      `❌ *Zumbis:* ${processes.zombie}`
    ].join('\n');

    // GPU (se disponível)
    let gpuInfo = '';
    if (graphics.controllers && graphics.controllers.length > 0) {
      gpuInfo = '\n🎮 *GPU*\n';
      graphics.controllers.forEach((gpu, index) => {
        gpuInfo += `${index + 1}. ${gpu.vendor} ${gpu.model}`;
        if (gpu.vram) gpuInfo += ` (${gpu.vram} MB VRAM)`;
        gpuInfo += '\n';
      });
    }

    // Docker (se disponível)
    let dockerStr = '';
    if (dockerInfo.containers > 0) {
      dockerStr = `\n🐳 *Docker:* ${dockerInfo.containersRunning}/${dockerInfo.containers} containers rodando`;
    }

    // Serviços importantes
    const importantServices = ['mysql', 'postgresql', 'nginx', 'apache', 'redis', 'mongodb', 'docker'];
    const runningServices = services.filter(s => 
      importantServices.some(name => s.name.toLowerCase().includes(name)) && s.running
    );
    
    let servicesStr = '';
    if (runningServices.length > 0) {
      servicesStr = '\n🔧 *Serviços Ativos:* ' + runningServices.map(s => s.name).join(', ');
    }

    // Montagem da mensagem final
    const message = [
      '💻 *RECURSOS DETALHADOS DO SISTEMA*\n',
      cpuInfo,
      memInfo,
      diskInfo.join('\n'),
      netInfo.join('\n'),
      systemInfo,
      processInfo,
      gpuInfo,
      dockerStr,
      servicesStr,
      `\n⏰ *Atualizado em:* ${new Date().toLocaleString('pt-BR')}`
    ].filter(Boolean).join('\n');

    await this.sendResponse(contactId, message);
    
  } catch (err) {
    console.error('❌ Erro ao obter recursos detalhados do sistema:', err);
    await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
  }
}

  async handleResumirCommand(msg, contactId) {
      const text = msg.body.substring(COMMANDS.RESUMIR.length).trim();
      
      if (msg.hasMedia || text) {
          await this.sendResponse(contactId, '⚠️ *Comando !resumir ativado!*\n\nPara usar o comando !resumir, envie apenas `!resumir` primeiro.\nEm seguida, envie o documento ou texto que deseja resumir.\n\n🔙 Para voltar ao menu: !voltar');
          return;
      }
      
      this.setMode(contactId, CHAT_MODES.RESUMIR);
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.RESUMIR]);
  }

  async performResumir(msg, contactId, providedText = '') {
      let textContent = '';
      let fileType = '';

      if (msg && msg.hasMedia) {
          await this.sendResponse(contactId, '⏳ *Processando arquivo...*', true);
          
          const media = await Utils.downloadMediaWithRetry(msg);
          if (!media) {
              await this.sendErrorMessage(contactId, '❌ Não foi possível baixar o arquivo. Tente novamente.');
              return;
          }
          
          const buffer = Buffer.from(media.data, 'base64');
          const filename = msg.filename ? msg.filename.toLowerCase() : '';
          const type = msg.mimetype;
          
          // Debug info
          console.log(`🔍 Debug arquivo - Contato: ${contactId}`);
          console.log(`📁 Filename: ${msg.filename}`);
          console.log(`📁 Filename lowercase: ${filename}`);
          console.log(`🏷️ MIME type: ${type}`);
          console.log(`📏 Buffer size: ${buffer.length} bytes`);
          
          try {
              // Função para detectar PDF por magic bytes
              const detectPdfByHeader = (buffer) => {
                  if (buffer.length < 4) return false;
                  const header = buffer.subarray(0, 4).toString('ascii');
                  return header === '%PDF';
              };
              
              // Função para detectar DOCX por magic bytes (ZIP signature)
              const detectDocxByHeader = (buffer) => {
                  if (buffer.length < 4) return false;
                  const header = buffer.subarray(0, 4);
                  return header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
              };
              
              // Detectar tipo de arquivo por múltiplos métodos
              const isPdf = filename.endsWith('.pdf') || 
                           type === 'application/pdf' || 
                           (type === 'application/octet-stream' && detectPdfByHeader(buffer)) ||
                           detectPdfByHeader(buffer);
                           
              const isTxt = filename.endsWith('.txt') || type === 'text/plain';
              const isCsv = filename.endsWith('.csv') || type === 'text/csv' || type === 'application/csv';
              const isDocx = filename.endsWith('.docx') || 
                            type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                            (type === 'application/octet-stream' && detectDocxByHeader(buffer) && filename.includes('docx'));
              
              console.log(`🔍 Detecção de tipo:`);
              console.log(`📄 isPdf: ${isPdf} (magic: ${detectPdfByHeader(buffer)})`);
              console.log(`📄 isTxt: ${isTxt}`);
              console.log(`📄 isCsv: ${isCsv}`);
              console.log(`📄 isDocx: ${isDocx} (magic: ${detectDocxByHeader(buffer)})`);
              
              if (isPdf) {
                  fileType = 'PDF';
                  await this.sendResponse(contactId, '📑 Extraindo texto do PDF...', true);
                  textContent = await parsePdfBuffer(buffer);
              } else if (isTxt) {
                  fileType = 'TXT';
                  await this.sendResponse(contactId, '📄 Lendo arquivo de texto...', true);
                  textContent = buffer.toString('utf8');
              } else if (isCsv) {
                  fileType = 'CSV';
                  await this.sendResponse(contactId, '📊 Processando arquivo CSV...', true);
                  textContent = buffer.toString('utf8');
              } else if (isDocx) {
                  fileType = 'DOCX';
                  await this.sendResponse(contactId, '📄 Extraindo texto do Word...', true);
                  const result = await mammoth.extractRawText({ buffer });
                  textContent = result.value;
              } else {
                  console.log(`❌ Tipo de arquivo não reconhecido`);
                  await this.sendResponse(contactId, `❌ *Tipo de arquivo não suportado*\n\n📎 **Arquivo recebido:**\n• Nome: ${msg.filename || 'sem nome'}\n• Tipo: ${type || 'desconhecido'}\n• Tamanho: ${buffer.length} bytes\n\n📎 **Formatos aceitos:**\n• PDF (.pdf)\n• Word (.docx)\n• Texto (.txt)\n• CSV (.csv)\n\n🔄 Envie um arquivo válido ou !voltar para cancelar`);
                  return;
              }
          } catch (err) {
              console.error(`❌ Erro ao ler arquivo ${fileType} para ${contactId}:`, err);
              await this.sendErrorMessage(contactId, `❌ Erro ao processar arquivo ${fileType}. Verifique se o arquivo não está corrompido e tente novamente.`);
              return;
          }
      } else if (providedText) {
          textContent = providedText;
          fileType = 'texto fornecido';
      } else if (msg && msg.body) {
          textContent = msg.body.trim();
          fileType = 'mensagem de texto';
      }

      if (!textContent || textContent.trim().length === 0) {
          await this.sendResponse(contactId, '❌ *Conteúdo vazio detectado*\n\nO arquivo ou texto não contém informações para resumir.\n\n🔄 Envie outro documento ou !voltar para cancelar');
          return;
      }

      const originalLength = textContent.length;
      const text = textContent.trim().slice(0, 8000);
      const truncated = originalLength > 8000;

      try {
          let statusMsg = `📝 *Gerando resumo...*\n\n📊 Caracteres: ${originalLength.toLocaleString()}`;
          if (fileType) {
              statusMsg += `\n📎 Fonte: ${fileType}`;
          }
          if (truncated) {
              statusMsg += `\n⚠️ Texto truncado para 8.000 caracteres`;
          }
          
          await this.sendResponse(contactId, statusMsg, true);
          
          const summary = await this.llmService.getAssistantResponse(contactId, `Resuma em português o texto a seguir de forma clara e concisa:\n\n${text}`);
          
          let finalResponse = `✅ *Resumo Concluído*\n\n${summary}`;
          
          if (truncated) {
              finalResponse += `\n\n⚠️ *Nota:* Devido ao tamanho do documento, apenas os primeiros 8.000 caracteres foram resumidos.`;
          }
          
          finalResponse += `\n\n🔙 Para voltar ao menu: !voltar`;
          
          await this.sendResponse(contactId, finalResponse);
          
      } catch (err) {
          console.error(`❌ Erro ao gerar resumo para ${contactId}:`, err);
          await this.sendErrorMessage(contactId, '❌ Erro ao gerar o resumo. Tente novamente em alguns instantes.');
      }
  }

  async handleResumirVideoCommand(msg, contactId) {
      const link = msg.body.substring(COMMANDS.RESUMIRVIDEO.length).trim();
      if (!link) {
          await this.sendResponse(contactId, '📺 Por favor, envie o link do vídeo do YouTube que deseja transcrever.');
          return;
      }
      try {
          await this.sendResponse(contactId, '⏳ Transcrevendo vídeo...', true);
          const transcript = await YouTubeService.fetchTranscript(link);
          await this.sendResponse(contactId, `📝 *Transcrição:*\n\n${transcript}`);

          const summaryPrompt =
            `Resuma em português o texto a seguir em tópicos e em até 30 linhas:\n\n${transcript}`;
          const summary = await this.llmService.getAssistantResponse(
            contactId,
            summaryPrompt
          );
          await this.sendResponse(contactId, `📑 *Resumo:*\n\n${summary}`);
      } catch (err) {
          console.error(`❌ Erro ao transcrever vídeo para ${contactId}:`, err);
          await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
      }
  }

  async handleImageMessage(msg, contactId, lowerText) {
    console.log(`🖼️ Recebida imagem de ${contactId}`);
    let media = await Utils.downloadMediaWithRetry(msg);
    if (!media) {
      await this.sendErrorMessage(contactId, '❌ Não foi possível baixar a imagem.');
      return;
    }
    const buffer = Buffer.from(media.data, 'base64');
    const timestamp = Date.now();
    const imagePath = path.join(__dirname, `image_${timestamp}.jpg`);
    try {
      await fs.writeFile(imagePath, buffer);
      console.log(`💾 Imagem salva temporariamente em ${imagePath}`);
      let prompt;
      let processingMessage;
      let mode;
      if (lowerText.startsWith(COMMANDS.FOTO)) {
        prompt = PROMPTS.imageDescription;
        processingMessage = '📸 Descrevendo imagem...';
        mode = 'description';
      } else if (lowerText.startsWith(COMMANDS.CALORIAS)) {
        prompt = PROMPTS.calorieEstimation;
        processingMessage = '🍎 Calculando calorias...';
        mode = 'calories';
      } else {
        prompt = PROMPTS.imageDescription;
        processingMessage = '🔍 Analisando imagem...';
        mode = 'description';
      }
      await this.sendResponse(contactId, processingMessage, true); // Status sempre em texto
      const response = await ollamaClient.generate({
        model: CONFIG.llm.imageModel,
        prompt: prompt,
        images: [imagePath],
        stream: false
      });
      const description = response.response.trim();
      console.log(`🤖 Resposta da análise de imagem (${mode}): ${description.substring(0, 100)}...`);

      if (mode === 'calories') {
        let foods = [];
        try {
          const jsonText = Utils.extractJSON(description);
          const obj = JSON.parse(jsonText);
          foods = Array.isArray(obj.foods) ? obj.foods : [];
        } catch (e) {
          console.error('❌ Erro ao analisar JSON de alimentos:', e);
        }

        if (!foods.length) {
          await this.sendResponse(contactId, description);
        } else {
          const results = [];
          for (const food of foods) {
            const cal = await CalorieService.getCalories(food);
            if (cal) {
              results.push(`🍽️ ${food}: ${cal} kcal`);
            } else {
              results.push(`🍽️ ${food}: N/A`);
            }
          }
          const finalText = results.join('\n');
          await this.sendResponse(contactId, finalText);
        }
      } else {
        await this.sendResponse(contactId, description);
      }
    } catch (err) {
        console.error(`❌ Erro ao processar imagem de ${contactId}:`, err);
        await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
    } finally {
      await Utils.cleanupFile(imagePath);
      console.log(`🗑️ Arquivo de imagem temporário ${imagePath} removido.`);
    }
  }

  async handleDeepCommand(contactId, text) {
    this.setMode(contactId, CHAT_MODES.ASSISTANT);
    const query = text.substring(COMMANDS.DEEP.length).trim();
    if (!query) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.ASSISTANT]);
      return;
    }
    await this.sendResponse(contactId, '🤔 Pensando...', true); // Status sempre em texto
    const response = await this.llmService.getAssistantResponse(contactId, query);
    await this.sendResponse(contactId, response);
  }

  async handleAgendabotCommand(contactId, text) {
    this.setMode(contactId, CHAT_MODES.AGENDABOT);
    const query = text.substring(COMMANDS.AGENDA.length).trim();
    if (!query) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.AGENDABOT]);
      return;
    }
    await this.processAgendabotMessage(contactId, query);
  }

  async handleTranscreverCommand(contactId) {
    this.setMode(contactId, CHAT_MODES.TRANSCRICAO);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.TRANSCRICAO]);
  }

  async handleLinkedinCommand(contactId, text) {
    const arg = text.substring(COMMANDS.LINKEDIN.length).trim();
    if (arg.toLowerCase() === 'login') {
      this.awaitingLinkedinCreds.set(contactId, true);
      await this.sendResponse(contactId, '🔑 Envie usuario e senha separados por ":"');
      return;
    }
    if (!arg) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.LINKEDIN]);
      return;
    }
    const liAt = this.linkedinSessions.get(contactId) || CONFIG.linkedin.liAt;
    if (!liAt) {
      this.awaitingLinkedinCreds.set(contactId, true);
      await this.sendResponse(contactId, '🔑 Nenhum login encontrado. Envie usuario e senha separados por ":"');
      return;
    }
    await this.sendResponse(contactId, '💼 Analisando perfil...', true);
    const response = await this.llmService.getAssistantResponseLinkedin(contactId, arg, liAt);
    await this.sendResponse(contactId, response);
  }

  async handleListarCommand(contactId) {
    await this.sendResponse(contactId, '📋 Buscando agendamentos...', true); // Status sempre em texto
    const listMessage = await this.scheduler.listSchedules(contactId);
    await this.sendResponse(contactId, listMessage);
  }

  async handleDeletarCommand(contactId) {
    this.setMode(contactId, CHAT_MODES.DELETAR);
    await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.DELETAR], true); // Status sempre em texto
    const result = await this.scheduler.listSchedulesForDeletion(contactId);
    await this.sendResponse(contactId, result.message);
    if (!result.schedules || result.schedules.length === 0) {
        this.setMode(contactId, null);
    }
  }

  async handleAudioMessage(msg, contactId) {
    console.log(`🎤 Recebido áudio de ${contactId}`);
    const media = await msg.downloadMedia();
    if (!media) {
      await this.sendErrorMessage(contactId, '❌ Desculpe, não consegui baixar seu áudio.');
      return;
    }
    const currentMode = this.getCurrentMode(contactId);
    try {
      await this.sendResponse(contactId, '🎤 Transcrevendo áudio...', true);
      const transcription = await this.transcriber.transcribe(
        Buffer.from(media.data, 'base64')
      );
      console.log(`📝 Transcrição para ${contactId}: ${transcription}`);
      if (currentMode === CHAT_MODES.TRANSCRICAO) {
        await this.sendResponse(contactId, `📝 *Transcrição:*\n\n${transcription}`);
        await this.sendResponse(contactId, SUCCESS_MESSAGES.TRANSCRIPTION_COMPLETE);
      } else if (currentMode) {
        await this.processMessageByMode(contactId, transcription, msg);
      } else {
        console.log(`🎤 Áudio recebido no menu. Mapeando transcrição "${transcription}" para comando...`);
        await this.sendResponse(contactId, '🤔 Interpretando comando de áudio...', true);
        const commandPrompt = PROMPTS.audioCommandMapping(transcription);
        const response = await ollamaClient.chat({
            model: CONFIG.llm.model,
            messages: [{ role: 'user', content: commandPrompt }],
            options: { temperature: 0.2 }
        });
        const mappedCommand = response.message.content.trim();
        console.log(`🤖 LLM mapeou áudio para: ${mappedCommand}`);
        if (mappedCommand !== 'INVALIDO' && Object.values(COMMANDS).includes(mappedCommand)) {
            await this.sendResponse(contactId, `Comando de áudio entendido como: ${mappedCommand}`, true);
            await this.handleMessage({ ...msg, body: mappedCommand });
        } else {
            await this.sendResponse(contactId, `😕 Desculpe, não entendi o comando de áudio "${transcription}". Mostrando o menu novamente.`);
            await this.sendResponse(contactId, MENU_MESSAGE);
        }
      }
    } catch (err) {
      console.error(`❌ Erro no processamento de áudio para ${contactId}:`, err);
      await this.sendErrorMessage(contactId, `❌ Erro ao processar áudio: ${err.message || 'Tente novamente.'}`);
    }
  }

  async processMessageByMode(contactId, text, msg) {
    const currentMode = this.getCurrentMode(contactId);
    console.log(`🔄 Processando mensagem no modo ${currentMode} para ${contactId}`);
    if (!currentMode) {
      await this.sendResponse(contactId, MENU_MESSAGE);
      return;
    }
    switch (currentMode) {
      case CHAT_MODES.ASSISTANT:
        await this.sendResponse(contactId, '🤔 Pensando...', true);
        const assistantResponse = await this.llmService.getAssistantResponse(contactId, text);
        await this.sendResponse(contactId, assistantResponse);
        break;
      case CHAT_MODES.TRANSCRICAO:
        await this.sendResponse(contactId, ERROR_MESSAGES.AUDIO_REQUIRED);
        break;
      case CHAT_MODES.LINKEDIN:
        const liAtCookie = this.linkedinSessions.get(contactId) || CONFIG.linkedin.liAt;
        if (!liAtCookie) {
          this.awaitingLinkedinCreds.set(contactId, true);
          await this.sendResponse(contactId, '🔑 Nenhum login encontrado. Envie usuario e senha separados por ":"');
          break;
        }
        await this.sendResponse(contactId, '💼 Analisando perfil...', true);
        const linkedinResponse = await this.llmService.getAssistantResponseLinkedin(contactId, `Analisar perfil: ${text}`, liAtCookie);
        await this.sendResponse(contactId, linkedinResponse);
        this.setMode(contactId, null);
        break;
      case CHAT_MODES.DELETAR:
        await this.processDeletarMessage(contactId, text);
        break;
      case CHAT_MODES.AGENDABOT:
        await this.processAgendabotMessage(contactId, text);
        break;
      case CHAT_MODES.RESUMIR:
        if (!msg.hasMedia && !text.trim()) {
          await this.sendResponse(contactId, '📝 *Aguardando documento ou texto...*\n\nPor favor, envie:\n• Um arquivo (PDF, DOCX, TXT, CSV)\n• Ou digite/cole o texto na mensagem\n\n🔙 Para cancelar: !voltar');
          return;
        }
        await this.performResumir(msg, contactId, text);
        this.setMode(contactId, null);
        break;
      default:
          console.warn(`⚠️ Modo desconhecido encontrado: ${currentMode}`);
          this.setMode(contactId, null);
          await this.sendResponse(contactId, MENU_MESSAGE);
          break;
    }
  }

  async processDeletarMessage(contactId, text) {
    const result = await this.scheduler.deleteSchedule(contactId, text.trim());
    await this.sendResponse(contactId, result);
    if (result.startsWith('✅') || result === ERROR_MESSAGES.INVALID_NUMBER) {
      this.setMode(contactId, null);
    }
  }

  async processAgendabotMessage(contactId, text) {
    try {
      await this.sendResponse(contactId, '📅 Processando agendamento...', true);
      const responseText = await this.llmService.getChatGPTResponse(contactId, text);
      try {
        const scheduleDataRaw = JSON.parse(responseText);
        await this.createSchedule(contactId, scheduleDataRaw);
        await this.sendResponse(contactId, SUCCESS_MESSAGES.SCHEDULE_CREATED);
        this.llmService.clearContext(contactId, CHAT_MODES.AGENDABOT);
      } catch (parseError) {
        console.log('LLM não retornou JSON, enviando como texto.');
        await this.sendResponse(contactId, responseText);
      }
    } catch (err) {
      console.error(`❌ Erro ao processar mensagem Agendabot para ${contactId}:`, err);
      await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
    }
  }

  async createSchedule(contactId, scheduleDataRaw) {
    console.log('🔧 Criando agendamento com dados:', scheduleDataRaw);
    if (!scheduleDataRaw || typeof scheduleDataRaw !== 'object' || !scheduleDataRaw.message || !scheduleDataRaw.scheduledTime || !scheduleDataRaw.scheduledTime.$date) {
        throw new Error('Dados de agendamento inválidos recebidos do LLM.');
    }
    const scheduleData = {
        recipient: contactId.replace(/\D/g, ''),
        message: scheduleDataRaw.message,
        status: 'approved',
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null,
        scheduledTime: null,
        expiryTime: null
    };
    try {
        const scheduledUTC = new Date(scheduleDataRaw.scheduledTime.$date);
        if (isNaN(scheduledUTC.getTime())) {
            throw new Error('Formato de data inválido em scheduledTime.$date.');
        }
        console.log('🔧 Passo1:', scheduledUTC);
        scheduleData.scheduledTime = Utils.toLocalTime(scheduledUTC);
        console.log('🔧 Passo2:', scheduleData.scheduledTime);
        const expiryUTC = new Date(scheduledUTC);
        expiryUTC.setMonth(expiryUTC.getMonth() + 1);
        scheduleData.expiryTime = Utils.toLocalTime(expiryUTC);
    } catch (dateError) {
        console.error('Erro ao processar datas do agendamento:', dateError);
        throw new Error(`Erro ao processar data do agendamento: ${dateError.message}`);
    }
    const errors = this.validateScheduleData(scheduleData);
    if (errors.length) {
      throw new Error(`Erros nos dados do agendamento: ${errors.join('; ')}`);
    }
    if (!this.scheduler || !this.scheduler.schedCollection) {
      throw new Error('Serviço de agendamento não está pronto.');
    }
    await this.scheduler.insertSchedule(scheduleData);
    console.log(`✅ Agendamento criado para ${contactId} às ${scheduleData.scheduledTime}`);
  }

  validateScheduleData(data) {
    const errors = [];
    if (!data.recipient) errors.push('Destinatário (recipient) está vazio.');
    if (!data.message) errors.push('Mensagem (message) está vazia.');
    if (!data.scheduledTime || isNaN(data.scheduledTime.getTime())) errors.push('Data/Hora agendada (scheduledTime) é inválida.');
    if (!data.expiryTime || isNaN(data.expiryTime.getTime())) errors.push('Data de expiração (expiryTime) é inválida.');
    return errors;
  }

  async handleImportarAgendaCommand(msg, contactId) {
    if (!msg.hasMedia) {
      await this.sendResponse(contactId, '📎 Envie um arquivo .ics junto com o comando.');
      return;
    }
    const media = await Utils.downloadMediaWithRetry(msg);
    if (!media) {
      await this.sendResponse(contactId, ERROR_MESSAGES.GENERIC);
      return;
    }
    const buffer = Buffer.from(media.data, 'base64');
    try {
      const icsService = new (await import('../services/icsImportService.js')).default(this.scheduler);
      await icsService.importFromBuffer(buffer, contactId.replace(/\D/g, ''));
      await this.sendResponse(contactId, '✅ Eventos importados com sucesso!');
    } catch (err) {
      console.error('Erro ao importar agenda:', err);
      await this.sendResponse(contactId, ERROR_MESSAGES.GENERIC);
    }
  }
}

export default WhatsAppBot;

