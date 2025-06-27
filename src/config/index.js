import path from 'path';
import { fileURLToPath } from 'url';

// Re-export from new modular structure
export { CONFIG, applyConfig } from './config.js';
export { CONFIG_DESCRIPTIONS, CONFIG_ENV_MAP } from './metadata.js';
export { COMMANDS, NUMERIC_SHORTCUTS, CHAT_MODES } from '../constants/commands.js';
export { MENU_MESSAGE, MODE_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES, PROMPTS } from '../constants/messages.js';

// Keep __dirname for backwards compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export { __dirname };
