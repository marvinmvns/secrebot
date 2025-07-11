import analyticsService from '../services/analyticsService.js';
import logger from '../utils/logger.js';

class AnalyticsHook {
    constructor() {
        this.enabled = true;
        this.activeInteractions = new Map();
    }

    async logIncomingMessage(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                messageType,
                messageContent,
                sessionId,
                flowId = null,
                nodeId = null,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType,
                messageContent: this.sanitizeContent(messageContent),
                direction: 'incoming',
                sessionId,
                flowId,
                nodeId,
                metadata: {
                    ...metadata,
                    timestamp: new Date(),
                    messageLength: messageContent ? messageContent.length : 0
                }
            };

            await analyticsService.recordInteraction(interactionData);
            
            this.activeInteractions.set(`${phoneNumber}_${sessionId}`, {
                startTime: Date.now(),
                lastActivity: Date.now(),
                messageCount: (this.activeInteractions.get(`${phoneNumber}_${sessionId}`)?.messageCount || 0) + 1
            });

            logger.debug(`Analytics: Incoming message logged for ${phoneNumber} on ${platform}`);

        } catch (error) {
            logger.error('Error logging incoming message analytics:', error);
        }
    }

    async logOutgoingMessage(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                messageType,
                messageContent,
                sessionId,
                flowId = null,
                nodeId = null,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType,
                messageContent: this.sanitizeContent(messageContent),
                direction: 'outgoing',
                sessionId,
                flowId,
                nodeId,
                metadata: {
                    ...metadata,
                    timestamp: new Date(),
                    messageLength: messageContent ? messageContent.length : 0
                }
            };

            await analyticsService.recordInteraction(interactionData);

            const sessionKey = `${phoneNumber}_${sessionId}`;
            if (this.activeInteractions.has(sessionKey)) {
                this.activeInteractions.get(sessionKey).lastActivity = Date.now();
            }

            logger.debug(`Analytics: Outgoing message logged for ${phoneNumber} on ${platform}`);

        } catch (error) {
            logger.error('Error logging outgoing message analytics:', error);
        }
    }

    async logFlowStart(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                flowId,
                flowName,
                sessionId,
                trigger,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType: 'flow_start',
                messageContent: `Flow iniciado: ${flowName}`,
                direction: 'system',
                sessionId,
                flowId,
                nodeId: null,
                metadata: {
                    ...metadata,
                    trigger,
                    flowName,
                    timestamp: new Date()
                }
            };

            await analyticsService.recordInteraction(interactionData);
            await analyticsService.incrementSession(phoneNumber);

            logger.debug(`Analytics: Flow start logged for ${phoneNumber} - Flow: ${flowName}`);

        } catch (error) {
            logger.error('Error logging flow start analytics:', error);
        }
    }

    async logFlowEnd(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                flowId,
                flowName,
                sessionId,
                completionStatus,
                duration,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType: 'flow_end',
                messageContent: `Flow finalizado: ${flowName} (${completionStatus})`,
                direction: 'system',
                sessionId,
                flowId,
                nodeId: null,
                metadata: {
                    ...metadata,
                    flowName,
                    completionStatus,
                    duration,
                    timestamp: new Date()
                }
            };

            await analyticsService.recordInteraction(interactionData);

            const sessionKey = `${phoneNumber}_${sessionId}`;
            if (this.activeInteractions.has(sessionKey)) {
                this.activeInteractions.delete(sessionKey);
            }

            logger.debug(`Analytics: Flow end logged for ${phoneNumber} - Flow: ${flowName} (${completionStatus})`);

        } catch (error) {
            logger.error('Error logging flow end analytics:', error);
        }
    }

    async logCommand(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                command,
                parameters,
                sessionId,
                success,
                executionTime,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType: 'command',
                messageContent: `Comando: ${command}`,
                direction: 'system',
                sessionId,
                flowId: null,
                nodeId: null,
                metadata: {
                    ...metadata,
                    command,
                    parameters,
                    success,
                    executionTime,
                    timestamp: new Date()
                }
            };

            await analyticsService.recordInteraction(interactionData);

            logger.debug(`Analytics: Command logged for ${phoneNumber} - Command: ${command} (${success ? 'success' : 'failed'})`);

        } catch (error) {
            logger.error('Error logging command analytics:', error);
        }
    }

    async logError(data) {
        if (!this.enabled) return;

        try {
            const {
                phoneNumber,
                platform,
                errorType,
                errorMessage,
                sessionId,
                flowId = null,
                nodeId = null,
                metadata = {}
            } = data;

            const interactionData = {
                phoneNumber,
                platform,
                messageType: 'error',
                messageContent: `Erro: ${errorType}`,
                direction: 'system',
                sessionId,
                flowId,
                nodeId,
                metadata: {
                    ...metadata,
                    errorType,
                    errorMessage: this.sanitizeError(errorMessage),
                    timestamp: new Date()
                }
            };

            await analyticsService.recordInteraction(interactionData);

            logger.debug(`Analytics: Error logged for ${phoneNumber} - Error: ${errorType}`);

        } catch (error) {
            logger.error('Error logging error analytics:', error);
        }
    }

    async getSessionStats() {
        const activeSessions = Array.from(this.activeInteractions.entries()).map(([key, data]) => {
            const [phoneNumber, sessionId] = key.split('_');
            return {
                phoneNumber,
                sessionId,
                duration: Date.now() - data.startTime,
                messageCount: data.messageCount,
                lastActivity: data.lastActivity
            };
        });

        return {
            totalActiveSessions: activeSessions.length,
            activeSessions
        };
    }

    sanitizeContent(content) {
        if (!content) return '';
        
        const maxLength = 500;
        let sanitized = content.toString();
        
        sanitized = sanitized.replace(/[^\w\s\-.,!?@#$%&*()+=[\]{}|;:'"<>]/g, '');
        
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength) + '...';
        }
        
        return sanitized;
    }

    sanitizeError(error) {
        if (!error) return '';
        
        let sanitized = error.toString();
        
        sanitized = sanitized.replace(/password|token|key|secret|credential/gi, '[REDACTED]');
        sanitized = sanitized.replace(/\b\d{11,}\b/g, '[PHONE_REDACTED]');
        
        return sanitized.substring(0, 200);
    }

    createWhatsAppWrapper(originalBot) {
        const originalHandleMessage = originalBot.handleMessage.bind(originalBot);
        const analyticsHook = this;

        originalBot.handleMessage = async function(msg) {
            const startTime = Date.now();
            const contact = msg.getContact();
            const contactId = contact ? contact.number : msg.from;
            const messageType = msg.type;
            const messageContent = msg.body || `[${messageType.toUpperCase()}]`;

            try {
                await analyticsHook.logIncomingMessage({
                    phoneNumber: contactId,
                    platform: 'whatsapp',
                    messageType,
                    messageContent,
                    sessionId: contactId + '_' + Date.now(),
                    metadata: {
                        messageId: msg.id.id,
                        isForwarded: msg.isForwarded,
                        hasMedia: msg.hasMedia,
                        fromGroup: msg.from.includes('@g.us')
                    }
                });

                const result = await originalHandleMessage(msg);
                
                const executionTime = Date.now() - startTime;
                logger.debug(`WhatsApp message processed in ${executionTime}ms for ${contactId}`);

                return result;
            } catch (error) {
                await analyticsHook.logError({
                    phoneNumber: contactId,
                    platform: 'whatsapp',
                    errorType: 'message_processing',
                    errorMessage: error.message,
                    sessionId: contactId + '_' + Date.now(),
                    metadata: {
                        messageType,
                        executionTime: Date.now() - startTime
                    }
                });
                throw error;
            }
        };

        return originalBot;
    }

    createTelegramWrapper(originalBot) {
        const analyticsHook = this;

        const wrapHandler = (originalHandler, handlerName) => {
            return async function(ctx) {
                const startTime = Date.now();
                const userId = ctx.from.id.toString();
                const messageType = handlerName.replace('handle', '').replace('Message', '').toLowerCase();
                let messageContent = '';

                if (ctx.message) {
                    messageContent = ctx.message.text || 
                                   ctx.message.caption || 
                                   `[${messageType.toUpperCase()}]`;
                }

                try {
                    await analyticsHook.logIncomingMessage({
                        phoneNumber: userId,
                        platform: 'telegram',
                        messageType,
                        messageContent,
                        sessionId: userId + '_' + Date.now(),
                        metadata: {
                            messageId: ctx.message?.message_id,
                            username: ctx.from.username,
                            firstName: ctx.from.first_name,
                            chatType: ctx.chat.type
                        }
                    });

                    const result = await originalHandler.call(this, ctx);
                    
                    const executionTime = Date.now() - startTime;
                    logger.debug(`Telegram ${handlerName} processed in ${executionTime}ms for ${userId}`);

                    return result;
                } catch (error) {
                    await analyticsHook.logError({
                        phoneNumber: userId,
                        platform: 'telegram',
                        errorType: 'message_processing',
                        errorMessage: error.message,
                        sessionId: userId + '_' + Date.now(),
                        metadata: {
                            messageType,
                            handlerName,
                            executionTime: Date.now() - startTime
                        }
                    });
                    throw error;
                }
            };
        };

        if (originalBot.handleTextMessage) {
            originalBot.handleTextMessage = wrapHandler(originalBot.handleTextMessage.bind(originalBot), 'handleTextMessage');
        }
        if (originalBot.handleVoiceMessage) {
            originalBot.handleVoiceMessage = wrapHandler(originalBot.handleVoiceMessage.bind(originalBot), 'handleVoiceMessage');
        }
        if (originalBot.handlePhotoMessage) {
            originalBot.handlePhotoMessage = wrapHandler(originalBot.handlePhotoMessage.bind(originalBot), 'handlePhotoMessage');
        }
        if (originalBot.handleDocumentMessage) {
            originalBot.handleDocumentMessage = wrapHandler(originalBot.handleDocumentMessage.bind(originalBot), 'handleDocumentMessage');
        }

        return originalBot;
    }

    enable() {
        this.enabled = true;
        logger.info('Analytics hook enabled');
    }

    disable() {
        this.enabled = false;
        logger.info('Analytics hook disabled');
    }
}

export default new AnalyticsHook();