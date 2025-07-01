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
    constructor(configService) {
        this.configService = configService;
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

    async init() {
        const currentConfig = await this.configService.getConfig();
        if (!currentConfig?.featureToggles) {
            await this.configService.setConfig({
                ...currentConfig,
                featureToggles: {
                    enabled: false,
                    features: {},
                    userFeatures: {}
                }
            });
        }
        logger.info('Feature Toggle Manager inicializado');
    }

    async getUserFeatures(userId) {
        // Combinar: ENV > Config > Default
        let features = { ...DEFAULT_FEATURES };

        // Aplicar features do ambiente
        features = { ...features, ...this.envFeatures };

        // Tentar carregar da config
        try {
            const currentConfig = await this.configService.getConfig();
            const userFeatures = currentConfig?.featureToggles?.userFeatures?.[userId.toString()];
            if (userFeatures) {
                features = { ...features, ...userFeatures };
            }
        } catch (error) {
            logger.error('Erro ao carregar features do usuário:', error);
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
        try {
            const currentConfig = await this.configService.getConfig();
            const userFeatures = currentConfig?.featureToggles?.userFeatures || {};
            
            userFeatures[userId.toString()] = {
                ...features,
                updatedAt: new Date()
            };

            await this.configService.setConfig({
                ...currentConfig,
                featureToggles: {
                    ...currentConfig.featureToggles,
                    userFeatures
                }
            });

            logger.info(`Features atualizadas para usuário ${userId}:`, features);
            return true;
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
        try {
            const currentConfig = await this.configService.getConfig();
            return currentConfig?.featureToggles?.userFeatures || {};
        } catch (error) {
            logger.error('Erro ao carregar todas as features:', error);
            return {};
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
        try {
            const currentConfig = await this.configService.getConfig();
            const userFeatures = currentConfig?.featureToggles?.userFeatures || {};
            
            delete userFeatures[userId.toString()];

            await this.configService.setConfig({
                ...currentConfig,
                featureToggles: {
                    ...currentConfig.featureToggles,
                    userFeatures
                }
            });

            logger.info(`Features resetadas para usuário ${userId}`);
            return true;
        } catch (error) {
            logger.error('Erro ao resetar features do usuário:', error);
            return false;
        }
    }

    // Métodos para controle global do sistema de feature toggles
    async isFeatureToggleSystemEnabled() {
        const currentConfig = await this.configService.getConfig();
        return currentConfig?.featureToggles?.enabled === true;
    }

    async enableFeatureToggleSystem() {
        const currentConfig = await this.configService.getConfig();
        
        await this.configService.setConfig({
            ...currentConfig,
            featureToggles: {
                ...currentConfig.featureToggles,
                enabled: true
            }
        });
        
        logger.info('Sistema de Feature Toggles habilitado');
    }

    async disableFeatureToggleSystem() {
        const currentConfig = await this.configService.getConfig();
        
        await this.configService.setConfig({
            ...currentConfig,
            featureToggles: {
                ...currentConfig.featureToggles,
                enabled: false
            }
        });
        
        logger.info('Sistema de Feature Toggles desabilitado');
    }

    async setGlobalFeature(featureName, enabled) {
        const currentConfig = await this.configService.getConfig();
        const features = currentConfig?.featureToggles?.features || {};
        
        await this.configService.setConfig({
            ...currentConfig,
            featureToggles: {
                ...currentConfig.featureToggles,
                features: {
                    ...features,
                    [featureName]: enabled
                }
            }
        });
        
        logger.info(`Feature global '${featureName}' definida como: ${enabled}`);
    }

    async getGlobalFeatureSettings() {
        const currentConfig = await this.configService.getConfig();
        return currentConfig?.featureToggles?.features || {};
    }
}

// Singleton instance
let featureToggleManager = null;

export async function createFeatureToggleManager(configService) {
    if (!featureToggleManager) {
        featureToggleManager = new FeatureToggleManager(configService);
        await featureToggleManager.init();
    }
    return featureToggleManager;
}

export { FeatureToggleManager };