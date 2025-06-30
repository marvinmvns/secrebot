import { COMMANDS, CHAT_MODES, NAVIGATION_STATES } from './commands.js';

export const MENU_MESSAGE = `🤖 *SECREBOT - MENU PRINCIPAL*

1️⃣ 📅 AGENDA & LEMBRETES
2️⃣ 🧠 INTELIGÊNCIA ARTIFICIAL
3️⃣ 🎬 MÍDIA & CONTEÚDO
4️⃣ 💼 ANÁLISE PROFISSIONAL
5️⃣ ⚙️ CONFIGURAÇÕES
6️⃣ 📞 SUPORTE & SISTEMA

Digite o número ou comando:
• ${COMMANDS.MENU} - Voltar ao menu principal
• ${COMMANDS.AJUDA} - Exibir ajuda detalhada`;

export const SUBMENU_MESSAGES = {
  agenda: `📅 *AGENDA & LEMBRETES*

1.1 ➕ Criar Agendamento
1.2 📋 Listar Agendamentos
1.3 🗑️ Deletar Agendamento
1.4 📥 Importar Agenda (.ics)

0️⃣ Voltar ao menu principal`,

  ia: `🧠 *INTELIGÊNCIA ARTIFICIAL*

2.1 💬 Chat Assistente (Deep)
2.2 📄 Resumir Texto/Arquivo
2.3 🎥 Resumir Vídeo
2.4 🖼️ Analisar Imagem

0️⃣ Voltar ao menu principal`,

  midia: `🎬 *MÍDIA & CONTEÚDO*

3.1 🎤 Transcrever Áudio
3.2 🔊 Ativar/Desativar Voz
3.3 🍎 Calcular Calorias (Foto)

0️⃣ Voltar ao menu principal`,

  profissional: `💼 *ANÁLISE PROFISSIONAL*

4.1 🔗 Analisar LinkedIn

0️⃣ Voltar ao menu principal`,

  config: `⚙️ *CONFIGURAÇÕES*

5.1 🔊 Modo de Resposta (Texto/Voz)
5.2 ⚡ Recursos do Sistema
5.3 🤖 Listar Modelos IA
5.4 🔄 Trocar Modelo IA
5.5 🎤 Listar Modelos Whisper
5.6 🔄 Trocar Modelo Whisper
5.7 🔄 Reiniciar Ollama
5.8 🎤 Reiniciar Whisper

0️⃣ Voltar ao menu principal`,

  suporte: `📞 *SUPORTE & SISTEMA*

6.1 📖 Ajuda Detalhada
6.2 ⚡ Recursos do Sistema

0️⃣ Voltar ao menu principal`,

  video: `🎥 *RESUMIR VÍDEO*

Escolha o método de resumo:

2.3.1 🚀 Transcrição Automática (YouTube)
2.3.2 🎯 Whisper IA (Mais Preciso)

0️⃣ Voltar ao submenu IA`
};

