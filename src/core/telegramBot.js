import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { TELEGRAM_COMMANDS, TELEGRAM_MESSAGES } from '../constants/telegramCommands.js';
import { createFeatureToggleManager } from '../services/featureToggleService.js';
import { TelegramIntegrationService } from '../services/telegramIntegrationService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TelegramBotService {
    constructor() {
        this.bot = null;
        this.isInitialized = false;
        this.featureToggles = null;
        this.userStates = new Map(); // Armazena estado de navegação por usuário
        this.integrationService = null;
        this.init();
    }

    async init() {
        try {
            if (!config.telegram?.botToken) {
                logger.warn('Telegram bot token não configurado. Bot do Telegram desabilitado.');
                return;
            }

            this.bot = new TelegramBot(config.telegram.botToken, { polling: true });
            this.featureToggles = await createFeatureToggleManager();
            this.integrationService = new TelegramIntegrationService(this.bot);
            
            this.setupEventHandlers();
            this.isInitialized = true;
            
            logger.info('Bot do Telegram inicializado com sucesso');
        } catch (error) {
            logger.error('Erro ao inicializar bot do Telegram:', error);
        }
    }

    setupEventHandlers() {
        // Comando /start
        this.bot.onText(/\/start/, (msg) => {
            this.handleStart(msg);
        });

        // Callback queries (botões inline)
        this.bot.on('callback_query', (query) => {
            this.handleCallbackQuery(query);
        });

        // Mensagens de texto
        this.bot.on('message', (msg) => {
            if (msg.text && !msg.text.startsWith('/')) {
                this.handleTextMessage(msg);
            }
        });

        // Mensagens de áudio
        this.bot.on('voice', (msg) => {
            this.handleVoiceMessage(msg);
        });

        // Imagens
        this.bot.on('photo', (msg) => {
            this.handlePhotoMessage(msg);
        });

        // Documentos
        this.bot.on('document', (msg) => {
            this.handleDocumentMessage(msg);
        });

        // Tratamento de erros
        this.bot.on('error', (error) => {
            logger.error('Erro no bot do Telegram:', error);
        });
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        // Resetar estado do usuário
        this.userStates.delete(userId);
        
        const welcomeMessage = TELEGRAM_MESSAGES.welcome;
        const mainMenu = await this.buildMainMenu(userId);
        
        await this.bot.sendMessage(chatId, welcomeMessage, {
            reply_markup: mainMenu,
            parse_mode: 'HTML'
        });
    }

    async buildMainMenu(userId) {
        const features = await this.featureToggles.getUserFeatures(userId);
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
        const features = await this.featureToggles.getUserFeatures(userId);
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
                    keyboard.push([{ text: '🎥 Resumir Vídeo', callback_data: 'action_video_summary' }]);
                }
                break;

            case 'agenda':
                if (features.scheduler) {
                    keyboard.push([{ text: '➕ Criar Lembrete', callback_data: 'action_create_reminder' }]);
                    keyboard.push([{ text: '📋 Listar Lembretes', callback_data: 'action_list_reminders' }]);
                    keyboard.push([{ text: '🗑️ Deletar Lembrete', callback_data: 'action_delete_reminder' }]);
                }
                break;

            case 'media':
                if (features.audio_transcription) {
                    keyboard.push([{ text: '🎤 Transcrever Áudio', callback_data: 'action_transcribe' }]);
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
                keyboard.push([{ text: '🤖 Modelos IA', callback_data: 'config_ai_models' }]);
                keyboard.push([{ text: '🎤 Modelos Whisper', callback_data: 'config_whisper_models' }]);
                keyboard.push([{ text: '🔧 Feature Toggles', callback_data: 'config_features' }]);
                break;
        }

        // Botão voltar
        keyboard.push([{ text: '🔙 Voltar', callback_data: 'back_main' }]);

        return {
            inline_keyboard: keyboard
        };
    }

    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        const data = query.data;

        try {
            await this.bot.answerCallbackQuery(query.id);

            if (data.startsWith('menu_')) {
                const menuType = data.replace('menu_', '');
                const subMenu = await this.buildSubMenu(menuType, userId);
                const message = TELEGRAM_MESSAGES.menus[menuType] || `Menu ${menuType}:`;
                
                await this.bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: subMenu,
                    parse_mode: 'HTML'
                });

            } else if (data.startsWith('action_')) {
                await this.handleAction(query, data);
                
            } else if (data.startsWith('config_')) {
                await this.handleConfigAction(query, data);
                
            } else if (data === 'back_main') {
                const mainMenu = await this.buildMainMenu(userId);
                
                await this.bot.editMessageText(TELEGRAM_MESSAGES.welcome, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: mainMenu,
                    parse_mode: 'HTML'
                });
                
            } else if (data === 'help') {
                await this.bot.sendMessage(chatId, TELEGRAM_MESSAGES.help, {
                    parse_mode: 'HTML'
                });
            }

        } catch (error) {
            logger.error('Erro ao processar callback query:', error);
            await this.bot.sendMessage(chatId, 'Ocorreu um erro. Tente novamente.');
        }
    }

    async handleAction(query, action) {
        const chatId = query.message.chat.id;
        const userId = query.from.id;
        
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
            'calories': 'Envie uma foto da comida para calcular calorias:',
            'linkedin': 'Envie o link do perfil do LinkedIn:'
        };

        const message = actionMessages[action.replace('action_', '')] || 'Aguardando entrada...';
        await this.bot.sendMessage(chatId, message);
    }

    async handleConfigAction(query, configAction) {
        const chatId = query.message.chat.id;
        const userId = query.from.id;

        switch (configAction) {
            case 'config_ai_models':
                await this.showAIModels(chatId);
                break;
            case 'config_whisper_models':
                await this.showWhisperModels(chatId);
                break;
            case 'config_features':
                await this.showFeatureToggles(chatId, userId);
                break;
        }
    }

    async handleTextMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text;

        const userState = this.userStates.get(userId);
        if (!userState) {
            // Mensagem sem contexto - tratar como chat geral se IA estiver habilitada
            const features = await this.featureToggles.getUserFeatures(userId);
            if (features.ai_chat) {
                await this.processAIChat(chatId, text);
            } else {
                await this.bot.sendMessage(chatId, 'Use /start para ver o menu principal.');
            }
            return;
        }

        // Processar baseado no estado atual
        await this.processUserInput(chatId, userId, userState, text);
    }

    async handleVoiceMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        const features = await this.featureToggles.getUserFeatures(userId);
        if (!features.audio_transcription) {
            await this.bot.sendMessage(chatId, 'Funcionalidade de transcrição de áudio não disponível.');
            return;
        }

        await this.integrationService.processVoiceTranscription(chatId, msg.voice);
    }

    async handlePhotoMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userState = this.userStates.get(userId);

        const features = await this.featureToggles.getUserFeatures(userId);
        
        if (userState?.action === 'analyze_image' && features.image_analysis) {
            await this.integrationService.processImageAnalysis(chatId, msg.photo);
        } else if (userState?.action === 'calories' && features.calorie_counter) {
            await this.integrationService.processCalorieCount(chatId, msg.photo);
        } else if (features.image_analysis) {
            // Análise geral de imagem
            await this.integrationService.processImageAnalysis(chatId, msg.photo);
        } else {
            await this.bot.sendMessage(chatId, 'Funcionalidade de análise de imagem não disponível.');
        }
    }

    async handleDocumentMessage(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const userState = this.userStates.get(userId);

        if (userState?.action === 'summarize') {
            await this.integrationService.processDocumentSummary(chatId, msg.document);
        } else {
            await this.bot.sendMessage(chatId, 'Envie um documento após selecionar "Resumir Texto".');
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
                await this.integrationService.processCreateReminder(chatId, input, userId);
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
            default:
                await this.bot.sendMessage(chatId, 'Ação não reconhecida.');
        }
    }

    // Métodos auxiliares de configuração
    async showAIModels(chatId) {
        await this.bot.sendMessage(chatId, '🤖 Modelos de IA disponíveis:\n\n(Implementar listagem de modelos)');
    }

    async showWhisperModels(chatId) {
        await this.bot.sendMessage(chatId, '🎤 Modelos Whisper disponíveis:\n\n(Implementar listagem de modelos)');
    }

    async showFeatureToggles(chatId, userId) {
        const features = await this.featureToggles.getUserFeatures(userId);
        let message = '🔧 <b>Feature Toggles:</b>\n\n';
        
        for (const [key, value] of Object.entries(features)) {
            const icon = value ? '✅' : '❌';
            const name = key.replace(/_/g, ' ').toUpperCase();
            message += `${icon} ${name}\n`;
        }

        await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }

    // Métodos de processamento específicos (placeholders)
    async processCreateReminder(chatId, text) {
        await this.bot.sendMessage(chatId, `📅 Lembrete criado: ${text}`);
    }

    async processVideoSummary(chatId, url) {
        await this.bot.sendMessage(chatId, `🎥 Processando vídeo: ${url}`);
    }

    async processLinkedInAnalysis(chatId, url) {
        await this.bot.sendMessage(chatId, `🔗 Analisando LinkedIn: ${url}`);
    }

    async processVoiceMessage(chatId, voice) {
        await this.bot.sendMessage(chatId, '🎤 Transcrevendo áudio...');
    }

    async processImageAnalysis(chatId, photos) {
        await this.bot.sendMessage(chatId, '🖼️ Analisando imagem...');
    }

    async processCalorieCount(chatId, photos) {
        await this.bot.sendMessage(chatId, '🍎 Calculando calorias...');
    }

    async processDocumentSummary(chatId, document) {
        await this.bot.sendMessage(chatId, '📄 Resumindo documento...');
    }

    // Método público para enviar mensagens
    async sendMessage(chatId, text, options = {}) {
        if (!this.isInitialized) {
            logger.warn('Bot do Telegram não inicializado');
            return false;
        }

        try {
            await this.bot.sendMessage(chatId, text, options);
            return true;
        } catch (error) {
            logger.error('Erro ao enviar mensagem Telegram:', error);
            return false;
        }
    }

    // Método para verificar se está ativo
    isActive() {
        return this.isInitialized && this.bot;
    }
}

export { TelegramBotService };