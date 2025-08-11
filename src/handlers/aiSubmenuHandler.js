import logger from '../utils/logger.js';
import { 
  NAVIGATION_STATES, 
  SUBMENU_MESSAGES,
  COMMANDS,
  MENU_MESSAGE 
} from '../config/index.js';

export default class AISubmenuHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleIASubmenu(msg, contactId, input) {
    try {
      switch (input) {
        case '2.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.DEEP });
          return true;
        case '2.2':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.RESUMIR });
          return true;
        case '2.3':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.SUBMENU_VIDEO);
          await this.whatsAppBot.sendResponse(contactId, SUBMENU_MESSAGES.video);
          return true;
        case '2.4':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.FOTO });
          return true;
        case '2.5':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.TRANSCREVER_RESUMIR });
          return true;
        case '2.6':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.CHOOSE_MODEL });
          return true;
        case '2.6.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: 'trocar_modelo_especifico' });
          return true;
        case '0':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Erro no submenu IA:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro no menu de IA.');
      return false;
    }
  }

  async handleMidiaSubmenu(msg, contactId, input) {
    try {
      switch (input) {
        case '3.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.TRANSCREVER });
          return true;
        case '3.2':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.VOZ });
          return true;
        case '3.3':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.CALORIAS });
          return true;
        case '3.4':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.CHOOSE_WHISPER_ENDPOINT });
          return true;
        case '3.4.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: 'trocar_endpoint_whisper_especifico' });
          return true;
        case '0':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Erro no submenu Mídia:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro no menu de Mídia.');
      return false;
    }
  }

  async handleConfigSubmenu(msg, contactId, input) {
    try {
      switch (input) {
        case '5.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.VOZ });
          return true;
        case '5.2':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.TTS_CONFIG });
          return true;
        case '5.3':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.LISTAR_ENDPOINTS_WHISPER });
          return true;
        case '5.4':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.LISTAR_ENDPOINTS_OLLAMA });
          return true;
        case '5.5':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.STATUS_ENDPOINTS });
          return true;
        case '5.6':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.RECURSO });
          return true;
        case '0':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Erro no submenu Config:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro no menu de Configurações.');
      return false;
    }
  }

  async handleSuporteSubmenu(msg, contactId, input) {
    try {
      switch (input) {
        case '6.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.AJUDA });
          return true;
        case '6.2':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.RECURSO });
          return true;
        case '0':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Erro no submenu Suporte:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro no menu de Suporte.');
      return false;
    }
  }

  async handleProfissionalSubmenu(msg, contactId, input) {
    try {
      switch (input) {
        case '4.1':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.handleMessage({ ...msg, body: COMMANDS.LINKEDIN });
          return true;
        case '0':
          this.whatsAppBot.setNavigationState(contactId, NAVIGATION_STATES.MAIN_MENU);
          await this.whatsAppBot.sendResponse(contactId, MENU_MESSAGE);
          return true;
      }
      return false;
    } catch (error) {
      logger.error('❌ Erro no submenu Profissional:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro no menu Profissional.');
      return false;
    }
  }
}