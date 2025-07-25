export const CONFIG_DESCRIPTIONS = {
  'debug.enabled': 'Ativa logs de depuração',
  'debug.verbose': 'Detalha processamento interno',
  'debug.logLevel': 'Nível mínimo de log',
  'mongo.uri': 'URI de conexão com o MongoDB',
  'mongo.dbName': 'Nome do banco de dados',
  'mongo.collectionName': 'Coleção onde os lembretes são armazenados',
  'server.port': 'Porta do servidor web',
  'scheduler.interval': 'Intervalo (ms) para verificar agendamentos',
  'scheduler.maxAttempts': 'Tentativas máximas de envio de um lembrete',
  'scheduler.retryDelay': 'Atraso (ms) entre novas tentativas',
  'scheduler.concurrency': 'Número de envios simultâneos',
  'scheduler.dynamic.enabled': 'Ativa ajuste automático de concorrência',
  'scheduler.dynamic.min': 'Concorrência mínima dinâmica',
  'scheduler.dynamic.max': 'Concorrência máxima dinâmica',
  'scheduler.dynamic.cpuThreshold': 'Limite de uso de CPU para reduzir carga',
  'scheduler.dynamic.memThreshold': 'Limite de uso de memória para reduzir carga',
  'queues.llmConcurrency': 'Tarefas de IA em paralelo',
  'queues.whisperConcurrency': 'Processos de transcrição em paralelo',
  'queues.memoryThresholdGB': 'Memória (GB) para pausar filas',
  'queues.memoryCheckInterval': 'Intervalo (ms) de checagem de memória',
  'llm.model': 'Modelo de linguagem usado',
  'llm.imageModel': 'Modelo para visão computacional',
  'llm.maxTokens': 'Tokens máximos por resposta',
  'llm.host': 'Endereço do servidor Ollama',
  'llm.timeoutMs': 'Timeout do servidor Ollama (ms)',
  'audio.sampleRate': 'Taxa de amostragem do áudio',
  'audio.model': 'Modelo Whisper',
  'audio.language': 'Idioma padrão das transcrições',
  'audio.timeoutMs': 'Timeout da transcrição (ms)',
  'elevenlabs.apiKey': 'Chave da API ElevenLabs',
  'elevenlabs.voiceId': 'ID de voz ElevenLabs',
  'elevenlabs.modelId': 'Modelo de TTS ElevenLabs',
  'elevenlabs.stability': 'Estabilidade da voz',
  'elevenlabs.similarityBoost': 'Similaridade da voz',
  'piper.enabled': 'Ativa TTS local Piper',
  'piper.executable': 'Executável do Piper',
  'piper.model': 'Modelo do Piper',
  'calorieApi.url': 'URL da API de calorias',
  'calorieApi.key': 'Chave da API de calorias',
  'google.clientId': 'Client ID do Google',
  'google.clientSecret': 'Client Secret do Google',
  'google.redirect': 'URL de redirecionamento OAuth',
  'linkedin.user': 'Usuário do LinkedIn',
  'linkedin.pass': 'Senha do LinkedIn',
  'linkedin.liAt': 'Cookie li_at',
  'linkedin.timeoutMs': 'Timeout do LinkedIn (ms)',
  'telegram.botToken': 'Token do bot do Telegram',
  'telegram.enableTTS': 'Habilita TTS no Telegram',
  'telegram.maxFileSize': 'Tamanho máximo de arquivo (bytes)',
  'telegram.features.aiChat': 'Feature IA Chat',
  'telegram.features.scheduler': 'Feature Agendamentos',
  'telegram.features.audioTranscription': 'Feature Transcrição de Áudio',
  'telegram.features.imageAnalysis': 'Feature Análise de Imagens',
  'telegram.features.videoSummary': 'Feature Resumo de Vídeos',
  'telegram.features.textSummary': 'Feature Resumo de Texto',
  'telegram.features.tts': 'Feature Text-to-Speech',
  'telegram.features.calorieCounter': 'Feature Contador de Calorias',
  'telegram.features.linkedinAnalysis': 'Feature Análise LinkedIn',
  'telegram.features.mediaProcessing': 'Feature Processamento de Mídia',
  'telegram.features.professionalAnalysis': 'Feature Análise Profissional',
  'telegram.features.systemResources': 'Feature Recursos do Sistema',
  'telegram.features.modelManagement': 'Feature Gerenciamento de Modelos',
  'telegram.features.whisperModelManagement': 'Feature Gerenciamento Modelos Whisper',
  'telegram.features.serviceManagement': 'Feature Gerenciamento de Serviços',
  'telegram.features.calendarImport': 'Feature Importar Agenda ICS',
  'telegram.features.dualVideoSummary': 'Feature Duplo Resumo de Vídeo',
  'telegram.features.voiceResponseToggle': 'Feature Toggle Resposta Voz',
  'telegram.features.advancedFileProcessing': 'Feature Processamento Avançado'
};

