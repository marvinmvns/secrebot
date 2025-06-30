export const TELEGRAM_COMMANDS = {
    START: '/start',
    HELP: '/help',
    MENU: '/menu',
    CONFIG: '/config'
};

export const TELEGRAM_MESSAGES = {
    welcome: `
🤖 <b>Bem-vindo ao SecreBot!</b>

Seu assistente inteligente com IA avançada e funcionalidades completas.

Escolha uma opção abaixo para começar:
    `,
    
    help: `
📚 <b>Ajuda - SecreBot Telegram</b>

<b>🎯 Funcionalidades Principais:</b>
• 🧠 <b>IA & Chat:</b> Conversas inteligentes e análises
• 📅 <b>Agenda:</b> Lembretes e agendamentos
• 🎬 <b>Mídia:</b> Transcrição e processamento
• 💼 <b>Análise:</b> LinkedIn e recursos do sistema

<b>🎮 Como usar:</b>
1. Use os botões do menu para navegar
2. Envie conteúdo diretamente (texto, áudio, imagem)
3. Siga as instruções de cada funcionalidade

<b>🔧 Comandos:</b>
/start - Menu principal
/help - Esta ajuda

<b>💡 Dicas:</b>
• Cada usuário tem configurações personalizáveis
• Use o botão "Voltar" para navegar
• Algumas funcionalidades podem estar desabilitadas
    `,

    menus: {
        ai: `
🧠 <b>INTELIGÊNCIA ARTIFICIAL</b>

Escolha uma funcionalidade de IA:
        `,
        
        agenda: `
📅 <b>AGENDA & LEMBRETES</b>

Gerencie seus compromissos:
        `,
        
        media: `
🎬 <b>MÍDIA & CONTEÚDO</b>

Processe áudio, vídeo e imagens:
        `,
        
        analysis: `
💼 <b>ANÁLISE PROFISSIONAL</b>

Ferramentas de análise avançada:
        `,
        
        config: `
⚙️ <b>CONFIGURAÇÕES</b>

Personalize o bot conforme suas necessidades:
        `
    },

    errors: {
        general: 'Ocorreu um erro. Tente novamente.',
        feature_disabled: 'Esta funcionalidade está desabilitada.',
        invalid_input: 'Entrada inválida. Tente novamente.',
        processing_error: 'Erro durante o processamento.',
        timeout: 'Operação expirou. Tente novamente.'
    },

    success: {
        reminder_created: '✅ Lembrete criado com sucesso!',
        reminder_deleted: '✅ Lembrete deletado com sucesso!',
        transcription_complete: '✅ Transcrição concluída!',
        analysis_complete: '✅ Análise concluída!',
        config_updated: '✅ Configuração atualizada!'
    },

    waiting: {
        processing: '⏳ Processando...',
        analyzing: '🔍 Analisando...',
        transcribing: '🎤 Transcrevendo...',
        generating: '🤖 Gerando resposta...',
        uploading: '📤 Enviando...'
    }
};

export const FEATURE_DESCRIPTIONS = {
    ai_chat: '🧠 Chat com Inteligência Artificial',
    scheduler: '📅 Sistema de Agendamentos',
    audio_transcription: '🎤 Transcrição de Áudio',
    image_analysis: '🖼️ Análise de Imagens',
    video_summary: '🎥 Resumo de Vídeos',
    text_summary: '📄 Resumo de Textos',
    tts: '🔊 Text-to-Speech',
    calorie_counter: '🍎 Contador de Calorias',
    linkedin_analysis: '🔗 Análise de LinkedIn',
    media_processing: '🎬 Processamento de Mídia',
    professional_analysis: '💼 Análise Profissional',
    system_resources: '📊 Recursos do Sistema'
};

export const BUTTON_TEXTS = {
    back: '🔙 Voltar',
    main_menu: '🏠 Menu Principal',
    help: '❓ Ajuda',
    cancel: '❌ Cancelar',
    confirm: '✅ Confirmar',
    next: '➡️ Próximo',
    previous: '⬅️ Anterior',
    settings: '⚙️ Configurações',
    enable: '✅ Habilitar',
    disable: '❌ Desabilitar',
    refresh: '🔄 Atualizar'
};