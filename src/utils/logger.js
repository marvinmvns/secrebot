class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  _formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  error(message, context = null) {
    if (this._shouldLog('ERROR')) {
      console.error(`❌ ${this._formatMessage('ERROR', message, context)}`);
    }
  }

  warn(message, context = null) {
    if (this._shouldLog('WARN')) {
      console.warn(`⚠️ ${this._formatMessage('WARN', message, context)}`);
    }
  }

  info(message, context = null) {
    if (this._shouldLog('INFO')) {
      console.log(`ℹ️ ${this._formatMessage('INFO', message, context)}`);
    }
  }

  debug(message, context = null) {
    if (this._shouldLog('DEBUG')) {
      console.log(`🐛 ${this._formatMessage('DEBUG', message, context)}`);
    }
  }

  startup(message) {
    console.log(`🚀 ${message}`);
  }

  success(message) {
    console.log(`✅ ${message}`);
  }

  banner(title, version = '') {
    const versionStr = version ? ` - ${version}` : '';
    console.log(`
╔═══════════════════════════════════════╗
║     🤖 ${title}${versionStr.padEnd(18 - title.length)}║
╚═══════════════════════════════════════╝`);
  }
}

const logger = new Logger();
export default logger;