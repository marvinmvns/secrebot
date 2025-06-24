import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA_HOST = 'http://127.0.0.1:11434';

// ===================== CONFIGURAÇÕES =====================
const CONFIG = {
  mongo: {
    uri: 'mongodb://admin:admin@127.0.0.1:27017/',
    dbName: 'sched',
    collectionName: 'schedv2'
  },
  server: {
    port: 3000
  },
  scheduler: {
    interval: 30000,
    maxAttempts: 3,
    retryDelay: 2 * 60 * 60 * 1000,
    concurrency: 5,
    dynamic: {
      enabled: false,
      min: 1,
      max: 10,
      cpuThreshold: 0.7,
      memThreshold: 0.8
    }
  },
  queues: {
    llmConcurrency: 2,
    whisperConcurrency: 1,
    memoryThresholdGB: 4,
    memoryCheckInterval: 1000
  },
  feeds: {
    checkInterval: 30 * 60 * 1000
  },
  video: {
    ytdlpPath: '/usr/bin/yt-dlp',
    maxBufferMb: 10
  },
  llm: {
    model: 'granite3.2:latest',
    imageModel: 'llava:7b',
    maxTokens: 3000,
    host: OLLAMA_HOST,
    dbName: 'llmcontexts',
    collectionName: 'conversations',
    ttlDays: 30
  },
  audio: {
    sampleRate: 16000,
    model: 'medium',
    language: 'pt'
  },
  // Novas configurações para ElevenLabs
  elevenlabs: {
    apiKey: '',
    voiceId: '',
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75
  },
  // Configurações para TTS local usando Piper
  piper: {
    enabled: false,
    executable: 'piper',
    model: ''
  },
  calorieApi: {
    url: 'https://api.api-ninjas.com/v1/nutrition?query=',
    key: ''
  },
  google: {
    clientId: '',
    clientSecret: '',
    redirect: 'http://localhost:3000/oauth2callback'
  },
  // Configurações para login no LinkedIn
  linkedin: {
    user: '',
    pass: '',
    liAt: '',
    timeoutMs: 30000
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
  'feeds.checkInterval': 'Intervalo (ms) para verificar novos vídeos',
  'llm.model': 'Modelo de linguagem usado',
  'llm.imageModel': 'Modelo para visão computacional',
  'llm.maxTokens': 'Tokens máximos por resposta',
  'llm.host': 'Endereço do servidor Ollama',
  'llm.dbName': 'Banco para histórico de conversas',
  'llm.collectionName': 'Coleção para conversas (!deep)',
  'llm.ttlDays': 'Dias para manter histórico (!deep)',
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
  'video.ytdlpPath': 'Caminho para o executável yt-dlp',
  'google.clientId': 'Client ID do Google',
  'google.clientSecret': 'Client Secret do Google',
  'google.redirect': 'URL de redirecionamento OAuth',
  'linkedin.user': 'Usuário do LinkedIn',
  'linkedin.pass': 'Senha do LinkedIn',
  'linkedin.liAt': 'Cookie li_at',
  'linkedin.timeoutMs': 'Timeout do LinkedIn (ms)'
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
  RESUMIRVIDEO: '!resumirvideo',
  ACOMPANHAR_FEED: '!acompanharfeedresumido',
  LISTAR_FEEDS: '!listaracompanhamentofeed',
  REMOVER_FEED: '!removeracompanhamentofeed',
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
  '14': COMMANDS.RESUMIRVIDEO,
  '15': COMMANDS.ACOMPANHAR_FEED,
  '16': COMMANDS.LISTAR_FEEDS,
  '17': COMMANDS.REMOVER_FEED,
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
1️⃣4️⃣ ${COMMANDS.RESUMIRVIDEO} - Resumir vídeo do YouTube
1️⃣5️⃣ ${COMMANDS.ACOMPANHAR_FEED} - Seguir canal do YouTube
1️⃣6️⃣ ${COMMANDS.LISTAR_FEEDS} - Listar canais acompanhados
1️⃣7️⃣ ${COMMANDS.REMOVER_FEED} <id> - Parar de acompanhar
0️⃣ ${COMMANDS.VOLTAR} - Voltar`;

const MODE_MESSAGES = {
  [CHAT_MODES.ASSISTANT]: `🤖 *Modo Assistente Ativado!*\n\n✨ Agora posso ajudá-lo com qualquer pergunta ou tarefa.\n💬 Digite sua mensagem ou envie um áudio!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.AGENDABOT]: `📅 *Modo Agendamento Ativado!*\n\n📝 Me diga o que você quer agendar e quando.\n🗣️ Você pode digitar ou enviar um áudio!\n\n💡 Exemplo: "Lembrar de reunião amanhã às 14h"\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCRICAO]: `🎤 *Modo Transcrição Ativado!*\n\n🎙️ Envie um áudio para eu transcrever em texto.\n📝 O áudio será convertido automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.LINKEDIN]: `💼 *Modo LinkedIn Ativado!*\n\n🔗 Envie o link do perfil que deseja analisar.\n📊 Vou estruturar as informações para você!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  [CHAT_MODES.DELETAR]: `🗑️ *Modo Deletar Agendamento*\n\nAguarde enquanto busco seus agendamentos...`,
  [CHAT_MODES.RESUMIR]: `📑 *Modo Resumo Ativado!*\n\nEnvie o texto ou arquivo que deseja resumir.\nUse !resumirvideo <link> para vídeos do YouTube.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
};

