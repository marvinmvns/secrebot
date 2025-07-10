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
     * Salva um flow na nova coleção
     */
    async saveFlow(flowData) {
        try {
            const flowDoc = {
                _id: flowData.id,
                ...flowData,
                lastModified: new Date()
            };

            const result = await this.collection.replaceOne(
                { _id: flowData.id },
                flowDoc,
                { upsert: true }
            );

            return {
                success: true,
                flowId: flowData.id,
                modified: result.modifiedCount > 0,
                inserted: result.upsertedCount > 0
            };
        } catch (error) {
            logger.error('❌ Erro ao salvar flow:', error);
            throw error;
        }
    }

    /**
     * Carrega um flow específico
     */
    async loadFlow(flowId) {
        try {
            const flow = await this.collection.findOne({ _id: flowId });
            return flow;
        } catch (error) {
            logger.error(`❌ Erro ao carregar flow ${flowId}:`, error);
            throw error;
        }
    }

    /**
     * Lista todos os flows
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

            return {
                flows,
                total,
                hasMore: skip + flows.length < total
            };
        } catch (error) {
            logger.error('❌ Erro ao listar flows:', error);
            throw error;
        }
    }

    /**
     * Exclui um flow
     */
    async deleteFlow(flowId) {
        try {
            const result = await this.collection.deleteOne({ _id: flowId });
            return {
                success: result.deletedCount > 0,
                deletedCount: result.deletedCount
            };
        } catch (error) {
            logger.error(`❌ Erro ao excluir flow ${flowId}:`, error);
            throw error;
        }
    }

    /**
     * Busca flows por critério
     */
    async searchFlows(query, options = {}) {
        try {
            const { limit = 20, skip = 0 } = options;
            
            const searchFilter = {
                $or: [
                    { name: { $regex: query, $options: 'i' } },
                    { description: { $regex: query, $options: 'i' } },
                    { 'nodes.data.text': { $regex: query, $options: 'i' } }
                ]
            };

            return await this.listFlows({
                limit,
                skip,
                filter: searchFilter,
                sortBy: 'lastModified',
                sortOrder: -1
            });
        } catch (error) {
            logger.error('❌ Erro na busca de flows:', error);
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