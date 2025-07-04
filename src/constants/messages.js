import { COMMANDS, CHAT_MODES, NAVIGATION_STATES } from './commands.js';

/**
 * =================================================================
 *                        MENU PRINCIPAL
 * =================================================================
 */
export const MENU_MESSAGE = `Olá! Sou o *SecreBot* 🤖, seu assistente pessoal.

Como posso te ajudar hoje?

1️⃣ *Agenda e Lembretes*
   _Gerencie seus compromissos e tarefas._

2️⃣ *Converse com a IA*
   _Tire dúvidas, resuma textos, vídeos e mais._

3️⃣ *Análise de Mídia*
   _Transcreva áudios e analise imagens._

4️⃣ *Ferramentas Profissionais*
   _Analise perfis do LinkedIn e documentos._

5️⃣ *Configurações*
   _Personalize minhas respostas e modelos de IA._

6️⃣ *Ajuda e Suporte*
   _Veja comandos e informações do sistema._

─────────────────────────────
💡 *Como usar:*
• Digite o *número* da opção.
• Envie um *áudio* com o que precisa.
• Use comandos diretos (ex: ${COMMANDS.AJUDA}, ${COMMANDS.MENU}).`;

/**
 * =================================================================
 *                            SUBMENUS
 * =================================================================
 */
export const SUBMENU_MESSAGES = {
  agenda: `📅 *Agenda e Lembretes*

1.1 ➕ Criar um novo agendamento
1.2 📋 Listar meus compromissos
1.3 🗑️ Deletar um agendamento
1.4 📥 Importar agenda (.ics)

0️⃣ Voltar ao Menu Principal

🎤 _Dica: Fale "criar lembrete para amanhã às 10h"_`,

  ia: `🧠 *Assistente e IA*

2.1 💬 Bater um papo com a IA
2.2 📄 Resumir texto ou arquivo (PDF, DOCX, TXT)
2.3 🎥 Resumir vídeo do YouTube
2.4 🖼️ Analisar uma imagem
2.5 🎤 Transcrever e resumir áudio

0️⃣ Voltar ao Menu Principal

🎤 _Dica: Fale "resumir este documento"_`,

  midia: `🎬 *Análise de Mídia*

3.1 🎤 Transcrever áudio para texto
3.2 🔊 Ativar ou desativar respostas por voz
3.3 🍎 Calcular calorias de uma foto

0️⃣ Voltar ao Menu Principal

🎤 _Dica: Fale "transcrever este áudio"_`,

  profissional: `💼 *Ferramentas Profissionais*

4.1 🔗 Analisar um perfil do LinkedIn

0️⃣ Voltar ao Menu Principal

🎤 _Dica: Envie o link de um perfil para começar._`,

  config: `⚙️ *Configurações*

*RESPOSTAS*
5.1 🔊 Alterar modo (Texto/Voz)

*INTELIGÊNCIA ARTIFICIAL (IA)*
5.2 🤖 Listar modelos de IA
5.3 🔄 Trocar modelo de IA
5.4 🚀 Reiniciar serviço de IA (Ollama)

*TRANSCRIÇÃO DE ÁUDIO*
5.5 🎤 Listar modelos de transcrição
5.6 🔄 Trocar modelo de transcrição
5.7 🚀 Reiniciar serviço de transcrição (Whisper)

*SISTEMA*
5.8 ⚡ Ver recursos do sistema

0️⃣ Voltar ao Menu Principal`,

  suporte: `📞 *Ajuda e Suporte*

6.1 📖 Ver guia de comandos completo
6.2 ⚡ Verificar status do sistema

0️⃣ Voltar ao Menu Principal

💡 _Dica: Para ajuda rápida, digite ${COMMANDS.AJUDA}_`,

  video: `🎥 *Resumir Vídeo*

Qual método você prefere?

2.3.1 🚀 *Rápido (YouTube Nativo)*
   _Ideal para a maioria dos vídeos._

2.3.2 🎯 *Preciso (Whisper IA)*
   _Análise mais detalhada, pode demorar mais._

0️⃣ Voltar ao submenu de IA`
};

