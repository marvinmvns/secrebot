import { LLMService } from './llmService.js';
import { AudioTranscriber } from './audioTranscriber.js';
import { TTSService } from './ttsService.js';
import { CalorieService } from './calorieService.js';
import { LinkedInScraper } from './linkedinScraper.js';
import { YouTubeService } from './youtubeService.js';
import { Scheduler } from './scheduler.js';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TelegramIntegrationService {
    constructor(bot) {
        this.bot = bot;
        this.llmService = new LLMService();
        this.audioTranscriber = new AudioTranscriber();
        this.ttsService = new TTSService();
        this.calorieService = new CalorieService();
        this.linkedinScraper = new LinkedInScraper();
        this.youtubeService = new YouTubeService();
        this.scheduler = new Scheduler();
    }

    async processAIChat(chatId, text, userId) {
        try {
            await this.bot.sendMessage(chatId, '🤖 Gerando resposta...');
            
            const response = await this.llmService.generateResponse(text, {
                maxTokens: 2000,
                temperature: 0.7
            });

            if (response) {
                // Dividir resposta em chunks se for muito longa
                const chunks = this.splitMessage(response);
                
                for (const chunk of chunks) {
                    await this.bot.sendMessage(chatId, chunk);
                }

                // Opção de TTS se disponível
                if (config.telegram?.enableTTS) {
                    const keyboard = {
                        inline_keyboard: [[
                            { text: '🔊 Ouvir Resposta', callback_data: `tts_${userId}_${Date.now()}` }
                        ]]
                    };
                    await this.bot.sendMessage(chatId, 'Deseja ouvir a resposta em áudio?', {
                        reply_markup: keyboard
                    });
                }
            } else {
                await this.bot.sendMessage(chatId, 'Não foi possível gerar uma resposta no momento.');
            }
        } catch (error) {
            logger.error('Erro no chat IA Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao processar sua mensagem.');
        }
    }

    async processImageAnalysis(chatId, photos) {
        try {
            await this.bot.sendMessage(chatId, '🔍 Analisando imagem...');
            
            // Pegar a foto de maior resolução
            const photo = photos[photos.length - 1];
            const fileId = photo.file_id;
            
            // Download da imagem
            const file = await this.bot.getFile(fileId);
            const filePath = file.file_path;
            const imageUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
            
            // Baixar imagem temporariamente
            const tempImagePath = await this.downloadFile(imageUrl, 'image');
            
            try {
                const analysis = await this.llmService.analyzeImage(tempImagePath, 
                    'Descreva esta imagem em detalhes, identificando objetos, pessoas, textos e contexto.'
                );

                if (analysis) {
                    const chunks = this.splitMessage(analysis);
                    for (const chunk of chunks) {
                        await this.bot.sendMessage(chatId, chunk);
                    }
                } else {
                    await this.bot.sendMessage(chatId, 'Não foi possível analisar a imagem.');
                }
            } finally {
                // Limpar arquivo temporário
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
            }
        } catch (error) {
            logger.error('Erro na análise de imagem Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao analisar a imagem.');
        }
    }

    async processCalorieCount(chatId, photos) {
        try {
            await this.bot.sendMessage(chatId, '🍎 Calculando calorias...');
            
            const photo = photos[photos.length - 1];
            const fileId = photo.file_id;
            
            const file = await this.bot.getFile(fileId);
            const filePath = file.file_path;
            const imageUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
            
            const tempImagePath = await this.downloadFile(imageUrl, 'food');
            
            try {
                const calorieInfo = await this.calorieService.calculateCalories(tempImagePath);
                
                if (calorieInfo) {
                    let message = '🍎 <b>Análise Nutricional:</b>\n\n';
                    
                    if (calorieInfo.items && calorieInfo.items.length > 0) {
                        for (const item of calorieInfo.items) {
                            message += `• <b>${item.name}</b>\n`;
                            message += `  Calorias: ${item.calories} kcal\n`;
                            if (item.protein) message += `  Proteína: ${item.protein}g\n`;
                            if (item.carbs) message += `  Carboidratos: ${item.carbs}g\n`;
                            if (item.fat) message += `  Gordura: ${item.fat}g\n\n`;
                        }
                        
                        const totalCalories = calorieInfo.items.reduce((sum, item) => sum + (item.calories || 0), 0);
                        message += `<b>Total: ${totalCalories} kcal</b>`;
                    } else {
                        message += calorieInfo.message || 'Não foi possível identificar alimentos na imagem.';
                    }
                    
                    await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
                } else {
                    await this.bot.sendMessage(chatId, 'Não foi possível calcular as calorias da imagem.');
                }
            } finally {
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
            }
        } catch (error) {
            logger.error('Erro no cálculo de calorias Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao calcular calorias.');
        }
    }

    async processVoiceTranscription(chatId, voice) {
        try {
            await this.bot.sendMessage(chatId, '🎤 Transcrevendo áudio...');
            
            const fileId = voice.file_id;
            const file = await this.bot.getFile(fileId);
            const filePath = file.file_path;
            const audioUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
            
            const tempAudioPath = await this.downloadFile(audioUrl, 'audio');
            
            try {
                const transcription = await this.audioTranscriber.transcribeAudio(tempAudioPath);
                
                if (transcription) {
                    await this.bot.sendMessage(chatId, `🎤 <b>Transcrição:</b>\n\n${transcription}`, {
                        parse_mode: 'HTML'
                    });
                } else {
                    await this.bot.sendMessage(chatId, 'Não foi possível transcrever o áudio.');
                }
            } finally {
                if (fs.existsSync(tempAudioPath)) {
                    fs.unlinkSync(tempAudioPath);
                }
            }
        } catch (error) {
            logger.error('Erro na transcrição Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao transcrever o áudio.');
        }
    }

    async processVideoSummary(chatId, videoUrl) {
        try {
            await this.bot.sendMessage(chatId, '🎥 Processando vídeo...');
            
            if (!this.isValidYouTubeUrl(videoUrl)) {
                await this.bot.sendMessage(chatId, 'Por favor, envie um link válido do YouTube.');
                return;
            }

            const summary = await this.youtubeService.summarizeVideo(videoUrl);
            
            if (summary) {
                let message = `🎥 <b>Resumo do Vídeo:</b>\n\n`;
                message += `<b>Título:</b> ${summary.title || 'N/A'}\n`;
                message += `<b>Canal:</b> ${summary.channel || 'N/A'}\n`;
                message += `<b>Duração:</b> ${summary.duration || 'N/A'}\n\n`;
                message += `<b>Resumo:</b>\n${summary.summary}`;
                
                const chunks = this.splitMessage(message);
                for (const chunk of chunks) {
                    await this.bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.sendMessage(chatId, 'Não foi possível processar o vídeo.');
            }
        } catch (error) {
            logger.error('Erro no resumo de vídeo Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao processar o vídeo.');
        }
    }

    async processLinkedInAnalysis(chatId, profileUrl) {
        try {
            await this.bot.sendMessage(chatId, '🔗 Analisando perfil LinkedIn...');
            
            if (!this.isValidLinkedInUrl(profileUrl)) {
                await this.bot.sendMessage(chatId, 'Por favor, envie um link válido do LinkedIn.');
                return;
            }

            const analysis = await this.linkedinScraper.analyzeProfile(profileUrl);
            
            if (analysis) {
                let message = `🔗 <b>Análise do Perfil LinkedIn:</b>\n\n`;
                message += `<b>Nome:</b> ${analysis.name || 'N/A'}\n`;
                message += `<b>Cargo:</b> ${analysis.title || 'N/A'}\n`;
                message += `<b>Empresa:</b> ${analysis.company || 'N/A'}\n`;
                message += `<b>Localização:</b> ${analysis.location || 'N/A'}\n\n`;
                
                if (analysis.summary) {
                    message += `<b>Resumo:</b>\n${analysis.summary}\n\n`;
                }
                
                if (analysis.skills && analysis.skills.length > 0) {
                    message += `<b>Principais Skills:</b>\n${analysis.skills.slice(0, 10).join(', ')}`;
                }
                
                const chunks = this.splitMessage(message);
                for (const chunk of chunks) {
                    await this.bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.sendMessage(chatId, 'Não foi possível analisar o perfil.');
            }
        } catch (error) {
            logger.error('Erro na análise LinkedIn Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao analisar o perfil LinkedIn.');
        }
    }

    async processCreateReminder(chatId, text, userId) {
        try {
            await this.bot.sendMessage(chatId, '📅 Criando lembrete...');
            
            const reminder = await this.scheduler.createSchedule(text, {
                platform: 'telegram',
                chatId: chatId,
                userId: userId
            });
            
            if (reminder) {
                const scheduledDate = new Date(reminder.scheduledTime).toLocaleString('pt-BR');
                await this.bot.sendMessage(chatId, 
                    `✅ <b>Lembrete criado!</b>\n\n` +
                    `📝 ${reminder.message}\n` +
                    `📅 ${scheduledDate}`, 
                    { parse_mode: 'HTML' }
                );
            } else {
                await this.bot.sendMessage(chatId, 'Não foi possível criar o lembrete. Verifique o formato da data/hora.');
            }
        } catch (error) {
            logger.error('Erro ao criar lembrete Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao criar o lembrete.');
        }
    }

    async processListReminders(chatId, userId) {
        try {
            const reminders = await this.scheduler.listUserSchedules(userId, 'telegram');
            
            if (!reminders || reminders.length === 0) {
                await this.bot.sendMessage(chatId, '📅 Você não tem lembretes agendados.');
                return;
            }

            let message = '📅 <b>Seus Lembretes:</b>\n\n';
            
            reminders.forEach((reminder, index) => {
                const scheduledDate = new Date(reminder.scheduledTime).toLocaleString('pt-BR');
                const status = reminder.status === 'approved' ? '⏳' : reminder.status === 'sent' ? '✅' : '❌';
                
                message += `${index + 1}. ${status} <b>${reminder.message}</b>\n`;
                message += `   📅 ${scheduledDate}\n\n`;
            });

            // Adicionar botões de ação
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🗑️ Deletar Lembrete', callback_data: 'delete_reminder_list' }],
                    [{ text: '🔄 Atualizar Lista', callback_data: 'action_list_reminders' }]
                ]
            };

            await this.bot.sendMessage(chatId, message, { 
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (error) {
            logger.error('Erro ao listar lembretes Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao carregar os lembretes.');
        }
    }

    async processTextSummary(chatId, text) {
        try {
            await this.bot.sendMessage(chatId, '📄 Resumindo texto...');
            
            const summary = await this.llmService.generateResponse(
                `Resuma o seguinte texto de forma clara e organizada:\n\n${text}`,
                { maxTokens: 2000 }
            );
            
            if (summary) {
                let message = `📄 <b>Resumo:</b>\n\n${summary}`;
                
                const chunks = this.splitMessage(message);
                for (const chunk of chunks) {
                    await this.bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.sendMessage(chatId, 'Não foi possível resumir o texto.');
            }
        } catch (error) {
            logger.error('Erro ao resumir texto Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao processar o resumo.');
        }
    }

    async processDocumentSummary(chatId, document) {
        try {
            await this.bot.sendMessage(chatId, '📄 Processando documento...');
            
            const fileId = document.file_id;
            const fileName = document.file_name;
            const fileSize = document.file_size;
            
            // Verificar tamanho do arquivo (máximo 20MB)
            if (fileSize > 20 * 1024 * 1024) {
                await this.bot.sendMessage(chatId, 'Arquivo muito grande. Máximo permitido: 20MB.');
                return;
            }

            const file = await this.bot.getFile(fileId);
            const filePath = file.file_path;
            const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;
            
            const tempFilePath = await this.downloadFile(fileUrl, 'document', fileName);
            
            try {
                const summary = await this.processFileForSummary(tempFilePath, fileName);
                
                if (summary) {
                    let message = `📄 <b>Resumo do Documento:</b>\n\n`;
                    message += `<b>Arquivo:</b> ${fileName}\n\n`;
                    message += summary;
                    
                    const chunks = this.splitMessage(message);
                    for (const chunk of chunks) {
                        await this.bot.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                    }
                } else {
                    await this.bot.sendMessage(chatId, 'Não foi possível processar o documento.');
                }
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        } catch (error) {
            logger.error('Erro ao processar documento Telegram:', error);
            await this.bot.sendMessage(chatId, 'Erro ao processar o documento.');
        }
    }

    // Métodos auxiliares
    async downloadFile(url, type, originalName = null) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao baixar arquivo: ${response.statusText}`);
        }

        const buffer = await response.buffer();
        const extension = originalName ? path.extname(originalName) : this.getExtensionByType(type);
        const tempFileName = `temp_${Date.now()}_${Math.random().toString(36)}${extension}`;
        const tempPath = path.join(__dirname, '../../temp', tempFileName);
        
        // Criar diretório temp se não existir
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(tempPath, buffer);
        return tempPath;
    }

    getExtensionByType(type) {
        const extensions = {
            'image': '.jpg',
            'audio': '.ogg',
            'video': '.mp4',
            'document': '.pdf'
        };
        return extensions[type] || '.tmp';
    }

    async processFileForSummary(filePath, fileName) {
        const extension = path.extname(fileName).toLowerCase();
        
        try {
            let content = '';
            
            if (extension === '.pdf') {
                // Implementar leitura de PDF
                const pdfParse = await import('pdf-parse');
                const buffer = fs.readFileSync(filePath);
                const data = await pdfParse.default(buffer);
                content = data.text;
            } else if (extension === '.txt') {
                content = fs.readFileSync(filePath, 'utf-8');
            } else if (['.doc', '.docx'].includes(extension)) {
                // Implementar leitura de Word
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ path: filePath });
                content = result.value;
            } else {
                throw new Error('Formato de arquivo não suportado');
            }

            if (content.length > 50000) {
                content = content.substring(0, 50000) + '...';
            }

            return await this.llmService.generateResponse(
                `Resuma o seguinte conteúdo de forma clara e organizada:\n\n${content}`,
                { maxTokens: 2000 }
            );
        } catch (error) {
            logger.error('Erro ao processar arquivo para resumo:', error);
            return null;
        }
    }

    splitMessage(text, maxLength = 4096) {
        if (text.length <= maxLength) {
            return [text];
        }

        const chunks = [];
        let current = text;

        while (current.length > maxLength) {
            let splitIndex = current.lastIndexOf('\n', maxLength);
            if (splitIndex === -1) {
                splitIndex = current.lastIndexOf(' ', maxLength);
            }
            if (splitIndex === -1) {
                splitIndex = maxLength;
            }

            chunks.push(current.substring(0, splitIndex));
            current = current.substring(splitIndex).trim();
        }

        if (current.length > 0) {
            chunks.push(current);
        }

        return chunks;
    }

    isValidYouTubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        return youtubeRegex.test(url);
    }

    isValidLinkedInUrl(url) {
        const linkedinRegex = /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/.+/;
        return linkedinRegex.test(url);
    }

    async generateTTS(text, userId) {
        try {
            const audioBuffer = await this.ttsService.generateSpeech(text);
            return audioBuffer;
        } catch (error) {
            logger.error('Erro ao gerar TTS:', error);
            return null;
        }
    }
}

export { TelegramIntegrationService };