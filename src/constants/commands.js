export const COMMANDS = {
  AJUDA: '!ajuda',
  DEEP: '!deep',
  AGENDA: '!agendabot',
  TRANSCREVER: '!transcrever',
  TRANSCREVER_RESUMIR: '!transcreveresumir',
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
  RESUMIRVIDEO2: '!resumirvideo2',
  IMPORTAR_AGENDA: '!importaragenda',
  VOLTAR: '!voltar',
  MODELOS: '!modelos',
  TROCAR_MODELO: '!trocarmodelo',
  MODELOS_WHISPER: '!modeloswhisper',
  TROCAR_MODELO_WHISPER: '!trocarmodelwhisper',
  REINICIAR_OLLAMA: '!reiniciarollama',
  REINICIAR_WHISPER: '!reiniciarwhisper'
};

export const NUMERIC_SHORTCUTS = {
  // Menu principal
  '1': 'submenu_agenda',
  '2': 'submenu_ia',
  '3': 'submenu_midia',
  '4': 'submenu_profissional',
  '5': 'submenu_config',
  '6': 'submenu_suporte',
  '0': COMMANDS.VOLTAR,
  
  // Agenda & Lembretes
  '1.1': COMMANDS.AGENDA,
  '1.2': COMMANDS.LISTAR,
  '1.3': COMMANDS.DELETAR,
  '1.4': COMMANDS.IMPORTAR_AGENDA,
  
  // Inteligência Artificial
  '2.1': COMMANDS.DEEP,
  '2.2': COMMANDS.RESUMIR,
  '2.3': 'submenu_video',
  '2.4': COMMANDS.FOTO,
  '2.5': COMMANDS.TRANSCREVER_RESUMIR,
  
  // Mídia & Conteúdo
  '3.1': COMMANDS.TRANSCREVER,
  '3.2': COMMANDS.VOZ,
  '3.3': COMMANDS.CALORIAS,
  
  // Análise Profissional
  '4.1': COMMANDS.LINKEDIN,
  
  // Configurações
  '5.1': COMMANDS.VOZ,
  '5.2': COMMANDS.MODELOS,
  '5.3': COMMANDS.TROCAR_MODELO,
  '5.4': COMMANDS.REINICIAR_OLLAMA,
  '5.5': COMMANDS.MODELOS_WHISPER,
  '5.6': COMMANDS.TROCAR_MODELO_WHISPER,
  '5.7': COMMANDS.REINICIAR_WHISPER,
  '5.8': COMMANDS.RECURSO,
  
  // Suporte & Sistema
  '6.1': COMMANDS.AJUDA,
  '6.2': COMMANDS.RECURSO,
  
  // Resumir Vídeo
  '2.3.1': COMMANDS.RESUMIRVIDEO,
  '2.3.2': COMMANDS.RESUMIRVIDEO2
};

export const CHAT_MODES = {
  ASSISTANT: 'assistant',
  AGENDABOT: 'agendabot',
  TRANSCRICAO: 'transcricao',
  TRANSCREVER_RESUMIR: 'transcrever_resumir',
  LINKEDIN: 'linkedin',
  DELETAR: 'deletar',
  RESUMIR: 'resumir',
  TROCAR_MODELO: 'trocar_modelo',
  TROCAR_MODELO_WHISPER: 'trocar_modelo_whisper'
};

export const NAVIGATION_STATES = {
  MAIN_MENU: 'main_menu',
  SUBMENU_AGENDA: 'submenu_agenda',
  SUBMENU_IA: 'submenu_ia',
  SUBMENU_MIDIA: 'submenu_midia',
  SUBMENU_PROFISSIONAL: 'submenu_profissional',
  SUBMENU_CONFIG: 'submenu_config',
  SUBMENU_SUPORTE: 'submenu_suporte',
  SUBMENU_VIDEO: 'submenu_video'
};

export const WHISPER_MODELS_LIST = [
  'tiny',
  'tiny.en',
  'base',
  'base.en', 
  'small',
  'small.en',
  'medium',
  'medium.en',
  'large-v1',
  'large',
  'large-v3-turbo'
];