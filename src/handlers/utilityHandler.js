import logger from '../utils/logger.js';

export default class UtilityHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  // Validation methods
  isValidLinkedInUrl(url) {
    const linkedinRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w\-\.]+\/?$/i;
    return linkedinRegex.test(url);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  isValidYouTubeUrl(url) {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/\S+\/|(?:v|e(?:mbed)?)\/)|\S*?[?&]v=)|youtu\.be\/([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
  }

  extractVideoId(url) {
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/\S+\/|(?:v|e(?:mbed)?)\/)|\S*?[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);
    return match ? match[1] : null;
  }

  isValidPhoneNumber(phone) {
    // Basic phone validation - can be enhanced
    const phoneRegex = /^\+?[\d\s\-\(\)]{8,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  // Text processing utilities
  sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\-\.\,\!\?\:\;\(\)]/g, '') // Remove special characters except basic punctuation
      .substring(0, 2000); // Limit length
  }

  extractMentions(text) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }

  extractHashtags(text) {
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;
    
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1]);
    }
    
    return hashtags;
  }

  extractUrls(text) {
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    return text.match(urlRegex) || [];
  }

  truncateText(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    
    return text.substring(0, maxLength - suffix.length).trim() + suffix;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  formatNumber(number) {
    return new Intl.NumberFormat('pt-BR').format(number);
  }

  formatCurrency(amount, currency = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Date and time utilities
  formatDate(date, locale = 'pt-BR') {
    if (!date) return 'N/A';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString(locale);
  }

  formatDateTime(date, locale = 'pt-BR') {
    if (!date) return 'N/A';
    
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleString(locale);
  }

  formatTimeAgo(date) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diffMs = now - dateObj;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} dia${diffDays > 1 ? 's' : ''} atrás`;
    } else if (diffHours > 0) {
      return `${diffHours} hora${diffHours > 1 ? 's' : ''} atrás`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''} atrás`;
    } else {
      return 'agora mesmo';
    }
  }

  parseDate(dateString) {
    // Parse various date formats
    const formats = [
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,      // DD/MM/YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/,        // YYYY-MM-DD
      /(\d{1,2})-(\d{1,2})-(\d{4})/,        // DD-MM-YYYY
    ];
    
    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        // Adjust based on format
        if (format === formats[0] || format === formats[2]) {
          // DD/MM/YYYY or DD-MM-YYYY
          return new Date(`${match[3]}-${match[2]}-${match[1]}`);
        } else {
          // YYYY-MM-DD
          return new Date(`${match[1]}-${match[2]}-${match[3]}`);
        }
      }
    }
    
    // Fallback to Date constructor
    return new Date(dateString);
  }

  // Schedule data validation
  validateScheduleData(data) {
    const errors = [];
    
    if (!data) {
      errors.push('Dados do agendamento são obrigatórios.');
      return { valid: false, errors };
    }
    
    if (!data.message || data.message.trim().length === 0) {
      errors.push('Mensagem do agendamento é obrigatória.');
    }
    
    if (!data.scheduledTime || isNaN(data.scheduledTime.getTime())) {
      errors.push('Data/Hora agendada (scheduledTime) é inválida.');
    }
    
    if (data.scheduledTime && data.scheduledTime <= new Date()) {
      errors.push('Data/Hora agendada deve ser no futuro.');
    }
    
    if (data.expiryTime && data.expiryTime <= new Date()) {
      errors.push('Data/Hora de expiração deve ser no futuro.');
    }
    
    if (data.scheduledTime && data.expiryTime && data.scheduledTime >= data.expiryTime) {
      errors.push('Data/Hora de expiração deve ser posterior à data agendada.');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  // File processing utilities
  getFileExtension(filename) {
    if (!filename) return '';
    return filename.split('.').pop().toLowerCase();
  }

  isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = this.getFileExtension(filename);
    return imageExtensions.includes(extension);
  }

  isAudioFile(filename) {
    const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus'];
    const extension = this.getFileExtension(filename);
    return audioExtensions.includes(extension);
  }

  isVideoFile(filename) {
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'];
    const extension = this.getFileExtension(filename);
    return videoExtensions.includes(extension);
  }

  isDocumentFile(filename) {
    const documentExtensions = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];
    const extension = this.getFileExtension(filename);
    return documentExtensions.includes(extension);
  }

  // Error handling utilities
  formatError(error) {
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && error.message) {
      return error.message;
    }
    
    return 'Erro desconhecido';
  }

  isNetworkError(error) {
    const networkErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EHOSTUNREACH'
    ];
    
    return networkErrors.some(code => 
      error.message?.includes(code) || error.code === code
    );
  }

  // Rate limiting utilities
  shouldRetryVideoProcessing(error) {
    // Determine if video processing should be retried
    if (!error) return false;
    
    const retryableErrors = [
      'timeout',
      'network',
      'temporary',
      'rate limit',
      'server error'
    ];
    
    const errorMessage = this.formatError(error).toLowerCase();
    
    return retryableErrors.some(retryError => 
      errorMessage.includes(retryError)
    );
  }

  // Contact ID utilities
  isValidContactId(contactId) {
    return typeof contactId === 'string' && contactId.length > 0;
  }

  formatContactId(contactId) {
    if (!contactId) return 'unknown';
    
    // Remove common WhatsApp suffixes and format
    return contactId
      .replace('@c.us', '')
      .replace('@g.us', '')
      .replace(/[^\w]/g, '_');
  }

  // Message formatting utilities
  escapeMarkdown(text) {
    if (!text) return '';
    
    const markdownChars = ['*', '_', '~', '`', '\\'];
    let escaped = text;
    
    markdownChars.forEach(char => {
      escaped = escaped.replace(new RegExp('\\' + char, 'g'), '\\' + char);
    });
    
    return escaped;
  }

  createProgressBar(current, total, length = 20) {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * length);
    const empty = length - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    return `${bar} ${percentage}%`;
  }

  // Configuration utilities
  parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'on', 'enabled'].includes(value.toLowerCase());
    }
    return false;
  }

  parseNumber(value, defaultValue = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // Security utilities
  sanitizeFilename(filename) {
    if (!filename) return 'file';
    
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename characters
      .replace(/^\.+/, '')           // Remove leading dots
      .substring(0, 255);            // Limit length
  }

  maskSensitiveData(data) {
    if (typeof data === 'string') {
      // Mask email addresses
      data = data.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 
        (match, username, domain) => {
          const maskedUsername = username.length > 2 
            ? username.substring(0, 2) + '*'.repeat(username.length - 2)
            : username;
          return `${maskedUsername}@${domain}`;
        });
      
      // Mask phone numbers
      data = data.replace(/(\+\d{1,3})\d{6,}/g, 
        (match, prefix) => prefix + '*'.repeat(match.length - prefix.length));
    }
    
    return data;
  }

  // Logging utilities  
  logUserAction(contactId, action, details = {}) {
    logger.info(`👤 User Action - ${contactId}: ${action}`, {
      contactId: this.formatContactId(contactId),
      action,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logSystemEvent(event, details = {}) {
    logger.info(`🔧 System Event: ${event}`, {
      event,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  logError(error, context = {}) {
    logger.error('❌ Error occurred:', {
      error: this.formatError(error),
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...context
    });
  }
}