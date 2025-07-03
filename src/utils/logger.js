import { CONFIG } from '../config/config.js';

class Logger {
  constructor() {
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = CONFIG.debug?.logLevel?.toUpperCase() || process.env.LOG_LEVEL || 'INFO';
    this.debugEnabled = CONFIG.debug?.enabled ?? (process.env.DEBUG_ENABLED === 'true' || process.env.NODE_ENV === 'development');
    this.verboseEnabled = CONFIG.debug?.verbose ?? (process.env.DEBUG_VERBOSE === 'true');
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  _serializeContext(context) {
    if (context instanceof Error) {
      return { message: context.message, stack: context.stack };
    }
    return context;
  }

  _formatMessage(level, message, context = null) {
    const timestamp = new Date().toISOString();
    const serialized = context ? ` [${JSON.stringify(this._serializeContext(context))}]` : '';
    return `[${timestamp}] ${level}: ${message}${serialized}`;
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

  // Verbose logging methods - only log when verbose mode is enabled
  verbose(message, context = null) {
    if (this.verboseEnabled && this._shouldLog('DEBUG')) {
      console.log(`🔍 ${this._formatMessage('VERBOSE', message, context)}`);
    }
  }

  // Method to replace console.log with conditional logging based on debug settings
  log(message, context = null, emoji = '🤖') {
    if (this.debugEnabled) {
      const contextStr = context ? ` [${JSON.stringify(this._serializeContext(context))}]` : '';
      const timestamp = new Date().toISOString();
      console.log(`${emoji} [${timestamp}] ${message}${contextStr}`);
    }
  }

  // Method for process flow tracking (verbose)
  flow(step, message, context = null) {
    if (this.verboseEnabled) {
      this.verbose(`STEP[${step}]: ${message}`, context);
    }
  }

  // Method for file operations (verbose)
  file(operation, filename, details = null) {
    if (this.verboseEnabled) {
      this.verbose(`FILE[${operation}]: ${filename}`, details);
    }
  }

  // Method for service operations (verbose)  
  service(serviceName, operation, details = null) {
    if (this.verboseEnabled) {
      this.verbose(`SERVICE[${serviceName}]: ${operation}`, details);
    }
  }

  // Method for API calls (verbose)
  api(method, endpoint, details = null) {
    if (this.verboseEnabled) {
      this.verbose(`API[${method}]: ${endpoint}`, details);
    }
  }

  // Check if debug/verbose is enabled (utility methods)
  isDebugEnabled() {
    return this.debugEnabled;
  }

  isVerboseEnabled() {
    return this.verboseEnabled;
  }
}

const logger = new Logger();
export default logger;