/**
 * =================================================================
 *                   MENSAGENS DE MODO DE CHAT
 * =================================================================
 */
export const MODE_MESSAGES = {
  [CHAT_MODES.ASSISTANT]: `🤖 *Modo Assistente Ativado!*
Pode perguntar o que quiser. Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.AGENDABOT]: `📅 *Modo Agendamento Ativado!*
Me diga o que e quando agendar.
_Ex: "Lembrar da consulta médica amanhã às 15h"_.

Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCRICAO]: `🎤 *Modo Transcrição Ativado!*
Envie o áudio que você quer converter em texto.

Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCREVER_RESUMIR]: `🧠 *Modo Transcrição e Resumo Ativado!*
Envie o áudio para que eu possa transcrever e criar um resumo.

Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.LINKEDIN]: `💼 *Modo Análise de LinkedIn Ativado!*
Envie o link do perfil que deseja analisar.

Para sair, digite ${COMMANDS.VOLTAR}`,
  
  [CHAT_MODES.DELETAR]: `🗑️ *Modo Deletar Agendamento*
Aguarde, estou buscando seus compromissos...`,
  
  [CHAT_MODES.RESUMIR]: `📑 *Modo Resumo Ativado!*
Envie um arquivo (PDF, DOCX, TXT) ou cole o texto aqui.

Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TROCAR_MODELO]: `🤖 *Troca de Modelo de IA*
Digite o número do modelo que deseja usar.

Use ${COMMANDS.MODELOS} para ver a lista.
Para sair, digite ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TROCAR_MODELO_WHISPER]: `🎤 *Troca de Modelo de Transcrição*
Digite o número do modelo que deseja usar.

Use ${COMMANDS.MODELOS_WHISPER} para ver a lista.
Para sair, digite ${COMMANDS.VOLTAR}`,
};

/**
 * =================================================================
 *                   MENSAGENS DE SUCESSO
 * =================================================================
 */
export const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: `✅ *Agendamento criado!*
Você será notificado na hora certa.`,

  SCHEDULE_DELETED: (message, dateTime) => `✅ *Agendamento deletado:*
  
🗑️ *Removido:* ${message}
📅 *Data/Hora:* ${dateTime}`,

  TRANSCRIPTION_COMPLETE: `✅ *Transcrição Concluída!*
A mensagem acima é o texto do seu áudio.`,
  
  VOICE_ENABLED: `🗣️ *Respostas por voz ativadas!*
Vou responder com áudio sempre que possível.`,
  
  VOICE_DISABLED: `💬 *Respostas por voz desativadas!*
A partir de agora, responderei apenas com texto.`
};

/**
 * =================================================================
 *                     MENSAGENS DE ERRO
 * =================================================================
 */
export const ERROR_MESSAGES = {
  GENERIC: `❌ *Ops, algo deu errado.*
Por favor, tente novamente. Se o erro persistir, digite ${COMMANDS.MENU} para recomeçar.`,

  NO_SCHEDULES: `📭 *Você não possui agendamentos.*
Para criar um, escolha a opção no menu ou fale "criar lembrete".`,

  INVALID_NUMBER: `🤔 *Opção inválida.*
Por favor, digite um dos números listados no menu.`,

  AUDIO_REQUIRED: `🎤 *Faltou o áudio!*
Por favor, envie um arquivo de áudio para que eu possa transcrever.`,

  IMAGE_REQUIRED: `📸 *Faltou a imagem!*
Por favor, envie uma imagem para que eu possa analisar.`,
  
  TEXT_OR_FILE_REQUIRED: `📝 *Faltou o conteúdo!*
Envie um texto ou anexe um arquivo (PDF, TXT, DOCX) para resumir.`,
  
  UNSUPPORTED_FILE: `📎 *Arquivo não suportado.*
Por favor, use apenas PDF, TXT, DOCX ou CSV.`,
  
  TTS_FAILED: `🔇 Desculpe, não consegui gerar o áudio. Enviando a resposta em texto.`
};

