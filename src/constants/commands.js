export const COMMANDS = {
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
  VOZ: '!voz',
  RECURSO: "!recurso",
  RESUMIR: '!resumir',
  RESUMIRVIDEO: '!resumirvideo',
  IMPORTAR_AGENDA: '!importaragenda',
  VOLTAR: '!voltar'
};

export const NUMERIC_SHORTCUTS = {
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
  '0': COMMANDS.VOLTAR
};

export const CHAT_MODES = {
  ASSISTANT: 'assistant',
  AGENDABOT: 'agendabot',
  TRANSCRICAO: 'transcricao',
  LINKEDIN: 'linkedin',
  DELETAR: 'deletar',
  RESUMIR: 'resumir'
};