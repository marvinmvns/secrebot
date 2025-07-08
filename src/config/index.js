import path from 'path';
import { fileURLToPath } from 'url';

// Re-export from new modular structure
export { config as CONFIG, applyConfig } from './config.js';
export { CONFIG_DESCRIPTIONS, CONFIG_ENV_MAP, CONFIG_EXAMPLES } from './metadata.js';
export { COMMANDS, NUMERIC_SHORTCUTS, CHAT_MODES, NAVIGATION_STATES, WHISPER_MODELS_LIST } from '../constants/commands.js';
export { MENU_MESSAGE, SUBMENU_MESSAGES, MODE_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES, HELP_GUIDE, PROMPTS } from '../constants/messages.js';

// Keep __dirname for backwards compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export { __dirname };