const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: `✅ *Compromisso Agendado com Sucesso!*\n\n📅 Seu lembrete foi salvo e será enviado no horário programado.\n⏰ Você receberá a mensagem automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  SCHEDULE_DELETED: (message, dateTime) => `✅ *Agendamento Deletado com Sucesso!*\n\n🗑️ Removido: ${message}\n📅 Data/Hora: ${dateTime}\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  TRANSCRIPTION_COMPLETE: `✅ *Transcrição Concluída!*\n\n📝 O texto acima é a transcrição do seu áudio.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  // Novas mensagens para o toggle de voz
  VOICE_ENABLED: `🗣️ Respostas por voz *ativadas*! Usarei áudio para responder sempre que possível.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  VOICE_DISABLED: `💬 Respostas por voz *desativadas*! Usarei apenas texto para responder.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  FEED_ADDED: (id) => `✅ Canal ${id} adicionado com sucesso.`,
  FEED_REMOVED: (id) => `✅ Canal ${id} removido com sucesso.`
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
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  NO_FEEDS: `📭 Você não acompanha nenhum canal.`,
  FEED_NOT_FOUND: `❌ Canal não encontrado.`
};

const PROMPTS = {
  agenda: (date) => `
Você é um assistente chamado Marvin Agenda.
Seu objetivo é ajudar o usuário a agendar compromissos.
A data e hora atuais são: ${date}.
Quando o usuário quiser agendar um compromisso, você deve coletar os dados obrigatórios "message" e "scheduledTime" (os únicos obrigatórios para o agendamento), completando os demais campos conforme o exemplo abaixo.
Quando todos os dados forem fornecidos, responda apenas com o JSON estruturado:

{
  "message": "mensagem_de_texto",
  "status": "approved",
  "scheduledTime": {
    "$date": "data_no_formato_ISO8601"
  },
  "expiryTime": {
    "$date": "data_no_formato_ISO8601"
  },
  "sentAt": null,
  "attempts": 0,
  "lastAttemptAt": null
}

Importante: sempre retorne apenas o JSON, sem explicações extras, e use o formato ISO8601 para datas.
  `,
  assistant: (date) => `
Você é um assistente virtual amigável e prestativo.
Responda de forma útil, clara e concisa.
Use emojis quando apropriado para tornar a conversa mais agradável.
Data atual: ${date}.
  `,
  linkedin: `
Analise o texto bruto extraído de um perfil do LinkedIn e produza um resumo organizado com as informações mais relevantes.
Use emojis para destacar as seções.
  `,
  imageDescription: `
Descreva a imagem de forma detalhada e clara:
  `,
  calorieEstimation: `
Identifique os alimentos presentes na imagem e responda SOMENTE com um JSON no formato:
{"foods":["alimento1","alimento2"]}
  `,
  audioCommandMapping: (transcription) => `
Dada a transcrição "${transcription}", qual comando do menu a seguir ela mais provavelmente representa?
Responda APENAS com o comando (ex: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar) ou "INVALIDO" se não corresponder a nenhum.
Comandos disponíveis: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar
  `,
  videoSummary: (date) => `
Você é um assistente especializado em resumir vídeos.
Forneça um resumo em português com até 20 frases destacando os principais pontos do conteúdo.
Data atual: ${date}.
  `
};



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
  __dirname,
  applyConfig
};