/**
 * =================================================================
 *                 PROMPTS PARA INTELIGÊNCIA ARTIFICIAL
 * =================================================================
 */
export const PROMPTS = {
  agenda: (date) => `Você é Marvin, um assistente especialista em agendamentos. A data e hora atuais são: ${date}. Sua tarefa é extrair "message" e "scheduledTime" da fala do usuário para criar um evento. Responda APENAS com o objeto JSON estruturado abaixo. Não adicione nenhuma explicação ou texto fora do JSON.

Exemplo de estrutura de resposta:
{
  "message": "Mensagem do lembrete",
  "status": "approved",
  "scheduledTime": { "$date": "DATA_EM_ISO8601" },
  "expiryTime": { "$date": "DATA_EM_ISO8601" },
  "sentAt": null,
  "attempts": 0,
  "lastAttemptAt": null
}

Sempre retorne um JSON válido neste formato. As datas devem estar em formato ISO8601 UTC.`,
  
  assistant: (date) => `Você é o SecreBot, um assistente virtual amigável, prestativo e um pouco espirituoso. Responda de forma útil, clara e concisa. Use emojis para deixar a conversa mais leve e agradável. A data atual é ${date}.`,
  
  linkedin: `Analise o texto a seguir, extraído de um perfil do LinkedIn. Estruture as informações mais relevantes em um resumo claro e organizado. Use seções com títulos em negrito e emojis para facilitar a leitura (Ex: *📄 Resumo*, *💼 Experiência*, *🎓 Educação*).`,
  
  imageDescription: 'Descreva esta imagem de forma detalhada, clara e objetiva.',
  
  calorieEstimation: `Identifique os alimentos na imagem. Responda SOMENTE com um JSON no formato: {"foods": ["alimento1", "alimento2"]}. A resposta deve ser sempre e unicamente este JSON.`,
  
  audioCommandMapping: (transcription) => `## Tarefa: Mapeamento de Intenção para Comando
Sua função é analisar a transcrição de áudio do usuário e determinar qual comando interno corresponde à sua intenção.

## Comandos Disponíveis e Palavras-Chave:
• !ajuda: ajuda, instruções, como usar, manual
• !deep: conversar com IA, assistente, fazer pergunta, chat
• !agendabot: criar lembrete, agendar, marcar, criar agenda
• !transcrever: transcrever áudio, converter voz em texto
• !transcreveresumir: resumir áudio, resumo do áudio
• !foto: analisar imagem, descrever foto, o que tem na foto
• !calorias: calcular calorias, analisar comida, nutrição
• !listaragendamentos: listar compromissos, ver agenda, meus lembretes
• !menu: menu principal, opções, início, tela inicial
• !linkedin: analisar LinkedIn, perfil profissional
• !deletaragendamento: deletar, remover, cancelar agendamento
• !voz: ativar voz, modo áudio, resposta falada
• !recurso: recursos, status do sistema
• !voltar: voltar, cancelar, sair, parar
• !resumir: resumir texto, resumir documento
• !resumirvideo: resumir vídeo, análise de vídeo
• !trocarmodelo: trocar modelo IA, mudar IA
• !modelos: listar modelos
• !modeloswhisper: listar modelos whisper
• !trocarmodelwhisper: trocar modelo whisper

## Instruções:
1. Analise a intenção principal na transcrição.
2. Responda APENAS com o comando correspondente (ex: !deep).
3. Se a intenção não for clara ou não corresponder a nenhum comando, responda com "INVALIDO".

## Transcrição para Análise:
"${transcription}"`
};
