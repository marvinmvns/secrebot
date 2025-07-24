import logger from '../utils/logger.js';

/**
 * Serviço para gerenciar sessões de usuários no WhatsApp
 * Armazena estado de conversação por número de telefone
 */
class SessionService {
    constructor(db) {
        this.collection = db.collection('sessions');
    }

    /**
     * Inicializa o serviço e cria índices necessários
     */
    async init() {
        try {
            await this.createIndexes();
            logger.info('✅ SessionService inicializado');
            return true;
        } catch (error) {
            logger.error('❌ Erro ao inicializar SessionService:', error);
            throw error;
        }
    }

    /**
     * Cria índices necessários para performance
     */
    async createIndexes() {
        try {
            await this.collection.createIndex(
                { phoneNumber: 1 }, 
                { unique: true, background: true }
            );
            
            await this.collection.createIndex(
                { lastActivity: 1 }, 
                { expireAfterSeconds: 86400 * 30, background: true } // 30 dias
            );
            
            logger.debug('📊 Índices da coleção sessions criados');
        } catch (error) {
            logger.error('❌ Erro ao criar índices da coleção sessions:', error);
            throw error;
        }
    }

    /**
     * Recupera a sessão de um usuário pelo número de telefone
     */
    async getSession(phoneNumber) {
        try {
            const session = await this.collection.findOne({ phoneNumber });
            
            if (session) {
                // Atualiza última atividade
                await this.updateLastActivity(phoneNumber);
                logger.debug(`📱 Sessão recuperada para ${phoneNumber}`);
                return {
                    chatMode: session.chatMode || null,
                    navigationState: session.navigationState || 'MAIN_MENU',
                    flowContext: session.flowContext || null,
                    llmContext: session.llmContext || {},
                    customData: session.customData || {}
                };
            }
            
            return null;
        } catch (error) {
            logger.error(`❌ Erro ao recuperar sessão para ${phoneNumber}:`, error);
            return null;
        }
    }

