import { Telegraf } from 'telegraf';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';
import { TELEGRAM_COMMANDS, TELEGRAM_MESSAGES } from '../constants/telegramCommands.js';
import { TelegramIntegrationService } from '../services/telegramIntegrationService.js';
import { CONFIG, WHISPER_MODELS_LIST } from '../config/index.js';
import si from 'systeminformation';
import TtsService from '../services/ttsService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TelegramBotService {
    constructor(llmService = null) {
        this.bot = null;
        this.isInitialized = false;
        this.userStates = new Map(); // Armazena estado de navegação por usuário
        this.userPreferences = new Map(); // Armazena preferências do usuário
        this.integrationService = null;
        this.llmService = llmService;
        this.ttsService = new TtsService();
        this.initPromise = this.init(); // Armazena a Promise de inicialização
    }

    async init() {
        try {
            if (!config.telegram?.botToken) {
                logger.warn('Telegram bot token não configurado. Bot do Telegram desabilitado.');
                this.isInitialized = false;
                return;
            }

            logger.info('Inicializando bot do Telegram...');
            
            this.bot = new Telegraf(config.telegram.botToken);
            this.integrationService = new TelegramIntegrationService(this.bot);

            this.setupEventHandlers();
            
            logger.info('Lançando bot do Telegram...');
            await this.bot.launch();
            
            this.isInitialized = true;
            logger.info('Bot do Telegram inicializado com sucesso');
            
        } catch (error) {
            this.isInitialized = false;
            logger.error('Erro ao inicializar bot do Telegram:', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                response: error.response?.description || 'N/A'
            });
            
            // Re-throw to propagate to ApplicationFactory
            throw new Error(`Inicialização do bot Telegram falhou: ${error.message}`);
        }
    }



    setupEventHandlers() {
        // Comando /start
        this.bot.command('start', (ctx) => {
            this.handleStart(ctx);
        });

        // Callback queries (botões inline)
        this.bot.on('callback_query', (ctx) => {
            this.handleCallbackQuery(ctx);
        });

        // Comando !transcreveresume
        this.bot.command('transcreveresume', (ctx) => {
            this.handleTranscreveresume(ctx);
        });

        // Mensagens de texto
        this.bot.on('text', (ctx) => {
            const text = ctx.message.text;
            if (text && text.startsWith('!transcreveresume')) {
                this.handleTranscreveresume(ctx);
            } else if (text && !text.startsWith('/')) {
                this.handleTextMessage(ctx);
            }
        });

        // Mensagens de áudio
        this.bot.on('voice', (ctx) => {
            this.handleVoiceMessage(ctx);
        });

        // Imagens
        this.bot.on('photo', (ctx) => {
            this.handlePhotoMessage(ctx);
        });

        // Documentos
        this.bot.on('document', (ctx) => {
            this.handleDocumentMessage(ctx);
        });

        // Tratamento de erros
        this.bot.catch((error) => {
            logger.error('Erro no bot do Telegram:', error);
        });
    }

    async handleStart(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        // Resetar estado do usuário
        this.userStates.delete(userId);
        
        const welcomeMessage = this.buildEnhancedWelcomeMessage();
        const mainMenu = await this.buildMainMenu(userId);
        
        await ctx.reply(welcomeMessage, {
            reply_markup: mainMenu,
            parse_mode: 'HTML'
        });
    }

    async handleTranscreveresume(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        try {

            // Definir estado do usuário para aguardar áudio
            this.userStates.set(userId, { 
                action: 'transcreveresume',
                chatId: chatId,
                step: 'waiting_audio'
            });

            await ctx.reply(
                '🎤📄 <b>Transcrever e Resumir Áudio</b>\n\n' +
                '🎯 Envie um áudio para transcrição automática e resumo inteligente!\n\n' +
                '✨ <b>Recursos:</b>\n' +
                '• 🎤 Transcrição precisa com Whisper\n' +
                '• 🧠 Resumo inteligente com IA\n' +
                '• 📱 Suporte a diversos formatos de áudio\n\n' +
                '🎵 <i>Aguardando seu áudio...</i>',
                { parse_mode: 'HTML' }
            );
        } catch (error) {
            logger.error('Erro no comando !transcreveresume:', error);
            await ctx.reply('Erro ao processar comando. Tente novamente.');
        }
    }

    async buildMainMenu(userId) {
        const features = {
            ai_chat: true,
            scheduler: true,
            audio_transcription: true,
            image_analysis: true,
            video_summary: true,
            text_summary: true,
            tts: true,
            calorie_counter: true,
            linkedin_analysis: true,
            media_processing: true,
            professional_analysis: true,
            system_resources: true,
            model_management: true,
            whisper_model_management: true,
            service_management: true,
            calendar_import: true,
            dual_video_summary: true,
            voice_response_toggle: true,
            advanced_file_processing: true
        };
        const keyboard = [];

        // Linha 1: IA e Agenda
        const row1 = [];
        if (features.ai_chat) {
            row1.push({ text: '🧠 IA & Chat', callback_data: 'menu_ai' });
        }
        if (features.scheduler) {
            row1.push({ text: '📅 Agenda', callback_data: 'menu_agenda' });
        }
        if (row1.length > 0) keyboard.push(row1);

        // Linha 2: Mídia e Análise
        const row2 = [];
        if (features.media_processing) {
            row2.push({ text: '🎬 Mídia', callback_data: 'menu_media' });
        }
        if (features.professional_analysis) {
            row2.push({ text: '💼 Análise', callback_data: 'menu_analysis' });
        }
        if (row2.length > 0) keyboard.push(row2);

        // Linha 3: Configurações e Ajuda
        const row3 = [];
        row3.push({ text: '⚙️ Configurações', callback_data: 'menu_config' });
        row3.push({ text: '❓ Ajuda', callback_data: 'help' });
        keyboard.push(row3);

        return {
            inline_keyboard: keyboard
        };
    }

    async buildSubMenu(menuType, userId) {
        const features = {
            ai_chat: true,
            scheduler: true,
            audio_transcription: true,
            image_analysis: true,
            video_summary: true,
            text_summary: true,
            tts: true,
            calorie_counter: true,
            linkedin_analysis: true,
            media_processing: true,
            professional_analysis: true,
            system_resources: true,
            model_management: true,
            whisper_model_management: true,
            service_management: true,
            calendar_import: true,
            dual_video_summary: true,
            voice_response_toggle: true,
            advanced_file_processing: true
        };
        const keyboard = [];

        switch (menuType) {
            case 'ai':
                if (features.ai_chat) {
                    keyboard.push([{ text: '💬 Chat Assistente', callback_data: 'action_chat' }]);
                }
                if (features.text_summary) {
                    keyboard.push([{ text: '📄 Resumir Texto', callback_data: 'action_summarize' }]);
                }
                if (features.image_analysis) {
                    keyboard.push([{ text: '🖼️ Analisar Imagem', callback_data: 'action_analyze_image' }]);
                }
                if (features.video_summary) {
                    if (features.dual_video_summary) {
                        keyboard.push([{ text: '🎥 Resumir Vídeo (Método 1)', callback_data: 'action_video_summary_1' }]);
                        keyboard.push([{ text: '🎬 Resumir Vídeo (Método 2)', callback_data: 'action_video_summary_2' }]);
                    } else {
                        keyboard.push([{ text: '🎥 Resumir Vídeo', callback_data: 'action_video_summary' }]);
                    }
                }
                break;

            case 'agenda':
                if (features.scheduler) {
                    keyboard.push([{ text: '➕ Agendamento Inteligente', callback_data: 'action_smart_scheduling' }]);
                    keyboard.push([{ text: '📋 Listar Lembretes', callback_data: 'action_list_reminders' }]);
                    keyboard.push([{ text: '🗑️ Deletar Lembrete', callback_data: 'action_delete_reminder' }]);
                    if (features.calendar_import) {
                        keyboard.push([{ text: '📅 Importar Agenda (ICS)', callback_data: 'action_import_ics' }]);
                    }
                    keyboard.push([{ text: '🔗 Google Calendar', callback_data: 'action_google_calendar' }]);
                }
                break;

            case 'media':
                if (features.audio_transcription) {
                    keyboard.push([{ text: '🎤 Transcrever Áudio', callback_data: 'action_transcribe' }]);
                    keyboard.push([{ text: '🎤📄 Transcrever e Resumir', callback_data: 'action_transcribe_summary' }]);
                }
                if (features.tts) {
                    keyboard.push([{ text: '🔊 Configurar Voz', callback_data: 'action_tts_config' }]);
                }
                if (features.calorie_counter) {
                    keyboard.push([{ text: '🍎 Calcular Calorias', callback_data: 'action_calories' }]);
                }
                break;

            case 'analysis':
                if (features.linkedin_analysis) {
                    keyboard.push([{ text: '🔗 Analisar LinkedIn', callback_data: 'action_linkedin' }]);
                }
                if (features.system_resources) {
                    keyboard.push([{ text: '📊 Recursos Sistema', callback_data: 'action_system_resources' }]);
                }
                break;

            case 'config':
                if (features.voice_response_toggle) {
                    keyboard.push([{ text: '🔊 Configurar Resposta Voz', callback_data: 'config_voice_response' }]);
                }
                keyboard.push([{ text: '🎤 Endpoints Whisper API', callback_data: 'config_whisper_endpoints' }]);
                keyboard.push([{ text: '🤖 Endpoints Ollama API', callback_data: 'config_ollama_endpoints' }]);
                keyboard.push([{ text: '📊 Status Todos Endpoints', callback_data: 'config_endpoints_status' }]);
                if (features.system_resources) {
                    keyboard.push([{ text: '⚡ Recursos Sistema', callback_data: 'config_system_resources' }]);
                }
                break;
        }

        // Botão voltar
        keyboard.push([{ text: '🔙 Voltar', callback_data: 'back_main' }]);

        return {
            inline_keyboard: keyboard
        };
    }

    async handleCallbackQuery(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const data = ctx.callbackQuery.data;

        try {
            await ctx.answerCbQuery();

            if (data.startsWith('menu_')) {
                const menuType = data.replace('menu_', '');
                const subMenu = await this.buildSubMenu(menuType, userId);
                const message = TELEGRAM_MESSAGES.menus[menuType] || `Menu ${menuType}:`;
                
                await ctx.editMessageText(message, {
                    chat_id: chatId,
                    message_id: ctx.callbackQuery.message.message_id,
                    reply_markup: subMenu,
                    parse_mode: 'HTML'
                });

            } else if (data.startsWith('action_')) {
                await this.handleAction(ctx, data);
                
            } else if (data.startsWith('config_')) {
                await this.handleConfigAction(ctx, data);
                
            } else if (data === 'back_main') {
                const mainMenu = await this.buildMainMenu(userId);
                
                await ctx.editMessageText(TELEGRAM_MESSAGES.welcome, {
                    chat_id: chatId,
                    message_id: ctx.callbackQuery.message.message_id,
                    reply_markup: mainMenu,
                    parse_mode: 'HTML'
                });
                
            } else if (data === 'help') {
                await this.bot.telegram.sendMessage(chatId, TELEGRAM_MESSAGES.help, {
                    parse_mode: 'HTML'
                });
            } else if (data === 'toggle_voice') {
                await this.toggleVoicePreference(chatId, userId);
            }

        } catch (error) {
            logger.error('Erro ao processar callback query:', error);
            await this.bot.telegram.sendMessage(chatId, 'Ocorreu um erro. Tente novamente.');
        }
    }

    async handleAction(ctx, action) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        
        // Definir estado do usuário
        this.userStates.set(userId, { 
            action: action.replace('action_', ''),
            chatId: chatId,
            step: 'waiting_input'
        });

        const actionMessages = {
            'chat': 'Envie sua mensagem e eu vou responder usando IA:',
            'summarize': 'Envie um texto ou arquivo para resumir:',
            'analyze_image': 'Envie uma imagem para análise:',
            'video_summary': 'Envie o link do vídeo do YouTube:',
            'create_reminder': 'Descreva o lembrete (ex: "Reunião amanhã às 14h"):',
            'transcribe': 'Envie um áudio para transcrever:',
            'transcribe_summary': 'Envie um áudio para transcrever e resumir:',
            'calories': 'Envie uma foto da comida para calcular calorias:',
            'linkedin': 'Envie o link do perfil do LinkedIn:',
            'tts_config': 'Configurando preferências de voz...',
            'smart_scheduling': 'Descreva o que deseja agendar (ex: "Reunião com cliente amanhã às 14h"):',
            'import_ics': 'Envie um arquivo .ics para importar eventos do calendário:',
            'google_calendar': 'Configurando integração com Google Calendar...'
        };

        const message = actionMessages[action.replace('action_', '')] || 'Aguardando entrada...';
        await this.bot.telegram.sendMessage(chatId, message);
    }

    async handleConfigAction(ctx, configAction) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;

        switch (configAction) {
            case 'config_whisper_endpoints':
                await this.showWhisperEndpoints(chatId);
                break;
            case 'config_ollama_endpoints':
                await this.showOllamaEndpoints(chatId);
                break;
            case 'config_endpoints_status':
                await this.showEndpointsStatus(chatId);
                break;
            case 'config_voice_response':
                await this.toggleVoicePreference(chatId, userId);
                break;
            case 'config_system_resources':
                await this.showSystemResources(chatId);
                break;
            case 'action_tts_config':
                await this.handleTTSConfig(chatId, userId);
                break;
            case 'action_system_resources':
                await this.showSystemResources(chatId);
                break;
            case 'action_import_ics':
                await this.handleICSImportAction(chatId, userId);
                break;
            case 'action_google_calendar':
                await this.integrationService.processGoogleCalendarIntegration(chatId, userId);
                break;
        }
    }

    async handleTextMessage(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const text = ctx.message.text;

        const userState = this.userStates.get(userId);
        if (!userState) {
            // Mensagem sem contexto - tratar como chat geral (AI chat sempre habilitado)
            await this.processAIChat(chatId, text, userId);
            return;
        }

        // Processar baseado no estado atual
        await this.processUserInput(chatId, userId, userState, text);
    }

    async handleVoiceMessage(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const userState = this.userStates.get(userId);
        
        // Transcrição de áudio sempre habilitada

        // Check if user is in transcribe_summary state
        if (userState?.action === 'transcribe_summary') {
            this.userStates.delete(userId); // Clear state after processing
            await this.integrationService.processVoiceTranscriptionSummary(chatId, ctx.message.voice);
        } else if (userState?.action === 'transcreveresume') {
            this.userStates.delete(userId); // Clear state after processing
            await this.integrationService.processVoiceTranscriptionSummary(chatId, ctx.message.voice);
        } else if (userState?.action === 'transcribe') {
            this.userStates.delete(userId); // Clear state after processing
            await this.integrationService.processVoiceTranscription(chatId, ctx.message.voice);
        } else {
            // Default behavior - just transcribe
            await this.integrationService.processVoiceTranscription(chatId, ctx.message.voice);
        }
    }

    async handlePhotoMessage(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const userState = this.userStates.get(userId);

        // Análise de imagem sempre habilitada
        
        if (userState?.action === 'analyze_image') {
            await this.integrationService.processImageAnalysis(chatId, ctx.message.photo);
        } else if (userState?.action === 'calories') {
            await this.integrationService.processCalorieCount(chatId, ctx.message.photo);
        } else {
            // Análise geral de imagem
            await this.integrationService.processImageAnalysis(chatId, ctx.message.photo);
        }
    }

    async handleDocumentMessage(ctx) {
        const chatId = ctx.chat.id;
        const userId = ctx.from.id;
        const userState = this.userStates.get(userId);

        if (userState?.action === 'summarize') {
            await this.integrationService.processDocumentSummary(chatId, ctx.message.document);
        } else if (userState?.action === 'import_ics') {
            this.userStates.delete(userId); // Clear state after processing
            await this.integrationService.processICSImport(chatId, ctx.message.document, userId);
        } else if (ctx.message.document.file_name?.toLowerCase().endsWith('.ics')) {
            // Auto-detect ICS files
            await this.integrationService.processICSImport(chatId, ctx.message.document, userId);
        } else {
            await this.bot.telegram.sendMessage(chatId, 'Envie um documento após selecionar uma ação ou use /start para ver o menu.');
        }
    }

    // Métodos de processamento (implementações específicas)
    async processAIChat(chatId, text, userId = null) {
        await this.integrationService.processAIChat(chatId, text, userId);
    }

    async processUserInput(chatId, userId, userState, input) {
        // Limpar estado após processamento
        this.userStates.delete(userId);
        
        switch (userState.action) {
            case 'chat':
                await this.integrationService.processAIChat(chatId, input, userId);
                break;
            case 'create_reminder':
                await this.integrationService.processSmartScheduling(chatId, input, userId);
                break;
            case 'video_summary':
                await this.integrationService.processVideoSummary(chatId, input);
                break;
            case 'linkedin':
                await this.integrationService.processLinkedInAnalysis(chatId, input);
                break;
            case 'summarize':
                // Para texto enviado diretamente
                await this.integrationService.processTextSummary(chatId, input);
                break;
            case 'tts_config':
                await this.handleTTSConfig(chatId, userId);
                break;
            case 'smart_scheduling':
                await this.integrationService.processSmartScheduling(chatId, input, userId);
                break;
            default:
                await this.bot.telegram.sendMessage(chatId, 'Ação não reconhecida.');
        }
    }

    // Métodos auxiliares de configuração
    // DEPRECATED: Função removida do menu config - use showOllamaEndpoints
    async showAIModels(chatId) {
        const message = '🤖 <b>Modelos de IA Disponíveis</b>\n\n📊 <i>Esta funcionalidade estará disponível em breve!</i>\n\nVocê poderá visualizar e selecionar diferentes modelos de IA para suas consultas.';
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    // DEPRECATED: Função removida do menu config - use showWhisperEndpoints
    async showWhisperModels(chatId) {
        const message = '🎤 <b>Modelos de Áudio Disponíveis</b>\n\n📊 <i>Esta funcionalidade estará disponível em breve!</i>\n\nVocê poderá escolher diferentes modelos para transcrição de áudio.';
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    async showFeatureToggles(chatId, userId) {
        let message = '🔧 <b>Funcionalidades Disponíveis:</b>\n\n';
        
        const features = [
            'AI CHAT',
            'SCHEDULER',
            'AUDIO TRANSCRIPTION',
            'IMAGE ANALYSIS',
            'VIDEO SUMMARY',
            'TEXT SUMMARY',
            'TTS',
            'CALORIE COUNTER',
            'LINKEDIN ANALYSIS',
            'MEDIA PROCESSING',
            'PROFESSIONAL ANALYSIS',
            'SYSTEM RESOURCES',
            'MODEL MANAGEMENT',
            'WHISPER MODEL MANAGEMENT',
            'SERVICE MANAGEMENT',
            'CALENDAR IMPORT',
            'DUAL VIDEO SUMMARY',
            'VOICE RESPONSE TOGGLE',
            'ADVANCED FILE PROCESSING'
        ];
        
        for (const feature of features) {
            message += `✅ ${feature}\n`;
        }

        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    async showSystemResources(chatId) {
        try {
            const message = '📊 <b>Monitor de Sistema</b>\n\n📊 <i>Carregando informações do sistema...</i>';
            await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
            // Implementar coleta de dados do sistema aqui
            const systemInfo = '💻 <b>Recursos do Sistema:</b>\n\n📊 <i>Funcionalidade em desenvolvimento</i>\n\nEm breve você poderá monitorar:\n• CPU e Memória\n• Espaço em disco\n• Status dos serviços';
            await this.bot.telegram.sendMessage(chatId, systemInfo, { parse_mode: 'HTML' });
        } catch (error) {
            logger.error('Erro ao mostrar recursos do sistema:', error);
            await this.bot.telegram.sendMessage(chatId, '⚠️ Erro ao carregar informações do sistema.');
        }
    }

    // Métodos de processamento específicos (placeholders)
    async processCreateReminder(chatId, text) {
        await this.bot.telegram.sendMessage(chatId, `📅 Lembrete criado: ${text}`);
    }

    async processVideoSummary(chatId, url) {
        await this.bot.telegram.sendMessage(chatId, `🎥 Processando vídeo: ${url}`);
    }

    async processLinkedInAnalysis(chatId, url) {
        await this.bot.telegram.sendMessage(chatId, `🔗 Analisando LinkedIn: ${url}`);
    }

    async processVoiceMessage(chatId, voice) {
        await this.bot.telegram.sendMessage(chatId, '🎤 Transcrevendo áudio...');
    }

    async processImageAnalysis(chatId, photos) {
        await this.bot.telegram.sendMessage(chatId, '🖼️ Analisando imagem...');
    }

    async processCalorieCount(chatId, photos) {
        await this.bot.telegram.sendMessage(chatId, '🍎 Calculando calorias...');
    }

    async processDocumentSummary(chatId, document) {
        await this.bot.telegram.sendMessage(chatId, '📄 Resumindo documento...');
    }

    // Método público para enviar mensagens (mantido para compatibilidade)
    async sendMessage(chatId, text, options = {}) {
        return await this.sendResponse(chatId, text, true); // Força texto para compatibilidade
    }

    // Método para aguardar inicialização
    async waitForInitialization() {
        await this.initPromise;
    }

    // Método para verificar se está ativo
    isActive() {
        return this.isInitialized && this.bot;
    }

    // --- Métodos de preferências do usuário ---
    getUserPreference(userId, key, defaultValue = false) {
        const prefs = this.userPreferences.get(userId) || {};
        return prefs[key] === undefined ? defaultValue : prefs[key];
    }

    setUserPreference(userId, key, value) {
        const prefs = this.userPreferences.get(userId) || {};
        prefs[key] = value;
        this.userPreferences.set(userId, prefs);
        logger.log(`🔧 Preferência [${key}=${value}] definida para usuário ${userId}`);
    }

    toggleVoicePreferenceForUser(userId) {
        const currentValue = this.getUserPreference(userId, 'voiceResponse', false);
        this.setUserPreference(userId, 'voiceResponse', !currentValue);
        return !currentValue; // Retorna o novo valor
    }

    // Método unificado para envio de respostas (texto ou voz)
    async sendResponse(chatId, textContent, forceText = false, userId = null) {
        if (!this.isInitialized) {
            logger.warn('Bot do Telegram não inicializado');
            return false;
        }

        const useVoice = userId && this.getUserPreference(userId, 'voiceResponse', false) && !forceText;

        // Verificação se serviço TTS foi configurado
        if (useVoice && this.ttsService && (this.ttsService.client || this.ttsService.piperEnabled)) {
            try {
                logger.service(`🗣️ Gerando resposta em áudio para chat ${chatId}...`);
                const audioBuffer = await this.ttsService.generateAudio(textContent);
                
                // Enviar como mensagem de voz
                await this.bot.telegram.sendVoice(chatId, {
                    source: audioBuffer,
                    filename: 'response.ogg'
                });
                
                logger.success(`✅ Áudio enviado para chat ${chatId}`);
                return true;
            } catch (ttsError) {
                logger.error(`❌ Erro ao gerar/enviar áudio TTS para chat ${chatId}`, ttsError);
                // Fallback para texto se TTS falhar
                await this.bot.telegram.sendMessage(chatId, '❌ Erro ao gerar áudio. Enviando resposta em texto:');
                await this.bot.telegram.sendMessage(chatId, textContent);
                return true;
            }
        } else {
            // Enviar como texto se preferência for texto, se TTS falhou na inicialização, ou se forçado
            try {
                await this.bot.telegram.sendMessage(chatId, textContent);
                return true;
            } catch (error) {
                logger.error('Erro ao enviar mensagem Telegram:', error);
                return false;
            }
        }
    }

    // Configuração de TTS
    async handleTTSConfig(chatId, userId) {
        const voiceEnabled = this.getUserPreference(userId, 'voiceResponse', false);
        
        let message = '🔊 <b>CONFIGURAÇÃO DE VOZ</b>\n\n';
        message += `🎤 <b>Status atual:</b> ${voiceEnabled ? '✅ Ativado' : '❌ Desativado'}\n\n`;
        
        if (this.ttsService && (this.ttsService.client || this.ttsService.piperEnabled)) {
            message += '📊 <b>Serviço TTS:</b> ✅ Disponível\n';
            if (this.ttsService.client) {
                message += '🌐 <b>Provedor:</b> ElevenLabs\n';
            } else if (this.ttsService.piperEnabled) {
                message += '🏠 <b>Provedor:</b> Piper (Local)\n';
            }
        } else {
            message += '📊 <b>Serviço TTS:</b> ❌ Não disponível\n';
            message += '⚠️ <i>Configure ElevenLabs ou Piper para usar respostas de voz</i>\n';
        }
        
        message += '\n💡 <b>Como funciona:</b>\n';
        message += '• Com voz ativada: Respostas serão enviadas como áudio\n';
        message += '• Com voz desativada: Respostas serão enviadas como texto\n';
        message += '• Fallback automático para texto se houver erro\n';
        
        const keyboard = {
            inline_keyboard: [
                [
                    {
                        text: voiceEnabled ? '🔇 Desativar Voz' : '🔊 Ativar Voz',
                        callback_data: 'toggle_voice'
                    }
                ],
                [{ text: '🔙 Voltar', callback_data: 'back_main' }]
            ]
        };
        
        await this.bot.telegram.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            reply_markup: keyboard
        });
    }

    // Toggle da preferência de voz
    async toggleVoicePreference(chatId, userId) {
        const voiceEnabled = this.toggleVoicePreferenceForUser(userId);
        const message = voiceEnabled 
            ? '🔊 <b>Respostas de voz ativadas!</b>\n\n🎤 Vou usar áudio para responder sempre que possível.'
            : '💬 <b>Respostas de voz desativadas!</b>\n\n📝 Vou usar apenas texto para responder.';
        
        // Enviar confirmação sempre em texto para clareza
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
        
        // Atualizar a interface de configuração
        setTimeout(() => {
            this.handleTTSConfig(chatId, userId);
        }, 1500);
    }

    // Handler para importação de ICS
    async handleICSImportAction(chatId, userId) {
        this.userStates.set(userId, {
            action: 'import_ics',
            chatId: chatId,
            step: 'waiting_file'
        });
        
        let message = '📅 <b>IMPORTAR AGENDA (ICS)</b>\n\n';
        message += '📎 <b>Envie um arquivo .ics</b> para importar eventos para seus lembretes.\n\n';
        message += '💡 <b>Como obter arquivo ICS:</b>\n';
        message += '• Google Calendar: Configurações > Importar/Exportar\n';
        message += '• Outlook: Arquivo > Salvar Calendário\n';
        message += '• Apple Calendar: Arquivo > Exportar\n\n';
        message += '⚠️ <b>Importante:</b> Apenas arquivos .ics são aceitos';
        
        await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    buildEnhancedWelcomeMessage() {
        return TELEGRAM_MESSAGES.welcome;
    }

    // === Novos Métodos para Gerenciamento de Endpoints ===

    async showWhisperEndpoints(chatId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🎤 Carregando endpoints Whisper API...', { parse_mode: 'HTML' });
            
            // Inject transcriber with access to whisperApiPool 
            const transcriber = this.integrationService?.getTranscriber?.() || null;
            const whisperPool = transcriber?.whisperApiPool;
            
            if (!whisperPool) {
                await this.bot.telegram.sendMessage(chatId, '❌ <b>WHISPER API NÃO DISPONÍVEL</b>\n\n⚠️ O pool de APIs Whisper não está configurado.', { parse_mode: 'HTML' });
                return;
            }

            const status = await whisperPool.getPoolStatus();
            
            let message = '🎤 <b>ENDPOINTS WHISPER API</b>\n\n';
            message += `📊 <b>Resumo Geral:</b>\n`;
            message += `• Total de Endpoints: ${status.totalEndpoints}\n`;
            message += `• Endpoints Saudáveis: ${status.healthyEndpoints}\n`;
            message += `• Estratégia de Balanceamento: ${status.strategy}\n\n`;
            
            if (status.endpoints.length === 0) {
                message += '📭 <i>Nenhum endpoint configurado</i>\n';
            } else {
                message += '📋 <b>Lista de Endpoints:</b>\n\n';
                
                status.endpoints.forEach((endpoint, index) => {
                    message += `${index + 1}. <b>${endpoint.url}</b>\n`;
                    message += `   🟢 Status: ${endpoint.healthy ? 'Saudável' : '🔴 Indisponível'}\n`;
                    message += `   ⭐ Prioridade: ${endpoint.priority}\n`;
                    if (endpoint.queueLength !== undefined) {
                        message += `   📊 Fila: ${endpoint.queueLength} itens\n`;
                    }
                    if (endpoint.error) {
                        message += `   ❌ Erro: ${endpoint.error}\n`;
                    }
                    message += '\n';
                });
            }
            
            await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
        } catch (err) {
            logger.error(`❌ Erro ao listar endpoints Whisper para ${chatId}`, err);
            await this.bot.telegram.sendMessage(chatId, `❌ <b>ERRO AO LISTAR ENDPOINTS</b>\n\n🚫 <b>Erro:</b> ${err.message}`, { parse_mode: 'HTML' });
        }
    }

    async showOllamaEndpoints(chatId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🤖 Carregando endpoints Ollama API...', { parse_mode: 'HTML' });
            
            // Access through llmService
            const ollamaPool = this.llmService?.ollamaApiPool;
            
            if (!ollamaPool) {
                await this.bot.telegram.sendMessage(chatId, '❌ <b>OLLAMA API NÃO DISPONÍVEL</b>\n\n⚠️ O pool de APIs Ollama não está configurado.', { parse_mode: 'HTML' });
                return;
            }

            const status = await ollamaPool.getPoolStatus();
            
            let message = '🤖 <b>ENDPOINTS OLLAMA API</b>\n\n';
            message += `📊 <b>Resumo Geral:</b>\n`;
            message += `• Modo: ${status.mode}\n`;
            message += `• Habilitado: ${status.enabled ? 'Sim' : 'Não'}\n`;
            message += `• Total de Endpoints: ${status.totalEndpoints}\n`;
            message += `• Endpoints Saudáveis: ${status.healthyEndpoints}\n`;
            message += `• Estratégia de Balanceamento: ${status.strategy}\n\n`;
            
            if (status.endpoints.length === 0) {
                message += '📭 <i>Nenhum endpoint configurado</i>\n';
            } else {
                message += '📋 <b>Lista de Endpoints:</b>\n\n';
                
                status.endpoints.forEach((endpoint, index) => {
                    message += `${index + 1}. <b>${endpoint.url}</b>\n`;
                    message += `   🏷️ Tipo: ${endpoint.type}\n`;
                    message += `   🟢 Status: ${endpoint.healthy ? 'Saudável' : '🔴 Indisponível'}\n`;
                    message += `   ⭐ Prioridade: ${endpoint.priority}\n`;
                    if (endpoint.runningModels !== undefined) {
                        message += `   🧠 Modelos Ativos: ${endpoint.runningModels}\n`;
                    }
                    if (endpoint.currentModel) {
                        message += `   📋 Modelo Atual: ${endpoint.currentModel}\n`;
                    }
                    if (endpoint.error) {
                        message += `   ❌ Erro: ${endpoint.error}\n`;
                    }
                    message += '\n';
                });
            }
            
            await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
        } catch (err) {
            logger.error(`❌ Erro ao listar endpoints Ollama para ${chatId}`, err);
            await this.bot.telegram.sendMessage(chatId, `❌ <b>ERRO AO LISTAR ENDPOINTS</b>\n\n🚫 <b>Erro:</b> ${err.message}`, { parse_mode: 'HTML' });
        }
    }

    async showEndpointsStatus(chatId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📊 Carregando status de todos os endpoints...', { parse_mode: 'HTML' });
            
            let message = '📊 <b>STATUS COMPLETO DOS ENDPOINTS</b>\n\n';
            
            // Status do Whisper API
            const transcriber = this.integrationService?.getTranscriber?.() || null;
            const whisperPool = transcriber?.whisperApiPool;
            
            if (whisperPool) {
                try {
                    const whisperStatus = await whisperPool.getPoolStatus();
                    message += '🎤 <b>WHISPER API</b>\n';
                    message += `• Endpoints: ${whisperStatus.healthyEndpoints}/${whisperStatus.totalEndpoints} saudáveis\n`;
                    message += `• Estratégia: ${whisperStatus.strategy}\n`;
                    
                    let totalQueue = 0;
                    whisperStatus.endpoints.forEach(endpoint => {
                        if (endpoint.queueLength) totalQueue += endpoint.queueLength;
                    });
                    message += `• Total na Fila: ${totalQueue} itens\n\n`;
                    
                } catch (err) {
                    message += '🎤 <b>WHISPER API</b>\n';
                    message += `❌ Erro ao obter status: ${err.message}\n\n`;
                }
            } else {
                message += '🎤 <b>WHISPER API</b>\n';
                message += '⚠️ Pool não configurado\n\n';
            }
            
            // Status do Ollama API
            const ollamaPool = this.llmService?.ollamaApiPool;
            if (ollamaPool) {
                try {
                    const ollamaStatus = await ollamaPool.getPoolStatus();
                    message += '🤖 <b>OLLAMA API</b>\n';
                    message += `• Modo: ${ollamaStatus.mode}\n`;
                    message += `• Habilitado: ${ollamaStatus.enabled ? 'Sim' : 'Não'}\n`;
                    message += `• Endpoints: ${ollamaStatus.healthyEndpoints}/${ollamaStatus.totalEndpoints} saudáveis\n`;
                    message += `• Estratégia: ${ollamaStatus.strategy}\n`;
                    
                    let totalRunningModels = 0;
                    ollamaStatus.endpoints.forEach(endpoint => {
                        if (endpoint.runningModels) totalRunningModels += endpoint.runningModels;
                    });
                    message += `• Total Modelos Ativos: ${totalRunningModels}\n\n`;
                    
                } catch (err) {
                    message += '🤖 <b>OLLAMA API</b>\n';
                    message += `❌ Erro ao obter status: ${err.message}\n\n`;
                }
            } else {
                message += '🤖 <b>OLLAMA API</b>\n';
                message += '⚠️ Pool não configurado\n\n';
            }
            
            // Status do sistema
            try {
                const si = await import('systeminformation');
                const cpuInfo = await si.cpu();
                const memInfo = await si.mem();
                const loadInfo = await si.currentLoad();
                
                message += '💻 <b>SISTEMA</b>\n';
                message += `• CPU: ${cpuInfo.manufacturer} ${cpuInfo.brand}\n`;
                message += `• Carga CPU: ${loadInfo.currentLoad.toFixed(1)}%\n`;
                message += `• Memória: ${(memInfo.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(memInfo.total / 1024 / 1024 / 1024).toFixed(1)}GB\n`;
                message += `• Uso Memória: ${((memInfo.used / memInfo.total) * 100).toFixed(1)}%\n\n`;
                
            } catch (err) {
                message += '💻 <b>SISTEMA</b>\n';
                message += `❌ Erro ao obter info do sistema: ${err.message}\n\n`;
            }
            
            message += `🔄 Atualizado em: ${new Date().toLocaleString('pt-BR')}\n`;
            
            await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
        } catch (err) {
            logger.error(`❌ Erro ao obter status dos endpoints para ${chatId}`, err);
            await this.bot.telegram.sendMessage(chatId, `❌ <b>ERRO AO OBTER STATUS</b>\n\n🚫 <b>Erro:</b> ${err.message}`, { parse_mode: 'HTML' });
        }
    }

    // === Fim dos Métodos de Gerenciamento de Endpoints ===

}

export { TelegramBotService };