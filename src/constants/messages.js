import { COMMANDS, CHAT_MODES, NAVIGATION_STATES } from './commands.js';

export const MENU_MESSAGE = `🤖 *SECREBOT - MENU PRINCIPAL*

🎯 *NAVEGAÇÃO INTELIGENTE*
• Digite o número da opção desejada
• Ou envie um áudio descrevendo o que precisa
• Use comandos diretos (!ajuda, !deep, etc.)

─────────────────────────────

1️⃣ 📅 *AGENDA & LEMBRETES*
   Criar, listar e gerenciar seus compromissos

2️⃣ 🧠 *INTELIGÊNCIA ARTIFICIAL*
   Chat assistente e análise de conteúdo

3️⃣ 🎬 *MÍDIA & CONTEÚDO*
   Transcrever áudio, analisar imagens

4️⃣ 💼 *ANÁLISE PROFISSIONAL*
   Análise de perfis LinkedIn e documentos

5️⃣ ⚙️ *CONFIGURAÇÕES*
   Ajustar preferências e modelos IA

6️⃣ 📞 *SUPORTE & SISTEMA*
   Ajuda, recursos e informações

─────────────────────────────

💡 *DICAS RÁPIDAS:*
• ${COMMANDS.MENU} - Voltar ao menu principal
• ${COMMANDS.AJUDA} - Exibir ajuda detalhada
• 🎤 Fale: "criar lembrete", "transcrever áudio", etc.`;

export const SUBMENU_MESSAGES = {
  agenda: `📅 *AGENDA & LEMBRETES*

🎯 *OPÇÕES DISPONÍVEIS:*

1.1 ➕ *Criar Agendamento*
   Agendar compromissos com lembretes automáticos

1.2 📋 *Listar Agendamentos*
   Ver todos os seus compromissos salvos

1.3 🗑️ *Deletar Agendamento*
   Remover compromissos da sua agenda

1.4 📥 *Importar Agenda (.ics)*
   Importar agenda de outros aplicativos

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "criar lembrete", "listar compromissos"

0️⃣ Voltar ao menu principal`,

  ia: `🧠 *INTELIGÊNCIA ARTIFICIAL*

🎯 *OPÇÕES DISPONÍVEIS:*

2.1 💬 *Chat Assistente (Deep)*
   Conversar com IA para qualquer tarefa

2.2 📄 *Resumir Texto/Arquivo*
   Resumir documentos PDF, DOCX, TXT

2.3 🎥 *Resumir Vídeo*
   Resumir vídeos do YouTube automaticamente

2.4 🖼️ *Analisar Imagem*
   Análise detalhada de imagens enviadas

2.5 🎤 *Transcrever e Resumir Áudio*
   Converter áudio em texto e resumir

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "conversar com IA", "resumir documento"

0️⃣ Voltar ao menu principal`,

  midia: `🎬 *MÍDIA & CONTEÚDO*

🎯 *OPÇÕES DISPONÍVEIS:*

3.1 🎤 *Transcrever Áudio*
   Converter áudio/voz em texto

3.2 🔊 *Ativar/Desativar Voz*
   Alternar entre respostas por texto ou áudio

3.3 🍎 *Calcular Calorias (Foto)*
   Analisar comida em fotos e calcular calorias

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "transcrever áudio", "calcular calorias"

0️⃣ Voltar ao menu principal`,

  profissional: `💼 *ANÁLISE PROFISSIONAL*

🎯 *OPÇÕES DISPONÍVEIS:*

4.1 🔗 *Analisar LinkedIn*
   Análise detalhada de perfis profissionais

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "analisar LinkedIn", "analisar perfil"

0️⃣ Voltar ao menu principal`,

  config: `⚙️ *CONFIGURAÇÕES*

🎯 *OPÇÕES DISPONÍVEIS:*

5.1 🔊 *Modo de Resposta (Texto/Voz)*
   Escolher como receber as respostas

5.2 ⚡ *Recursos do Sistema*
   Ver informações detalhadas do sistema

5.3 🤖 *Listar Modelos IA*
   Ver todos os modelos disponíveis

5.4 🔄 *Trocar Modelo IA*
   Alterar modelo de inteligência artificial

5.5 🎤 *Listar Modelos Whisper*
   Ver modelos de transcrição disponíveis

5.6 🔄 *Trocar Modelo Whisper*
   Alterar modelo de transcrição

5.7 🔄 *Reiniciar Ollama*
   Reiniciar serviço de IA

5.8 🎤 *Reiniciar Whisper*
   Reiniciar serviço de transcrição

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "ativar voz", "trocar modelo"

0️⃣ Voltar ao menu principal`,

  suporte: `📞 *SUPORTE & SISTEMA*

🎯 *OPÇÕES DISPONÍVEIS:*

6.1 📖 *Ajuda Detalhada*
   Instruções completas de uso

6.2 ⚡ *Recursos do Sistema*
   Informações técnicas detalhadas

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "ajuda", "recursos sistema"

0️⃣ Voltar ao menu principal`,

  video: `🎥 *RESUMIR VÍDEO*

🎯 *ESCOLHA O MÉTODO:*

2.3.1 🚀 *Transcrição Automática (YouTube)*
   Método rápido para vídeos do YouTube

2.3.2 🎯 *Whisper IA (Mais Preciso)*
   Análise mais detalhada e precisa

──────────────────────────

💡 *DICA:* Digite o número ou fale o que precisa!
🎤 Exemplo: "resumir vídeo YouTube", "método preciso"

0️⃣ Voltar ao submenu IA`
};

