import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

// Aumenta o tempo limite do Undici caso especificado
if (process.env.OLLAMA_TIMEOUT_MS) {
  process.env.UNDICI_HEADERS_TIMEOUT = process.env.OLLAMA_TIMEOUT_MS;
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
    interval: 30000, // 30 segundos
    maxAttempts: 3,
    retryDelay: 2 * 60 * 60 * 1000, // 2 horas
    concurrency: 5, // Limite de envios simultâneos
    dynamic: {
      enabled: process.env.DYNAMIC_CONCURRENCY === 'true',
      min: 1,
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
    model: 'granite3.2:latest',
    imageModel: 'llava:7b',
    maxTokens: 3000,
    host: OLLAMA_HOST
  },
  audio: {
    sampleRate: 16000,
    model: 'medium',
    language: 'pt'
  },
  // Novas configurações para ElevenLabs
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY ,
    voiceId: process.env.ELEVENLABS_VOICE_ID ,
    modelId: 'eleven_multilingual_v2', // Modelo de TTS
    stability: 0.5,
    similarityBoost: 0.75
  },
  // Configurações para TTS local usando Piper
  piper: {
    // Define como habilitado quando uma variável de modelo é informada
    enabled: !!process.env.PIPER_MODEL,
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
  }
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
  '2': COMMANDS.DEEP,
  '3': COMMANDS.AGENDA,
  '4': COMMANDS.TRANSCREVER,
  '5': COMMANDS.FOTO,
  '6': COMMANDS.CALORIAS,
  '7': COMMANDS.LISTAR,
  '8': COMMANDS.DELETAR,
  '9': COMMANDS.LINKEDIN,
  '10': COMMANDS.VOZ, // Novo atalho para alternar voz
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
const MENU_MESSAGE = `🤖 *Bem-vindo ao Assistente WhatsApp!* 🤖\n\n📋 *Menu Principal - Digite o número ou comando:*\n\n1️⃣ ${COMMANDS.AJUDA} – 📖 Exibe este menu
2️⃣ ${COMMANDS.DEEP} – 🤖 Modo assistente (chatbot)
3️⃣ ${COMMANDS.AGENDA} – 📅 Agendar compromissos
4️⃣ ${COMMANDS.TRANSCREVER} – 🎤 Transcrever áudio
5️⃣ ${COMMANDS.FOTO} – 📸 Descrever imagem (envie junto)
6️⃣ ${COMMANDS.CALORIAS} – 🍎 Estimar calorias (envie foto)
7️⃣ ${COMMANDS.LISTAR} – 📋 Ver seus agendamentos
8️⃣ ${COMMANDS.DELETAR} – 🗑️ Deletar agendamentos
9️⃣ ${COMMANDS.LINKEDIN} – 💼 Analisar perfil LinkedIn
🔟 ${COMMANDS.VOZ} – 🗣️ Alternar resposta por voz/texto
1️⃣1️⃣ ${COMMANDS.RECURSO} – 💻 Mostrar recursos do sistema
1️⃣2️⃣ ${COMMANDS.RESUMIR} – 📑 Resumir texto ou arquivo (PDF, TXT, DOCX, CSV)
1️⃣3️⃣ ${COMMANDS.IMPORTAR_AGENDA} – 📂 Importar eventos (.ics ou Google)

💡 *Dica:* Você pode digitar apenas o número ou enviar um áudio com o nome da opção!
🔙 *Voltar:* Digite ${COMMANDS.VOLTAR} ou 0 a qualquer momento`;

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
  linkedin: 'Transformar em um texto estruturado o json abaixo, use emojis para destacar seções',
  imageDescription: 'Descreva a imagem de forma detalhada e clara:',
  calorieEstimation: `Identifique os alimentos presentes na imagem e responda SOMENTE com um JSON no formato {"foods":["alimento1","alimento2"]}`,
  // Novo prompt para mapear áudio para comando do menu
  audioCommandMapping: (transcription) => `Dada a transcrição "${transcription}", qual comando do menu a seguir ela mais provavelmente representa? Responda APENAS com o comando (ex: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar) ou "INVALIDO" se não corresponder a nenhum.
Comandos disponíveis: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar`
};

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
  __dirname
};
