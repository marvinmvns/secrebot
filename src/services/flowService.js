import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FlowDataService from './flowDataService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Serviço para gerenciamento de fluxos no Flow Builder
 * Responsável por CRUD de fluxos, validação e integração
 */
class FlowService {
    constructor(db) {
        this.flowDataService = new FlowDataService(db);
        this.flows = new Map();
        this.init();
    }

    /**
     * Inicializa o serviço carregando fluxos salvos
     */
    async init() {
        try {
            logger.debug('🚀 Inicializando FlowService...');
            
            // Inicializar o serviço de dados flows (inclui migração automática)
            await this.flowDataService.init();
            
            // Carregar todos os flows na memória para cache (SEMPRE da base flows)
            const result = await this.flowDataService.listFlows();
            
            if (result && result.success && result.flows) {
                result.flows.forEach(flowData => {
                    // Usar _id do MongoDB como chave principal
                    const flowId = flowData._id || flowData.id;
                    this.flows.set(flowId, flowData);
                    logger.debug(`📄 Flow carregado: '${flowData.name}' (ID: ${flowId})`);
                });
            } else {
                logger.warn('⚠️ Nenhum flow encontrado na base ou erro na listagem');
            }
            
            logger.info(`✅ FlowService inicializado com ${this.flows.size} fluxos`);
            
            // Verificar se existe o template padrão jiu-jitsu apenas uma vez
            await this.ensureDefaultTemplate();
            
            // Executar verificação de integridade
            await this.validateFlowsIntegrity();
            
        } catch (error) {
            logger.error('❌ Erro ao inicializar FlowService:', error);
            logger.error('Stack trace:', error.stack);
            throw error; // Re-throw para que o erro seja tratado em nível superior
        }
    }

    /**
     * Garante que o template padrão jiu-jitsu existe na base, carregando apenas se necessário
     */
    async ensureDefaultTemplate() {
        try {
            // Primeiro, verificar se já existe um flow com marcador de template padrão
            const existingDefaultFlow = Array.from(this.flows.values())
                .find(flow => flow.metadata?.isDefault === true);
            
            if (existingDefaultFlow) {
                logger.debug('Template padrão já existe:', existingDefaultFlow.name);
                return;
            }
            
            // Se não há flows na base, verificar se existe o template específico
            const hasJiuJitsuFlow = Array.from(this.flows.values())
                .some(flow => flow.name && (
                    flow.name.toLowerCase().includes('academia') || 
                    flow.name.toLowerCase().includes('jiu') ||
                    flow.alias === 'jiu-jitsu'
                ));
            
            if (hasJiuJitsuFlow) {
                logger.debug('Flow jiu-jitsu já existe na base');
                return;
            }
            
            // Carregar template apenas se necessário
            await this.loadDefaultTemplate();
            
        } catch (error) {
            logger.error('❌ Erro ao verificar template padrão:', error);
        }
    }

    /**
     * Carrega o template padrão do jiu-jitsu quando não há fluxos na base
     */
    async loadDefaultTemplate() {
        try {
            const templatePath = path.join(__dirname, '../../template_academia_jiu_jitsu.json');
            const templateExists = await fs.access(templatePath).then(() => true).catch(() => false);
            
            if (!templateExists) {
                logger.debug('Template jiu-jitsu não encontrado, pulando carregamento');
                return;
            }
            
            const templateData = await fs.readFile(templatePath, 'utf8');
            const template = JSON.parse(templateData);
            
            // Remover o ID do template para gerar um novo
            delete template.id;
            
            // Definir como template padrão
            template.name = "Exemplo Academia Jiu-Jitsu";
            template.description = "Template padrão carregado automaticamente - Academia de Jiu-Jitsu";
            template.metadata = {
                ...template.metadata,
                isDefault: true,
                loadedAt: new Date().toISOString()
            };
            
            const result = await this.saveFlow(template);
            if (result.success) {
                logger.info('✅ Template padrão jiu-jitsu carregado');
            } else {
                logger.warn('⚠️ Falha ao carregar template padrão:', result.error);
            }
            
        } catch (error) {
            logger.error('❌ Erro ao carregar template padrão:', error);
        }
    }

