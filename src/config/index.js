import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Aumenta o tempo limite do Undici caso especificado
// Ajusta os timeouts do Undici se OLLAMA_TIMEOUT_MS estiver definido
if (process.env.OLLAMA_TIMEOUT_MS) {
  process.env.UNDICI_HEADERS_TIMEOUT = process.env.OLLAMA_TIMEOUT_MS;
  process.env.UNDICI_BODY_TIMEOUT = process.env.OLLAMA_TIMEOUT_MS;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

// ===================== CONFIGURAÇÕES =====================
const CONFIG = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://admin:admin@127.0.0.1:27017/',
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
      max: parseInt(process.env.SCHED_MAX_CONCURRENCY || '10', 10),
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
    host: OLLAMA_HOST
  },
  audio: {
    sampleRate: parseInt(process.env.AUDIO_SAMPLE_RATE || '16000', 10),
    model: process.env.WHISPER_MODEL || 'medium',
    language: process.env.AUDIO_LANGUAGE || 'pt'
  },
  // Novas configurações para ElevenLabs
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    stability: parseFloat(process.env.ELEVENLABS_STABILITY || '0.5'),
    similarityBoost: parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.75')
  },
  // Configurações para TTS local usando Piper
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
  // Configurações para login no LinkedIn
  linkedin: {
    user: process.env.LINKEDIN_USER || '',
    pass: process.env.LINKEDIN_PASS || '',
    liAt: process.env.LINKEDIN_LI_AT || '',
    timeoutMs: parseInt(process.env.LINKEDIN_TIMEOUT_MS || '30000', 10)
  }
};

const CONFIG_DESCRIPTIONS = {
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
  'audio.sampleRate': 'Taxa de amostragem do áudio',
  'audio.model': 'Modelo Whisper',
  'audio.language': 'Idioma padrão das transcrições',
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
  'linkedin.timeoutMs': 'Timeout do LinkedIn (ms)'
};

const CONFIG_ENV_MAP = {
  'mongo.uri': 'MONGO_URI',
  'server.port': 'PORT',
  'scheduler.interval': 'SCHED_INTERVAL',
  'scheduler.maxAttempts': 'SCHED_MAX_ATTEMPTS',
  'scheduler.retryDelay': 'SCHED_RETRY_DELAY',
  'scheduler.concurrency': 'SCHED_CONCURRENCY',
  'scheduler.dynamic.enabled': 'DYNAMIC_CONCURRENCY',
  'scheduler.dynamic.min': 'SCHED_DYNAMIC_MIN',
  'scheduler.dynamic.max': 'SCHED_MAX_CONCURRENCY',
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
  'audio.sampleRate': 'AUDIO_SAMPLE_RATE',
  'audio.model': 'WHISPER_MODEL',
  'audio.language': 'AUDIO_LANGUAGE',
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
  'linkedin.timeoutMs': 'LINKEDIN_TIMEOUT_MS'
};

// ===================== CONSTANTES =====================
const COMMANDS = {
  AJUDA: '!ajuda',
  DEEP: '!deep',
  AGENDA: '!agendabot',
  TRANSCREVER: '!transcrever',
  FOTO: '!foto',
  CALORIAS: '!calorias',
  LISTAR: '!listaragendamentos',
  MENU: '!menu',
  LINKEDIN: '!linkedin',
  DELETAR: '!deletaragendamento',
  VOZ: '!voz', // Novo comando para alternar resposta por voz
  RECURSO: "!recurso",
  RESUMIR: '!resumir',
  IMPORTAR_AGENDA: '!importaragenda',
  VOLTAR: '!voltar'
};

// Atalhos numéricos para menu principal
const NUMERIC_SHORTCUTS = {
  '1': COMMANDS.AJUDA,
  '2': COMMANDS.AGENDA,
  '3': COMMANDS.LISTAR,
  '4': COMMANDS.DELETAR,
  '5': COMMANDS.DEEP,
  '6': COMMANDS.TRANSCREVER,
  '7': COMMANDS.FOTO,
  '8': COMMANDS.CALORIAS,
  '9': COMMANDS.LINKEDIN,
  '10': COMMANDS.VOZ,
  '11': COMMANDS.RECURSO,
  '12': COMMANDS.RESUMIR,
  '13': COMMANDS.IMPORTAR_AGENDA,
  '0': COMMANDS.VOLTAR
};