export const MODE_MESSAGES = {
  [CHAT_MODES.ASSISTANT]: `🤖 *Modo Assistente Ativado!*\n\n✨ Agora posso ajudá-lo com qualquer pergunta ou tarefa.\n💬 Digite sua mensagem ou envie um áudio!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.AGENDABOT]: `📅 *Modo Agendamento Ativado!*\n\n📝 Me diga o que você quer agendar e quando.\n🗣️ Você pode digitar ou enviar um áudio!\n\n💡 Exemplo: "Lembrar de reunião amanhã às 14h"\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCRICAO]: `🎤 *Modo Transcrição Ativado!*\n\n🎙️ Envie um áudio para eu transcrever em texto.\n📝 O áudio será convertido automaticamente!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

  [CHAT_MODES.TRANSCREVER_RESUMIR]: `🎤 *Modo Transcrição e Resumo Ativado!*\n\n🎙️ Envie um áudio para eu transcrever e resumir.\n🧠 Vou converter em texto e criar um resumo estruturado!\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`,

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
  
  audioCommandMapping: (transcription) => `Analise a transcrição "${transcription}" e determine qual comando do menu corresponde à intenção do usuário.

COMANDOS DISPONÍVEIS E SUAS FUNÇÕES:
• !ajuda - Exibir ajuda, instruções, como usar, manual
• !deep - Conversar com IA, chat inteligente, assistente virtual, fazer pergunta
• !agendabot - Criar lembrete, agendar compromisso, marcar encontro, criar agenda
• !transcrever - Transcrever áudio, converter voz em texto, passar áudio para texto
• !transcreveresumir - Transcrever e resumir áudio, fazer resumo do áudio
• !foto - Analisar imagem, ver foto, descrever imagem, análise visual
• !calorias - Calcular calorias, analisar comida, ver nutrição, contar calorias
• !listaragendamentos - Listar compromissos, ver agenda, mostrar lembretes
• !menu - Voltar menu, menu principal, opções, início
• !linkedin - Analisar LinkedIn, perfil profissional, análise de perfil
• !deletaragendamento - Deletar compromisso, remover lembrete, cancelar agenda
• !voz - Ativar voz, modo áudio, resposta falada, alternar voz/texto
• !recurso - Recursos sistema, informações técnicas, status do sistema
• !voltar - Voltar, cancelar, sair, parar
• !resumir - Resumir texto, resumir documento, fazer resumo
• !resumirvideo - Resumir vídeo YouTube, análise de vídeo
• !trocarmodelo - Trocar modelo IA, alterar modelo, mudar IA
• !modelos - Listar modelos, ver modelos disponíveis
• !modeloswhisper - Modelos Whisper, ver transcrição disponível
• !trocarmodelwhisper - Trocar modelo Whisper, alterar transcrição

INSTRUÇÕES:
1. Analise a intenção do usuário na transcrição
2. Considere sinônimos e variações de fala
3. Responda APENAS com o comando correspondente (ex: !deep, !agendabot)
4. Se não houver correspondência clara, responda "INVALIDO"

EXEMPLOS:
- "quero criar um lembrete" → !agendabot
- "conversar com a IA" → !deep
- "transcrever esse áudio" → !transcrever
- "como funciona isso" → !ajuda
- "voltar pro menu" → !menu
- "ver meus compromissos" → !listaragendamentos

Transcrição para análise: "${transcription}"`
};