export const CONFIG_ENV_MAP = {
  'debug.enabled': 'DEBUG_ENABLED',
  'debug.verbose': 'DEBUG_VERBOSE',
  'debug.logLevel': 'LOG_LEVEL',
  'mongo.uri': 'MONGO_URI',
  'mongo.dbName': 'MONGO_DB_NAME',
  'mongo.collectionName': 'MONGO_COLLECTION_NAME',
  'server.port': 'PORT',
  'scheduler.interval': 'SCHED_INTERVAL',
  'scheduler.maxAttempts': 'SCHED_MAX_ATTEMPTS',
  'scheduler.retryDelay': 'SCHED_RETRY_DELAY',
  'scheduler.concurrency': 'SCHED_CONCURRENCY',
  'scheduler.dynamic.enabled': 'DYNAMIC_CONCURRENCY',
  'scheduler.dynamic.min': 'SCHED_DYNAMIC_MIN',
  'scheduler.dynamic.max': 'SCHED_DYNAMIC_MAX',
  'scheduler.dynamic.cpuThreshold': 'SCHED_CPU_THRESHOLD',
  'scheduler.dynamic.memThreshold': 'SCHED_MEM_THRESHOLD',
  'queues.llmConcurrency': 'LLM_CONCURRENCY',
  'queues.whisperConcurrency': 'WHISPER_CONCURRENCY',
  'queues.memoryThresholdGB': 'QUEUE_MEM_THRESHOLD_GB',
  'queues.memoryCheckInterval': 'MEM_CHECK_INTERVAL',
  'llm.model': 'LLM_MODEL',
  'llm.imageModel': 'LLM_IMAGE_MODEL',
  'llm.maxTokens': 'LLM_MAX_TOKENS',
  'llm.host': 'OLLAMA_HOST',
  'llm.timeoutMs': 'OLLAMA_TIMEOUT_MS',
  'audio.sampleRate': 'AUDIO_SAMPLE_RATE',
  'audio.model': 'WHISPER_MODEL',
  'audio.language': 'AUDIO_LANGUAGE',
  'audio.timeoutMs': 'WHISPER_TIMEOUT_MS',
  'elevenlabs.apiKey': 'ELEVENLABS_API_KEY',
  'elevenlabs.voiceId': 'ELEVENLABS_VOICE_ID',
  'elevenlabs.modelId': 'ELEVENLABS_MODEL_ID',
  'elevenlabs.stability': 'ELEVENLABS_STABILITY',
  'elevenlabs.similarityBoost': 'ELEVENLABS_SIMILARITY',
  'piper.enabled': 'PIPER_ENABLED',
  'piper.executable': 'PIPER_EXECUTABLE',
  'piper.model': 'PIPER_MODEL',
  'calorieApi.url': 'CALORIE_API_URL',
  'calorieApi.key': 'CALORIE_API_KEY',
  'google.clientId': 'GOOGLE_CLIENT_ID',
  'google.clientSecret': 'GOOGLE_CLIENT_SECRET',
  'google.redirect': 'GOOGLE_REDIRECT',
  'linkedin.user': 'LINKEDIN_USER',
  'linkedin.pass': 'LINKEDIN_PASS',
  'linkedin.liAt': 'LINKEDIN_LI_AT',
  'linkedin.timeoutMs': 'LINKEDIN_TIMEOUT_MS',
  'telegram.botToken': 'TELEGRAM_BOT_TOKEN',
  'telegram.enableTTS': 'TELEGRAM_ENABLE_TTS',
  'telegram.maxFileSize': 'TELEGRAM_MAX_FILE_SIZE',
  'telegram.features.aiChat': 'TELEGRAM_FEATURE_AI_CHAT',
  'telegram.features.scheduler': 'TELEGRAM_FEATURE_SCHEDULER',
  'telegram.features.audioTranscription': 'TELEGRAM_FEATURE_AUDIO_TRANSCRIPTION',
  'telegram.features.imageAnalysis': 'TELEGRAM_FEATURE_IMAGE_ANALYSIS',
  'telegram.features.videoSummary': 'TELEGRAM_FEATURE_VIDEO_SUMMARY',
  'telegram.features.textSummary': 'TELEGRAM_FEATURE_TEXT_SUMMARY',
  'telegram.features.tts': 'TELEGRAM_FEATURE_TTS',
  'telegram.features.calorieCounter': 'TELEGRAM_FEATURE_CALORIE_COUNTER',
  'telegram.features.linkedinAnalysis': 'TELEGRAM_FEATURE_LINKEDIN_ANALYSIS',
  'telegram.features.mediaProcessing': 'TELEGRAM_FEATURE_MEDIA_PROCESSING',
  'telegram.features.professionalAnalysis': 'TELEGRAM_FEATURE_PROFESSIONAL_ANALYSIS',
  'telegram.features.systemResources': 'TELEGRAM_FEATURE_SYSTEM_RESOURCES',
  'telegram.features.modelManagement': 'TELEGRAM_FEATURE_MODEL_MANAGEMENT',
  'telegram.features.whisperModelManagement': 'TELEGRAM_FEATURE_WHISPER_MODEL_MANAGEMENT',
  'telegram.features.serviceManagement': 'TELEGRAM_FEATURE_SERVICE_MANAGEMENT',
  'telegram.features.calendarImport': 'TELEGRAM_FEATURE_CALENDAR_IMPORT',
  'telegram.features.dualVideoSummary': 'TELEGRAM_FEATURE_DUAL_VIDEO_SUMMARY',
  'telegram.features.voiceResponseToggle': 'TELEGRAM_FEATURE_VOICE_RESPONSE_TOGGLE',
  'telegram.features.advancedFileProcessing': 'TELEGRAM_FEATURE_ADVANCED_FILE_PROCESSING'
};