    /**
     * Salva ou atualiza a sessão de um usuário
     */
    async saveSession(phoneNumber, sessionData) {
        try {
            const updateData = {
                phoneNumber,
                chatMode: sessionData.chatMode || null,
                navigationState: sessionData.navigationState || 'MAIN_MENU',
                flowContext: sessionData.flowContext || null,
                llmContext: sessionData.llmContext || {},
                customData: sessionData.customData || {},
                lastActivity: new Date(),
                updatedAt: new Date()
            };

            const result = await this.collection.updateOne(
                { phoneNumber },
                { 
                    $set: updateData,
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );

            logger.debug(`💾 Sessão salva para ${phoneNumber}`);
            return result.acknowledged;
        } catch (error) {
            logger.error(`❌ Erro ao salvar sessão para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Define o modo de chat para um usuário
     */
    async setChatMode(phoneNumber, mode) {
        try {
            const updateData = {
                chatMode: mode,
                lastActivity: new Date(),
                updatedAt: new Date()
            };

            await this.collection.updateOne(
                { phoneNumber },
                { 
                    $set: updateData,
                    $setOnInsert: { 
                        phoneNumber,
                        navigationState: 'MAIN_MENU',
                        flowContext: null,
                        llmContext: {},
                        customData: {},
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            logger.debug(`🔧 Modo ${mode} definido para ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao definir modo para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Define o estado de navegação para um usuário
     */
    async setNavigationState(phoneNumber, state) {
        try {
            const updateData = {
                navigationState: state,
                lastActivity: new Date(),
                updatedAt: new Date()
            };

            await this.collection.updateOne(
                { phoneNumber },
                { 
                    $set: updateData,
                    $setOnInsert: { 
                        phoneNumber,
                        chatMode: null,
                        flowContext: null,
                        llmContext: {},
                        customData: {},
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            logger.debug(`📍 Estado de navegação ${state} definido para ${phoneNumber}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao definir estado de navegação para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Calcula o tamanho em bytes de um contexto LLM
     */
    calculateContextSize(context) {
        return Buffer.byteLength(JSON.stringify(context), 'utf8');
    }

    /**
     * Verifica se o contexto excede o limite de 15KB
     */
    isContextOversized(context) {
        const sizeInBytes = this.calculateContextSize(context);
        const limitInBytes = 15 * 1024; // 15KB
        return sizeInBytes > limitInBytes;
    }

    /**
     * Reduz o contexto removendo mensagens antigas até ficar sob o limite
     */
    truncateContext(context) {
        if (!Array.isArray(context) || context.length === 0) {
            return context;
        }

        const limitInBytes = 15 * 1024; // 15KB
        let truncatedContext = [...context];
        
        // Se já está sob o limite, retorna como está
        if (this.calculateContextSize(truncatedContext) <= limitInBytes) {
            return truncatedContext;
        }

        // Sempre manter a primeira mensagem se for uma mensagem de sistema
        const hasSystemMessage = truncatedContext[0]?.role === 'system';
        const startIndex = hasSystemMessage ? 1 : 0;

        // Estratégia 1: Remove mensagens do meio (mais antigas) até ficar sob o limite
        while (this.calculateContextSize(truncatedContext) > limitInBytes && truncatedContext.length > startIndex + 1) {
            truncatedContext.splice(startIndex, 1);
        }

        // Estratégia 2: Se ainda está muito grande, manter apenas as últimas mensagens
        if (this.calculateContextSize(truncatedContext) > limitInBytes && truncatedContext.length > startIndex) {
            const systemMsg = hasSystemMessage ? [truncatedContext[0]] : [];
            
            // Pega as últimas mensagens uma por uma até ficar sob o limite
            let finalContext = [...systemMsg];
            
            // Adiciona mensagens do final para o início até não exceder o limite
            for (let i = truncatedContext.length - 1; i >= startIndex; i--) {
                const testContext = [truncatedContext[i], ...finalContext.slice(systemMsg.length)];
                const testContextWithSystem = [...systemMsg, ...testContext];
                
                if (this.calculateContextSize(testContextWithSystem) <= limitInBytes) {
                    finalContext = testContextWithSystem;
                } else {
                    break;
                }
            }
            
            truncatedContext = finalContext;
        }

        // Estratégia 3: Última tentativa - truncar o conteúdo das mensagens
        if (this.calculateContextSize(truncatedContext) > limitInBytes && truncatedContext.length > 0) {
            // Trunca o conteúdo das mensagens não-sistema
            for (let i = startIndex; i < truncatedContext.length; i++) {
                while (this.calculateContextSize(truncatedContext) > limitInBytes && truncatedContext[i].content.length > 50) {
                    // Reduz o conteúdo da mensagem pela metade
                    const content = truncatedContext[i].content;
                    truncatedContext[i].content = content.substring(0, Math.floor(content.length * 0.7)) + '...';
                }
            }
        }

        return truncatedContext;
    }

    /**
     * Salva contexto LLM para um usuário com verificação de tamanho
     */
    async saveLLMContext(phoneNumber, mode, context) {
        try {
            let contextToSave = context;
            
            // Verificar se o contexto excede 15KB
            if (this.isContextOversized(context)) {
                logger.warn(`⚠️ Contexto LLM para ${phoneNumber} modo ${mode} excede 15KB (${this.calculateContextSize(context)} bytes), truncando...`);
                contextToSave = this.truncateContext(context);
                logger.info(`✂️ Contexto truncado para ${this.calculateContextSize(contextToSave)} bytes`);
            }

            const updateData = {
                [`llmContext.${mode}`]: contextToSave,
                lastActivity: new Date(),
                updatedAt: new Date()
            };

            await this.collection.updateOne(
                { phoneNumber },
                { 
                    $set: updateData,
                    $setOnInsert: { 
                        phoneNumber,
                        chatMode: null,
                        navigationState: 'MAIN_MENU',
                        flowContext: null,
                        customData: {},
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            logger.debug(`🧠 Contexto LLM salvo para ${phoneNumber} no modo ${mode} (${this.calculateContextSize(contextToSave)} bytes)`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao salvar contexto LLM para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Limpa contexto LLM para um usuário e modo específico
     */
    async clearLLMContext(phoneNumber, mode) {
        try {
            await this.collection.updateOne(
                { phoneNumber },
                { 
                    $unset: { [`llmContext.${mode}`]: "" },
                    $set: { 
                        lastActivity: new Date(),
                        updatedAt: new Date()
                    }
                }
            );

            logger.debug(`🧹 Contexto LLM limpo para ${phoneNumber} no modo ${mode}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao limpar contexto LLM para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Remove a sessão de um usuário
     */
    async clearSession(phoneNumber) {
        try {
            const result = await this.collection.deleteOne({ phoneNumber });
            logger.debug(`🗑️ Sessão removida para ${phoneNumber}`);
            return result.deletedCount > 0;
        } catch (error) {
            logger.error(`❌ Erro ao remover sessão para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Atualiza timestamp de última atividade
     */
    async updateLastActivity(phoneNumber) {
        try {
            await this.collection.updateOne(
                { phoneNumber },
                { $set: { lastActivity: new Date() } }
            );
        } catch (error) {
            logger.error(`❌ Erro ao atualizar última atividade para ${phoneNumber}:`, error);
        }
    }

    /**
     * Salva dados customizados na sessão
     */
    async saveCustomData(phoneNumber, key, value) {
        try {
            const updateData = {
                [`customData.${key}`]: value,
                lastActivity: new Date(),
                updatedAt: new Date()
            };

            await this.collection.updateOne(
                { phoneNumber },
                { 
                    $set: updateData,
                    $setOnInsert: { 
                        phoneNumber,
                        chatMode: null,
                        navigationState: 'MAIN_MENU',
                        flowContext: null,
                        llmContext: {},
                        customData: {},
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            logger.debug(`📦 Dados customizados salvos para ${phoneNumber}: ${key}`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao salvar dados customizados para ${phoneNumber}:`, error);
            return false;
        }
    }

    /**
     * Lista sessões ativas (com atividade nos últimos 7 dias)
     */
    async getActiveSessions(days = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const sessions = await this.collection.find(
                { lastActivity: { $gte: cutoffDate } },
                { projection: { phoneNumber: 1, chatMode: 1, lastActivity: 1 } }
            ).toArray();

            return sessions;
        } catch (error) {
            logger.error('❌ Erro ao listar sessões ativas:', error);
            return [];
        }
    }

    /**
     * Limpa sessões antigas (mais de 30 dias sem atividade)
     */
    async cleanupOldSessions() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 30);

            const result = await this.collection.deleteMany({
                lastActivity: { $lt: cutoffDate }
            });

            logger.info(`🧹 ${result.deletedCount} sessões antigas removidas`);
            return result.deletedCount;
        } catch (error) {
            logger.error('❌ Erro ao limpar sessões antigas:', error);
            return 0;
        }
    }
}

export default SessionService;