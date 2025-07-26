import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST;
const OLLAMA_TIMEOUT_MS = process.env.OLLAMA_TIMEOUT_MS || '999000';

process.env.UNDICI_HEADERS_TIMEOUT = OLLAMA_TIMEOUT_MS;
process.env.UNDICI_BODY_TIMEOUT = OLLAMA_TIMEOUT_MS;

export const config = {
  debug: {
    enabled: process.env.DEBUG_ENABLED === 'true' || process.env.NODE_ENV === 'development',
    verbose: process.env.DEBUG_VERBOSE === 'true',
    logLevel: process.env.LOG_LEVEL || 'debug'
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://bot:senha@127.0.0.1:27017/bot?authSource=sched',
    dbName: 'sched',
    collectionName: 'sched'
  },
  server: {
    port: process.env.PORT || 3000
  },
  scheduler: {
    interval: parseInt(process.env.SCHED_INTERVAL || '30000', 10),
    maxAttempts: parseInt(process.env.SCHED_MAX_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.SCHED_RETRY_DELAY || String(2 * 60 * 60 * 1000), 10),
    concurrency: parseInt(process.env.SCHED_CONCURRENCY || '5', 10),
    dynamic: {
      enabled: process.env.DYNAMIC_CONCURRENCY === 'true',
      min: parseInt(process.env.SCHED_DYNAMIC_MIN || '1', 10),
      max: parseInt(process.env.SCHED_DYNAMIC_MAX || process.env.SCHED_MAX_CONCURRENCY || '100', 10),
      cpuThreshold: parseFloat(process.env.SCHED_CPU_THRESHOLD || '1.7'),
      memThreshold: parseFloat(process.env.SCHED_MEM_THRESHOLD || '1.8')
    }
  },
  queues: {
    llmConcurrency: parseInt(process.env.LLM_CONCURRENCY || '20', 10),
    whisperConcurrency: parseInt(process.env.WHISPER_CONCURRENCY || '10', 10),
    memoryThresholdGB: parseInt(process.env.QUEUE_MEM_THRESHOLD_GB || '32', 10),
    memoryCheckInterval: parseInt(process.env.MEM_CHECK_INTERVAL || '1000', 10)
  },
  llm: {
    model: process.env.LLM_MODEL || 'granite3.2:latest',
    imageModel: process.env.LLM_IMAGE_MODEL || 'llava:7b',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '32000', 10),
    host: OLLAMA_HOST || 'http://127.0.0.1:11434',
    timeoutMs: parseInt(OLLAMA_TIMEOUT_MS, 999999)
  },
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000', 10),
    model: process.env.WHISPER_MODEL || 'large-v3-turbo',
    language: process.env.AUDIO_LANGUAGE || 'pt',
    timeoutMs: parseInt(process.env.WHISPER_TIMEOUT_MS || '9990000', 10)
  },
  whisperApi: {
    enabled: process.env.WHISPER_API_ENABLED === 'true',
    mode: process.env.WHISPER_API_MODE || 'api', // 'local' or 'api'
    endpoints: [
      {
        url: process.env.WHISPER_API_ENDPOINT_1 || 'http://localhost:3001',
        enabled: process.env.WHISPER_API_ENDPOINT_1_ENABLED !== 'false',
        priority: parseInt(process.env.WHISPER_API_ENDPOINT_1_PRIORITY || '1', 10),
        maxRetries: parseInt(process.env.WHISPER_API_ENDPOINT_1_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.WHISPER_API_ENDPOINT_2 || '',
        enabled: process.env.WHISPER_API_ENDPOINT_2_ENABLED === 'true' && !!process.env.WHISPER_API_ENDPOINT_2,
        priority: parseInt(process.env.WHISPER_API_ENDPOINT_2_PRIORITY || '2', 10),
        maxRetries: parseInt(process.env.WHISPER_API_ENDPOINT_2_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.WHISPER_API_ENDPOINT_3 || '',
        enabled: process.env.WHISPER_API_ENDPOINT_3_ENABLED === 'true' && !!process.env.WHISPER_API_ENDPOINT_3,
        priority: parseInt(process.env.WHISPER_API_ENDPOINT_3_PRIORITY || '3', 10),
        maxRetries: parseInt(process.env.WHISPER_API_ENDPOINT_3_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.WHISPER_API_ENDPOINT_4 || '',
        enabled: process.env.WHISPER_API_ENDPOINT_4_ENABLED === 'true' && !!process.env.WHISPER_API_ENDPOINT_4,
        priority: parseInt(process.env.WHISPER_API_ENDPOINT_4_PRIORITY || '4', 10),
        maxRetries: parseInt(process.env.WHISPER_API_ENDPOINT_4_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.WHISPER_API_ENDPOINT_5 || '',
        enabled: process.env.WHISPER_API_ENDPOINT_5_ENABLED === 'true' && !!process.env.WHISPER_API_ENDPOINT_5,
        priority: parseInt(process.env.WHISPER_API_ENDPOINT_5_PRIORITY || '5', 10),
        maxRetries: parseInt(process.env.WHISPER_API_ENDPOINT_5_MAX_RETRIES || '2', 10)
      }
    ].filter(endpoint => endpoint.enabled && endpoint.url),
    timeout: parseInt(process.env.WHISPER_API_TIMEOUT || '300000', 10), // 5 minutes
    retryDelay: parseInt(process.env.WHISPER_API_RETRY_DELAY || '2000', 10),
    loadBalancing: {
      strategy: process.env.WHISPER_API_LOAD_STRATEGY || 'queue_length', // 'round_robin', 'priority', 'queue_length'
      healthCheckInterval: parseInt(process.env.WHISPER_API_HEALTH_CHECK_INTERVAL || '30000', 10)
    },
    whisperOptions: {
      outputInCsv: process.env.WHISPER_OUTPUT_CSV === 'true',
      outputInJson: process.env.WHISPER_OUTPUT_JSON === 'true',
      outputInJsonFull: process.env.WHISPER_OUTPUT_JSON_FULL === 'true',
      outputInLrc: process.env.WHISPER_OUTPUT_LRC === 'true',
      outputInSrt: process.env.WHISPER_OUTPUT_SRT !== 'false',
      outputInText: process.env.WHISPER_OUTPUT_TEXT === 'true',
      outputInVtt: process.env.WHISPER_OUTPUT_VTT === 'true',
      outputInWords: process.env.WHISPER_OUTPUT_WORDS === 'true',
      translateToEnglish: process.env.WHISPER_TRANSLATE_EN === 'true',
      timestamps_length: parseInt(process.env.WHISPER_TIMESTAMPS_LENGTH || '20', 10),
      splitOnWord: process.env.WHISPER_SPLIT_ON_WORD !== 'false',
      removeTimestamps: process.env.WHISPER_REMOVE_TIMESTAMPS === 'true'
    }
  },
  ollamaApi: {
    enabled: process.env.OLLAMA_API_ENABLED === 'true',
    mode: process.env.OLLAMA_API_MODE || 'local', // 'local' or 'api'
    endpoints: [
      {
        url: process.env.OLLAMA_API_ENDPOINT_1 || 'http://localhost:11434',
        enabled: process.env.OLLAMA_API_ENDPOINT_1_ENABLED !== 'false',
        priority: parseInt(process.env.OLLAMA_API_ENDPOINT_1_PRIORITY || '1', 10),
        maxRetries: parseInt(process.env.OLLAMA_API_ENDPOINT_1_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.OLLAMA_API_ENDPOINT_2 || '',
        enabled: process.env.OLLAMA_API_ENDPOINT_2_ENABLED === 'true' && !!process.env.OLLAMA_API_ENDPOINT_2,
        priority: parseInt(process.env.OLLAMA_API_ENDPOINT_2_PRIORITY || '2', 10),
        maxRetries: parseInt(process.env.OLLAMA_API_ENDPOINT_2_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.OLLAMA_API_ENDPOINT_3 || '',
        enabled: process.env.OLLAMA_API_ENDPOINT_3_ENABLED === 'true' && !!process.env.OLLAMA_API_ENDPOINT_3,
        priority: parseInt(process.env.OLLAMA_API_ENDPOINT_3_PRIORITY || '3', 10),
        maxRetries: parseInt(process.env.OLLAMA_API_ENDPOINT_3_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.OLLAMA_API_ENDPOINT_4 || '',
        enabled: process.env.OLLAMA_API_ENDPOINT_4_ENABLED === 'true' && !!process.env.OLLAMA_API_ENDPOINT_4,
        priority: parseInt(process.env.OLLAMA_API_ENDPOINT_4_PRIORITY || '4', 10),
        maxRetries: parseInt(process.env.OLLAMA_API_ENDPOINT_4_MAX_RETRIES || '2', 10)
      },
      {
        url: process.env.OLLAMA_API_ENDPOINT_5 || '',
        enabled: process.env.OLLAMA_API_ENDPOINT_5_ENABLED === 'true' && !!process.env.OLLAMA_API_ENDPOINT_5,
        priority: parseInt(process.env.OLLAMA_API_ENDPOINT_5_PRIORITY || '5', 10),
        maxRetries: parseInt(process.env.OLLAMA_API_ENDPOINT_5_MAX_RETRIES || '2', 10)
      }
    ].filter(endpoint => endpoint.enabled && endpoint.url),
    timeout: parseInt(process.env.OLLAMA_API_TIMEOUT || '600000', 10), // 10 minutes
    retryDelay: parseInt(process.env.OLLAMA_API_RETRY_DELAY || '2000', 10),
    loadBalancing: {
      strategy: process.env.OLLAMA_API_LOAD_STRATEGY || 'queue_length', // 'round_robin', 'priority', 'queue_length'
      healthCheckInterval: parseInt(process.env.OLLAMA_API_HEALTH_CHECK_INTERVAL || '30000', 10)
    }
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    voiceId: process.env.ELEVENLABS_VOICE_ID || '',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
    similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.75')
  },
  piper: {
    enabled: process.env.PIPER_ENABLED === 'true' || !!process.env.PIPER_MODEL,
    executable: process.env.PIPER_EXECUTABLE || 'piper',
    model: process.env.PIPER_MODEL || ''
  },
  calorieApi: {
    url: process.env.CALORIE_API_URL || 'https://api.api-ninjas.com/v1/nutrition?query=',
    key: process.env.CALORIE_API_KEY || ''
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect: process.env.GOOGLE_REDIRECT || 'http://localhost:3000/oauth2callback'
  },
  linkedin: {
    user: process.env.LINKEDIN_USER || '',
    pass: process.env.LINKEDIN_PASS || '',
    liAt: process.env.LINKEDIN_LI_AT || '',
    timeoutMs: parseInt(process.env.LINKEDIN_TIMEOUT_MS || '60000', 10),
    structuredTimeoutMs: parseInt(process.env.LINKEDIN_STRUCTURED_TIMEOUT_MS || '90000', 10),
    rawTimeoutMs: parseInt(process.env.LINKEDIN_RAW_TIMEOUT_MS || '45000', 10)
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    enableTTS: process.env.TELEGRAM_ENABLE_TTS === 'true',
    maxFileSize: parseInt(process.env.TELEGRAM_MAX_FILE_SIZE || '20971520', 10), // 20MB
    features: {
      aiChat: process.env.TELEGRAM_FEATURE_AI_CHAT !== 'true',
      scheduler: process.env.TELEGRAM_FEATURE_SCHEDULER !== 'true',
      audioTranscription: process.env.TELEGRAM_FEATURE_AUDIO_TRANSCRIPTION !== 'true',
      imageAnalysis: process.env.TELEGRAM_FEATURE_IMAGE_ANALYSIS !== 'true',
      videoSummary: process.env.TELEGRAM_FEATURE_VIDEO_SUMMARY !== 'true',
      textSummary: process.env.TELEGRAM_FEATURE_TEXT_SUMMARY !== 'true',
      tts: process.env.TELEGRAM_FEATURE_TTS !== 'true',
      calorieCounter: process.env.TELEGRAM_FEATURE_CALORIE_COUNTER === 'true',
      linkedinAnalysis: process.env.TELEGRAM_FEATURE_LINKEDIN_ANALYSIS === 'true',
      mediaProcessing: process.env.TELEGRAM_FEATURE_MEDIA_PROCESSING !== 'true',
      professionalAnalysis: process.env.TELEGRAM_FEATURE_PROFESSIONAL_ANALYSIS === 'true',
      systemResources: process.env.TELEGRAM_FEATURE_SYSTEM_RESOURCES !== 'true',
      // Novas features do WhatsApp
      modelManagement: process.env.TELEGRAM_FEATURE_MODEL_MANAGEMENT !== 'true',
      whisperModelManagement: process.env.TELEGRAM_FEATURE_WHISPER_MODEL_MANAGEMENT !== 'true',
      serviceManagement: process.env.TELEGRAM_FEATURE_SERVICE_MANAGEMENT === 'true',
      calendarImport: process.env.TELEGRAM_FEATURE_CALENDAR_IMPORT !== 'true',
      dualVideoSummary: process.env.TELEGRAM_FEATURE_DUAL_VIDEO_SUMMARY !== 'true',
      voiceResponseToggle: process.env.TELEGRAM_FEATURE_VOICE_RESPONSE_TOGGLE !== 'true',
      advancedFileProcessing: process.env.TELEGRAM_FEATURE_ADVANCED_FILE_PROCESSING !== 'true'
    }
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metrics: {
      enabled: process.env.METRICS_ENABLED === 'true',
      endpoint: process.env.METRICS_ENDPOINT || '/metrics',
      port: parseInt(process.env.METRICS_PORT || '9090', 10),
      collectDefaultMetrics: process.env.METRICS_COLLECT_DEFAULT !== 'false',
      collectInterval: parseInt(process.env.METRICS_COLLECT_INTERVAL || '5000', 10)
    },
    grafana: {
      enabled: process.env.GRAFANA_ENABLED === 'true',
      url: process.env.GRAFANA_URL || 'http://localhost:3000',
      adminUser: process.env.GRAFANA_ADMIN_USER || 'admin',
      adminPassword: process.env.GRAFANA_ADMIN_PASSWORD || 'admin'
    },
    prometheus: {
      enabled: process.env.PROMETHEUS_ENABLED === 'true',
      url: process.env.PROMETHEUS_URL || 'http://localhost:9090',
      scrapeInterval: process.env.PROMETHEUS_SCRAPE_INTERVAL || '15s',
      retentionTime: process.env.PROMETHEUS_RETENTION_TIME || '15d'
    },
    alerts: {
      enabled: process.env.ALERTS_ENABLED === 'true',
      endpoints: {
        slack: process.env.ALERT_SLACK_WEBHOOK || '',
        webhook: process.env.ALERT_WEBHOOK_URL || ''
      },
      thresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD || '0.05'), // 5%
        responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '5000', 10), // 5s
        memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE_THRESHOLD || '0.8'), // 80%
        cpuUsage: parseFloat(process.env.ALERT_CPU_USAGE_THRESHOLD || '0.8') // 80%
      }
    }
  }
};

export function applyConfig(obj) {
  const merge = (target, source) => {
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key]) target[key] = {};
        merge(target[key], value);
      } else {
        target[key] = value;
      }
    }
  };
  merge(config, obj);
}

// Função para obter configuração dinâmica com prioridade para MongoDB
export function getDynamicConfig(mongoConfig = null) {
  if (!mongoConfig) {
    return config;
  }

  // Cria uma cópia da configuração base
  const dynamicConfig = JSON.parse(JSON.stringify(config));
  
  // Aplica configurações do MongoDB com prioridade
  const merge = (target, source) => {
    for (const key of Object.keys(source)) {
      if (source[key] !== undefined && source[key] !== null) {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if (!target[key]) target[key] = {};
          merge(target[key], value);
        } else {
          target[key] = value;
        }
      }
    }
  };
  
  merge(dynamicConfig, mongoConfig);
  return dynamicConfig;
}

export { config as CONFIG };