const CHAT_MODES = {
  ASSISTANT: 'assistant',
  AGENDABOT: 'agendabot',
  TRANSCRICAO: 'transcricao',
  LINKEDIN: 'linkedin',
  DELETAR: 'deletar',
  RESUMIR: 'resumir'
};

// Atualizar mensagem do menu para incluir a opção de voz
const MENU_MESSAGE = `🤖 *Bem-vindo!* Escolha uma opção:\n\n1️⃣ ${COMMANDS.AJUDA} - Ajuda
2️⃣ ${COMMANDS.AGENDA} - Agendar lembrete
3️⃣ ${COMMANDS.LISTAR} - Listar lembretes
4️⃣ ${COMMANDS.DELETAR} - Remover lembrete
5️⃣ ${COMMANDS.DEEP} - Chatbot
6️⃣ ${COMMANDS.TRANSCREVER} - Transcrever áudio
7️⃣ ${COMMANDS.FOTO} - Descrever imagem
8️⃣ ${COMMANDS.CALORIAS} - Estimar calorias
9️⃣ ${COMMANDS.LINKEDIN} - Analisar LinkedIn
🔟 ${COMMANDS.VOZ} - Alternar voz/texto
1️⃣1️⃣ ${COMMANDS.RECURSO} - Recursos do sistema
1️⃣2️⃣ ${COMMANDS.RESUMIR} - Resumir texto/arquivo
1️⃣3️⃣ ${COMMANDS.IMPORTAR_AGENDA} - Importar eventos
0️⃣ ${COMMANDS.VOLTAR} - Voltar`;

const MODE_MESSAGES = {
  [CHAT_MODES.ASSISTANT]: `🤖 *Modo Assistente Ativado!*\n\n✨ Agora posso ajudá-lo com qualquer pergunta ou tarefa.\n💬 Digite sua mensagem ou envie um áudio!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.AGENDABOT]: `📅 *Modo Agendamento Ativado!*\n\n📝 Me diga o que você quer agendar e quando.\n🗣️ Você pode digitar ou enviar um áudio!\n\n💡 Exemplo: "Lembrar de reunião amanhã às 14h"\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCRICAO]: `🎤 *Modo Transcrição Ativado!*\n\n🎙️ Envie um áudio para eu transcrever em texto.\n📝 O áudio será convertido automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.LINKEDIN]: `💼 *Modo LinkedIn Ativado!*\n\n🔗 Envie o link do perfil que deseja analisar.\n📊 Vou estruturar as informações para você!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  [CHAT_MODES.DELETAR]: `🗑️ *Modo Deletar Agendamento*\n\nAguarde enquanto busco seus agendamentos...`,
  [CHAT_MODES.RESUMIR]: `📑 *Modo Resumo Ativado!*\n\nEnvie o texto ou arquivo que deseja resumir.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
};

const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: `✅ *Compromisso Agendado com Sucesso!*\n\n📅 Seu lembrete foi salvo e será enviado no horário programado.\n⏰ Você receberá a mensagem automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  SCHEDULE_DELETED: (message, dateTime) => `✅ *Agendamento Deletado com Sucesso!*\n\n🗑️ Removido: ${message}\n📅 Data/Hora: ${dateTime}\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  TRANSCRIPTION_COMPLETE: `✅ *Transcrição Concluída!*\n\n📝 O texto acima é a transcrição do seu áudio.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  // Novas mensagens para o toggle de voz
  VOICE_ENABLED: `🗣️ Respostas por voz *ativadas*! Usarei áudio para responder sempre que possível.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  VOICE_DISABLED: `💬 Respostas por voz *desativadas*! Usarei apenas texto para responder.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`
};

const ERROR_MESSAGES = {
  GENERIC: `❌ *Erro ao processar sua solicitação*\n\n😔 Desculpe, algo deu errado. Por favor, tente novamente.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  NO_SCHEDULES: `📭 *Nenhum agendamento encontrado*\n\n💡 Use o comando ${COMMANDS.AGENDA} para criar um novo!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  INVALID_NUMBER: `❌ *Número inválido!*\n\n🔢 Por favor, escolha um número válido da lista.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  AUDIO_REQUIRED: `🎤 *Áudio necessário!*\n\n📎 Por favor, envie um áudio para transcrever.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  IMAGE_REQUIRED: `📸 *Imagem necessária!*\n\n📎 Por favor, envie uma imagem junto com o comando.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  TEXT_OR_FILE_REQUIRED: `📝 *Texto ou arquivo necessário!*\n\nEnvie uma mensagem de texto ou anexe um PDF, TXT, DOCX ou CSV com o comando.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  UNSUPPORTED_FILE: `📎 *Tipo de arquivo não suportado!*\n\nUse apenas PDF, TXT, DOCX ou CSV.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  // Novo erro para falha no TTS
  TTS_FAILED: `🔇 Desculpe, não consegui gerar a resposta em áudio. Enviando em texto.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`
};

