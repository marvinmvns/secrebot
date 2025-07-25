import LLMService from './llmService.js';
import AudioTranscriber from './audioTranscriber.js';
import TTSService from './ttsService.js';
import CalorieService from './calorieService.js';
import LinkedInScraper from './linkedinScraper.js';
import YouTubeService from './youtubeService.js';
import Scheduler from './scheduler.js';
import logger from '../utils/logger.js';
import { config } from '../config/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TelegramIntegrationService {
    constructor(bot) {
        this.bot = bot;
        this.llmService = new LLMService();
        this.audioTranscriber = new AudioTranscriber();
        this.ttsService = new TTSService();
        this.calorieService = new CalorieService();
        this.linkedinScraper = new LinkedInScraper();
        this.youtubeService = YouTubeService;
        this.scheduler = new Scheduler();
    }

    async processAIChat(chatId, text, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🤖 Gerando resposta...');
            
            const response = await this.llmService.generateResponse(text, {
                maxTokens: 2000,
                temperature: 0.7
            });

            if (response) {
                // Dividir resposta em chunks se for muito longa
                const chunks = this.splitMessage(response);
                
                for (const chunk of chunks) {
                    await this.bot.telegram.sendMessage(chatId, chunk);
                }

                // Opção de TTS se disponível
                if (config.telegram?.enableTTS) {
                    const keyboard = {
                        inline_keyboard: [[
                            { text: '🔊 Ouvir Resposta', callback_data: `tts_${userId}_${Date.now()}` }
                        ]]
                    };
                    await this.bot.telegram.sendMessage(chatId, 'Deseja ouvir a resposta em áudio?', {
                        reply_markup: keyboard
                    });
                }
            } else {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível gerar uma resposta no momento.');
            }
        } catch (error) {
            logger.error('Erro no chat IA Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar sua mensagem.');
        }
    }

    async processImageAnalysis(chatId, photos) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🔍 Analisando imagem...');
            
            // Pegar a foto de maior resolução
            const photo = photos[photos.length - 1];
            const fileId = photo.file_id;
            
            // Download da imagem
            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const imageUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
            // Baixar imagem temporariamente
            const tempImagePath = await this.downloadFile(imageUrl, 'image');
            
            try {
                const analysis = await this.llmService.analyzeImage(tempImagePath, 
                    'Descreva esta imagem em detalhes, identificando objetos, pessoas, textos e contexto.'
                );

                if (analysis) {
                    const chunks = this.splitMessage(analysis);
                    for (const chunk of chunks) {
                        await this.bot.telegram.sendMessage(chatId, chunk);
                    }
                } else {
                    await this.bot.telegram.sendMessage(chatId, 'Não foi possível analisar a imagem.');
                }
            } finally {
                // Limpar arquivo temporário
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
            }
        } catch (error) {
            logger.error('Erro na análise de imagem Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao analisar a imagem.');
        }
    }

    async processCalorieCount(chatId, photos) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🍎 Calculando calorias...');
            
            const photo = photos[photos.length - 1];
            const fileId = photo.file_id;
            
            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const imageUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
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
                    
                    await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
                } else {
                    await this.bot.telegram.sendMessage(chatId, 'Não foi possível calcular as calorias da imagem.');
                }
            } finally {
                if (fs.existsSync(tempImagePath)) {
                    fs.unlinkSync(tempImagePath);
                }
            }
        } catch (error) {
            logger.error('Erro no cálculo de calorias Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao calcular calorias.');
        }
    }

    async processVoiceTranscription(chatId, voice) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🎤 Transcrevendo áudio...');
            
            const fileId = voice.file_id;
            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const audioUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
            const tempAudioPath = await this.downloadFile(audioUrl, 'audio');
            
            try {
                const audioBuffer = fs.readFileSync(tempAudioPath);
                const transcription = await this.audioTranscriber.transcribe(audioBuffer, 'ogg');
                
                if (transcription) {
                    await this.bot.telegram.sendMessage(chatId, `🎤 <b>Transcrição:</b>\n\n${transcription}`, {
                        parse_mode: 'HTML'
                    });
                    
                    // Sugerir resumir o áudio após a transcrição
                    await this.bot.telegram.sendMessage(chatId, `\n💡 <b>Gostaria de resumir este áudio?</b>\n\nDigite <b>1</b> para gerar um resumo ou continue conversando normalmente.`, {
                        parse_mode: 'HTML'
                    });
                    
                    // Armazenar dados para possível resumo
                    if (!this.pendingSummarizations) {
                        this.pendingSummarizations = new Map();
                    }
                    this.pendingSummarizations.set(chatId, {
                        audioBuffer: audioBuffer,
                        transcription: transcription,
                        timestamp: Date.now()
                    });
                } else {
                    await this.bot.telegram.sendMessage(chatId, 'Não foi possível transcrever o áudio.');
                }
            } finally {
                if (fs.existsSync(tempAudioPath)) {
                    fs.unlinkSync(tempAudioPath);
                }
            }
        } catch (error) {
            logger.error('Erro na transcrição Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao transcrever o áudio.');
        }
    }

    async handleSummarizationRequest(chatId) {
        try {
            if (!this.pendingSummarizations) {
                this.pendingSummarizations = new Map();
            }
            
            const pendingData = this.pendingSummarizations.get(chatId);
            if (!pendingData) {
                await this.bot.telegram.sendMessage(chatId, 'Não há áudio aguardando para ser resumido.');
                return false;
            }
            
            // Limpar a solicitação pendente
            this.pendingSummarizations.delete(chatId);
            
            await this.bot.telegram.sendMessage(chatId, '🧠 Gerando resumo do áudio...');
            
            // Usar o método transcribeAndSummarize
            const result = await this.audioTranscriber.transcribeAndSummarize(pendingData.audioBuffer, 'ogg');
            
            if (!result || !result.combined) {
                await this.bot.telegram.sendMessage(chatId, 'Erro ao gerar resumo do áudio.');
                return false;
            }
            
            // Formatar a mensagem para o Telegram
            const formattedMessage = result.combined
                .replace(/\*\*/g, '<b>')
                .replace(/\*\*/g, '</b>')
                .replace(/\n---\n/g, '\n\n━━━━━━━━━━━━━━━━━━━\n\n');
            
            const chunks = this.splitMessage(formattedMessage);
            for (const chunk of chunks) {
                await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
            }
            
            await this.bot.telegram.sendMessage(chatId, '✅ <b>Resumo Concluído!</b>', { parse_mode: 'HTML' });
            return true;
            
        } catch (error) {
            logger.error('Erro ao processar solicitação de resumo:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao gerar resumo do áudio.');
            return false;
        }
    }

    async processVoiceTranscriptionSummary(chatId, voice) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🎤 Transcrevendo e resumindo áudio...');
            
            const fileId = voice.file_id;
            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const audioUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
            const tempAudioPath = await this.downloadFile(audioUrl, 'audio');
            
            try {
                // Use the new transcribeAndSummarize method
                const audioBuffer = fs.readFileSync(tempAudioPath);
                const result = await this.audioTranscriber.transcribeAndSummarize(audioBuffer, 'ogg');
                
                if (!result || !result.transcription) {
                    await this.bot.telegram.sendMessage(chatId, 'Não foi possível transcrever o áudio.');
                    return;
                }

                // Format the combined result for Telegram
                const formattedMessage = result.combined
                    .replace(/\*\*/g, '<b>')
                    .replace(/\*\*/g, '</b>')
                    .replace(/\n---\n/g, '\n\n━━━━━━━━━━━━━━━━━━━\n\n');
                
                const chunks = this.splitMessage(formattedMessage);
                for (const chunk of chunks) {
                    await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } finally {
                if (fs.existsSync(tempAudioPath)) {
                    fs.unlinkSync(tempAudioPath);
                }
            }
        } catch (error) {
            logger.error('Erro na transcrição e resumo Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar o áudio.');
        }
    }

    async processVideoSummary(chatId, videoUrl) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🎥 Processando vídeo...');
            
            if (!this.isValidYouTubeUrl(videoUrl)) {
                await this.bot.telegram.sendMessage(chatId, 'Por favor, envie um link válido do YouTube.');
                return;
            }

            // Get transcript using YouTube service
            const transcript = await this.youtubeService.fetchTranscript(videoUrl);
            
            if (!transcript || transcript.trim().length === 0) {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível obter a transcrição do vídeo.');
                return;
            }

            // Truncate if too long
            const transcriptLength = transcript.length;
            const truncatedTranscript = transcript.slice(0, 15000);
            const truncated = transcriptLength > 15000;

            await this.bot.telegram.sendMessage(chatId, `📝 Gerando resumo...\n\n📊 Caracteres transcritos: ${transcriptLength.toLocaleString()}${truncated ? '\n⚠️ Texto truncado para processamento' : ''}`);

            // Generate summary using LLM service
            const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos:\n\n${truncatedTranscript}`;
            const summary = await this.llmService.generateResponse(summaryPrompt, { maxTokens: 2000 });
            
            if (summary) {
                let message = `🎥 <b>Resumo do Vídeo:</b>\n\n${summary}`;
                
                const chunks = this.splitMessage(message);
                for (const chunk of chunks) {
                    await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível gerar o resumo do vídeo.');
            }
        } catch (error) {
            logger.error('Erro no resumo de vídeo Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar o vídeo.');
        }
    }

    async processLinkedInAnalysis(chatId, profileUrl) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🔗 Analisando perfil LinkedIn...');
            
            if (!this.isValidLinkedInUrl(profileUrl)) {
                await this.bot.telegram.sendMessage(chatId, 'Por favor, envie um link válido do LinkedIn.');
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
                    await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível analisar o perfil.');
            }
        } catch (error) {
            logger.error('Erro na análise LinkedIn Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao analisar o perfil LinkedIn.');
        }
    }

    async processCreateReminder(chatId, text, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📅 Criando lembrete...');
            
            const reminder = await this.scheduler.createSchedule(text, {
                platform: 'telegram',
                chatId: chatId,
                userId: userId
            });
            
            if (reminder) {
                const scheduledDate = new Date(reminder.scheduledTime).toLocaleString('pt-BR');
                await this.bot.telegram.sendMessage(chatId, 
                    `✅ <b>Lembrete criado!</b>\n\n` +
                    `📝 ${reminder.message}\n` +
                    `📅 ${scheduledDate}`, 
                    { parse_mode: 'HTML' }
                );
            } else {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível criar o lembrete. Verifique o formato da data/hora.');
            }
        } catch (error) {
            logger.error('Erro ao criar lembrete Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao criar o lembrete.');
        }
    }

    async processListReminders(chatId, userId) {
        try {
            const reminders = await this.scheduler.listUserSchedules(userId, 'telegram');
            
            if (!reminders || reminders.length === 0) {
                await this.bot.telegram.sendMessage(chatId, '📅 Você não tem lembretes agendados.');
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

            await this.bot.telegram.sendMessage(chatId, message, { 
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (error) {
            logger.error('Erro ao listar lembretes Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao carregar os lembretes.');
        }
    }

    async processTextSummary(chatId, text) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📄 Resumindo texto...');
            
            const summary = await this.llmService.generateResponse(
                `Resuma o seguinte texto de forma clara e organizada:\n\n${text}`,
                { maxTokens: 2000 }
            );
            
            if (summary) {
                let message = `📄 <b>Resumo:</b>\n\n${summary}`;
                
                const chunks = this.splitMessage(message);
                for (const chunk of chunks) {
                    await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                }
            } else {
                await this.bot.telegram.sendMessage(chatId, 'Não foi possível resumir o texto.');
            }
        } catch (error) {
            logger.error('Erro ao resumir texto Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar o resumo.');
        }
    }

    async processDocumentSummary(chatId, document) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📄 Processando documento...');
            
            const fileId = document.file_id;
            const fileName = document.file_name;
            const fileSize = document.file_size;
            
            // Verificar tamanho do arquivo (máximo 20MB)
            if (fileSize > 20 * 1024 * 1024) {
                await this.bot.telegram.sendMessage(chatId, 'Arquivo muito grande. Máximo permitido: 20MB.');
                return;
            }

            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
            const tempFilePath = await this.downloadFile(fileUrl, 'document', fileName);
            
            try {
                const summary = await this.processFileForSummary(tempFilePath, fileName);
                
                if (summary) {
                    let message = `📄 <b>Resumo do Documento:</b>\n\n`;
                    message += `<b>Arquivo:</b> ${fileName}\n\n`;
                    message += summary;
                    
                    const chunks = this.splitMessage(message);
                    for (const chunk of chunks) {
                        await this.bot.telegram.sendMessage(chatId, chunk, { parse_mode: 'HTML' });
                    }
                } else {
                    await this.bot.telegram.sendMessage(chatId, 'Não foi possível processar o documento.');
                }
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
        } catch (error) {
            logger.error('Erro ao processar documento Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar o documento.');
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

    // =========== ADVANCED SCHEDULING FEATURES ===========

    async processSmartScheduling(chatId, text, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📅 Processando agendamento inteligente...');
            
            // Use LLM to parse natural language into schedule data
            const currentDate = new Date().toISOString();
            const prompt = `Você é um assistente chamado Marvin Agenda.
