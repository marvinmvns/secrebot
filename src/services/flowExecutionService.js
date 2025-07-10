import logger from '../utils/logger.js';

/**
 * Serviço para execução de fluxos visuais criados no Flow Builder
 * Integra com o sistema WhatsApp existente para processar fluxos no-code
 */
class FlowExecutionService {
    constructor(whatsappBot, llmService) {
        this.bot = whatsappBot;
        this.llmService = llmService;
        this.activeFlows = new Map(); // userId -> flowState
        this.loadedFlows = new Map(); // flowId -> flowData
        this.userVariables = new Map(); // userId -> variables
        this.executionHistory = new Map(); // userId -> history
    }

    /**
     * Inicializa o serviço carregando fluxos salvos
     * @param {Object} flowService - Instância do FlowService
     */
    async init(flowService) {
        try {
            if (!flowService) {
                logger.warn('FlowService não fornecido para FlowExecutionService');
                return;
            }

            const result = await flowService.listFlows();
            
            if (result.success && result.flows) {
                for (const flowSummary of result.flows) {
                    try {
                        const flowData = await flowService.loadFlow(flowSummary.id);
                        if (flowData.success) {
                            this.loadFlow(flowData.flow);
                        }
                    } catch (error) {
                        logger.error(`Erro ao carregar fluxo ${flowSummary.id}:`, error);
                    }
                }
            }

            logger.info(`✅ FlowExecutionService inicializado com ${this.loadedFlows.size} fluxos`);
        } catch (error) {
            logger.error('❌ Erro ao inicializar FlowExecutionService:', error);
        }
    }

    /**
     * Carrega um fluxo na memória para execução
     * @param {Object} flowData - Dados do fluxo exportados do Flow Builder
     */
    loadFlow(flowData) {
        try {
            // Validar estrutura do fluxo
            if (!this.validateFlow(flowData)) {
                throw new Error('Estrutura do fluxo inválida');
            }

            // Processar nós para criar um grafo de execução
            const processedFlow = this.processFlowData(flowData);
            
            this.loadedFlows.set(flowData.id || flowData.name, processedFlow);
            
            logger.info(`✅ Fluxo '${flowData.name}' carregado com sucesso`);
            return true;
        } catch (error) {
            logger.error(`❌ Erro ao carregar fluxo: ${error.message}`);
            throw error;
        }
    }

    /**
     * Valida se um fluxo tem estrutura válida
     * @param {Object} flowData - Dados do fluxo
     * @returns {boolean}
     */
    validateFlow(flowData) {
        if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
            return false;
        }

        if (!flowData.connections || !Array.isArray(flowData.connections)) {
            return false;
        }

        // Verificar se existe pelo menos um nó de início
        const startNodes = flowData.nodes.filter(node => node.type === 'start');
        if (startNodes.length === 0) {
            return false;
        }

        // Verificar se todos os nós têm IDs únicos
        const nodeIds = flowData.nodes.map(node => node.id);
        const uniqueIds = new Set(nodeIds);
        if (nodeIds.length !== uniqueIds.size) {
            return false;
        }

