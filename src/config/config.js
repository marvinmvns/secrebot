import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST;
const OLLAMA_TIMEOUT_MS = process.env.OLLAMA_TIMEOUT_MS || '600000';

process.env.UNDICI_HEADERS_TIMEOUT = OLLAMA_TIMEOUT_MS;
process.env.UNDICI_BODY_TIMEOUT = OLLAMA_TIMEOUT_MS;

export const config = {
  debug: {
    enabled: process.env.DEBUG_ENABLED === 'true' || process.env.NODE_ENV === 'development',
    verbose: process.env.DEBUG_VERBOSE === 'true',
    logLevel: process.env.LOG_LEVEL || 'info'
  },
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://bot:senha@127.0.0.1:27017/bot?authSource=sched',
    dbName: 'sched',
    collectionName: 'schedv2'
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
      max: parseInt(process.env.SCHED_DYNAMIC_MAX || process.env.SCHED_MAX_CONCURRENCY || '10', 10),
      cpuThreshold: parseFloat(process.env.SCHED_CPU_THRESHOLD || '0.7'),
      memThreshold: parseFloat(process.env.SCHED_MEM_THRESHOLD || '0.8')
    }
  },
  queues: {
    llmConcurrency: parseInt(process.env.LLM_CONCURRENCY || '2', 10),
    whisperConcurrency: parseInt(process.env.WHISPER_CONCURRENCY || '1', 10),
    memoryThresholdGB: parseInt(process.env.QUEUE_MEM_THRESHOLD_GB || '4', 10),
    memoryCheckInterval: parseInt(process.env.MEM_CHECK_INTERVAL || '1000', 10)
  },
  llm: {
    model: process.env.LLM_MODEL || 'granite3.2:latest',
    imageModel: process.env.LLM_IMAGE_MODEL || 'llava:7b',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '3000', 10),
    host: OLLAMA_HOST,
    timeoutMs: parseInt(OLLAMA_TIMEOUT_MS, 10)
  },
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000', 10),
    model: process.env.WHISPER_MODEL || 'large-v3-turbo',
    language: process.env.AUDIO_LANGUAGE || 'pt',
    timeoutMs: parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10)
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
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
    timeoutMs: parseInt(process.env.LINKEDIN_TIMEOUT_MS || '30000', 10)
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    enableTTS: process.env.TELEGRAM_ENABLE_TTS === 'true',
    maxFileSize: parseInt(process.env.TELEGRAM_MAX_FILE_SIZE || '20971520', 10), // 20MB
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
    features: {
      aiChat: process.env.TELEGRAM_FEATURE_AI_CHAT !== 'false',
      scheduler: process.env.TELEGRAM_FEATURE_SCHEDULER !== 'false',
      audioTranscription: process.env.TELEGRAM_FEATURE_AUDIO_TRANSCRIPTION !== 'false',
      imageAnalysis: process.env.TELEGRAM_FEATURE_IMAGE_ANALYSIS !== 'false',
      videoSummary: process.env.TELEGRAM_FEATURE_VIDEO_SUMMARY !== 'false',
      textSummary: process.env.TELEGRAM_FEATURE_TEXT_SUMMARY !== 'false',
      tts: process.env.TELEGRAM_FEATURE_TTS !== 'false',
      calorieCounter: process.env.TELEGRAM_FEATURE_CALORIE_COUNTER === 'true',
      linkedinAnalysis: process.env.TELEGRAM_FEATURE_LINKEDIN_ANALYSIS === 'true',
      mediaProcessing: process.env.TELEGRAM_FEATURE_MEDIA_PROCESSING !== 'false',
      professionalAnalysis: process.env.TELEGRAM_FEATURE_PROFESSIONAL_ANALYSIS === 'true',
      systemResources: process.env.TELEGRAM_FEATURE_SYSTEM_RESOURCES !== 'false'
    }
  },
  featureToggles: {
    enabled: process.env.FEATURE_TOGGLES_ENABLED === 'true',
    features: {}
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

export { config as CONFIG };
