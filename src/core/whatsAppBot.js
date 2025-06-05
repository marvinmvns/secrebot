import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs/promises';
import path from 'path';
import ollama from 'ollama';
import si from 'systeminformation';

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

// Importar o serviço TTS
import TtsService from '../services/ttsService.js';

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
    return Object.values(COMMANDS).some(cmd => lower.startsWith(cmd));
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
    if (useVoice && this.ttsService && this.ttsService.client) { // Adicionado check this.ttsService.client
      try {
        console.log(`🗣️ Gerando resposta em áudio para ${contactId}...`);
        const audioBuffer = await this.ttsService.generateAudio(textContent);
        const audioBase64 = audioBuffer.toString('base64');
        // Tentar enviar como audio/ogg primeiro, pode ser mais compatível
        const media = new MessageMedia('audio/ogg', audioBase64, 'response.ogg');
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
        await this.processMessageByMode(contactId, text);
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
          [COMMANDS.FOTO]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          },
          [COMMANDS.CALORIAS]: async () => {
              await this.sendResponse(contactId, ERROR_MESSAGES.IMAGE_REQUIRED);
          }
      };

      for (const [command, handler] of Object.entries(commandHandlers)) {
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
        await this.sendResponse(contactId, '🔍 Coletando informações do sistema...', true);
        const [cpu, mem, osInfo, load] = await Promise.all([
          si.cpu(),
          si.mem(),
          si.osInfo(),
          si.currentLoad(),
        ]);
        const totalMem = (mem.total / 1024 / 1024 / 1024).toFixed(1);
        const usedMem = ((mem.total - mem.available) / 1024 / 1024 / 1024).toFixed(1);
        const message = `💻 *Recursos do Sistema*\n\n🖥️ CPU: ${cpu.manufacturer} ${cpu.brand}\n⚙️ Núcleos: ${cpu.cores}\n📈 Uso CPU: ${load.currentLoad.toFixed(1)}%\n🧠 Memória: ${usedMem}/${totalMem} GB\n🛠️ OS: ${osInfo.distro} ${osInfo.release}`;
        await this.sendResponse(contactId, message);
      } catch (err) {
        console.error('❌ Erro ao obter recursos do sistema:', err);
        await this.sendErrorMessage(contactId, ERROR_MESSAGES.GENERIC);
      }
  }

  async handleImageMessage(msg, contactId, lowerText) {
    console.log(`🖼️ Recebida imagem de ${contactId}`);
    const media = await msg.downloadMedia();
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
      const response = await ollama.generate({
        model: CONFIG.llm.imageModel,
        prompt: prompt,
        images: [imagePath],
        stream: false
      });
      const description = response.response.trim();
      console.log(`🤖 Resposta da análise de imagem (${mode}): ${description.substring(0, 100)}...`);
      await this.sendResponse(contactId, description);
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
    const url = text.substring(COMMANDS.LINKEDIN.length).trim();
    if (!url) {
      await this.sendResponse(contactId, MODE_MESSAGES[CHAT_MODES.LINKEDIN]);
      return;
    }
    await this.sendResponse(contactId, '💼 Analisando perfil...', true);
    const response = await this.llmService.getAssistantResponseLinkedin(contactId, url);
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
        await this.processMessageByMode(contactId, transcription);
      } else {
        console.log(`🎤 Áudio recebido no menu. Mapeando transcrição "${transcription}" para comando...`);
        await this.sendResponse(contactId, '🤔 Interpretando comando de áudio...', true);
        const commandPrompt = PROMPTS.audioCommandMapping(transcription);
        const response = await ollama.chat({
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

  async processMessageByMode(contactId, text) {
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
        await this.sendResponse(contactId, '💼 Analisando perfil...', true);
        const linkedinResponse = await this.llmService.getAssistantResponseLinkedin(contactId, `Analisar perfil: ${text}`);
        await this.sendResponse(contactId, linkedinResponse);
        this.setMode(contactId, null);
        break;
      case CHAT_MODES.DELETAR:
        await this.processDeletarMessage(contactId, text);
        break;
      case CHAT_MODES.AGENDABOT:
        await this.processAgendabotMessage(contactId, text);
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
        scheduleData.scheduledTime = Utils.toGMTMinus3(scheduledUTC);
        console.log('🔧 Passo2:', scheduleData.scheduledTime);
        const expiryUTC = new Date(scheduledUTC);
        expiryUTC.setMonth(expiryUTC.getMonth() + 1);
        scheduleData.expiryTime = Utils.toGMTMinus3(expiryUTC);
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
}

export default WhatsAppBot;