        return true;
    }

    /**
     * Processa dados do fluxo para criar estrutura de execução
     * @param {Object} flowData - Dados brutos do fluxo
     * @returns {Object} Fluxo processado
     */
    processFlowData(flowData) {
        const processedFlow = {
            id: flowData.id || flowData.name,
            name: flowData.name,
            description: flowData.description,
            nodes: new Map(),
            connections: new Map(),
            startNodes: [],
            metadata: flowData.metadata || {}
        };

        // Processar nós
        flowData.nodes.forEach(node => {
            const processedNode = {
                ...node,
                inputs: [],
                outputs: []
            };

            processedFlow.nodes.set(node.id, processedNode);

            if (node.type === 'start') {
                processedFlow.startNodes.push(node.id);
            }
        });

        // Processar conexões
        flowData.connections.forEach(connection => {
            const fromNode = processedFlow.nodes.get(connection.from);
            const toNode = processedFlow.nodes.get(connection.to);

            if (fromNode && toNode) {
                fromNode.outputs.push(connection.to);
                toNode.inputs.push(connection.from);
                
                processedFlow.connections.set(connection.id, connection);
            }
        });

        return processedFlow;
    }

    /**
     * Inicia execução de um fluxo para um usuário
     * @param {string} userId - ID do usuário
     * @param {string} flowId - ID do fluxo
     * @param {string} trigger - Gatilho que iniciou o fluxo
     * @param {Object} initialData - Dados iniciais
     */
    async startFlowExecution(userId, flowId, trigger, initialData = {}) {
        try {
            const flow = this.loadedFlows.get(flowId);
            if (!flow) {
                throw new Error(`Fluxo '${flowId}' não encontrado`);
            }

            // Encontrar nó de início apropriado
            const startNode = this.findStartNode(flow, trigger);
            if (!startNode) {
                throw new Error('Nenhum nó de início encontrado para este gatilho');
            }

            // Criar estado de execução para o usuário
            const executionState = {
                userId,
                flowId,
                currentNodeId: startNode.id,
                variables: new Map(),
                history: [],
                startTime: new Date(),
                status: 'running',
                waitingForInput: false,
                inputTimeout: null
            };

            // Inicializar variáveis
            Object.entries(initialData).forEach(([key, value]) => {
                executionState.variables.set(key, value);
            });

            this.activeFlows.set(userId, executionState);
            this.userVariables.set(userId, executionState.variables);

            logger.info(`🚀 Iniciando execução do fluxo '${flowId}' para usuário ${userId}`);

            // Executar primeiro nó
            await this.executeNode(executionState, startNode);

        } catch (error) {
            logger.error(`❌ Erro ao iniciar execução do fluxo: ${error.message}`);
            throw error;
        }
    }

    /**
     * Encontra o nó de início apropriado baseado no gatilho
     * @param {Object} flow - Fluxo processado
     * @param {string} trigger - Gatilho
     * @returns {Object|null} Nó de início
     */
    findStartNode(flow, trigger) {
        const startNodes = flow.startNodes.map(id => flow.nodes.get(id));
        
        // Procurar nó de início específico para o gatilho
        for (const node of startNodes) {
            if (node.data.trigger === 'keyword' && node.data.value === trigger) {
                return node;
            }
        }

        // Procurar nó de início genérico
        for (const node of startNodes) {
            if (node.data.trigger === 'any') {
                return node;
            }
        }

        // Retornar primeiro nó de início se nenhum específico for encontrado
        return startNodes[0] || null;
    }

    /**
     * Executa um nó específico
     * @param {Object} executionState - Estado da execução
     * @param {Object} node - Nó a ser executado
     */
    async executeNode(executionState, node) {
        try {
            logger.info(`🔄 Executando nó ${node.id} (${node.type}) para usuário ${executionState.userId}`);

            // Adicionar ao histórico
            executionState.history.push({
                nodeId: node.id,
                nodeType: node.type,
                timestamp: new Date(),
                data: node.data
            });

            // Executar baseado no tipo do nó
            let result;
            switch (node.type) {
                case 'start':
                    result = await this.executeStartNode(executionState, node);
                    break;
                case 'message':
                    result = await this.executeMessageNode(executionState, node);
                    break;
                case 'condition':
                    result = await this.executeConditionNode(executionState, node);
                    break;
                case 'input':
                    result = await this.executeInputNode(executionState, node);
                    break;
                case 'delay':
                    result = await this.executeDelayNode(executionState, node);
                    break;
                case 'llm':
                    result = await this.executeLlmNode(executionState, node);
                    break;
                case 'webhook':
                    result = await this.executeWebhookNode(executionState, node);
                    break;
                case 'youtube':
                    result = await this.executeYouTubeNode(executionState, node);
                    break;
                case 'calories':
                    result = await this.executeCaloriesNode(executionState, node);
                    break;
                case 'linkedin':
                    result = await this.executeLinkedInNode(executionState, node);
                    break;
                case 'telegram':
                    result = await this.executeTelegramNode(executionState, node);
                    break;
                case 'tts':
                    result = await this.executeTTSNode(executionState, node);
                    break;
                case 'transcribe':
                    result = await this.executeTranscribeNode(executionState, node);
                    break;
                case 'calendar':
                    result = await this.executeCalendarNode(executionState, node);
                    break;
                case 'scheduler':
                    result = await this.executeSchedulerNode(executionState, node);
                    break;
                case 'variable':
                    result = await this.executeVariableNode(executionState, node);
                    break;
                case 'end':
                    result = await this.executeEndNode(executionState, node);
                    break;
                default:
                    throw new Error(`Tipo de nó não suportado: ${node.type}`);
            }

            // Processar resultado
            if (result && result.nextNodeId) {
                await this.moveToNextNode(executionState, result.nextNodeId);
            } else if (result && result.wait) {
                // Nó está aguardando entrada
                executionState.waitingForInput = true;
            } else if (result && result.end) {
                // Finalizar execução
                await this.endFlowExecution(executionState.userId);
            }

        } catch (error) {
            logger.error(`❌ Erro ao executar nó ${node.id}: ${error.message}`);
            await this.handleExecutionError(executionState, error);
        }
    }

    /**
     * Executa nó de início
     */
    async executeStartNode(executionState, node) {
        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de mensagem
     */
    async executeMessageNode(executionState, node) {
        const message = this.replaceVariables(node.data.text, executionState.variables);
        
        // Aplicar delay se configurado
        if (node.data.delay && node.data.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, node.data.delay * 1000));
        }

        // Enviar mensagem via WhatsApp
        await this.sendWhatsAppMessage(executionState.userId, message);

        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de condição
     */
    async executeConditionNode(executionState, node) {
        const userInput = executionState.variables.get('userInput') || '';
        const conditionValue = node.data.value;
        let conditionMet = false;

        switch (node.data.condition) {
            case 'contains':
                conditionMet = userInput.toLowerCase().includes(conditionValue.toLowerCase());
                break;
            case 'equals':
                conditionMet = userInput.toLowerCase() === conditionValue.toLowerCase();
                break;
            case 'starts':
                conditionMet = userInput.toLowerCase().startsWith(conditionValue.toLowerCase());
                break;
            case 'ends':
                conditionMet = userInput.toLowerCase().endsWith(conditionValue.toLowerCase());
                break;
            case 'regex':
                try {
                    const regex = new RegExp(conditionValue, 'i');
                    conditionMet = regex.test(userInput);
                } catch (e) {
                    logger.warn(`Regex inválida em condição: ${conditionValue}`);
                }
                break;
        }

        // Determinar próximo nó baseado na condição
        const nextNodeIndex = conditionMet ? 0 : 1;
        const nextNodeId = node.outputs[nextNodeIndex];

        return { nextNodeId };
    }

    /**
     * Executa nó de entrada
     */
    async executeInputNode(executionState, node) {
        // Configurar timeout para entrada
        const timeout = node.data.timeout || 60;
        
        executionState.inputTimeout = setTimeout(async () => {
            // Timeout atingido, continuar para próximo nó
            executionState.waitingForInput = false;
            if (node.outputs.length > 1) {
                await this.moveToNextNode(executionState, node.outputs[1]); // Caminho de timeout
            }
        }, timeout * 1000);

        return { wait: true };
    }

    /**
     * Executa nó de delay
     */
    async executeDelayNode(executionState, node) {
        const seconds = node.data.seconds || 3;
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de LLM
     */
    async executeLlmNode(executionState, node) {
        let prompt = node.data.prompt || '';
        
        // Substituir variáveis no prompt
        prompt = this.replaceVariables(prompt, executionState.variables);
        
        // Adicionar contexto se habilitado
        if (node.data.context) {
            const history = executionState.history
                .filter(h => h.nodeType === 'message')
                .map(h => h.data.text)
                .join('\n');
            
            if (history) {
                prompt = `Contexto da conversa:\n${history}\n\nPrompt atual: ${prompt}`;
            }
        }

        // Chamar LLM
        const response = await this.llmService.getAssistantResponse(executionState.userId, prompt);
        
        // Enviar resposta
        await this.sendWhatsAppMessage(executionState.userId, response);

        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de webhook
     */
    async executeWebhookNode(executionState, node) {
        const { url, method, headers, body } = node.data;
        
        if (!url) {
            throw new Error('URL do webhook não configurada');
        }

        // Preparar dados para envio
        let requestBody = body;
        if (typeof body === 'string') {
            requestBody = this.replaceVariables(body, executionState.variables);
        }

        // Fazer requisição
        const response = await fetch(url, {
            method: method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: requestBody
        });

        if (!response.ok) {
            throw new Error(`Webhook falhou: ${response.status} ${response.statusText}`);
        }

        // Salvar resposta como variável
        const responseData = await response.json();
        executionState.variables.set('webhookResponse', responseData);

        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de fim
     */
    async executeEndNode(executionState, node) {
        if (node.data.message) {
            const message = this.replaceVariables(node.data.message, executionState.variables);
            await this.sendWhatsAppMessage(executionState.userId, message);
        }

        return { end: true };
    }

    /**
     * Move para o próximo nó na execução
     */
    async moveToNextNode(executionState, nextNodeId) {
        const flow = this.loadedFlows.get(executionState.flowId);
        const nextNode = flow.nodes.get(nextNodeId);

        if (!nextNode) {
            logger.warn(`Nó ${nextNodeId} não encontrado, finalizando execução`);
            await this.endFlowExecution(executionState.userId);
            return;
        }

        executionState.currentNodeId = nextNodeId;
        await this.executeNode(executionState, nextNode);
    }

    /**
     * Processa entrada do usuário quando um fluxo está aguardando
     */
    async processUserInput(userId, message) {
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState || !executionState.waitingForInput) {
            return false; // Não há fluxo aguardando entrada
        }

        // Limpar timeout se existir
        if (executionState.inputTimeout) {
            clearTimeout(executionState.inputTimeout);
            executionState.inputTimeout = null;
        }

        // Salvar entrada como variável
        const currentNode = this.getCurrentNode(executionState);
        const variableName = currentNode.data.variable || 'userInput';
        executionState.variables.set(variableName, message);

        // Continuar execução
        executionState.waitingForInput = false;
        
        if (currentNode.outputs.length > 0) {
            await this.moveToNextNode(executionState, currentNode.outputs[0]);
        }

        return true;
    }

    /**
     * Obtém o nó atual da execução
     */
    getCurrentNode(executionState) {
        const flow = this.loadedFlows.get(executionState.flowId);
        return flow.nodes.get(executionState.currentNodeId);
    }

    /**
     * Substitui variáveis em uma string
     */
    replaceVariables(text, variables) {
        let result = text;
        
        variables.forEach((value, key) => {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, value);
        });

        return result;
    }

    /**
     * Envia mensagem via WhatsApp
     */
    async sendWhatsAppMessage(userId, message) {
        const client = this.bot.getClient();
        if (client) {
            await client.sendMessage(userId, message);
        }
    }

    /**
     * Finaliza execução do fluxo
     */
    async endFlowExecution(userId) {
        const executionState = this.activeFlows.get(userId);
        
        if (executionState) {
            // Limpar timeout se existir
            if (executionState.inputTimeout) {
                clearTimeout(executionState.inputTimeout);
            }

            // Salvar histórico
            this.executionHistory.set(userId, {
                ...executionState,
                endTime: new Date(),
                status: 'completed'
            });

            // Remover estado ativo
            this.activeFlows.delete(userId);
            
            logger.info(`✅ Execução do fluxo finalizada para usuário ${userId}`);
        }
    }

    /**
     * Trata erros durante execução
     */
    async handleExecutionError(executionState, error) {
        logger.error(`❌ Erro na execução do fluxo: ${error.message}`);
        
        // Enviar mensagem de erro para o usuário
        await this.sendWhatsAppMessage(
            executionState.userId, 
            'Desculpe, ocorreu um erro durante o processamento. Tente novamente.'
        );

        // Finalizar execução
        await this.endFlowExecution(executionState.userId);
    }

    /**
     * Verifica se um usuário tem fluxo ativo
     */
    hasActiveFlow(userId) {
        return this.activeFlows.has(userId);
    }

    /**
     * Executa nó do YouTube
     */
    async executeYouTubeNode(executionState, node) {
        try {
            const YouTubeService = await import('./youtubeService.js');
            const url = this.replaceVariables(node.data.url, executionState.variables);
            
            let result;
            switch (node.data.action) {
                case 'transcript':
                    result = await YouTubeService.default.transcribeVideo(url);
                    break;
                case 'download':
                    result = await YouTubeService.default.downloadVideo(url);
                    break;
                case 'info':
                    result = await YouTubeService.default.getVideoInfo(url);
                    break;
                default:
                    result = await YouTubeService.default.transcribeVideo(url);
            }
            
            executionState.variables.set(node.data.outputVariable || 'youtubeResult', result);
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó YouTube:', error);
            throw error;
        }
    }

    /**
     * Executa nó de calorias
     */
    async executeCaloriesNode(executionState, node) {
        try {
            const CalorieService = await import('./calorieService.js');
            const food = this.replaceVariables(node.data.food, executionState.variables);
            
            const calories = await CalorieService.default.getCalories(food);
            executionState.variables.set(node.data.outputVariable || 'calories', calories);
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó de calorias:', error);
            throw error;
        }
    }

    /**
     * Executa nó do LinkedIn
     */
    async executeLinkedInNode(executionState, node) {
        try {
            const LinkedInScraper = await import('./linkedinScraper.js');
            const profileUrl = this.replaceVariables(node.data.profileUrl, executionState.variables);
            
            const profileData = await LinkedInScraper.fetchProfileStructured(profileUrl);
            executionState.variables.set(node.data.outputVariable || 'linkedinData', profileData);
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó LinkedIn:', error);
            throw error;
        }
    }

    /**
     * Executa nó do Telegram
     */
    async executeTelegramNode(executionState, node) {
        try {
            const TelegramIntegrationService = await import('./telegramIntegrationService.js');
            const chatId = this.replaceVariables(node.data.chatId, executionState.variables);
            const message = this.replaceVariables(node.data.message, executionState.variables);
            
            // Se houver token específico, usar esse bot, senão usar o principal
            if (node.data.botToken) {
                // Implementar envio com bot específico
                const fetch = await import('node-fetch');
                const botToken = this.replaceVariables(node.data.botToken, executionState.variables);
                
                await fetch.default(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message
                    })
                });
            } else {
                // Usar integração principal (precisa implementar)
                logger.info(`Envio Telegram para ${chatId}: ${message}`);
            }
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó Telegram:', error);
            throw error;
        }
    }

    /**
     * Executa nó de TTS
     */
    async executeTTSNode(executionState, node) {
        try {
            const TTSService = await import('./ttsService.js');
            const text = this.replaceVariables(node.data.text, executionState.variables);
            
            const audioFile = await TTSService.default.generateSpeech(text, {
                voice: node.data.voice || 'default',
                speed: node.data.speed || 1.0
            });
            
            executionState.variables.set(node.data.outputVariable || 'audioFile', audioFile);
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó TTS:', error);
            throw error;
        }
    }

    /**
     * Executa nó de transcrição
     */
    async executeTranscribeNode(executionState, node) {
        try {
            const AudioTranscriber = await import('./audioTranscriber.js');
            const audioFile = this.replaceVariables(node.data.audioFile, executionState.variables);
            
            const transcriber = new AudioTranscriber.default();
            const transcription = await transcriber.transcribe(audioFile, {
                model: node.data.model || 'whisper'
            });
            
            executionState.variables.set(node.data.outputVariable || 'transcription', transcription);
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó de transcrição:', error);
            throw error;
        }
    }

    /**
     * Executa nó do calendário
     */
    async executeCalendarNode(executionState, node) {
        try {
            const GoogleCalendarService = await import('./googleCalendarService.js');
            const calendarService = new GoogleCalendarService.default();
            
            let result;
            switch (node.data.action) {
                case 'create':
                    const title = this.replaceVariables(node.data.title, executionState.variables);
                    const description = this.replaceVariables(node.data.description, executionState.variables);
                    
                    result = await calendarService.createEvent({
                        summary: title,
                        description: description,
                        start: { dateTime: node.data.startTime },
                        end: { dateTime: node.data.endTime }
                    });
                    break;
                case 'list':
                    result = await calendarService.listEvents();
                    break;
                default:
                    throw new Error(`Ação de calendário não suportada: ${node.data.action}`);
            }
            
            executionState.variables.set('calendarResult', result);
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó do calendário:', error);
            throw error;
        }
    }

    /**
     * Executa nó do agendador
     */
    async executeSchedulerNode(executionState, node) {
        try {
            const Scheduler = await import('./scheduler.js');
            const scheduler = new Scheduler.default();
            
            const targetFlow = this.replaceVariables(node.data.targetFlow, executionState.variables);
            
            switch (node.data.scheduleType) {
                case 'once':
                    scheduler.scheduleOnce(new Date(node.data.datetime), () => {
                        // Executar fluxo de destino
                        this.startFlowExecution(executionState.userId, targetFlow, 'scheduled');
                    });
                    break;
                case 'cron':
                    scheduler.scheduleCron(node.data.cron, () => {
                        this.startFlowExecution(executionState.userId, targetFlow, 'scheduled');
                    });
                    break;
            }
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó do agendador:', error);
            throw error;
        }
    }

    /**
     * Executa nó de variável
     */
    async executeVariableNode(executionState, node) {
        try {
            const variableName = node.data.name;
            const variableValue = this.replaceVariables(node.data.value, executionState.variables);
            
            switch (node.data.action) {
                case 'set':
                    if (node.data.operation === 'append' && executionState.variables.has(variableName)) {
                        const currentValue = executionState.variables.get(variableName);
                        executionState.variables.set(variableName, currentValue + variableValue);
                    } else if (node.data.operation === 'prepend' && executionState.variables.has(variableName)) {
                        const currentValue = executionState.variables.get(variableName);
                        executionState.variables.set(variableName, variableValue + currentValue);
                    } else {
                        executionState.variables.set(variableName, variableValue);
                    }
                    break;
                case 'get':
                    // Valor já está nas variáveis, não precisa fazer nada
                    break;
                case 'increment':
                    const currentNum = parseInt(executionState.variables.get(variableName) || 0);
                    executionState.variables.set(variableName, currentNum + 1);
                    break;
                case 'decrement':
                    const currentNum2 = parseInt(executionState.variables.get(variableName) || 0);
                    executionState.variables.set(variableName, currentNum2 - 1);
                    break;
            }
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó de variável:', error);
            throw error;
        }
    }

    /**
     * Obtém lista de fluxos disponíveis carregados
     */
    getAvailableFlows() {
        const flows = [];
        
        for (const [flowId, flowData] of this.loadedFlows) {
            flows.push({
                id: flowId,
                name: flowData.name,
                description: flowData.description,
                nodes: Array.from(flowData.nodes.values()),
                metadata: flowData.metadata
            });
        }
        
        return flows;
    }

    /**
     * Obtém estatísticas dos fluxos
     */
    getFlowStats() {
        return {
            activeFlows: this.activeFlows.size,
            loadedFlows: this.loadedFlows.size,
            totalExecutions: this.executionHistory.size
        };
    }
}

export default FlowExecutionService;