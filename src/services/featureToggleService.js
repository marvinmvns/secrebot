import { MongoClient } from 'mongodb';
import { config } from '../config/config.js';
import logger from '../utils/logger.js';

const DEFAULT_FEATURES = {
    ai_chat: true,
    scheduler: true,
    audio_transcription: true,
    image_analysis: true,
    video_summary: true,
    text_summary: true,
    tts: true,
    calorie_counter: false, // Requer API key
    linkedin_analysis: false, // Requer configuração
    media_processing: true,
    professional_analysis: false,
    system_resources: true
};

class FeatureToggleManager {
    constructor() {
        this.db = null;
        this.collection = null;
        this.isConnected = false;
        this.envFeatures = this.loadEnvFeatures();
    }

    loadEnvFeatures() {
        const envFeatures = {};
        
        // Carregar features do .env
        for (const [key] of Object.entries(DEFAULT_FEATURES)) {
            const envKey = `TELEGRAM_FEATURE_${key.toUpperCase()}`;
            const envValue = process.env[envKey];
            
            if (envValue !== undefined) {
                envFeatures[key] = envValue.toLowerCase() === 'true';
            }
        }

        return envFeatures;
    }

    async connect() {
        if (this.isConnected) return true;

        if (!config.mongo?.uri) {
            logger.warn('MongoDB não configurado. Usando apenas features do .env');
            return false;
        }

        try {
            const client = new MongoClient(config.mongo.uri);
            await client.connect();
            
            this.db = client.db();
            this.collection = this.db.collection('telegram_features');
            
            // Criar índices
            await this.collection.createIndex({ userId: 1 }, { unique: true });
            
            this.isConnected = true;
            logger.info('Feature Toggle Manager conectado ao MongoDB');
            return true;
        } catch (error) {
            logger.error('Erro ao conectar Feature Toggle Manager:', error);
            return false;
        }
    }

    async getUserFeatures(userId) {
        // Combinar: ENV > MongoDB > Default
        let features = { ...DEFAULT_FEATURES };

        // Aplicar features do ambiente
        features = { ...features, ...this.envFeatures };

        // Tentar carregar do MongoDB se conectado
        if (this.isConnected) {
            try {
                const userConfig = await this.collection.findOne({ userId: userId.toString() });
                if (userConfig && userConfig.features) {
                    features = { ...features, ...userConfig.features };
                }
            } catch (error) {
                logger.error('Erro ao carregar features do usuário:', error);
            }
        }

        // Verificar dependências específicas
        features = this.checkFeatureDependencies(features);

        return features;
    }

    checkFeatureDependencies(features) {
        // Desabilitar features que dependem de APIs não configuradas
        if (!config.calorie?.apiKey) {
            features.calorie_counter = false;
        }

        if (!config.linkedin?.user || !config.linkedin?.pass) {
            features.linkedin_analysis = false;
        }

        if (!config.elevenlabs?.apiKey && !config.piper?.enabled) {
            features.tts = false;
        }

        if (!config.ollama?.host) {
            features.ai_chat = false;
            features.image_analysis = false;
            features.text_summary = false;
        }

        // Agrupar features compostas
        features.media_processing = features.audio_transcription || features.video_summary;
        features.professional_analysis = features.linkedin_analysis || features.system_resources;

        return features;
    }

    async setUserFeatures(userId, features) {
        if (!this.isConnected) {
            logger.warn('MongoDB não conectado. Não é possível salvar features do usuário');
            return false;
        }

        try {
            const result = await this.collection.updateOne(
                { userId: userId.toString() },
                { 
                    $set: { 
                        features: features,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        userId: userId.toString(),
                        createdAt: new Date()
                    }
                },
                { upsert: true }
            );

            logger.info(`Features atualizadas para usuário ${userId}:`, features);
            return result.acknowledged;
        } catch (error) {
            logger.error('Erro ao salvar features do usuário:', error);
            return false;
        }
    }

    async toggleUserFeature(userId, featureName, enabled) {
        const currentFeatures = await this.getUserFeatures(userId);
        
        if (!(featureName in currentFeatures)) {
            logger.warn(`Feature desconhecida: ${featureName}`);
            return false;
        }

        const newFeatures = {
            ...currentFeatures,
            [featureName]: enabled
        };

        return await this.setUserFeatures(userId, newFeatures);
    }

    async getGlobalFeatures() {
        return {
            env: this.envFeatures,
            default: DEFAULT_FEATURES,
            combined: { ...DEFAULT_FEATURES, ...this.envFeatures }
        };
    }

    async getAllUserFeatures() {
        if (!this.isConnected) {
            return [];
        }

        try {
            return await this.collection.find({}).toArray();
        } catch (error) {
            logger.error('Erro ao carregar todas as features:', error);
            return [];
        }
    }

    // Validar se uma feature está disponível para o usuário
    async isFeatureEnabled(userId, featureName) {
        const features = await this.getUserFeatures(userId);
        return features[featureName] === true;
    }

    // Listar features disponíveis com descrições
    getAvailableFeatures() {
        return Object.keys(DEFAULT_FEATURES);
    }

    // Criar configuração padrão para novo usuário
    async createDefaultUserConfig(userId) {
        const defaultConfig = {
            ...DEFAULT_FEATURES,
            ...this.envFeatures
        };

        return await this.setUserFeatures(userId, defaultConfig);
    }

    // Resetar features do usuário para padrão
    async resetUserFeatures(userId) {
        if (!this.isConnected) {
            return false;
        }

        try {
            await this.collection.deleteOne({ userId: userId.toString() });
            logger.info(`Features resetadas para usuário ${userId}`);
            return true;
        } catch (error) {
            logger.error('Erro ao resetar features do usuário:', error);
            return false;
        }
    }
}

// Singleton instance
let featureToggleManager = null;

export async function createFeatureToggleManager() {
    if (!featureToggleManager) {
        featureToggleManager = new FeatureToggleManager();
        await featureToggleManager.connect();
    }
    return featureToggleManager;
}

export { FeatureToggleManager };