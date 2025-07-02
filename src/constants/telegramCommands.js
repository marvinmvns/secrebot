export const TELEGRAM_COMMANDS = {
    START: '/start',
    HELP: '/help',
    MENU: '/menu',
    CONFIG: '/config',
    TRANSCREVER_RESUME: '!transcreveresume'
};

export const MENU_NAVIGATION = {
    BACK_TO_MAIN: 'back_main',
    HELP_INFO: 'help',
    TOGGLE_VOICE: 'toggle_voice'
};

export const TELEGRAM_MESSAGES = {
    welcome: `
🤖 <b>Bem-vindo ao SecreBot!</b>

Seu assistente inteligente com IA avançada e funcionalidades completas.

🎯 Escolha uma das opções abaixo para começar:
    `,
    
    help: `
📚 <b>Ajuda - SecreBot Telegram</b>

<b>🎯 Funcionalidades Principais:</b>
• 🧠 <b>IA & Chat:</b> Conversas inteligentes e análises
• 📅 <b>Agenda:</b> Lembretes e agendamentos inteligentes
• 🎬 <b>Mídia:</b> Transcrição e processamento de conteúdo
• 💼 <b>Análise:</b> LinkedIn e recursos do sistema

<b>🎮 Como usar:</b>
• Use os botões interativos para navegar facilmente
• Envie conteúdo diretamente (texto, áudio, imagem, documento)
• Siga as instruções de cada funcionalidade

<b>🔧 Comandos disponíveis:</b>
• <code>/start</code> - Abre o menu principal
• <code>/help</code> - Mostra esta ajuda
• <code>!transcreveresume</code> - Transcrever e resumir áudio

<b>💡 Dicas importantes:</b>
• Navegação 100% por botões - sem necessidade de digitar números
• Configurações personalizáveis por usuário
• Use o botão "🔙 Voltar" para navegar entre menus
• Algumas funcionalidades podem estar desabilitadas conforme sua configuração
• Respostas podem ser enviadas como texto ou áudio (configurável)
    `,

    menus: {
        ai: `
🧠 <b>INTELIGÊNCIA ARTIFICIAL</b>

🤖 Aproveite o poder da IA para suas tarefas diárias.
Escolha uma funcionalidade abaixo:
        `,
        
        agenda: `
📅 <b>AGENDA & LEMBRETES</b>

⏰ Organize sua agenda e nunca mais esqueça compromissos importantes.
Escolha uma opção:
        `,
        
        media: `
🎬 <b>MÍDIA & CONTEÚDO</b>

🎵 Processe e analise diferentes tipos de mídia com facilidade.
Escolha uma opção:
        `,
        
        analysis: `
💼 <b>ANÁLISE PROFISSIONAL</b>

📊 Ferramentas profissionais para análises detalhadas.
Escolha uma opção:
        `,
        
        config: `
⚙️ <b>CONFIGURAÇÕES</b>

🔧 Personalize o bot conforme suas preferências e necessidades.
Escolha uma opção:
        `
    },

    errors: {
        general: '⚠️ Ops! Algo deu errado. Tente novamente em instantes.',
        feature_disabled: '🚫 Esta funcionalidade não está disponível para você.',
        invalid_input: '🤔 Entrada inválida. Por favor, tente novamente.',
        processing_error: '⚡ Erro durante o processamento. Tente mais tarde.',
        timeout: '⏱️ Operação expirou. Tente novamente.'
    },

    success: {
        reminder_created: '✅ 🎉 Lembrete criado com sucesso!',
        reminder_deleted: '✅ 🗑️ Lembrete deletado com sucesso!',
        transcription_complete: '✅ 🎤 Transcrição concluída com sucesso!',
        analysis_complete: '✅ 🔍 Análise concluída com sucesso!',
        config_updated: '✅ ⚙️ Configuração atualizada com sucesso!'
    },

    waiting: {
        processing: '⏳ Processando sua solicitação...',
        analyzing: '🔍 Analisando conteúdo...',
        transcribing: '🎤 Transcrevendo áudio...',
        generating: '🤖 IA gerando resposta...',
        uploading: '📤 Enviando resultado...'
    }
};

export const FEATURE_DESCRIPTIONS = {
    ai_chat: '🧠 Conversa Inteligente com IA',
    scheduler: '📅 Agendamento Inteligente',
    audio_transcription: '🎤 Transcrição Avançada de Áudio',
    image_analysis: '🖼️ Análise Inteligente de Imagens',
    video_summary: '🎥 Resumo Automático de Vídeos',
    text_summary: '📄 Resumo Inteligente de Textos',
    tts: '🔊 Voz Personalizada (TTS)',
    calorie_counter: '🍎 Contador Inteligente de Calorias',
    linkedin_analysis: '🔗 Análise Completa de LinkedIn',
    media_processing: '🎬 Processamento Avançado de Mídia',
    professional_analysis: '💼 Análise Profissional Detalhada',
    system_resources: '📊 Monitoramento de Sistema'
};

export const BUTTON_TEXTS = {
    back: '🔙 Voltar',
    main_menu: '🏠 Menu Principal',
    help: '❓ Ajuda & Suporte',
    cancel: '❌ Cancelar Ação',
    confirm: '✅ Confirmar',
    next: '➡️ Avançar',
    previous: '⬅️ Voltar',
    settings: '⚙️ Preferências',
    enable: '✅ Ativar',
    disable: '❌ Desativar',
    refresh: '🔄 Atualizar Lista'
};