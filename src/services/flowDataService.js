import logger from '../utils/logger.js';

/**
 * Serviço dedicado para gerenciamento de dados de flows
 * Separado da configuração base do sistema
 */
class FlowDataService {
    constructor(db) {
        this.collection = db.collection('flows');
        this.configCollection = db.collection('config');
        this.migrationCompleted = false;
    }

    /**
     * Inicializa o serviço e executa migração se necessário
     */
    async init() {
        try {
            // Verificar se a migração já foi executada
            await this.ensureMigration();
            
            // Criar índices necessários
            await this.createIndexes();
            
            logger.info('✅ FlowDataService inicializado');
            return true;
        } catch (error) {
            logger.error('❌ Erro ao inicializar FlowDataService:', error);
            throw error;
        }
    }

    /**
     * Executa migração dos dados de flow da tabela config para a nova tabela
     */
    async ensureMigration() {
        try {
            // Verificar se já existe dados na nova coleção
            const flowCount = await this.collection.countDocuments();
            
            if (flowCount > 0) {
                logger.info('📊 Dados de flows já existem na nova coleção');
                this.migrationCompleted = true;
                return;
            }

            // Buscar dados de flows na configuração antiga
            const configDoc = await this.configCollection.findOne({ _id: 'app' });
            
            if (!configDoc || !configDoc.values || !configDoc.values.flows) {
                logger.info('📊 Nenhum flow encontrado na configuração para migrar');
                this.migrationCompleted = true;
                return;
            }

            const oldFlows = configDoc.values.flows;
            const flowsToMigrate = Object.values(oldFlows);

            if (flowsToMigrate.length === 0) {
                logger.info('📊 Nenhum flow para migrar');
                this.migrationCompleted = true;
                return;
            }

            logger.info(`🔄 Iniciando migração de ${flowsToMigrate.length} flows`);

            // Migrar cada flow para a nova coleção
            const migrationResults = [];
            for (const flow of flowsToMigrate) {
                try {
                    const flowDoc = {
                        _id: flow.id,
                        ...flow,
                        migratedAt: new Date(),
                        migrationVersion: '1.0'
                    };

                    await this.collection.insertOne(flowDoc);
                    migrationResults.push({ id: flow.id, success: true });
                    logger.verbose(`✅ Flow migrado: ${flow.id} - ${flow.name}`);
                } catch (error) {
                    logger.error(`❌ Erro ao migrar flow ${flow.id}:`, error);
                    migrationResults.push({ id: flow.id, success: false, error: error.message });
                }
            }

            const successCount = migrationResults.filter(r => r.success).length;
            const errorCount = migrationResults.length - successCount;

            logger.info(`✅ Migração concluída: ${successCount} sucessos, ${errorCount} erros`);

            // Remover dados de flows da configuração após migração bem-sucedida
            if (successCount > 0) {
                await this.removeFlowsFromConfig();
            }

            this.migrationCompleted = true;
        } catch (error) {
            logger.error('❌ Erro durante migração de flows:', error);
            throw error;
        }
    }

    /**
     * Remove os dados de flows da configuração antiga
     */
    async removeFlowsFromConfig() {
        try {
            await this.configCollection.updateOne(
                { _id: 'app' },
                { $unset: { 'values.flows': '' } }
            );
            logger.info('🗑️ Dados de flows removidos da configuração');
        } catch (error) {
            logger.warn('⚠️ Erro ao remover flows da configuração:', error);
        }
    }

    /**
     * Cria índices necessários para performance
     */
    async createIndexes() {
        try {
            await this.collection.createIndex({ name: 1 });
            await this.collection.createIndex({ createdAt: -1 });
            await this.collection.createIndex({ lastModified: -1 });
            await this.collection.createIndex({ 'metadata.isDefault': 1 });
            logger.verbose('📊 Índices criados para coleção flows');
        } catch (error) {
            logger.warn('⚠️ Erro ao criar índices:', error);
        }
    }

    /**
     * Salva um flow na coleção flows - REGISTRO COMPLETO
     */
    async saveFlow(flowData) {
        try {
            const flowDoc = {
                _id: flowData.id,
                ...flowData,
                lastModified: new Date(),
                operationType: flowData.id ? 'update' : 'insert',
                flowVersion: flowData.version || '1.0'
            };

            const result = await this.collection.replaceOne(
                { _id: flowData.id },
                flowDoc,
                { upsert: true }
            );

            const operation = result.modifiedCount > 0 ? 'atualizado' : 'inserido';
            logger.info(`💾 Flow '${flowData.name}' ${operation} na base flows (ID: ${flowData.id})`);

            return {
                success: true,
                flowId: flowData.id,
                modified: result.modifiedCount > 0,
                inserted: result.upsertedCount > 0,
                operation: operation
            };
        } catch (error) {
            logger.error(`❌ Erro ao salvar flow '${flowData.name}' na base flows:`, error);
            throw error;
        }
    }

