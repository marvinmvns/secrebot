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
        this.llmQueue = new Map(); // userId -> llmRequest info
        this.llmProcessing = new Set(); // userIds currently being processed
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

            this.flowService = flowService; // Guardar referência para recarregar quando necessário
            await this.reloadAllFlows();

            logger.info(`✅ FlowExecutionService inicializado com ${this.loadedFlows.size} fluxos`);
        } catch (error) {
            logger.error('❌ Erro ao inicializar FlowExecutionService:', error);
        }
    }

    /**
     * Recarrega todos os flows da base de dados
     */
    async reloadAllFlows() {
        try {
            if (!this.flowService) {
                logger.warn('FlowService não disponível para recarregar flows');
                return;
            }

            // Limpar flows carregados
            this.loadedFlows.clear();

            const result = await this.flowService.listFlows();
            
            if (result.success && result.flows) {
                for (const flowSummary of result.flows) {
                    try {
                        const flowData = await this.flowService.loadFlow(flowSummary.id);
                        if (flowData.success) {
                            this.loadFlow(flowData.flow);
                        }
                    } catch (error) {
                        logger.error(`Erro ao carregar fluxo ${flowSummary.id}:`, error);
                    }
                }
            }

            logger.info(`🔄 Flows recarregados: ${this.loadedFlows.size} fluxos`);
        } catch (error) {
            logger.error('❌ Erro ao recarregar flows:', error);
        }
    }

    /**
     * Recarrega um flow específico da base de dados
     */
    async reloadFlow(flowId) {
        try {
            if (!this.flowService) {
                logger.warn('FlowService não disponível para recarregar flow');
                return false;
            }

            const flowData = await this.flowService.loadFlow(flowId);
            if (flowData.success) {
                this.loadFlow(flowData.flow);
                logger.info(`🔄 Flow '${flowId}' recarregado com sucesso`);
                return true;
            }
            
            logger.warn(`⚠️ Flow '${flowId}' não encontrado para recarregar`);
            return false;
        } catch (error) {
            logger.error(`❌ Erro ao recarregar flow ${flowId}:`, error);
            return false;
        }
    }

    /**
     * Remove um flow da memória
     */
    unloadFlow(flowId) {
        if (this.loadedFlows.has(flowId)) {
            this.loadedFlows.delete(flowId);
            logger.info(`🗑️ Flow '${flowId}' removido da memória`);
            return true;
        }
        return false;
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
    async startFlowExecution(userId, identifier, trigger, initialData = {}) {
        try {
            logger.info(`🚀 [TESTE] Iniciando execução de flow: ${identifier} para usuário: ${userId}`);
            
            // Primeiro tentar encontrar o flow por ID
            let flow = this.loadedFlows.get(identifier);
            let flowId = identifier; // Assumir que identifier é o flowId se encontrado diretamente
            
            logger.info(`🚀 [TESTE] Flow encontrado por ID: ${flow ? 'SIM' : 'NÃO'}`);
            
            // Se não encontrou por ID, tentar por alias
            if (!flow) {
                for (const [id, flowData] of this.loadedFlows.entries()) {
                    if (flowData.alias === identifier) {
                        flow = flowData;
                        flowId = id; // Usar o ID real do flow encontrado por alias
                        break;
                    }
                }
                logger.info(`🚀 [TESTE] Flow encontrado por alias: ${flow ? 'SIM' : 'NÃO'}`);
            }
            
            if (!flow) {
                throw new Error(`Fluxo '${identifier}' não encontrado`);
            }
            
            logger.info(`🚀 [TESTE] Flow carregado: ${flow.name || flow.id}`);
            
            logger.info(`🚀 [TESTE] Procurando nó de início...`);

            // Encontrar nó de início apropriado
            const startNode = this.findStartNode(flow, trigger);
            if (!startNode) {
                throw new Error('Nenhum nó de início encontrado para este gatilho');
            }
            
            // Validate start node has outputs
            if (!startNode.outputs || startNode.outputs.length === 0) {
                throw new Error(`Nó de início ${startNode.id} não tem saídas configuradas`);
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
                inputTimeout: null,
                initialData // Preservar dados iniciais para acesso posterior
            };

            // Inicializar variáveis
            Object.entries(initialData).forEach(([key, value]) => {
                executionState.variables.set(key, value);
            });

            this.activeFlows.set(userId, executionState);
            this.userVariables.set(userId, executionState.variables);

            logger.info(`🚀 Iniciando execução do fluxo '${flowId}' para usuário ${userId}`);

            // Executar primeiro nó (start) with error handling
            try {
                await this.executeNode(executionState, startNode);
                return true; // Indicar sucesso
            } catch (nodeError) {
                logger.error(`❌ Erro ao executar nó inicial ${startNode.id}:`, nodeError);
                // Clean up execution state
                this.activeFlows.delete(userId);
                this.userVariables.delete(userId);
                throw nodeError;
            }

        } catch (error) {
            logger.error(`❌ Erro ao iniciar execução do fluxo: ${error.message}`);
            throw error;
        }
    }

    /**
     * Inicia execução de fluxo e captura mensagens geradas durante execução inicial
     * Específico para testes, onde precisamos capturar as mensagens do bot
     */
    async startFlowExecutionWithCapture(userId, identifier, trigger, initialData = {}) {
        const responseMessages = [];
        
        // Interceptar mensagens durante execução
        const originalSendMessage = this.sendWhatsAppMessage;
        this.sendWhatsAppMessage = async (uid, msg) => {
            if (uid === userId) {
                logger.info(`🧪 [CAPTURE-START] Capturando mensagem inicial: "${msg}"`);
                responseMessages.push(msg);
            }
            return await originalSendMessage.call(this, uid, msg);
        };

        try {
            const started = await this.startFlowExecution(userId, identifier, trigger, initialData);
            
            // Restaurar função original
            this.sendWhatsAppMessage = originalSendMessage;
            
            logger.info(`🧪 [CAPTURE-START] Execução iniciada: ${started}, Mensagens capturadas: ${responseMessages.length}`);
            
            return {
                started,
                messages: responseMessages,
                sessionActive: this.activeFlows.has(userId)
            };
        } catch (error) {
            // Restaurar função original mesmo em caso de erro
            this.sendWhatsAppMessage = originalSendMessage;
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
        
        // Para testes manuais, retornar qualquer nó de início
        if (trigger === 'manual') {
            return startNodes[0] || null;
        }
        
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
            
            // Log extra para debug do teste
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.info(`🧪 [TESTE] Executando nó: ${node.id} (tipo: ${node.type})`);
                if (node.data) {
                    logger.debug(`🧪 [TESTE] Dados do nó: ${JSON.stringify(node.data)}`);
                }
            }

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
                // Nó está aguardando entrada - flag já definida no executeInputNode
                logger.info(`⏸️ Fluxo pausado aguardando entrada do usuário ${executionState.userId}`);
            } else if (result && result.end) {
                // Finalizar execução
                await this.endFlowExecution(executionState.userId);
            }

        } catch (error) {
            logger.error(`❌ Erro ao executar nó ${node.id} (tipo: ${node.type}): ${error.message}`);
            
            // Log extra para debug do teste
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.error(`🧪 [TESTE] Erro detalhado no nó ${node.id}:`, {
                    nodeType: node.type,
                    nodeData: node.data,
                    errorMessage: error.message,
                    errorStack: error.stack
                });
            }
            
            await this.handleExecutionError(executionState, error);
        }
    }

    /**
     * Executa nó de início
     */
    async executeStartNode(executionState, node) {
        // Debug log para sessões de teste
        if (executionState.initialData && executionState.initialData.isTestSession) {
            logger.info(`🧪 [TESTE] StartNode outputs: ${JSON.stringify(node.outputs)}`);
            logger.info(`🧪 [TESTE] StartNode outputs[0]: ${node.outputs[0]}`);
        }
        
        if (!node.outputs || node.outputs.length === 0) {
            logger.error(`❌ Start node ${node.id} não tem outputs definidos`);
            return { end: true };
        }
        
        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de mensagem com error handling robusto
     */
    async executeMessageNode(executionState, node) {
        const message = this.replaceVariables(node.data.text, executionState.variables);
        
        // Debug log para sessões de teste
        if (executionState.initialData && executionState.initialData.isTestSession) {
            logger.info(`🧪 [TESTE] MessageNode enviando: "${message}"`);
            logger.info(`🧪 [TESTE] MessageNode delay: ${node.data.delay || 0} segundos`);
        }
        
        // Aplicar delay se configurado
        if (node.data.delay && node.data.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, node.data.delay * 1000));
        }

        // Enviar mensagem via WhatsApp - mas não falhar se envio falhar
        const messageSent = await this.sendWhatsAppMessage(executionState.userId, message);
        
        if (!messageSent) {
            logger.warn(`⚠️ Falha ao enviar mensagem via WhatsApp, mas continuando flow para ${executionState.userId}`);
            // Salvar mensagem não enviada para possível reenvio
            executionState.variables.set('lastUnsentMessage', message);
        }

        // Verificar se deve aguardar entrada do usuário
        if (node.data.waitForInput) {
            // Configurar timeout para entrada
            const timeout = node.data.inputTimeout || 60;
            
            // Definir que está aguardando input ANTES de configurar o timeout
            executionState.waitingForInput = true;
            
            executionState.inputTimeout = setTimeout(async () => {
                // Timeout atingido, continuar para próximo nó
                executionState.waitingForInput = false;
                if (node.outputs.length > 1) {
                    executionState.currentNodeId = node.outputs[1];
                    const flow = this.loadedFlows.get(executionState.flowId);
                    const nextNode = flow.nodes.get(node.outputs[1]);
                    if (nextNode) {
                        await this.executeNode(executionState, nextNode);
                    }
                } else if (node.outputs.length > 0) {
                    // Se só há uma saída, continuar normalmente após timeout
                    executionState.currentNodeId = node.outputs[0];
                    const flow = this.loadedFlows.get(executionState.flowId);
                    const nextNode = flow.nodes.get(node.outputs[0]);
                    if (nextNode) {
                        await this.executeNode(executionState, nextNode);
                    }
                }
            }, timeout * 1000);

            return { wait: true };
        }

        return { nextNodeId: node.outputs[0] };
    }

    /**
     * Executa nó de condição
     */
    async executeConditionNode(executionState, node) {
        // Obter input do usuário - usar a variável especificada no nó ou tentar variáveis comuns
        const variableName = node.data.variable || 'userChoice';
        let userInput = executionState.variables.get(variableName) || 
                       executionState.variables.get('userChoice') ||
                       executionState.variables.get('nameAndChoice') || 
                       executionState.variables.get('userInput') || 
                       executionState.variables.get('opcaoAdicional') || '';
        
        // Ensure userInput is a string to prevent evaluation errors
        userInput = String(userInput || '');
        
        const conditionValue = String(node.data.value || '');
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
                    if (conditionValue) {
                        const regex = new RegExp(conditionValue, 'i');
                        conditionMet = regex.test(userInput);
                    } else {
                        logger.warn(`Regex vazia em condição: ${node.id}`);
                    }
                } catch (e) {
                    logger.warn(`Regex inválida em condição: ${conditionValue}`, e);
                }
                break;
        }

        // Determinar próximo nó baseado na condição
        const nextNodeIndex = conditionMet ? 0 : 1;
        const nextNodeId = node.outputs[nextNodeIndex];
        
        // Verificar se o próximo nó existe
        if (!nextNodeId) {
            logger.warn(`⚠️ Nó ${node.id} não tem saída para índice ${nextNodeIndex} (condição=${conditionMet}). Outputs: [${node.outputs.join(', ')}]`);
            return { end: true }; // Finalizar execução se não há próximo nó
        }

        // Log para debugging
        logger.info(`🔍 Verificando condição em ${node.id}: "${userInput}" ${node.data.condition} "${conditionValue}" = ${conditionMet}`);
        logger.debug(`📊 Variáveis disponíveis: ${Array.from(executionState.variables.keys()).join(', ')}`);
        
        // Se a condição foi atendida, não executar mais condições
        if (conditionMet) {
            logger.info(`✅ Condição atendida em ${node.id}: "${userInput}" ${node.data.condition} "${conditionValue}"`);
        } else {
            logger.info(`❌ Condição NÃO atendida em ${node.id}: "${userInput}" ${node.data.condition} "${conditionValue}"`);
        }

        return { nextNodeId };
    }

    /**
     * Executa nó de entrada
     */
    async executeInputNode(executionState, node) {
        // Configurar timeout para entrada
        const timeout = node.data.timeout || 60;
        
        // Definir que está aguardando input ANTES de configurar o timeout
        executionState.waitingForInput = true;
        
        executionState.inputTimeout = setTimeout(async () => {
            // Timeout atingido, continuar para próximo nó
            executionState.waitingForInput = false;
            if (node.outputs.length > 1) {
                executionState.currentNodeId = node.outputs[1];
                const flow = this.loadedFlows.get(executionState.flowId);
                const nextNode = flow.nodes.get(node.outputs[1]);
                if (nextNode) {
                    await this.executeNode(executionState, nextNode);
                }
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
     * Executa nó de LLM com error handling robusto
     */
    async executeLlmNode(executionState, node) {
        try {
            let prompt = node.data.prompt || '';
            
            // Debug log para sessões de teste
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.info(`🧪 [TESTE] LLM Node executando prompt: "${prompt}"`);
            }
            
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

            logger.info(`🤖 Enviando prompt para LLM (usuário: ${executionState.userId}): "${prompt.substring(0, 100)}..."`);

            // Verificar se já há uma requisição LLM em andamento para este usuário
            if (this.llmProcessing.has(executionState.userId)) {
                logger.info(`⏳ Usuário ${executionState.userId} já tem requisição LLM em andamento - enfileirando...`);
                
                // Adicionar à fila e aguardar processamento
                this.llmQueue.set(executionState.userId, {
                    prompt,
                    timestamp: new Date(),
                    executionState,
                    node
                });
                
                // Enviar mensagem de status se não for sessão de teste
                if (!executionState.initialData?.isTestSession) {
                    await this.sendWhatsAppMessage(
                        executionState.userId, 
                        "🤖 Sua solicitação foi enfileirada e será processada em breve..."
                    );
                }
                
                return { wait: true }; // Pausar execução até LLM responder
            }

            // Marcar usuário como processando LLM
            this.llmProcessing.add(executionState.userId);
            
            try {
                // Chamar LLM sem timeout - permite tempo ilimitado para resposta
                logger.info(`⏳ LLM em processamento para usuário ${executionState.userId} - aguardando resposta...`);
                
                // Enviar mensagem de status se não for sessão de teste e demorar mais que 5 segundos
                const statusTimeout = setTimeout(async () => {
                    if (!executionState.initialData?.isTestSession) {
                        await this.sendWhatsAppMessage(
                            executionState.userId, 
                            "🤖 Processando sua solicitação... Por favor, aguarde..."
                        );
                    }
                }, 5000);
                
                const response = await this.llmService.getAssistantResponse(executionState.userId, prompt);
                
                clearTimeout(statusTimeout);
                logger.info(`🤖 Resposta LLM recebida (usuário: ${executionState.userId}): "${response.substring(0, 100)}..."`);
                
                // Salvar resposta como variável
                if (node.data.outputVariable) {
                    executionState.variables.set(node.data.outputVariable, response);
                }
                
                // Tentar enviar resposta - mas não falhar se envio falhar
                const messageSent = await this.sendWhatsAppMessage(executionState.userId, response);
                
                if (!messageSent) {
                    logger.warn(`⚠️ Falha ao enviar resposta LLM via WhatsApp, mas continuando flow para ${executionState.userId}`);
                    // Save response in variables even if sending failed
                    executionState.variables.set('lastLlmResponse', response);
                    executionState.variables.set('lastLlmError', 'Message delivery failed');
                } else {
                    logger.info(`✅ Resposta LLM enviada com sucesso para ${executionState.userId}`);
                    executionState.variables.set('lastLlmResponse', response);
                }
                
                // Processar fila se houver outras requisições aguardando
                await this.processLlmQueue(executionState.userId);
                
                return { nextNodeId: node.outputs[0] };
                
            } finally {
                // Sempre remover usuário da lista de processamento
                this.llmProcessing.delete(executionState.userId);
            }
            
        } catch (error) {
            logger.error(`❌ Erro no nó LLM: ${error.message}`);
            
            // Debug log para sessões de teste
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.error(`🧪 [TESTE] Erro detalhado no LLM:`, {
                    prompt: node.data.prompt,
                    errorMessage: error.message,
                    errorStack: error.stack
                });
            }
            
            // Em vez de parar o flow, enviar mensagem de erro e continuar
            const errorMessage = node.data.errorMessage || 'Desculpe, houve um problema ao processar sua solicitação. Vamos continuar...';
            await this.sendWhatsAppMessage(executionState.userId, errorMessage);
            
            // Salvar erro como variável para possível uso posterior
            executionState.variables.set('lastLlmError', error.message);
            
            // Continuar para próximo nó se existir
            if (node.outputs && node.outputs.length > 0) {
                return { nextNodeId: node.outputs[0] };
            } else {
                return { end: true };
            }
        }
    }

    /**
     * Processa fila de requisições LLM
     */
    async processLlmQueue(userId) {
        // Verificar se há requisições na fila para este usuário
        const queuedRequest = this.llmQueue.get(userId);
        if (!queuedRequest) {
            return; // Nenhuma requisição na fila
        }
        
        logger.info(`🔄 Processando requisição LLM enfileirada para usuário ${userId}`);
        
        // Remover da fila
        this.llmQueue.delete(userId);
        
        // Continuar execução do nó LLM
        try {
            await this.executeNode(queuedRequest.executionState, queuedRequest.node);
        } catch (error) {
            logger.error(`❌ Erro ao processar fila LLM para ${userId}: ${error.message}`);
        }
    }
    
    /**
     * Limpa fila LLM para um usuário (em caso de erro ou finalização de flow)
     */
    clearLlmQueue(userId) {
        this.llmQueue.delete(userId);
        this.llmProcessing.delete(userId);
        logger.info(`🧹 Fila LLM limpa para usuário ${userId}`);
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
        
        // Não executar o próximo nó se estiver aguardando entrada
        if (!executionState.waitingForInput) {
            await this.executeNode(executionState, nextNode);
        }
    }

    /**
     * Processa entrada do usuário quando um fluxo está aguardando
     */
    async processUserInput(userId, message) {
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState) {
            logger.debug(`❌ Nenhum fluxo ativo para usuário ${userId}`);
            return false; // Não há fluxo ativo
        }

        if (!executionState.waitingForInput) {
            logger.debug(`❌ Fluxo ativo para ${userId} mas não aguardando entrada (waitingForInput: ${executionState.waitingForInput})`);
            return false; // Fluxo não está aguardando entrada
        }

        logger.info(`📥 Processando entrada do usuário ${userId}: "${message}"`);

        // Limpar timeout se existir
        if (executionState.inputTimeout) {
            clearTimeout(executionState.inputTimeout);
            executionState.inputTimeout = null;
        }

        // Salvar entrada como variável
        const currentNode = this.getCurrentNode(executionState);
        const variableName = currentNode.data.variable || currentNode.data.inputVariable || 'userInput';
        executionState.variables.set(variableName, message);
        
        logger.info(`💾 Entrada salva como variável '${variableName}': "${message}"`);

        // Continuar execução
        executionState.waitingForInput = false;
        
        if (currentNode.outputs.length > 0) {
            executionState.currentNodeId = currentNode.outputs[0];
            const flow = this.loadedFlows.get(executionState.flowId);
            const nextNode = flow.nodes.get(currentNode.outputs[0]);
            if (nextNode) {
                await this.executeNode(executionState, nextNode);
            }
        }

        return true;
    }

    /**
     * Alias mais amigável para processUserInput, usado pela API de teste
     */
    async processFlowMessage(userId, message) {
        logger.info(`🧪 [DEBUG] processFlowMessage called: userId=${userId}, message="${message}"`);
        
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState) {
            logger.warn(`🧪 [DEBUG] No active flow for user: ${userId}`);
            return null; // Não há fluxo ativo
        }
        
        logger.info(`🧪 [DEBUG] Active flow found: ${executionState.flowId}`);

        // Capturar TODAS as mensagens que seriam enviadas durante a execução
        const originalSendMessage = this.sendWhatsAppMessage;
        const responseMessages = [];
        
        // Interceptar mensagens durante o processamento
        this.sendWhatsAppMessage = async (uid, msg) => {
            if (uid === userId) {
                logger.info(`🧪 [CAPTURE] Capturando mensagem: "${msg}"`);
                responseMessages.push(msg);
            }
            
            // Ainda chamar a função original para logging de teste
            return await originalSendMessage.call(this, uid, msg);
        };

        try {
            const processed = await this.processUserInput(userId, message);
            
            logger.info(`🧪 [RESULT] Processed: ${processed}, Messages captured: ${responseMessages.length}`);
            if (responseMessages.length > 0) {
                logger.info(`🧪 [RESULT] Messages: ${JSON.stringify(responseMessages)}`);
            }
            
            // Retornar todas as mensagens capturadas, separadas por linha
            if (processed && responseMessages.length > 0) {
                return responseMessages.join('\n\n');
            }
            
            return null;
        } finally {
            // Restaurar função original
            this.sendWhatsAppMessage = originalSendMessage;
        }
    }

    /**
     * Verifica se há um fluxo ativo para o usuário
     */
    hasActiveFlow(userId) {
        const executionState = this.activeFlows.get(userId);
        return !!executionState;
    }

    /**
     * Obtém informações detalhadas sobre o estado atual do fluxo
     */
    getCurrentFlowState(userId) {
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState) {
            return { active: false };
        }

        const currentNode = this.getCurrentNode(executionState);
        
        return {
            active: true,
            flowId: executionState.flowId,
            currentNodeId: executionState.currentNodeId,
            waitingForInput: executionState.waitingForInput,
            variables: Object.fromEntries(executionState.variables),
            nodeType: currentNode?.type,
            nodeData: currentNode?.data,
            isTestSession: executionState.initialData?.isTestSession || false
        };
    }

    /**
     * Obtém o nó atual da execução
     */
    getCurrentNode(executionState) {
        const flow = this.loadedFlows.get(executionState.flowId);
        return flow.nodes.get(executionState.currentNodeId);
    }

    /**
     * Obtém o estado atual do fluxo para um usuário
     */
    getCurrentFlowState(userId) {
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState) {
            return null;
        }

        return {
            flowId: executionState.flowId,
            currentNodeId: executionState.currentNodeId,
            waitingForInput: executionState.waitingForInput,
            variables: Object.fromEntries(executionState.variables)
        };
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
     * Envia mensagem via WhatsApp com retry e error handling robusto
     */
    async sendWhatsAppMessage(userId, message, retries = 3) {
        // Check if this is a test session and skip WhatsApp sending to avoid Puppeteer errors
        const executionState = this.activeFlows.get(userId);
        if (executionState && executionState.initialData && executionState.initialData.isTestSession) {
            logger.info(`🧪 [TESTE] Simulando envio de mensagem para ${userId}: "${message}"`);
            // Don't return early - allow intercepted functions in processFlowMessage to work
            return true;
        }

        // Send to real WhatsApp with retry logic
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const client = this.bot.getClient();
                if (!client) {
                    logger.warn(`⚠️ Cliente WhatsApp não disponível (tentativa ${attempt}/${retries})`);
                    if (attempt === retries) {
                        logger.error(`❌ Cliente WhatsApp indisponível após ${retries} tentativas`);
                        return false; // Don't throw, just return false
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Progressive delay
                    continue;
                }

                await client.sendMessage(userId, message);
                logger.info(`✅ Mensagem enviada via WhatsApp para ${userId} (tentativa ${attempt})`);
                return true;
                
            } catch (error) {
                logger.warn(`⚠️ Erro ao enviar mensagem WhatsApp (tentativa ${attempt}/${retries}): ${error.message}`);
                
                if (attempt === retries) {
                    logger.error(`❌ Falha definitiva ao enviar mensagem WhatsApp para ${userId}: ${error.message}`);
                    // Don't throw error - just log and continue flow
                    return false;
                }
                
                // Progressive delay between retries
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        
        return false;
    }

    /**
     * Para a execução do fluxo (chamado manualmente pelo usuário)
     */
    async stopFlowExecution(userId) {
        const executionState = this.activeFlows.get(userId);
        
        if (executionState) {
            // Limpar timeout se existir
            if (executionState.inputTimeout) {
                clearTimeout(executionState.inputTimeout);
            }
            
            // Limpar fila LLM
            this.clearLlmQueue(userId);

            // Salvar histórico
            this.executionHistory.set(userId, {
                ...executionState,
                endTime: new Date(),
                status: 'stopped'
            });

            // Remover estado ativo
            this.activeFlows.delete(userId);
            
            logger.info(`🛑 Execução do fluxo parada manualmente para usuário ${userId}`);
            return true;
        }
        
        return false;
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
            
            // Limpar fila LLM
            this.clearLlmQueue(userId);

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
     * Trata erros durante execução com recovery
     */
    async handleExecutionError(executionState, error) {
        logger.error(`❌ Erro na execução do fluxo: ${error.message}`);
        
        // Salvar erro no histórico
        executionState.history.push({
            nodeId: 'error',
            nodeType: 'error',
            timestamp: new Date(),
            error: error.message
        });
        
        // Classificar tipo de erro
        const isRecoverableError = this.isRecoverableError(error);
        
        if (isRecoverableError) {
            logger.info(`🔄 Erro recuperável detectado, tentando continuar flow`);
            
            // Tentar enviar mensagem de erro (mas não falhar se não conseguir)
            await this.sendWhatsAppMessage(
                executionState.userId, 
                'Houve um pequeno problema, mas vamos continuar...'
            );
            
            // Não finalizar execução - permitir que o flow continue
            executionState.variables.set('lastError', error.message);
            executionState.variables.set('errorRecovery', true);
            
        } else {
            logger.error(`❌ Erro não recuperável, finalizando execução`);
            
            // Tentar enviar mensagem de erro
            await this.sendWhatsAppMessage(
                executionState.userId, 
                'Desculpe, ocorreu um erro durante o processamento. Tente novamente.'
            );

            // Finalizar execução apenas para erros não recuperáveis
            await this.endFlowExecution(executionState.userId);
        }
    }
    
    /**
     * Determina se um erro é recuperável
     */
    isRecoverableError(error) {
        const recoverableErrors = [
            'network',
            'timeout',
            'connection',
            'whatsapp',
            'client',
            'rate limit',
            'temporarily',
            'unavailable'
        ];
        
        const errorMessage = error.message.toLowerCase();
        return recoverableErrors.some(keyword => errorMessage.includes(keyword));
    }

    /**
     * Verifica se um usuário tem fluxo ativo
     */
    hasActiveFlow(userId) {
        return this.activeFlows.has(userId);
    }

    /**
     * Obtém informações sobre o fluxo ativo do usuário
     */
    getActiveFlowInfo(userId) {
        const executionState = this.activeFlows.get(userId);
        
        if (!executionState) {
            return null;
        }

        const flow = this.loadedFlows.get(executionState.flowId);
        const currentNode = flow ? flow.nodes.get(executionState.currentNodeId) : null;

        return {
            flowId: executionState.flowId,
            flowName: flow ? flow.name : 'Desconhecido',
            currentNode: currentNode ? currentNode.type : 'Desconhecido',
            currentNodeId: executionState.currentNodeId,
            startTime: executionState.startTime.toLocaleString('pt-BR'),
            waitingForInput: executionState.waitingForInput,
            status: executionState.status
        };
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
            // Skip LinkedIn scraping in test sessions
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.info('🧪 Pulando execução LinkedIn no modo teste');
                executionState.variables.set(node.data.outputVariable || 'linkedinData', {
                    success: true,
                    mockData: true,
                    message: 'Dados simulados para teste'
                });
                return { nextNodeId: node.outputs[0] };
            }

            const LinkedInScraper = await import('./linkedinScraper.js');
            const profileUrl = this.replaceVariables(node.data.profileUrl, executionState.variables);
            
            if (!profileUrl || !profileUrl.includes('linkedin.com')) {
                throw new Error('URL do LinkedIn inválida ou não fornecida');
            }
            
            const profileData = await LinkedInScraper.fetchProfileStructured(profileUrl);
            executionState.variables.set(node.data.outputVariable || 'linkedinData', profileData);
            
            return { nextNodeId: node.outputs[0] };
        } catch (error) {
            logger.error('Erro no nó LinkedIn:', error);
            // In test mode, don't fail the flow, just log and continue
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.warn('⚠️ Erro no LinkedIn ignorado no modo teste');
                executionState.variables.set(node.data.outputVariable || 'linkedinData', {
                    success: false,
                    error: error.message,
                    mockData: true
                });
                return { nextNodeId: node.outputs[0] };
            }
            throw error;
        }
    }

    /**
     * Executa nó do Telegram com error handling robusto
     */
    async executeTelegramNode(executionState, node) {
        try {
            const chatId = this.replaceVariables(node.data.chatId, executionState.variables);
            const message = this.replaceVariables(node.data.message, executionState.variables);
            
            // Debug log para sessões de teste
            if (executionState.initialData && executionState.initialData.isTestSession) {
                logger.info(`🧪 [TESTE] Telegram Node simulando envio para ${chatId}: "${message}"`);
                executionState.variables.set('telegramSent', true);
                return { nextNodeId: node.outputs[0] };
            }
            
            // Se houver token específico, usar esse bot, senão usar o principal
            if (node.data.botToken) {
                // Implementar envio com bot específico com retry
                const fetch = await import('node-fetch');
                const botToken = this.replaceVariables(node.data.botToken, executionState.variables);
                
                let success = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        const response = await fetch.default(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: message
                            })
                        });
                        
                        if (response.ok) {
                            logger.info(`✅ Mensagem Telegram enviada para ${chatId} (tentativa ${attempt})`);
                            success = true;
                            break;
                        } else {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                    } catch (err) {
                        logger.warn(`⚠️ Erro ao enviar Telegram (tentativa ${attempt}/3): ${err.message}`);
                        if (attempt === 3) {
                            throw err;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    }
                }
                
                executionState.variables.set('telegramSent', success);
            } else {
                // Usar integração principal (simular por enquanto)
                logger.info(`📱 Envio Telegram para ${chatId}: ${message}`);
                executionState.variables.set('telegramSent', true);
            }
            
            return { nextNodeId: node.outputs[0] };
            
        } catch (error) {
            logger.error('❌ Erro no nó Telegram:', error);
            
            // Em vez de parar o flow, salvar erro e continuar
            executionState.variables.set('telegramError', error.message);
            executionState.variables.set('telegramSent', false);
            
            // Continuar para próximo nó se existir
            if (node.outputs && node.outputs.length > 0) {
                return { nextNodeId: node.outputs[0] };
            } else {
                return { end: true };
            }
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
                        this.startFlowExecution(executionState.userId, targetFlow, 'scheduled', {});
                    });
                    break;
                case 'cron':
                    scheduler.scheduleCron(node.data.cron, () => {
                        this.startFlowExecution(executionState.userId, targetFlow, 'scheduled', {});
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