export const MODE_MESSAGES = {
  [CHAT_MODES.ASSISTANT]: `🤖 *Modo Assistente Ativado!*\n\n✨ Agora posso ajudá-lo com qualquer pergunta ou tarefa.\n💬 Digite sua mensagem ou envie um áudio!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.AGENDABOT]: `📅 *Modo Agendamento Ativado!*\n\n📝 Me diga o que você quer agendar e quando.\n🗣️ Você pode digitar ou enviar um áudio!\n\n💡 Exemplo: "Lembrar de reunião amanhã às 14h"\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCRICAO]: `🎤 *Modo Transcrição Ativado!*\n\n🎙️ Envie um áudio para eu transcrever em texto.\n📝 O áudio será convertido automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.LINKEDIN]: `💼 *Modo LinkedIn Ativado!*\n\n🔗 Envie o link do perfil que deseja analisar.\n📊 Vou estruturar as informações para você!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  [CHAT_MODES.DELETAR]: `🗑️ *Modo Deletar Agendamento*\n\nAguarde enquanto busco seus agendamentos...`,
  
  [CHAT_MODES.RESUMIR]: `📑 *Modo Resumo Ativado!*\n\n📎 *Agora envie:*\n• Arquivo PDF, DOCX, TXT ou CSV\n• Texto diretamente na mensagem\n\n💡 *Dica:* Use !resumirvideo <link> para vídeos do YouTube\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TROCAR_MODELO]: `🔄 *Modo Trocar Modelo IA Ativado!*\n\n🤖 *Digite o número do modelo* que deseja ativar.\n\n💡 *Dica:* Use ${COMMANDS.MODELOS} para ver a lista atualizada\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TROCAR_MODELO_WHISPER]: `🎤 *Modo Trocar Modelo Whisper Ativado!*\n\n🗣️ *Digite o número do modelo* que deseja ativar.\n\n💡 *Dica:* Use ${COMMANDS.MODELOS_WHISPER} para ver a lista atualizada\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
};

export const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: `✅ *Compromisso Agendado com Sucesso!*\n\n📅 Seu lembrete foi salvo e será enviado no horário programado.\n⏰ Você receberá a mensagem automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  SCHEDULE_DELETED: (message, dateTime) => `✅ *Agendamento Deletado com Sucesso!*\n\n🗑️ Removido: ${message}\n📅 Data/Hora: ${dateTime}\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  TRANSCRIPTION_COMPLETE: `✅ *Transcrição Concluída!*\n\n📝 O texto acima é a transcrição do seu áudio.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  VOICE_ENABLED: `🗣️ Respostas por voz *ativadas*! Usarei áudio para responder sempre que possível.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  VOICE_DISABLED: `💬 Respostas por voz *desativadas*! Usarei apenas texto para responder.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`
};

export const ERROR_MESSAGES = {
  GENERIC: `❌ *Erro ao processar sua solicitação*\n\n😔 Desculpe, algo deu errado. Por favor, tente novamente.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  NO_SCHEDULES: `📭 *Nenhum agendamento encontrado*\n\n💡 Use o comando ${COMMANDS.AGENDA} para criar um novo!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  INVALID_NUMBER: `❌ *Número inválido!*\n\n🔢 Por favor, escolha um número válido da lista.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  AUDIO_REQUIRED: `🎤 *Áudio necessário!*\n\n📎 Por favor, envie um áudio para transcrever.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  IMAGE_REQUIRED: `📸 *Imagem necessária!*\n\n📎 Por favor, envie uma imagem junto com o comando.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  TEXT_OR_FILE_REQUIRED: `📝 *Texto ou arquivo necessário!*\n\nEnvie uma mensagem de texto ou anexe um PDF, TXT, DOCX ou CSV com o comando.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  UNSUPPORTED_FILE: `📎 *Tipo de arquivo não suportado!*\n\nUse apenas PDF, TXT, DOCX ou CSV.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,
  
  TTS_FAILED: `🔇 Desculpe, não consegui gerar a resposta em áudio. Enviando em texto.
🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`
};

export const PROMPTS = {
  agenda: (date) => `\nVocê é um assistente chamado Marvin Agenda.\nSeu objetivo é ajudar o usuário a agendar compromissos.\nA data e hora atuais são: ${date}.\nQuando o usuário quiser agendar um compromisso, você deve coletar os dados obrigatórios "message" e "scheduledTime" (os únicos obrigatórios para o agendamento e sera falado), completando os demais campos conforme o exemplo abaixo.\nQuando todos os dados forem fornecidos, responda apenas com o JSON estruturado:\n\n{\n  "message": "mensagem_de_texto",\n  "status": "approved",\n  "scheduledTime": {\n    "$date": "data_no_formato_ISO8601"\n  },\n  "expiryTime": {\n    "$date": "data_no_formato_ISO8601"\n  },\n  "sentAt": null,\n  "attempts": 0,\n  "lastAttemptAt": null\n}\n\nImportante: Quando responder com o JSON, não adicione nenhuma explicação ou texto adicional. sempre retornar um json em qualquer hipotese e as datas no formato esperado`,
  
  assistant: (date) => `\nVocê é um assistente virtual amigável e prestativo.\nResponda de forma útil, clara e concisa.\nUse emojis quando apropriado para tornar a conversa mais agradável.\nData atual: ${date}.`,
  
  linkedin: 'Analise o texto bruto extraído de um perfil do LinkedIn e produza um resumo organizado com as informações mais relevantes. Use emojis para destacar as seções.',
  
  imageDescription: 'Descreva a imagem de forma detalhada e clara:',
  
  calorieEstimation: `Identifique os alimentos presentes na imagem e responda SOMENTE com um JSON no formato {"foods":["alimento1","alimento2"]} a resposta sempre devera ser um json`,
  
  audioCommandMapping: (transcription) => `Dada a transcrição "${transcription}", qual comando do menu a seguir ela mais provavelmente representa? Responda APENAS com o comando (ex: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar) ou "INVALIDO" se não corresponder a nenhum.
Comandos disponíveis: !ajuda, !deep, !agendabot, !transcrever, !foto, !calorias, !listaragendamentos, !menu, !linkedin, !deletaragendamento, !voz, !recurso, !voltar`
};