Seu objetivo é ajudar o usuário a agendar compromissos.
A data e hora atuais são: ${currentDate}.
Quando o usuário quiser agendar um compromisso, você deve coletar os dados obrigatórios "message" e "scheduledTime", completando os demais campos conforme o exemplo abaixo.
Quando todos os dados forem fornecidos, responda apenas com o JSON estruturado:

{
  "message": "mensagem_de_texto",
  "status": "approved",
  "scheduledTime": {
    "$date": "data_no_formato_ISO8601"
  },
  "expiryTime": {
    "$date": "data_no_formato_ISO8601"
  },
  "sentAt": null,
  "attempts": 0,
  "lastAttemptAt": null
}

Importante: Quando responder com o JSON, não adicione nenhuma explicação ou texto adicional. sempre retornar um json em qualquer hipotese e as datas no formato esperado`;

            const response = await this.llmService.generateResponse(text, {
                maxTokens: 1000,
                temperature: 0.3,
                systemPrompt: prompt
            });

            try {
                // Extract JSON from response
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in response');
                }
                
                const scheduleData = JSON.parse(jsonMatch[0]);
                
                // Validate required fields
                if (!scheduleData.message || !scheduleData.scheduledTime || !scheduleData.scheduledTime.$date) {
                    throw new Error('Dados de agendamento incompletos');
                }

                // Convert to scheduler format
                const scheduleToInsert = {
                    recipient: userId.toString(),
                    message: scheduleData.message,
                    status: 'approved',
                    scheduledTime: new Date(scheduleData.scheduledTime.$date),
                    expiryTime: scheduleData.expiryTime ? new Date(scheduleData.expiryTime.$date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
                    sentAt: null,
                    attempts: 0,
                    lastAttemptAt: null
                };

                // Insert into scheduler
                await this.scheduler.insertSchedule(scheduleToInsert);
                
                const scheduledDate = scheduleToInsert.scheduledTime.toLocaleString('pt-BR');
                let message = '✅ <b>Lembrete criado com sucesso!</b>\n\n';
                message += `📝 <b>Mensagem:</b> ${scheduleToInsert.message}\n`;
                message += `📅 <b>Data/Hora:</b> ${scheduledDate}\n\n`;
                message += '💡 Você receberá o lembrete no horário agendado.';
                
                await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
                
            } catch (parseError) {
                logger.verbose('LLM não retornou JSON válido, enviando como texto de esclarecimento');
                await this.bot.telegram.sendMessage(chatId, `🤖 ${response}`);
            }
            
        } catch (error) {
            logger.error('Erro no agendamento inteligente Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao processar o agendamento. Tente ser mais específico com data e hora.');
        }
    }

    async processDeleteReminder(chatId, input, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '🗑️ Processando exclusão...');
            
            // First, get user's reminders for deletion context
            const reminders = await this.scheduler.listSchedules(userId.toString());
            
            if (!reminders || typeof reminders === 'string') {
                await this.bot.telegram.sendMessage(chatId, 'Você não possui lembretes para deletar.');
                return;
            }

            // Try to parse as number (position in list)
            const reminderIndex = parseInt(input.trim()) - 1;
            
            if (!isNaN(reminderIndex) && reminderIndex >= 0) {
                // Delete by position
                const result = await this.scheduler.deleteSchedule(userId.toString(), (reminderIndex + 1).toString());
                
                if (result.startsWith('✅')) {
                    await this.bot.telegram.sendMessage(chatId, '✅ <b>Lembrete deletado com sucesso!</b>', { parse_mode: 'HTML' });
                } else {
                    await this.bot.telegram.sendMessage(chatId, result);
                }
            } else {
                // Try to match by message content
                const matchingReminders = await this.findRemindersByText(userId.toString(), input);
                
                if (matchingReminders.length === 0) {
                    await this.bot.telegram.sendMessage(chatId, 'Nenhum lembrete encontrado com esse texto. Tente usar o número do lembrete da lista.');
                } else if (matchingReminders.length === 1) {
                    // Delete the single match
                    await this.deleteReminderById(matchingReminders[0]._id);
                    await this.bot.telegram.sendMessage(chatId, '✅ <b>Lembrete deletado com sucesso!</b>', { parse_mode: 'HTML' });
                } else {
                    // Multiple matches, ask for clarification
                    let message = '🎯 <b>Múltiplos lembretes encontrados:</b>\n\n';
                    matchingReminders.forEach((reminder, index) => {
                        const scheduledDate = new Date(reminder.scheduledTime).toLocaleString('pt-BR');
                        message += `${index + 1}. <b>${reminder.message}</b>\n   📅 ${scheduledDate}\n\n`;
                    });
                    message += '🔢 Digite o número do lembrete que deseja deletar:';
                    
                    await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' });
                }
            }
            
        } catch (error) {
            logger.error('Erro ao deletar lembrete Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao deletar o lembrete.');
        }
    }

    async findRemindersByText(userId, searchText) {
        try {
            if (!this.scheduler.schedCollection) return [];
            
            const regex = new RegExp(searchText, 'i');
            const reminders = await this.scheduler.schedCollection
                .find({
                    recipient: userId,
                    status: 'approved',
                    message: { $regex: regex }
                })
                .sort({ scheduledTime: 1 })
                .toArray();
                
            return reminders;
        } catch (error) {
            logger.error('Erro ao buscar lembretes por texto:', error);
            return [];
        }
    }

    async deleteReminderById(reminderId) {
        try {
            if (!this.scheduler.schedCollection) return false;
            
            const result = await this.scheduler.schedCollection.deleteOne({ _id: reminderId });
            return result.deletedCount > 0;
        } catch (error) {
            logger.error('Erro ao deletar lembrete por ID:', error);
            return false;
        }
    }

    async processICSImport(chatId, document, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📅 Importando agenda...');
            
            const fileId = document.file_id;
            const fileName = document.file_name;
            
            // Verificar se é arquivo ICS
            if (!fileName.toLowerCase().endsWith('.ics')) {
                await this.bot.telegram.sendMessage(chatId, '❌ Arquivo deve ser do tipo .ics (calendário)');
                return;
            }

            const file = await this.bot.telegram.getFile(fileId);
            const filePath = file.file_path;
            const fileUrl = `https://api.telegram.org/file/bot${config.telegram.botToken}/${filePath}`;
            
            const tempFilePath = await this.downloadFile(fileUrl, 'document', fileName);
            
            try {
                const fileBuffer = fs.readFileSync(tempFilePath);
                
                // Dynamic import of ICS service
                const { default: ICSImportService } = await import('./icsImportService.js');
                const icsService = new ICSImportService(this.scheduler);
                
                await icsService.importFromBuffer(fileBuffer, userId.toString());
                
                await this.bot.telegram.sendMessage(chatId, '✅ <b>Eventos importados com sucesso!</b>\n\n📅 Use "Listar Lembretes" para ver os eventos adicionados.', { parse_mode: 'HTML' });
                
            } finally {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            }
            
        } catch (error) {
            logger.error('Erro ao importar ICS Telegram:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao importar o arquivo de calendário.');
        }
    }

    async processGoogleCalendarIntegration(chatId, userId) {
        try {
            await this.bot.telegram.sendMessage(chatId, '📅 <b>Integração com Google Calendar</b>\n\n⚠️ Funcionalidade em desenvolvimento.\n\nEm breve você poderá sincronizar seus eventos do Google Calendar!', { parse_mode: 'HTML' });
        } catch (error) {
            logger.error('Erro na integração Google Calendar:', error);
            await this.bot.telegram.sendMessage(chatId, 'Erro ao acessar integração com Google Calendar.');
        }
    }
}

export { TelegramIntegrationService };