    /**
     * Carrega um flow específico da base flows
     */
    async loadFlow(flowId) {
        try {
            const flow = await this.collection.findOne({ _id: flowId });
            
            if (flow) {
                logger.verbose(`📋 Flow '${flow.name}' carregado da base flows (ID: ${flowId})`);
            } else {
                logger.verbose(`⚠️ Flow não encontrado na base flows (ID: ${flowId})`);
            }
            
            return flow;
        } catch (error) {
            logger.error(`❌ Erro ao carregar flow ${flowId} da base flows:`, error);
            throw error;
        }
    }

    /**
     * Lista todos os flows da base flows
     */
    async listFlows(options = {}) {
        try {
            const { 
                limit = 0, 
                skip = 0, 
                sortBy = 'lastModified',
                sortOrder = -1,
                filter = {}
            } = options;

            const cursor = this.collection.find(filter);
            
            if (sortBy) {
                cursor.sort({ [sortBy]: sortOrder });
            }
            
            if (skip > 0) {
                cursor.skip(skip);
            }
            
            if (limit > 0) {
                cursor.limit(limit);
            }

            const flows = await cursor.toArray();
            const total = await this.collection.countDocuments(filter);

            logger.verbose(`📊 Listagem da base flows: ${flows.length} flows retornados (total: ${total})`);

            return {
                success: true,
                flows,
                total,
                hasMore: skip + flows.length < total
            };
        } catch (error) {
            logger.error('❌ Erro ao listar flows da base flows:', error);
            return {
                success: false,
                flows: [],
                total: 0,
                hasMore: false,
                error: error.message
            };
        }
    }

    /**
     * Exclui um flow da base flows
     */
    async deleteFlow(flowId) {
        try {
            // Buscar dados do flow antes de excluir para log
            const flow = await this.collection.findOne({ _id: flowId });
            
            const result = await this.collection.deleteOne({ _id: flowId });
            
            if (result.deletedCount > 0) {
                const flowName = flow ? flow.name : 'Unknown';
                logger.info(`🗑️ Flow '${flowName}' excluído da base flows (ID: ${flowId})`);
            } else {
                logger.warn(`⚠️ Tentativa de excluir flow inexistente na base flows (ID: ${flowId})`);
            }
            
            return {
                success: result.deletedCount > 0,
                deletedCount: result.deletedCount
            };
        } catch (error) {
            logger.error(`❌ Erro ao excluir flow ${flowId} da base flows:`, error);
            throw error;
        }
    }

    /**
     * Busca flows por critério na base flows
     */
    async searchFlows(query, options = {}) {
        try {
            const { limit = 20, skip = 0 } = options;
            
            const searchFilter = {
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { alias: { $regex: query, $options: 'i' } },
                    { 'nodes.data.text': { $regex: query, $options: 'i' } },
                    { 'nodes.data.prompt': { $regex: query, $options: 'i' } }
                ]
            };

            const result = await this.listFlows({
                limit,
                skip,
                filter: searchFilter,
                sortBy: 'lastModified',
                sortOrder: -1
            });

            logger.info(`🔍 Busca na base flows por '${query}': ${result.flows.length} resultados encontrados`);
            
            return result;
        } catch (error) {
            logger.error(`❌ Erro na busca de flows por '${query}' na base flows:`, error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas da coleção
     */
    async getStats() {
        try {
            const total = await this.collection.countDocuments();
            
            if (total === 0) {
                return {
                    totalFlows: 0,
                    totalNodes: 0,
                    totalConnections: 0,
                    nodeTypes: {},
                    averageNodesPerFlow: 0,
                    lastModified: null
                };
            }

            // Agregação para estatísticas
            const stats = await this.collection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalFlows: { $sum: 1 },
                        totalNodes: { $sum: { $size: { $ifNull: ['$nodes', []] } } },
                        totalConnections: { $sum: { $size: { $ifNull: ['$connections', []] } } },
                        lastModified: { $max: '$lastModified' }
                    }
                }
            ]).toArray();

            const result = stats[0] || {
                totalFlows: 0,
                totalNodes: 0,
                totalConnections: 0,
                lastModified: null
            };

            // Calcular tipos de nós
            const nodeTypesResult = await this.collection.aggregate([
                { $unwind: { path: '$nodes', preserveNullAndEmptyArrays: true } },
                { $group: { _id: '$nodes.type', count: { $sum: 1 } } }
            ]).toArray();

            result.nodeTypes = {};
            nodeTypesResult.forEach(item => {
                if (item._id) {
                    result.nodeTypes[item._id] = item.count;
                }
            });

            result.averageNodesPerFlow = result.totalFlows > 0 
                ? Math.round(result.totalNodes / result.totalFlows * 10) / 10 
                : 0;