    /**
     * Gera um ID simples baseado no nome do flow
     * @param {string} flowName - Nome do flow
     * @returns {string} ID simples para usar em comandos
     */
    generateSimpleId(flowName) {
        if (!flowName) {
            return `flow-${Date.now()}`;
        }
        
        // Converter para minúsculo, remover acentos e caracteres especiais
        let id = flowName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, '-') // Substitui espaços por hífens
            .replace(/-+/g, '-') // Remove hífens múltiplos
            .replace(/^-|-$/g, ''); // Remove hífens no início/fim
        
        // Limitar tamanho máximo
        if (id.length > 30) {
            id = id.substring(0, 30).replace(/-$/, '');
        }
        
        // Garantir que não está vazio
        if (!id) {
            id = `flow-${Date.now()}`;
        }
        
        return id;
    }

    /**
     * Gera um alias amigável baseado no nome do flow
     * @param {string} flowName - Nome do flow
     * @returns {string} Alias amigável para usar em comandos
     */
    generateAlias(flowName) {
        if (!flowName) {
            return null;
        }
        
        // Converter para minúsculo, remover acentos e caracteres especiais
        let alias = flowName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
            .replace(/\s+/g, '-') // Substitui espaços por hífens
            .replace(/-+/g, '-') // Remove hífens múltiplos
            .replace(/^-|-$/g, ''); // Remove hífens no início/fim
        
        // Limitar tamanho máximo para alias
        if (alias.length > 20) {
            alias = alias.substring(0, 20).replace(/-$/, '');
        }
        
        // Garantir que não está vazio
        if (!alias) {
            return null;
        }
        
        return alias;
    }

    /**
     * Gera um ID único verificando se já existe na base flows
     * @param {string} flowName - Nome do flow
     * @returns {string} ID único para o flow
     */
    async generateUniqueId(flowName) {
        let baseId = this.generateSimpleId(flowName);
        let finalId = baseId;
        let counter = 1;
        
        // SEMPRE verificar existência direto no MongoDB flows collection
        while (await this.flowDataService.flowExists(finalId)) {
            finalId = `${baseId}-${counter}`;
            counter++;
            
            // Evitar loop infinito
            if (counter > 999) {
                finalId = `${baseId}-${Date.now()}`;
                break;
            }
        }
        
        logger.debug(`🆔 ID único gerado para flow '${flowName}': ${finalId}`);
        return finalId;
    }

    /**
     * Salva um fluxo
     * @param {Object} flowData - Dados do fluxo
     * @returns {Object} Resultado da operação
     */
    async saveFlow(flowData) {
        try {
            // Validar dados obrigatórios
            const validation = this.validateFlow(flowData);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error
                };
            }

            // Gerar ID se não existir - usar nome simples e verificar duplicatas
            let flowId = flowData.id;
            if (!flowId) {
                flowId = await this.generateUniqueId(flowData.name);
            }
            
            // Gerar alias se não existir
            let alias = flowData.alias;
            if (!alias && flowData.name) {
                alias = this.generateAlias(flowData.name);
            }
            
            // Preparar dados do fluxo
            const flow = {
                ...flowData,
                id: flowId,
                alias: alias,
                createdAt: flowData.createdAt || new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: flowData.version || '1.0'
            };

            // Persistir no banco usando o novo serviço
            await this.flowDataService.saveFlow(flow);

            // Salvar na memória para cache
            this.flows.set(flowId, flow);

            logger.info(`✅ Fluxo '${flow.name}' salvo com ID: ${flowId}`);
            
            return {
                success: true,
                flowId: flowId,
                flow: flow
            };

        } catch (error) {
            logger.error('❌ Erro ao salvar fluxo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Carrega um fluxo específico - SEMPRE busca direto da base flows
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Dados do fluxo ou erro
     */
    async loadFlow(flowId) {
        try {
            // SEMPRE buscar direto do MongoDB flows collection
            const flow = await this.flowDataService.loadFlow(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
                };
            }

            // Atualizar cache na memória
            this.flows.set(flowId, flow);

            return {
                success: true,
                flow: flow
            };

        } catch (error) {
            logger.error(`❌ Erro ao carregar fluxo ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Busca um fluxo por ID ou alias - SEMPRE busca direto da base flows
     * @param {string} identifier - ID ou alias do fluxo
     * @returns {Object} Dados do fluxo ou erro
     */
    async findFlow(identifier) {
        try {
            // SEMPRE buscar direto do MongoDB flows collection
            let flow = await this.flowDataService.loadFlow(identifier);
            
            // Se não encontrou por ID, tenta buscar por alias
            if (!flow) {
                const searchResult = await this.flowDataService.listFlows({
                    filter: { alias: identifier },
                    limit: 1
                });
                
                if (searchResult.flows && searchResult.flows.length > 0) {
                    flow = searchResult.flows[0];
                }
            }
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
                };
            }

            // Atualizar cache na memória
            this.flows.set(flow._id, flow);

            return {
                success: true,
                flow: flow
            };

        } catch (error) {
            logger.error(`❌ Erro ao buscar fluxo ${identifier}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lista todos os fluxos
     * @returns {Object} Lista de fluxos
     */
    async listFlows() {
        try {
            // Sempre buscar direto do MongoDB, nunca do cache
            const result = await this.flowDataService.listFlows();
            
            if (!result.success) {
                return result;
            }
            
            const flowList = result.flows.map(flow => ({
                id: flow.id,
                alias: flow.alias,
                name: flow.name,
                description: flow.description,
                createdAt: flow.createdAt,
                lastModified: flow.lastModified,
                version: flow.version,
                nodeCount: flow.nodes ? flow.nodes.length : 0,
                connectionCount: flow.connections ? flow.connections.length : 0
            }));

            return {
                success: true,
                flows: flowList,
                total: flowList.length
            };

        } catch (error) {
            logger.error('❌ Erro ao listar fluxos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Exclui um fluxo - SEMPRE opera na base flows
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Resultado da operação
     */
    async deleteFlow(flowId) {
        try {
            // SEMPRE verificar existência direto no MongoDB flows collection
            const flow = await this.flowDataService.loadFlow(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
                };
            }

            const flowName = flow.name;
            
            // Remover do banco flows
            const deleteResult = await this.flowDataService.deleteFlow(flowId);
            
            if (!deleteResult.success) {
                return {
                    success: false,
                    error: 'Erro ao excluir fluxo da base de dados'
                };
            }

            // Remover da memória (cache)
            this.flows.delete(flowId);

            logger.info(`🗑️ Fluxo '${flowName}' (${flowId}) excluído da base flows`);
            
            return {
                success: true,
                message: 'Fluxo excluído com sucesso da base flows'
            };

        } catch (error) {
            logger.error(`❌ Erro ao excluir fluxo ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Duplica um fluxo - SEMPRE busca e salva na base flows
     * @param {string} flowId - ID do fluxo a ser duplicado
     * @param {string} newName - Nome do novo fluxo
     * @returns {Object} Resultado da operação
     */
    async duplicateFlow(flowId, newName) {
        try {
            // SEMPRE buscar direto do MongoDB flows collection
            const originalFlow = await this.flowDataService.loadFlow(flowId);
            
            if (!originalFlow) {
                return {
                    success: false,
                    error: 'Fluxo original não encontrado'
                };
            }

            // Criar cópia do fluxo
            const duplicatedFlow = {
                ...originalFlow,
                name: newName || `${originalFlow.name} (Cópia)`,
                description: `Cópia de: ${originalFlow.description}`,
                id: undefined, // Será gerado automaticamente
                _id: undefined // Remove o ID do MongoDB também
            };

            // Salvar a cópia na base flows
            return await this.saveFlow(duplicatedFlow);

        } catch (error) {
            logger.error(`❌ Erro ao duplicar fluxo ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Valida um fluxo
     * @param {Object} flowData - Dados do fluxo
     * @returns {Object} Resultado da validação
     */
    validateFlow(flowData) {
        try {
            // Verificar campos obrigatórios
            if (!flowData.name || !flowData.name.trim()) {
                return {
                    valid: false,
                    error: 'Nome do fluxo é obrigatório'
                };
            }

            if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
                return {
                    valid: false,
                    error: 'Fluxo deve conter nós'
                };
            }

            if (flowData.nodes.length === 0) {
                return {
                    valid: false,
                    error: 'Fluxo deve ter pelo menos um nó'
                };
            }

            // Verificar se existe pelo menos um nó de início
            const startNodes = flowData.nodes.filter(node => node.type === 'start');
            if (startNodes.length === 0) {
                return {
                    valid: false,
                    error: 'Fluxo deve ter pelo menos um nó de início'
                };
            }

            // Verificar IDs únicos dos nós
            const nodeIds = flowData.nodes.map(node => node.id);
            const uniqueIds = new Set(nodeIds);
            if (nodeIds.length !== uniqueIds.size) {
                return {
                    valid: false,
                    error: 'Todos os nós devem ter IDs únicos'
                };
            }

            // Verificar estrutura das conexões
            if (flowData.connections && Array.isArray(flowData.connections)) {
                for (const connection of flowData.connections) {
                    if (!connection.from || !connection.to) {
                        return {
                            valid: false,
                            error: 'Conexões devem ter origem e destino'
                        };
                    }

                    // Verificar se os nós das conexões existem
                    const fromExists = nodeIds.includes(connection.from);
                    const toExists = nodeIds.includes(connection.to);
                    
                    if (!fromExists || !toExists) {
                        return {
                            valid: false,
                            error: 'Conexão referencia nó inexistente'
                        };
                    }
                }
            }

            // Validações específicas por tipo de nó
            for (const node of flowData.nodes) {
                const nodeValidation = this.validateNode(node);
                if (!nodeValidation.valid) {
                    return nodeValidation;
                }
            }

            return {
                valid: true
            };

        } catch (error) {
            logger.error('❌ Erro na validação do fluxo:', error);
            return {
                valid: false,
                error: 'Erro interno na validação'
            };
        }
    }

    /**
     * Valida um nó específico
     * @param {Object} node - Dados do nó
     * @returns {Object} Resultado da validação
     */
    validateNode(node) {
        if (!node.id || !node.type) {
            return {
                valid: false,
                error: 'Nó deve ter ID e tipo'
            };
        }

        // Validações específicas por tipo
        switch (node.type) {
            case 'message':
                if (!node.data || !node.data.text || !node.data.text.trim()) {
                    return {
                        valid: false,
                        error: 'Nó de mensagem deve ter texto'
                    };
                }
                break;

            case 'condition':
                if (!node.data || !node.data.condition || !node.data.value) {
                    return {
                        valid: false,
                        error: 'Nó de condição deve ter tipo e valor'
                    };
                }
                break;

            case 'webhook':
                if (!node.data || !node.data.url) {
                    return {
                        valid: false,
                        error: 'Nó de webhook deve ter URL'
                    };
                }
                
                try {
                    new URL(node.data.url);
                } catch {
                    return {
                        valid: false,
                        error: 'URL do webhook inválida'
                    };
                }
                break;

            case 'llm':
                if (!node.data || !node.data.prompt || !node.data.prompt.trim()) {
                    return {
                        valid: false,
                        error: 'Nó de LLM deve ter prompt'
                    };
                }
                break;

            case 'delay':
                if (!node.data || !node.data.seconds || node.data.seconds < 1) {
                    return {
                        valid: false,
                        error: 'Nó de delay deve ter tempo válido'
                    };
                }
                break;
        }

        return {
            valid: true
        };
    }

    /**
     * Exporta um fluxo para arquivo - SEMPRE busca direto da base flows
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Dados do fluxo formatados
     */
    async exportFlow(flowId) {
        try {
            // SEMPRE buscar direto do MongoDB flows collection
            const flow = await this.flowDataService.loadFlow(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado na base flows'
                };
            }

            const exportData = {
                ...flow,
                exportedAt: new Date().toISOString(),
                exportVersion: '1.0'
            };

            return {
                success: true,
                data: exportData,
                filename: `flow_${flow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`
            };

        } catch (error) {
            logger.error(`❌ Erro ao exportar fluxo ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Importa um fluxo de arquivo
     * @param {Object} flowData - Dados do fluxo importado
     * @returns {Object} Resultado da importação
     */
    async importFlow(flowData) {
        try {
            // Validar dados importados
            const validation = this.validateFlow(flowData);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Fluxo inválido: ${validation.error}`
                };
            }

            // Verificar se já existe fluxo com mesmo nome
            const existingFlow = Array.from(this.flows.values())
                .find(flow => flow.name === flowData.name);

            if (existingFlow) {
                flowData.name = `${flowData.name} (Importado)`;
            }

            // Remover ID existente para gerar novo
            flowData.id = undefined;

            // Salvar fluxo importado
            return await this.saveFlow(flowData);

        } catch (error) {
            logger.error('❌ Erro ao importar fluxo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtém estatísticas dos fluxos - SEMPRE busca direto da base flows
     * @returns {Object} Estatísticas
     */
    async getStats() {
        try {
            // SEMPRE buscar estatísticas direto do MongoDB flows collection
            const stats = await this.flowDataService.getStats();
            
            if (!stats) {
                return {
                    totalFlows: 0,
                    totalNodes: 0,
                    totalConnections: 0,
                    nodeTypes: {},
                    averageNodesPerFlow: 0,
                    lastModified: null
                };
            }

            return {
                ...stats,
                lastModified: stats.lastModified ? stats.lastModified.toISOString() : null
            };

        } catch (error) {
            logger.error('❌ Erro ao obter estatísticas:', error);
            return {
                totalFlows: 0,
                totalNodes: 0,
                totalConnections: 0,
                nodeTypes: {},
                averageNodesPerFlow: 0,
                lastModified: null
            };
        }
    }

    /**
     * Busca fluxos por critério - SEMPRE busca direto da base flows
     * @param {string} query - Termo de busca
     * @returns {Object} Resultados da busca
     */
    async searchFlows(query) {
        try {
            if (!query || !query.trim()) {
                return await this.listFlows();
            }

            // SEMPRE buscar direto do MongoDB flows collection
            const searchResult = await this.flowDataService.searchFlows(query.toLowerCase().trim());
            
            if (!searchResult.flows) {
                return {
                    success: false,
                    error: 'Erro na busca de fluxos'
                };
            }

            const flowList = searchResult.flows.map(flow => ({
                id: flow._id || flow.id,
                alias: flow.alias,
                name: flow.name,
                description: flow.description,
                createdAt: flow.createdAt,
                lastModified: flow.lastModified,
                version: flow.version,
                nodeCount: flow.nodes ? flow.nodes.length : 0,
                connectionCount: flow.connections ? flow.connections.length : 0
            }));

            // Atualizar cache com resultados da busca
            searchResult.flows.forEach(flow => {
                this.flows.set(flow._id || flow.id, flow);
            });

            return {
                success: true,
                flows: flowList,
                total: searchResult.total || flowList.length,
                query: query
            };

        } catch (error) {
            logger.error('❌ Erro na busca de fluxos:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cria um novo fluxo a partir de um template
     * @param {string} templateName - Nome do template a carregar
     * @param {string} flowName - Nome para o novo fluxo
     * @returns {Object} Resultado da operação
     */
    async createFromTemplate(templateName = 'jiu_jitsu', flowName) {
        try {
            let templatePath;
            
            // Determinar caminho do template baseado no nome
            switch (templateName.toLowerCase()) {
                case 'jiu_jitsu':
                case 'jiujitsu':
                case 'academia':
                    templatePath = path.join(__dirname, '../../template_academia_jiu_jitsu.json');
                    break;
                default:
                    return {
                        success: false,
                        error: `Template '${templateName}' não encontrado`
                    };
            }

            // Verificar se template existe
            const templateExists = await fs.access(templatePath).then(() => true).catch(() => false);
            if (!templateExists) {
                return {
                    success: false,
                    error: `Arquivo de template não encontrado: ${templatePath}`
                };
            }

            // Carregar dados do template
            const templateData = await fs.readFile(templatePath, 'utf8');
            const template = JSON.parse(templateData);
            
            // Preparar dados do novo fluxo
            delete template.id; // Remover ID para gerar novo
            template.name = flowName || `${template.name} - ${new Date().toLocaleDateString()}`;
            template.description = `Fluxo criado a partir do template: ${template.name}`;
            template.metadata = {
                ...template.metadata,
                createdFromTemplate: templateName,
                templateVersion: template.version || '1.0',
                createdAt: new Date().toISOString()
            };

            // Salvar novo fluxo
            const result = await this.saveFlow(template);
            
            if (result.success) {
                logger.info(`✅ Fluxo criado a partir do template '${templateName}': ${result.flowId}`);
            }

            return result;

        } catch (error) {
            logger.error(`❌ Erro ao criar fluxo do template '${templateName}':`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Lista templates disponíveis
     * @returns {Object} Lista de templates
     */
    async listAvailableTemplates() {
        try {
            const templates = [];
            
            // Template jiu-jitsu
            const jiujitsuPath = path.join(__dirname, '../../template_academia_jiu_jitsu.json');
            const jiujitsuExists = await fs.access(jiujitsuPath).then(() => true).catch(() => false);
            
            if (jiujitsuExists) {
                try {
                    const templateData = await fs.readFile(jiujitsuPath, 'utf8');
                    const template = JSON.parse(templateData);
                    
                    templates.push({
                        name: 'jiu_jitsu',
                        displayName: 'Academia Jiu-Jitsu',
                        description: template.description || 'Template para atendimento de academia de jiu-jitsu',
                        category: template.metadata?.category || 'fitness',
                        nodeCount: template.nodes?.length || 0,
                        connectionCount: template.connections?.length || 0,
                        tags: template.metadata?.tags || []
                    });
                } catch (error) {
                    logger.warn('⚠️ Erro ao ler template jiu-jitsu:', error.message);
                }
            }

            return {
                success: true,
                templates: templates,
                total: templates.length
            };

        } catch (error) {
            logger.error('❌ Erro ao listar templates:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Registra execução de flow na base flows
     * @param {string} flowId - ID do flow
     * @param {Object} executionData - Dados da execução
     * @returns {Object} Resultado da operação
     */
    async recordExecution(flowId, executionData) {
        try {
            const result = await this.flowDataService.recordFlowExecution(flowId, executionData);
            
            if (result.success) {
                logger.info(`✅ Execução do flow '${flowId}' registrada na base flows`);
            }
            
            return result;
        } catch (error) {
            logger.error(`❌ Erro ao registrar execução do flow ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Registra resultado de busca na base flows
     * @param {string} flowId - ID do flow
     * @param {Object} searchData - Dados da busca
     * @returns {Object} Resultado da operação
     */
    async recordSearch(flowId, searchData) {
        try {
            const result = await this.flowDataService.recordFlowSearch(flowId, searchData);
            
            if (result.success) {
                logger.info(`✅ Busca do flow '${flowId}' registrada na base flows`);
            }
            
            return result;
        } catch (error) {
            logger.error(`❌ Erro ao registrar busca do flow ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtém histórico de execuções de um flow da base flows
     * @param {string} flowId - ID do flow
     * @param {Object} options - Opções de filtragem
     * @returns {Object} Histórico de execuções
     */
    async getExecutionHistory(flowId, options = {}) {
        try {
            const result = await this.flowDataService.getFlowExecutionHistory(flowId, options);
            
            if (result.success) {
                logger.debug(`📊 Histórico de execuções obtido para flow '${flowId}' da base flows`);
            }
            
            return result;
        } catch (error) {
            logger.error(`❌ Erro ao obter histórico do flow ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtém métricas completas de um flow da base flows
     * @param {string} flowId - ID do flow
     * @returns {Object} Métricas completas
     */
    async getFlowMetrics(flowId) {
        try {
            // Buscar flow com dados completos da base flows
            const flow = await this.flowDataService.loadFlow(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Flow não encontrado na base flows'
                };
            }

            const metrics = {
                flowId: flowId,
                name: flow.name,
                totalExecutions: flow.totalExecutions || 0,
                totalSearches: flow.searches ? flow.searches.length : 0,
                lastExecution: flow.lastExecution,
                lastSearch: flow.lastSearch,
                createdAt: flow.createdAt,
                lastModified: flow.lastModified,
                nodeCount: flow.nodes ? flow.nodes.length : 0,
                connectionCount: flow.connections ? flow.connections.length : 0,
                executionHistory: flow.executions || [],
                searchHistory: flow.searches || []
            };

            logger.info(`📊 Métricas completas obtidas para flow '${flowId}' da base flows`);

            return {
                success: true,
                metrics: metrics
            };
        } catch (error) {
            logger.error(`❌ Erro ao obter métricas do flow ${flowId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Método para garantir que todos os dados estão na base flows
     * Verifica integridade e consistência dos dados
     * @returns {Object} Resultado da verificação
     */
    async validateFlowsIntegrity() {
        try {
            const dbFlows = await this.flowDataService.listFlows();
            const cacheFlows = Array.from(this.flows.values());
            
            const report = {
                totalFlowsInDB: dbFlows.total || 0,
                totalFlowsInCache: cacheFlows.length,
                missingInCache: [],
                missingInDB: [],
                inconsistencies: []
            };

            // Verificar flows que estão no DB mas não no cache
            if (dbFlows.flows) {
                dbFlows.flows.forEach(dbFlow => {
                    const flowId = dbFlow._id || dbFlow.id;
                    if (!this.flows.has(flowId)) {
                        report.missingInCache.push(flowId);
                    }
                });
            }

            // Verificar flows que estão no cache mas não no DB
            for (const [flowId] of this.flows.entries()) {
                const dbFlow = await this.flowDataService.loadFlow(flowId);
                if (!dbFlow) {
                    report.missingInDB.push(flowId);
                }
            }

            // Sincronizar cache com DB se necessário
            if (report.missingInCache.length > 0) {
                logger.debug(`🔄 Sincronizando ${report.missingInCache.length} flows do DB para o cache`);
                for (const flowId of report.missingInCache) {
                    const dbFlow = await this.flowDataService.loadFlow(flowId);
                    if (dbFlow) {
                        this.flows.set(flowId, dbFlow);
                    }
                }
            }

            // Só mostrar detalhes se houver inconsistências
            if (report.missingInCache.length > 0 || report.missingInDB.length > 0) {
                logger.info(`✅ Verificação de integridade da base flows concluída`);
                logger.info(`   - Flows no DB: ${report.totalFlowsInDB}`);
                logger.info(`   - Flows no Cache: ${report.totalFlowsInCache}`);
                if (report.missingInCache.length > 0) {
                    logger.info(`   - Faltando no Cache: ${report.missingInCache.length}`);
                }
                if (report.missingInDB.length > 0) {
                    logger.info(`   - Faltando no DB: ${report.missingInDB.length}`);
                }
            } else {
                logger.debug(`✅ Verificação de integridade da base flows concluída - tudo consistente`);
            }

            return {
                success: true,
                report: report
            };
        } catch (error) {
            logger.error('❌ Erro na verificação de integridade:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default FlowService;