export const CONFIG_EXAMPLES = {
  'debug.enabled': 'true',
  'debug.verbose': 'true',
  'debug.logLevel': 'debug',
  'mongo.uri': 'mongodb://bot:sua_senha@localhost:27017/sched?authSource=sched',
  'mongo.dbName': 'sched',
  'mongo.collectionName': 'sched',
  'server.port': '3000',
  'scheduler.interval': '30000',
  'scheduler.maxAttempts': '3',
  'scheduler.retryDelay': '7200000',
  'scheduler.concurrency': '5',
  'scheduler.dynamic.enabled': 'false',
  'scheduler.dynamic.min': '1',
  'scheduler.dynamic.max': '10',
  'scheduler.dynamic.cpuThreshold': '0.7',
  'scheduler.dynamic.memThreshold': '0.8',
  'queues.llmConcurrency': '2',
  'queues.whisperConcurrency': '1',
  'queues.memoryThresholdGB': '4',
  'queues.memoryCheckInterval': '1000',
  'llm.model': 'llama3.2:latest',
  'llm.imageModel': 'llava:latest',
  'llm.maxTokens': '3000',
  'llm.host': 'http://127.0.0.1:11434',
  'llm.timeoutMs': '600000',
  'audio.sampleRate': '16000',
  'audio.model': 'large-v3-turbo',
  'audio.language': 'pt',
  'audio.timeoutMs': '120000',
  'elevenlabs.apiKey': 'sk-sua_chave_elevenlabs_aqui',
  'elevenlabs.voiceId': 'seu_voice_id_aqui',
  'elevenlabs.modelId': 'eleven_multilingual_v2',
  'elevenlabs.stability': '0.5',
  'elevenlabs.similarityBoost': '0.75',
  'piper.enabled': 'true',
  'piper.executable': './piper/piper-wrapper.sh',
  'piper.model': './piper/models/pt_BR-faber-medium.onnx',
  'calorieApi.url': 'https://api.api-ninjas.com/v1/nutrition?query=',
  'calorieApi.key': 'sua_chave_api_ninjas_aqui',
  'google.clientId': 'seu_client_id_aqui',
  'google.clientSecret': 'seu_client_secret_aqui',
  'google.redirect': 'http://localhost:3000/oauth2callback',
  'linkedin.user': 'seu_email@exemplo.com',
  'linkedin.pass': 'sua_senha_linkedin',
  'linkedin.liAt': 'cookie_li_at_opcional',
  'linkedin.timeoutMs': '30000',
  'telegram.botToken': 'abc123:token',
  'telegram.enableTTS': 'true',
  'telegram.maxFileSize': '20971520',
  'telegram.features.aiChat': 'true',
  'telegram.features.scheduler': 'true',
  'telegram.features.audioTranscription': 'true',
  'telegram.features.imageAnalysis': 'true',
  'telegram.features.videoSummary': 'true',
  'telegram.features.textSummary': 'true',
  'telegram.features.tts': 'true',
  'telegram.features.calorieCounter': 'false',
  'telegram.features.linkedinAnalysis': 'false',
  'telegram.features.mediaProcessing': 'true',
  'telegram.features.professionalAnalysis': 'false',
  'telegram.features.systemResources': 'true',
  'telegram.features.modelManagement': 'true',
  'telegram.features.whisperModelManagement': 'true',
  'telegram.features.serviceManagement': 'false',
  'telegram.features.calendarImport': 'true',
  'telegram.features.dualVideoSummary': 'true',
  'telegram.features.voiceResponseToggle': 'true',
  'telegram.features.advancedFileProcessing': 'true'
};
