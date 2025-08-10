import logger from '../utils/logger.js';
import { 
  NUMERIC_SHORTCUTS, 
  NAVIGATION_STATES, 
  SUBMENU_MESSAGES,
  MENU_MESSAGE 
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

      // Handle based on current navigation state
      if (!navigationState) {
        return await this.handleMainMenuNavigation(msg, contactId, numericInput);
      }

      return await this.handleSubmenuNavigation(msg, contactId, numericInput, navigationState);
    } catch (error) {
      logger.error('❌ Erro na navegação hierárquica:', error);
      return false;
    }
  }

  async handleMainMenuNavigation(msg, contactId, numericInput) {
    // Map numeric inputs to main menu actions
    const menuMap = {
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
    if (action) {
      return await action();
    }

    await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida. Digite um número de 1-9.');
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
      // Set navigation state
      await this.whatsAppBot.setNavigationState(contactId, {
        submenu: submenuType,
        level: 1,
        timestamp: Date.now()
      });

      // Send submenu message
      const submenuMessage = SUBMENU_MESSAGES[submenuType];
      if (submenuMessage) {
        await this.whatsAppBot.sendResponse(contactId, submenuMessage);
      } else {
        await this.whatsAppBot.sendResponse(contactId, `Menu ${submenuType} não implementado.`);
      }
      
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
    return await this.whatsAppBot.handleAgendaSubmenu(msg, contactId, input);
  }

  async handleIASubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleIASubmenu(msg, contactId, input);
  }

  async handleMidiaSubmenu(msg, contactId, input) {
    return await this.whatsAppBot.handleMidiaSubmenu(msg, contactId, input);
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
    // This method is delegated to whatsAppBot for complex transcription matching logic
    return await this.whatsAppBot.trySubmenuNavigation(transcription, navigationState);
  }
}