const PROMPTS = {
  agenda: (date) => `\nVocê é um assistente chamado Marvin Agenda.\nSeu objetivo é ajudar o usuário a agendar compromissos.\nA data e hora atuais são: ${date}.\nQuando o usuário quiser agendar um compromisso, você deve coletar os dados obrigatórios "message" e "scheduledTime" (os únicos obrigatórios para o agendamento e sera falado), completando os demais campos conforme o exemplo abaixo.\nQuando todos os dados forem fornecidos, responda apenas com o JSON estruturado:\n\n{\n  "message": "mensagem_de_texto",\n  "status": "approved",\n  "scheduledTime": {\n    "$date": "data_no_formato_ISO8601"\n  },\n  "expiryTime": {\n    "$date": "data_no_formato_ISO8601"\n  },\n  "sentAt": null,\n  "attempts": 0,\n  "lastAttemptAt": null\n}\n\nImportante: Quando responder com o JSON, não adicione nenhuma explicação ou texto adicional. sempre retornar um json em qualquer hipotese e as datas no formato esperado`,
  assistant: (date) => `\nVocê é um assistente virtual amigável e prestativo.\nResponda de forma útil, clara e concisa.\nUse emojis quando apropriado para tornar a conversa mais agradável.\nData atual: ${date}.`,
  linkedin: 'Analise o texto bruto extraído de um perfil do LinkedIn e produza um resumo organizado com as informações mais relevantes. Use emojis para destacar as seções.',
  imageDescription: 'Descreva a imagem de forma detalhada e clara:',
  calorieEstimation: `Identifique os alimentos presentes na imagem e responda SOMENTE com um JSON no formato {"foods":["alimento1","alimento2"]}`,
  // Novo prompt para mapear áudio para comando do menu
  audioCommandMapping: (transcription) => `Dada a transcrição "${transcription}", qual comando do menu a seguir ela mais provavelmente representa? Responda APENAS com o comando (ex: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar) ou "INVALIDO" se não corresponder a nenhum.
Comandos disponíveis: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar`
};

