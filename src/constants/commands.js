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
  LISTAR_ENDPOINTS_WHISPER: '!listarendpointswhisper',
  LISTAR_ENDPOINTS_OLLAMA: '!listarendpointsollama',
  STATUS_ENDPOINTS: '!statusendpoints',
  STATUS_APIS: '!statusapis',
  SAIR: '!sair',
  FLOW_SAIR: '!flow sair',
  FLOW_STOP: '!flow stop',
  FLOW_RESTART: '!flow restart',
  FLOW_VOLTAR: '!flow voltar',
  FLOW_STATUS: '!flow status',
  FLOW_LIST: '!flow list',
  WHISPERSILENT: '!whispersilent'
};

export const NUMERIC_SHORTCUTS = {
  // Menu principal
  '1': 'submenu_agenda',
  '2': 'submenu_ia',
  '3': 'submenu_midia',
  '4': 'submenu_profissional',
  '5': 'submenu_config',
  '6': 'submenu_suporte',
  '7': 'submenu_whispersilent',
  '8': 'submenu_status_apis',
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
  '5.2': COMMANDS.LISTAR_ENDPOINTS_WHISPER,
  '5.3': COMMANDS.LISTAR_ENDPOINTS_OLLAMA,
  '5.4': COMMANDS.STATUS_ENDPOINTS,
  '5.5': COMMANDS.RECURSO,
  
  // Suporte & Sistema
  '6.1': COMMANDS.AJUDA,
  '6.2': COMMANDS.RECURSO,
  
  // Resumir Vídeo
  '2.3.1': COMMANDS.RESUMIRVIDEO,
  '2.3.2': COMMANDS.RESUMIRVIDEO2,
  
  // WhisperSilent Integration
  '7.1': 'ws_health_check',
  '7.2': 'ws_health_detailed',
  '7.3': 'ws_status',
  '7.4': 'ws_transcriptions_list',
  '7.5': 'ws_transcriptions_search',
  '7.6': 'ws_transcriptions_stats',
  '7.7': 'ws_aggregation_status',
  '7.8': 'ws_aggregation_texts',
  '7.9': 'ws_control_toggle_api',
  '7.10': 'ws_control_start',
  '7.11': 'ws_control_stop',
  '7.12': 'ws_send_unsent',
  '7.13': 'ws_export_data',
  '7.14': COMMANDS.WHISPERSILENT,
  
  // Status de APIs
  '8.1': 'api_status_ollama',
  '8.2': 'api_status_whisper',
  '8.3': 'api_status_complete',
  '8.4': 'api_models_ollama',
  '8.5': 'api_models_whisper',
  '8.6': 'api_endpoints_ollama',
  '8.7': 'api_endpoints_whisper'
};

export const CHAT_MODES = {
  ASSISTANT: 'assistant',
  AGENDABOT: 'agendabot',
  TRANSCRICAO: 'transcricao',
  TRANSCREVER_RESUMIR: 'transcrever_resumir',
  LINKEDIN: 'linkedin',
  DELETAR: 'deletar',
  RESUMIR: 'resumir',
  RESUMIR_VIDEO: 'resumir_video',
  RESUMIR_VIDEO2: 'resumir_video2',
  TROCAR_MODELO: 'trocar_modelo',
  TROCAR_MODELO_WHISPER: 'trocar_modelo_whisper',
  WHISPERSILENT_CONFIG: 'whispersilent_config'
};

export const NAVIGATION_STATES = {
  MAIN_MENU: 'main_menu',
  SUBMENU_AGENDA: 'submenu_agenda',
  SUBMENU_IA: 'submenu_ia',
  SUBMENU_MIDIA: 'submenu_midia',
  SUBMENU_PROFISSIONAL: 'submenu_profissional',
  SUBMENU_CONFIG: 'submenu_config',
  SUBMENU_SUPORTE: 'submenu_suporte',
  SUBMENU_VIDEO: 'submenu_video',
  SUBMENU_WHISPERSILENT: 'submenu_whispersilent',
  SUBMENU_STATUS_APIS: 'submenu_status_apis'
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