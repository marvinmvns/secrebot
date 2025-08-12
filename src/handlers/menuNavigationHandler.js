import logger from '../utils/logger.js';
import { 
  NUMERIC_SHORTCUTS, 
  NAVIGATION_STATES, 
  SUBMENU_MESSAGES,
  MENU_MESSAGE,
  COMMANDS,
  PROMPTS,
  CHAT_MODES
} from '../config/index.js';

export default class MenuNavigationHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleNavigation(msg, contactId, text) {
    try {
      const navigationState = await this.whatsAppBot.getNavigationState(contactId);
      
      // Handle hierarchical navigation (numeric shortcuts)
      if (this.isNumericInput(text)) {
        return await this.handleHierarchicalNavigation(msg, contactId, text, navigationState);
      }

      // Handle text-based navigation  
      return await this.handleTextNavigation(msg, contactId, text, navigationState);
    } catch (error) {
      logger.error('❌ Erro na navegação:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro na navegação do menu.');
      return false;
    }
  }

  isNumericInput(text) {
    // Check if text matches numeric shortcut patterns like "1", "1.1", "2.3.1"
    return /^\d+(\.\d+)*$/.test(text.trim());
  }

  async handleHierarchicalNavigation(msg, contactId, text, navigationState) {
    try {
      const numericInput = text.trim();
      logger.info(`🔢 Navegação hierárquica: ${numericInput} de ${contactId}`);
      logger.debug(`🐛 handleHierarchicalNavigation - navigationState: ${navigationState ? JSON.stringify(navigationState) : 'NULL'}`);

      // Handle based on current navigation state
      // If user types a single digit (1-9), always treat as main menu navigation
      const isSingleDigit = /^[1-9]$/.test(numericInput);
      if (!navigationState || navigationState === 'MAIN_MENU' || typeof navigationState === 'string' || isSingleDigit) {
        logger.debug(`🐛 Chamando handleMainMenuNavigation para "${numericInput}" (state: ${navigationState}, singleDigit: ${isSingleDigit})`);
        const result = await this.handleMainMenuNavigation(msg, contactId, numericInput);
        logger.debug(`🐛 handleMainMenuNavigation retornou: ${result}`);
        return result;
      }

      logger.debug(`🐛 Chamando handleSubmenuNavigation para "${numericInput}"`);
      const result = await this.handleSubmenuNavigation(msg, contactId, numericInput, navigationState);
      logger.debug(`🐛 handleSubmenuNavigation retornou: ${result}`);
      return result;
    } catch (error) {
      logger.error('❌ Erro na navegação hierárquica:', error);
      return false;
    }
  }

  async handleMainMenuNavigation(msg, contactId, numericInput) {
    logger.debug(`🐛 handleMainMenuNavigation chamado com numericInput: "${numericInput}"`);
    
    // Handle direct hierarchical navigation (like "1.1" without first going to "1")
    if (numericInput.includes('.')) {
      logger.debug(`🐛 Navegação hierárquica detectada: ${numericInput}`);
      const parts = numericInput.split('.');
      const mainMenu = parts[0];
      
      // Map main menu to submenu type
      const menuTypeMap = {
        '1': 'AGENDA',
        '2': 'IA', 
        '3': 'MIDIA',
        '4': 'PROFISSIONAL',
        '5': 'CONFIG',
        '6': 'SUPORTE',
        '7': 'VIDEO',
        '8': 'STATUS_APIS',
        '9': 'CRYPTO'
      };
      
      const submenuType = menuTypeMap[mainMenu];
      logger.debug(`🐛 Menu hierárquico "${mainMenu}" mapeado para: ${submenuType}`);
      
      if (submenuType) {
        // Set navigation state and handle submenu directly
        await this.whatsAppBot.setNavigationState(contactId, {
          submenu: submenuType,
          level: 1,
          timestamp: Date.now()
        });
        
        return await this.handleSubmenuNavigation(msg, contactId, numericInput, {submenu: submenuType});
      }
    }
    
    // Map numeric inputs to main menu actions (single numbers like "0", "1", "2")
    logger.debug(`🐛 Processando entrada de menu principal: "${numericInput}"`);
    
    const menuMap = {
      '0': () => this.handleBackCommand(contactId, null),
      '1': () => this.showSubmenu(contactId, 'AGENDA'),
      '2': () => this.showSubmenu(contactId, 'IA'),
      '3': () => this.showSubmenu(contactId, 'MIDIA'),
      '4': () => this.showSubmenu(contactId, 'PROFISSIONAL'),
      '5': () => this.showSubmenu(contactId, 'CONFIG'),
      '6': () => this.showSubmenu(contactId, 'SUPORTE'),
      '7': () => this.showSubmenu(contactId, 'VIDEO'),
      '8': () => this.showSubmenu(contactId, 'STATUS_APIS'),
      '9': () => this.showSubmenu(contactId, 'CRYPTO')
    };

    const action = menuMap[numericInput];
    logger.debug(`🐛 Ação encontrada para "${numericInput}": ${action ? 'SIM' : 'NÃO'}`);
    
    if (action) {
      logger.debug(`🐛 Executando ação para entrada "${numericInput}"`);
      const result = await action();
      logger.debug(`🐛 Resultado da ação: ${result}`);
      return result;
    }

    logger.debug(`🐛 Entrada inválida: "${numericInput}"`);
    await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida. Digite 0 para menu principal, 1-9 para submenus, ou navegue diretamente (ex: 1.1).');
    return true;
  }

  async handleSubmenuNavigation(msg, contactId, numericInput, navigationState) {
    try {
      const submenuType = navigationState.submenu;
      
      switch (submenuType) {
        case 'AGENDA':
          return await this.handleAgendaSubmenu(msg, contactId, numericInput);
        case 'IA':
          return await this.handleIASubmenu(msg, contactId, numericInput);
        case 'MIDIA':
          return await this.handleMidiaSubmenu(msg, contactId, numericInput);
        case 'PROFISSIONAL':
          return await this.handleProfissionalSubmenu(msg, contactId, numericInput);
        case 'CONFIG':
          return await this.handleConfigSubmenu(msg, contactId, numericInput);
        case 'SUPORTE':
          return await this.handleSuporteSubmenu(msg, contactId, numericInput);
        case 'VIDEO':
          return await this.handleVideoSubmenu(msg, contactId, numericInput);
        case 'STATUS_APIS':
          return await this.handleStatusApisSubmenu(msg, contactId, numericInput);
        case 'CRYPTO':
          return await this.handleCryptoSubmenu(msg, contactId, numericInput);
        default:
          await this.whatsAppBot.sendResponse(contactId, '❌ Estado de navegação inválido.');
          await this.clearNavigationState(contactId);
          return true;
      }
    } catch (error) {
      logger.error(`❌ Erro na navegação do submenu ${navigationState.submenu}:`, error);
      return false;
    }
  }

  async handleTextNavigation(msg, contactId, text, navigationState) {
    // Handle text-based commands when in navigation state
    const lowerText = text.toLowerCase().trim();
    
    // Handle "voltar" or "menu" commands
    if (lowerText === 'voltar' || lowerText === 'back') {
      return await this.handleBackCommand(contactId, navigationState);
    }
    
    if (lowerText === 'menu' || lowerText === 'início' || lowerText === 'home') {
      await this.clearNavigationState(contactId);
      await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
      return true;
    }
    
    // If user sends text while in navigation, show current menu again
    if (navigationState && navigationState.submenu) {
      await this.showSubmenu(contactId, navigationState.submenu);
      return true;
    }
    
    return false;
  }

  async handleBackCommand(contactId, navigationState) {
    if (!navigationState) {
      await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
      return true;
    }

    // Navigate back one level
    if (navigationState.level > 1) {
      await this.whatsAppBot.setNavigationState(contactId, {
        ...navigationState,
        level: navigationState.level - 1
      });
    } else {
      // Back to main menu
      await this.clearNavigationState(contactId);
      await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
    }
    
    return true;
  }

  async showSubmenu(contactId, submenuType) {
    try {
      logger.debug(`🐛 showSubmenu chamado com contactId: ${contactId}, submenuType: ${submenuType}`);
      
      // Set navigation state
      await this.whatsAppBot.setNavigationState(contactId, {
        submenu: submenuType,
        level: 1,
        timestamp: Date.now()
      });

      // Map submenu types to correct message keys
      const submenuMap = {
        'AGENDA': SUBMENU_MESSAGES.agenda,
        'IA': SUBMENU_MESSAGES.ia,
        'MIDIA': SUBMENU_MESSAGES.midia,
        'PROFISSIONAL': SUBMENU_MESSAGES.profissional,
        'CONFIG': SUBMENU_MESSAGES.config,
        'SUPORTE': SUBMENU_MESSAGES.suporte,
        'VIDEO': SUBMENU_MESSAGES.video || 'Menu de vídeo não implementado.',
        'STATUS_APIS': SUBMENU_MESSAGES.status_apis || 'Menu de status de APIs não implementado.',
        'CRYPTO': SUBMENU_MESSAGES.crypto || 'Menu de criptomoedas não implementado.'
      };

      // Send submenu message
      const submenuMessage = submenuMap[submenuType];
      logger.debug(`🐛 submenuMessage para ${submenuType}: ${submenuMessage ? 'ENCONTRADA' : 'NÃO ENCONTRADA'}`);
      
      if (submenuMessage) {
        logger.debug(`🐛 Enviando mensagem do submenu: ${submenuMessage.substring(0, 100)}...`);
        await this.whatsAppBot.sendResponse(contactId, submenuMessage);
        logger.debug(`🐛 Mensagem do submenu enviada com sucesso`);
      } else {
        const errorMsg = `Menu ${submenuType} não implementado.`;
        logger.debug(`🐛 Enviando mensagem de erro: ${errorMsg}`);
        await this.whatsAppBot.sendResponse(contactId, errorMsg);
      }
      
      logger.debug(`🐛 showSubmenu concluído com sucesso para ${submenuType}`);
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao mostrar submenu ${submenuType}:`, error);
      return false;
    }
  }

  async clearNavigationState(contactId) {
    await this.whatsAppBot.setNavigationState(contactId, null);
  }

  // Delegate submenu handlers to original whatsAppBot methods
  async handleAgendaSubmenu(msg, contactId, input) {
    const option = input.includes('.') ? input.split('.')[1] : input;
    
    switch (option) {
      case '1':
        // 1.1 - Criar agendamento
        await this.clearNavigationState(contactId); // Clear navigation state when entering specific mode
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.SCHEDULER);
        await this.whatsAppBot.sendResponse(contactId, '➕ *Criar Agendamento*\n\nDescreva o que deseja agendar (ex: "Reunião amanhã às 14h")');
        break;
      case '2':
        // 1.2 - Listar agendamentos
        return await this.whatsAppBot.scheduleHandler.handleListarCommand(contactId);
      case '3':
        // 1.3 - Deletar agendamento
        return await this.whatsAppBot.scheduleHandler.handleDeletarCommand(contactId);
      case '4':
        // 1.4 - Importar agenda
        await this.clearNavigationState(contactId); // Clear navigation state when entering specific mode
        await this.whatsAppBot.setMode(contactId, 'IMPORT_CALENDAR');
        await this.whatsAppBot.sendResponse(contactId, '📥 *Importar Agenda*\n\nEnvie um arquivo .ics para importar os eventos.');
        break;
      case '0':
        return await this.handleBackCommand(contactId, null);
      default:
        await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida. Use 1, 2, 3, 4 ou 0 para voltar.');
        break;
    }
    return true;
  }

  async handleIASubmenu(msg, contactId, input) {
    const option = input.includes('.') ? input.split('.')[1] : input;
    
    switch (option) {
      case '1':
        // 2.1 - Bater papo com IA
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.ASSISTANT);
        await this.whatsAppBot.sendResponse(contactId, '💬 *Modo Conversa Ativado*\n\nAgora você pode conversar comigo! Digite sua pergunta ou mensagem.');
        break;
      case '2':
        // 2.2 - Resumir texto/arquivo
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.RESUMIR);
        await this.whatsAppBot.sendResponse(contactId, '📄 *Resumir Documento*\n\nEnvie um texto, PDF, DOCX ou TXT para resumir.');
        break;
      case '3':
        // 2.3 - Resumir vídeo YouTube
        return await this.whatsAppBot.videoSummaryHandler.handleResumirvideo1Command(contactId);
        break;
      case '4':
        // 2.4 - Analisar imagem
        return await this.whatsAppBot.imageHandler.handleFotoCommand(contactId);
        break;
      case '5':
        // 2.5 - Transcrever e resumir áudio
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.TRANSCREVER_RESUMIR);
        await this.whatsAppBot.sendResponse(contactId, '🎤 *Transcrever e Resumir*\n\nEnvie um áudio para transcrever e resumir.');
        break;
      case '6':
        // 2.6 - Escolher modelo específico
        return await this.whatsAppBot.modelManagementHandler.handleChooseModelCommand(contactId);
        break;
      case '0':
        return await this.handleBackCommand(contactId, null);
      default:
        await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida. Use 1, 2, 3, 4, 5, 6 ou 0 para voltar.');
        break;
    }
    return true;
  }

  async handleMidiaSubmenu(msg, contactId, input) {
    const option = input.includes('.') ? input.split('.')[1] : input;
    
    switch (option) {
      case '1':
        // 3.1 - Transcrever áudio
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.TRANSCRICAO);
        await this.whatsAppBot.sendResponse(contactId, '🎤 *Modo Transcrição*\n\nEnvie um áudio para transcrever.');
        break;
      case '2':
        // 3.2 - Ativar/desativar voz
        return await this.whatsAppBot.systemHandler.handleVozCommand(contactId);
        break;
      case '3':
        // 3.3 - Calcular calorias
        await this.whatsAppBot.setMode(contactId, CHAT_MODES.CALORIAS);
        await this.whatsAppBot.sendResponse(contactId, '🍎 *Calculadora de Calorias*\n\nEnvie uma foto da comida para análise nutricional.');
        break;
      case '4':
        // 3.4 - Escolher endpoint transcrição
        return await this.whatsAppBot.endpointHandler.handleChooseWhisperEndpointCommand(contactId);
        break;
      case '0':
        return await this.handleBackCommand(contactId, null);
      default:
        await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida. Use 1, 2, 3, 4 ou 0 para voltar.');
        break;
    }
    return true;
  }

  async handleProfissionalSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleProfissionalSubmenu(msg, contactId, input);
  }

  async handleConfigSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleConfigSubmenu(msg, contactId, input);
  }

  async handleSuporteSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleSuporteSubmenu(msg, contactId, input);
  }

  async handleVideoSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleVideoSubmenu(msg, contactId, input);
  }

  async handleStatusApisSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleStatusApisSubmenu(msg, contactId, input);
  }

  async handleCryptoSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleCryptoSubmenu(msg, contactId, input);
  }

  // Audio navigation support
  async processAudioNavigation(msg, contactId, transcription, navigationState) {
    try {
      // Try to match transcription to menu options
      const numericMatch = await this.trySubmenuNavigation(transcription, navigationState);
      if (numericMatch) {
        return await this.handleSubmenuNavigation(msg, contactId, numericMatch, navigationState);
      }

      // Handle text-based audio navigation
      return await this.handleTextNavigation(msg, contactId, transcription, navigationState);
    } catch (error) {
      logger.error('❌ Erro na navegação por áudio:', error);
      return false;
    }
  }

  async trySubmenuNavigation(transcription, navigationState) {
    const submenuMapping = {
      // Palavras-chave para navegação de submenu
      'agenda': 'submenu_agenda',
      'lembrete': 'submenu_agenda',
      'compromisso': 'submenu_agenda',
      'agendamento': 'submenu_agenda',
      'ia': 'submenu_ia',
      'inteligencia': 'submenu_ia',
      'artificial': 'submenu_ia',
      'chat': 'submenu_ia',
      'conversa': 'submenu_ia',
      'midia': 'submenu_midia',
      'audio': 'submenu_midia',
      'som': 'submenu_midia',
      'voz': 'submenu_midia',
      'profissional': 'submenu_profissional',
      'linkedin': 'submenu_profissional',
      'perfil': 'submenu_profissional',
      'analisar': 'submenu_profissional',
      'analise': 'submenu_profissional',
      'config': 'submenu_config',
      'configuracao': 'submenu_config',
      'configurar': 'submenu_config',
      'ajuste': 'submenu_config',
      'suporte': 'submenu_suporte',
      'ajuda': 'submenu_suporte',
      'sistema': 'submenu_suporte',
      'recurso': 'submenu_suporte'
    };

    const lowerTranscription = transcription.toLowerCase();
    
    for (const [keyword, submenu] of Object.entries(submenuMapping)) {
      if (lowerTranscription.includes(keyword)) {
        return submenu;
      }
    }
    
    return null;
  }

  async processTextNavigation(msg, contactId, text, navigationState) {
    logger.flow(`⌨️ Processando navegação por texto. Estado: ${navigationState}, Texto: "${text}"`);

    // Primeiro, verificar se é input numérico para navegação hierárquica
    if (this.isNumericInput(text) && await this.handleHierarchicalNavigation(msg, contactId, text, navigationState)) {
      return;
    }

    // Depois, tentar mapear para comando direto ou via LLM
    const commandPrompt = PROMPTS.audioCommandMapping(text);
    let mappedCommand = 'INVALIDO';

    const directMapping = {
      'linkedin': COMMANDS.LINKEDIN,
      'analisar linkedin': COMMANDS.LINKEDIN,
      'perfil linkedin': COMMANDS.LINKEDIN,
      'analisar perfil': COMMANDS.LINKEDIN,
      'linkedin login': `${COMMANDS.LINKEDIN} login`,
      'linkedin test': `${COMMANDS.LINKEDIN} test`,
      'testar linkedin': `${COMMANDS.LINKEDIN} test`
    };

    const lowerText = text.toLowerCase();
    for (const [keyword, command] of Object.entries(directMapping)) {
      if (lowerText.includes(keyword)) {
        mappedCommand = command;
        logger.api(`🎯 Mapeamento direto de texto para: ${mappedCommand}`);
        break;
      }
    }

    if (mappedCommand === 'INVALIDO') {
      try {
        mappedCommand = await this.whatsAppBot.llmService.generateText(commandPrompt, 0.2);
        logger.api(`🤖 LLM mapeou texto para: ${mappedCommand}`);
      } catch (error) {
        logger.error('❌ Erro ao mapear comando de texto via LLM:', error);
        logger.flow('🔄 Tentando fallback para navegação por submenu');
      }
    }

    if (mappedCommand !== 'INVALIDO' && Object.values(COMMANDS).includes(mappedCommand)) {
        await this.whatsAppBot.sendResponse(contactId, `✅ Comando interpretado: *${this.getCommandDescription(mappedCommand)}*`, true);
        await this.whatsAppBot.handleMessage({ ...msg, body: mappedCommand });
    } else {
        const submenuCommand = await this.trySubmenuNavigation(text, navigationState);

        if (submenuCommand) {
            logger.flow(`⌨️ Texto mapeado para navegação de submenu: ${submenuCommand}`);
            await this.whatsAppBot.sendResponse(contactId, `✅ Navegando para: *${this.getSubmenuDescription(submenuCommand)}*`, true);
            await this.whatsAppBot.handleMessage({ ...msg, body: submenuCommand });
        } else {
            const currentMenuText = this.getCurrentMenuText(navigationState);
            await this.whatsAppBot.sendResponse(contactId, `😕 Desculpe, não entendi a mensagem "${text}".

💡 *Tente algo como:*\n• "criar lembrete" • "conversar com IA"\n• "transcrever áudio" • "analisar imagem"\n• "ver compromissos" • "ajuda"\n\n${currentMenuText}`);
        }
    }
  }

  getCurrentMenuText(navigationState) {
    switch (navigationState) {
      case NAVIGATION_STATES.SUBMENU_AGENDA:
        return SUBMENU_MESSAGES.agenda;
      case NAVIGATION_STATES.SUBMENU_IA:
        return SUBMENU_MESSAGES.ia;
      case NAVIGATION_STATES.SUBMENU_MIDIA:
        return SUBMENU_MESSAGES.midia;
      case NAVIGATION_STATES.SUBMENU_PROFISSIONAL:
        return SUBMENU_MESSAGES.profissional;
      case NAVIGATION_STATES.SUBMENU_CONFIG:
        return SUBMENU_MESSAGES.config;
      case NAVIGATION_STATES.SUBMENU_SUPORTE:
        return SUBMENU_MESSAGES.suporte;
      case NAVIGATION_STATES.SUBMENU_VIDEO:
        return SUBMENU_MESSAGES.video;
      default:
        return MENU_MESSAGE;
    }
  }

  // Audio navigation support
  async processAudioNavigation(msg, contactId, transcription, navigationState) {
    logger.flow(`🎤 Processando navegação por áudio. Estado: ${navigationState}, Transcrição: "${transcription}"`);
    await this.whatsAppBot.sendResponse(contactId, '🤔 Interpretando comando de áudio...', true);
    
    // Primeiro, tentar navegação hierárquica por áudio
    if (await this.handleHierarchicalNavigation(msg, contactId, transcription, navigationState)) {
      return;
    }
    
    // Depois, tentar mapear para comando direto
    const commandPrompt = PROMPTS.audioCommandMapping(transcription);
    let mappedCommand = 'INVALIDO';
    
    // Mapeamento direto para comandos comuns
    const directMapping = {
      'linkedin': COMMANDS.LINKEDIN,
      'analisar linkedin': COMMANDS.LINKEDIN,
      'perfil linkedin': COMMANDS.LINKEDIN,
      'analisar perfil': COMMANDS.LINKEDIN,
      'linkedin login': `${COMMANDS.LINKEDIN} login`,
      'linkedin test': `${COMMANDS.LINKEDIN} test`,
      'testar linkedin': `${COMMANDS.LINKEDIN} test`
    };
    
    const lowerTranscription = transcription.toLowerCase();
    for (const [keyword, command] of Object.entries(directMapping)) {
      if (lowerTranscription.includes(keyword)) {
        mappedCommand = command;
        logger.api(`🎯 Mapeamento direto de áudio para: ${mappedCommand}`);
        break;
      }
    }
    
    // Se não encontrou mapeamento direto, usar LLM
    if (mappedCommand === 'INVALIDO') {
      try {
        mappedCommand = await this.whatsAppBot.llmService.generateText(commandPrompt, 0.2);
        logger.api(`🤖 LLM mapeou áudio para: ${mappedCommand}`);
      } catch (error) {
        logger.error('❌ Erro ao mapear comando de áudio via LLM:', error);
        // Fallback: tentar navegação por submenu diretamente
        logger.flow('🔄 Tentando fallback para navegação por submenu');
      }
    }
    
    if (mappedCommand !== 'INVALIDO' && Object.values(COMMANDS).includes(mappedCommand)) {
        await this.whatsAppBot.sendResponse(contactId, `✅ Comando de áudio interpretado: *${this.getCommandDescription(mappedCommand)}*`, true);
        await this.whatsAppBot.handleMessage({ ...msg, body: mappedCommand });
    } else {
        // Se não conseguiu mapear diretamente, tentar navegar por submenu
        const submenuCommand = await this.trySubmenuNavigation(transcription, navigationState);
        
        if (submenuCommand) {
            logger.flow(`🎤 Áudio mapeado para navegação de submenu: ${submenuCommand}`);
            await this.whatsAppBot.sendResponse(contactId, `✅ Navegando para: *${this.getSubmenuDescription(submenuCommand)}*`, true);
            await this.showSubmenu(contactId, submenuCommand);
        } else {
            const currentMenuText = this.getCurrentMenuText(navigationState);
            await this.whatsAppBot.sendResponse(contactId, `😕 Desculpe, não entendi o comando de áudio "${transcription}". 

💡 *Tente falar algo como:*
• "criar lembrete" • "conversar com IA" 
• "transcrever áudio" • "analisar imagem"
• "ver compromissos" • "ajuda"

${currentMenuText}`);
        }
    }
  }

  getCommandDescription(command) {
    const descriptions = {
      [COMMANDS.AJUDA]: 'Exibir Ajuda',
      [COMMANDS.DEEP]: 'Chat com IA',
      [COMMANDS.AGENDA]: 'Criar Agendamento',
      [COMMANDS.TRANSCREVER]: 'Transcrever Áudio',
      [COMMANDS.TRANSCREVER_RESUMIR]: 'Transcrever e Resumir',
      [COMMANDS.FOTO]: 'Analisar Imagem',
      [COMMANDS.CALORIAS]: 'Calcular Calorias',
      [COMMANDS.LISTAR]: 'Listar Compromissos',
      [COMMANDS.LINKEDIN]: 'Analisar LinkedIn',
      [COMMANDS.DELETAR]: 'Deletar Compromisso',
      [COMMANDS.VOZ]: 'Alternar Voz/Texto',
      [COMMANDS.TTS_CONFIG]: 'Configurar TTS',
      [COMMANDS.RECURSO]: 'Recursos do Sistema',
      [COMMANDS.RESUMIR]: 'Resumir Documento',
      [COMMANDS.RESUMIRVIDEO]: 'Resumir Vídeo',
      [COMMANDS.MENU]: 'Menu Principal',
      [COMMANDS.VOLTAR]: 'Voltar'
    };
    return descriptions[command] || command;
  }

  getSubmenuDescription(submenu) {
    const descriptions = {
      'submenu_agenda': 'Agenda & Lembretes',
      'submenu_ia': 'Inteligência Artificial',
      'submenu_midia': 'Mídia & Conteúdo',
      'submenu_profissional': 'Análise Profissional',
      'submenu_config': 'Configurações',
      'submenu_suporte': 'Suporte & Sistema',
      'submenu_whispersilent': 'WhisperSilent API'
    };
    return descriptions[submenu] || submenu;
  }

}