function updateConfigFromEnv() {
  CONFIG.mongo.uri = process.env.MONGO_URI || CONFIG.mongo.uri;
  CONFIG.server.port = process.env.PORT || CONFIG.server.port;

  CONFIG.scheduler.interval = parseInt(process.env.SCHED_INTERVAL || CONFIG.scheduler.interval, 10);
  CONFIG.scheduler.maxAttempts = parseInt(process.env.SCHED_MAX_ATTEMPTS || CONFIG.scheduler.maxAttempts, 10);
  CONFIG.scheduler.retryDelay = parseInt(process.env.SCHED_RETRY_DELAY || CONFIG.scheduler.retryDelay, 10);
  CONFIG.scheduler.concurrency = parseInt(process.env.SCHED_CONCURRENCY || CONFIG.scheduler.concurrency, 10);

  CONFIG.scheduler.dynamic.enabled = process.env.DYNAMIC_CONCURRENCY === 'true' || CONFIG.scheduler.dynamic.enabled;
  CONFIG.scheduler.dynamic.min = parseInt(process.env.SCHED_DYNAMIC_MIN || CONFIG.scheduler.dynamic.min, 10);
  CONFIG.scheduler.dynamic.max = parseInt(process.env.SCHED_MAX_CONCURRENCY || CONFIG.scheduler.dynamic.max, 10);
  CONFIG.scheduler.dynamic.cpuThreshold = parseFloat(process.env.SCHED_CPU_THRESHOLD || CONFIG.scheduler.dynamic.cpuThreshold);
  CONFIG.scheduler.dynamic.memThreshold = parseFloat(process.env.SCHED_MEM_THRESHOLD || CONFIG.scheduler.dynamic.memThreshold);

  CONFIG.queues.llmConcurrency = parseInt(process.env.LLM_CONCURRENCY || CONFIG.queues.llmConcurrency, 10);
  CONFIG.queues.whisperConcurrency = parseInt(process.env.WHISPER_CONCURRENCY || CONFIG.queues.whisperConcurrency, 10);
  CONFIG.queues.memoryThresholdGB = parseInt(process.env.QUEUE_MEM_THRESHOLD_GB || CONFIG.queues.memoryThresholdGB, 10);
  CONFIG.queues.memoryCheckInterval = parseInt(process.env.MEM_CHECK_INTERVAL || CONFIG.queues.memoryCheckInterval, 10);

  CONFIG.audio.sampleRate = parseInt(process.env.AUDIO_SAMPLE_RATE || CONFIG.audio.sampleRate, 10);
  CONFIG.audio.model = process.env.WHISPER_MODEL || CONFIG.audio.model;
  CONFIG.audio.language = process.env.AUDIO_LANGUAGE || CONFIG.audio.language;

  CONFIG.llm.model = process.env.LLM_MODEL || CONFIG.llm.model;
  CONFIG.llm.imageModel = process.env.LLM_IMAGE_MODEL || CONFIG.llm.imageModel;
  CONFIG.llm.maxTokens = parseInt(process.env.LLM_MAX_TOKENS || CONFIG.llm.maxTokens, 10);
  CONFIG.llm.host = process.env.OLLAMA_HOST || CONFIG.llm.host;
  if (process.env.OLLAMA_TIMEOUT_MS) {
    process.env.UNDICI_HEADERS_TIMEOUT = process.env.OLLAMA_TIMEOUT_MS;
    process.env.UNDICI_BODY_TIMEOUT = process.env.OLLAMA_TIMEOUT_MS;
  }

  CONFIG.elevenlabs.apiKey = process.env.ELEVENLABS_API_KEY || CONFIG.elevenlabs.apiKey;
  CONFIG.elevenlabs.voiceId = process.env.ELEVENLABS_VOICE_ID || CONFIG.elevenlabs.voiceId;
  CONFIG.elevenlabs.modelId = process.env.ELEVENLABS_MODEL_ID || CONFIG.elevenlabs.modelId;
  CONFIG.elevenlabs.stability = parseFloat(process.env.ELEVENLABS_STABILITY || CONFIG.elevenlabs.stability);
  CONFIG.elevenlabs.similarityBoost = parseFloat(process.env.ELEVENLABS_SIMILARITY || CONFIG.elevenlabs.similarityBoost);

  CONFIG.piper.enabled = process.env.PIPER_ENABLED === 'true' || !!process.env.PIPER_MODEL || CONFIG.piper.enabled;
  CONFIG.piper.executable = process.env.PIPER_EXECUTABLE || CONFIG.piper.executable;
  CONFIG.piper.model = process.env.PIPER_MODEL || CONFIG.piper.model;

  CONFIG.calorieApi.url = process.env.CALORIE_API_URL || CONFIG.calorieApi.url;
  CONFIG.calorieApi.key = process.env.CALORIE_API_KEY || CONFIG.calorieApi.key;

  CONFIG.google.clientId = process.env.GOOGLE_CLIENT_ID || CONFIG.google.clientId;
  CONFIG.google.clientSecret = process.env.GOOGLE_CLIENT_SECRET || CONFIG.google.clientSecret;
  CONFIG.google.redirect = process.env.GOOGLE_REDIRECT || CONFIG.google.redirect;

  CONFIG.linkedin.user = process.env.LINKEDIN_USER || CONFIG.linkedin.user;
  CONFIG.linkedin.pass = process.env.LINKEDIN_PASS || CONFIG.linkedin.pass;
  CONFIG.linkedin.liAt = process.env.LINKEDIN_LI_AT || CONFIG.linkedin.liAt;
  CONFIG.linkedin.timeoutMs = parseInt(process.env.LINKEDIN_TIMEOUT_MS || CONFIG.linkedin.timeoutMs, 10);
}

function applyConfig(obj) {
  const merge = (t, s) => {
    for (const k of Object.keys(s)) {
      const v = s[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!t[k]) t[k] = {};
        merge(t[k], v);
      } else {
        t[k] = v;
      }
    }
  };
  merge(CONFIG, obj);
}

export {
  CONFIG,
  COMMANDS,
  NUMERIC_SHORTCUTS,
  CHAT_MODES,
  MENU_MESSAGE,
  MODE_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  PROMPTS,
  CONFIG_DESCRIPTIONS,
  CONFIG_ENV_MAP,
  __dirname,
  updateConfigFromEnv,
  applyConfig
};