            return result;
        } catch (error) {
            logger.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Verifica se um flow existe
     */
    async flowExists(flowId) {
        try {
            const count = await this.collection.countDocuments({ _id: flowId });
            return count > 0;
        } catch (error) {
            logger.error(`❌ Erro ao verificar existência do flow ${flowId}:`, error);
            return false;
        }
    }

    /**
     * Atualiza apenas campos específicos de um flow
     */
    async updateFlow(flowId, updates) {
        try {
            const updateDoc = {
                ...updates,
                lastModified: new Date()
            };

            const result = await this.collection.updateOne(
                { _id: flowId },
                { $set: updateDoc }
            );

            return {
                success: result.matchedCount > 0,
                modified: result.modifiedCount > 0
            };
        } catch (error) {
            logger.error(`❌ Erro ao atualizar flow ${flowId}:`, error);
            throw error;
        }
    }

    /**
     * Registra execução de flow com resultados e métricas
     * @param {string} flowId - ID do flow
     * @param {Object} executionData - Dados da execução
     * @returns {Object} Resultado da operação
     */
    async recordFlowExecution(flowId, executionData) {
        try {
            const execution = {
                executionId: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                flowId: flowId,
                startTime: executionData.startTime || new Date(),
                endTime: executionData.endTime || new Date(),
                duration: executionData.duration || 0,
                status: executionData.status || 'completed',
                input: executionData.input || {},
                output: executionData.output || {},
                nodesExecuted: executionData.nodesExecuted || [],
                errors: executionData.errors || [],
                metrics: executionData.metrics || {},
                timestamp: new Date()
            };

            // Atualizar o flow com dados da última execução
            await this.collection.updateOne(
                { _id: flowId },
                { 
                    $push: { 
                        executions: { 
                            $each: [execution], 
                            $slice: -50 // Manter apenas as últimas 50 execuções
                        } 
                    },
                    $set: {
                        lastExecution: execution,
                        lastExecutionTime: execution.endTime,
                        totalExecutions: { $inc: 1 },
                        lastModified: new Date()
                    }
                }
            );

            logger.info(`🔄 Execução registrada na base flows - Flow: ${flowId}, Status: ${execution.status}`);

            return {
                success: true,
                executionId: execution.executionId,
                status: execution.status
            };
        } catch (error) {
            logger.error(`❌ Erro ao registrar execução do flow ${flowId} na base flows:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Registra resultado de busca/pesquisa na base flows
     * @param {string} flowId - ID do flow
     * @param {Object} searchData - Dados da busca
     * @returns {Object} Resultado da operação
     */
    async recordFlowSearch(flowId, searchData) {
        try {
            const search = {
                searchId: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                flowId: flowId,
                query: searchData.query || '',
                filters: searchData.filters || {},
                results: searchData.results || [],
                resultCount: searchData.resultCount || 0,
                searchTime: searchData.searchTime || 0,
                timestamp: new Date()
            };

            // Atualizar o flow com dados da busca
            await this.collection.updateOne(
                { _id: flowId },
                { 
                    $push: { 
                        searches: { 
                            $each: [search], 
                            $slice: -20 // Manter apenas as últimas 20 buscas
                        } 
                    },
                    $set: {
                        lastSearch: search,
                        lastSearchTime: search.timestamp,
                        lastModified: new Date()
                    }
                }
            );

            logger.info(`🔍 Busca registrada na base flows - Flow: ${flowId}, Query: '${search.query}', Resultados: ${search.resultCount}`);

            return {
                success: true,
                searchId: search.searchId,
                resultCount: search.resultCount
            };
        } catch (error) {
            logger.error(`❌ Erro ao registrar busca do flow ${flowId} na base flows:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Obtém histórico de execuções de um flow
     * @param {string} flowId - ID do flow
     * @param {Object} options - Opções de filtragem
     * @returns {Object} Histórico de execuções
     */
    async getFlowExecutionHistory(flowId, options = {}) {
        try {
            const { limit = 10, status = null } = options;
            
            const flow = await this.collection.findOne(
                { _id: flowId },
                { projection: { executions: 1, totalExecutions: 1, lastExecution: 1 } }
            );

            if (!flow) {
                return {
                    success: false,
                    error: 'Flow não encontrado na base flows'
                };
            }

            let executions = flow.executions || [];
            
            // Filtrar por status se especificado
            if (status) {
                executions = executions.filter(exec => exec.status === status);
            }

            // Limitar resultados
            executions = executions.slice(-limit).reverse();

            logger.verbose(`📊 Histórico de execuções obtido da base flows - Flow: ${flowId}, Registros: ${executions.length}`);

            return {
                success: true,
                flowId: flowId,
                executions: executions,
                totalExecutions: flow.totalExecutions || 0,
                lastExecution: flow.lastExecution || null
            };
        } catch (error) {
            logger.error(`❌ Erro ao obter histórico de execuções do flow ${flowId} da base flows:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verifica se um flow com o ID especificado já existe
     * @param {string} flowId - ID do flow
     * @returns {boolean} True se existe, false caso contrário
     */
    async flowExists(flowId) {
        try {
            const count = await this.collection.countDocuments({ _id: flowId });
            return count > 0;
        } catch (error) {
            logger.error(`❌ Erro ao verificar existência do flow ${flowId}:`, error);
            return false;
        }
    }
}

export default FlowDataService;