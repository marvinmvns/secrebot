import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Serviço para gerenciamento de fluxos no Flow Builder
 * Responsável por CRUD de fluxos, validação e integração
 */
class FlowService {
    constructor(configService) {
        this.configService = configService;
        this.flows = new Map();
        this.init();
    }

    /**
     * Inicializa o serviço carregando fluxos salvos
     */
    async init() {
        try {
            const savedFlows = await this.configService.getConfig('flows') || {};
            
            Object.entries(savedFlows).forEach(([id, flowData]) => {
                this.flows.set(id, flowData);
            });
            
            logger.info(`✅ FlowService inicializado com ${this.flows.size} fluxos`);
            
            // Verificar se existe fluxo padrão, se não, criar um com o template jiu-jitsu
            if (this.flows.size === 0) {
                await this.loadDefaultTemplate();
            }
        } catch (error) {
            logger.error('❌ Erro ao inicializar FlowService:', error);
        }
    }

    /**
     * Carrega o template padrão do jiu-jitsu quando não há fluxos na base
     */
    async loadDefaultTemplate() {
        try {
            const templatePath = path.join(__dirname, '../../template_academia_jiu_jitsu.json');
            const templateExists = await fs.access(templatePath).then(() => true).catch(() => false);
            
            if (templateExists) {
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
                    logger.info('✅ Template padrão jiu-jitsu carregado automaticamente');
                } else {
                    logger.warn('⚠️ Falha ao carregar template padrão:', result.error);
                }
            } else {
                logger.warn('⚠️ Template jiu-jitsu não encontrado em:', templatePath);
            }
        } catch (error) {
            logger.error('❌ Erro ao carregar template padrão:', error);
        }
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

            // Gerar ID se não existir
            const flowId = flowData.id || `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Preparar dados do fluxo
            const flow = {
                ...flowData,
                id: flowId,
                createdAt: flowData.createdAt || new Date().toISOString(),
                lastModified: new Date().toISOString(),
                version: flowData.version || '1.0'
            };

            // Salvar na memória
            this.flows.set(flowId, flow);

            // Persistir no banco
            const allFlows = Object.fromEntries(this.flows);
            await this.configService.setConfig({ flows: allFlows });

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
     * Carrega um fluxo específico
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Dados do fluxo ou erro
     */
    async loadFlow(flowId) {
        try {
            const flow = this.flows.get(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
                };
            }

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
     * Lista todos os fluxos
     * @returns {Object} Lista de fluxos
     */
    async listFlows() {
        try {
            const flowList = Array.from(this.flows.values()).map(flow => ({
                id: flow.id,
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
     * Exclui um fluxo
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Resultado da operação
     */
    async deleteFlow(flowId) {
        try {
            if (!this.flows.has(flowId)) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
                };
            }

            const flowName = this.flows.get(flowId).name;
            
            // Remover da memória
            this.flows.delete(flowId);

            // Persistir no banco
            const allFlows = Object.fromEntries(this.flows);
            await this.configService.setConfig({ flows: allFlows });

            logger.info(`🗑️ Fluxo '${flowName}' (${flowId}) excluído`);
            
            return {
                success: true,
                message: 'Fluxo excluído com sucesso'
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
     * Duplica um fluxo
     * @param {string} flowId - ID do fluxo a ser duplicado
     * @param {string} newName - Nome do novo fluxo
     * @returns {Object} Resultado da operação
     */
    async duplicateFlow(flowId, newName) {
        try {
            const originalFlow = this.flows.get(flowId);
            
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
                id: undefined // Será gerado automaticamente
            };

            // Salvar a cópia
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
     * Exporta um fluxo para arquivo
     * @param {string} flowId - ID do fluxo
     * @returns {Object} Dados do fluxo formatados
     */
    async exportFlow(flowId) {
        try {
            const flow = this.flows.get(flowId);
            
            if (!flow) {
                return {
                    success: false,
                    error: 'Fluxo não encontrado'
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
     * Obtém estatísticas dos fluxos
     * @returns {Object} Estatísticas
     */
    getStats() {
        try {
            const flows = Array.from(this.flows.values());
            
            const stats = {
                totalFlows: flows.length,
                totalNodes: flows.reduce((sum, flow) => sum + (flow.nodes ? flow.nodes.length : 0), 0),
                totalConnections: flows.reduce((sum, flow) => sum + (flow.connections ? flow.connections.length : 0), 0),
                nodeTypes: {},
                averageNodesPerFlow: 0,
                lastModified: null
            };

            // Contar tipos de nós
            flows.forEach(flow => {
                if (flow.nodes) {
                    flow.nodes.forEach(node => {
                        stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;
                    });
                }
            });

            // Calcular média de nós por fluxo
            if (flows.length > 0) {
                stats.averageNodesPerFlow = Math.round(stats.totalNodes / flows.length * 10) / 10;
            }

            // Encontrar última modificação
            if (flows.length > 0) {
                stats.lastModified = flows
                    .map(flow => new Date(flow.lastModified || flow.createdAt))
                    .sort((a, b) => b - a)[0]
                    .toISOString();
            }

            return stats;

        } catch (error) {
            logger.error('❌ Erro ao obter estatísticas:', error);
            return null;
        }
    }

    /**
     * Busca fluxos por critério
     * @param {string} query - Termo de busca
     * @returns {Object} Resultados da busca
     */
    async searchFlows(query) {
        try {
            if (!query || !query.trim()) {
                return await this.listFlows();
            }

            const searchTerm = query.toLowerCase().trim();
            const flows = Array.from(this.flows.values());
            
            const results = flows.filter(flow => {
                return (
                    flow.name.toLowerCase().includes(searchTerm) ||
                    (flow.description && flow.description.toLowerCase().includes(searchTerm)) ||
                    (flow.nodes && flow.nodes.some(node => 
                        node.data && JSON.stringify(node.data).toLowerCase().includes(searchTerm)
                    ))
                );
            });

            const flowList = results.map(flow => ({
                id: flow.id,
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
                total: flowList.length,
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
}

export default FlowService;