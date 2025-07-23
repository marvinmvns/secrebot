import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * WhisperSilent API Integration Service
 * Provides integration with WhisperSilent HTTP API for monitoring and control
 */
class WhisperSilentService {
  constructor() {
    this.baseUrl = null;
    this.isConfigured = false;
    this.lastHealthCheck = null;
    this.connectionStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    };
  }

  /**
   * Helper function to format timestamps safely
   */
  formatTimestamp(timestamp) {
    if (!timestamp || isNaN(timestamp)) {
      return '⏰ Data não disponível';
    }
    
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return '⏰ Data inválida';
    }
    
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Helper function to format uptime
   */
  formatUptime(seconds) {
    if (!seconds || isNaN(seconds)) return '0h 0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const successRate = this.connectionStats.totalRequests > 0 
      ? ((this.connectionStats.successfulRequests / this.connectionStats.totalRequests) * 100).toFixed(1)
      : 0;
      
    return {
      total: this.connectionStats.totalRequests,
      successful: this.connectionStats.successfulRequests,
      failed: this.connectionStats.failedRequests,
      successRate: successRate
    };
  }

  /**
   * Configure the WhisperSilent server connection
   * @param {string} ipPort - Server IP and port (e.g., "localhost:8080")
   */
  configure(ipPort) {
    try {
      if (!ipPort || !ipPort.includes(':')) {
        throw new Error('Formato inválido. Use IP:PORTA (ex: localhost:8080)');
      }

      this.baseUrl = `http://${ipPort}`;
      this.isConfigured = true;
      
      logger.info(`WhisperSilent configurado para: ${this.baseUrl}`);
      return { success: true, url: this.baseUrl };
    } catch (error) {
      logger.error('Erro ao configurar WhisperSilent:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if service is configured
   */
  checkConfiguration() {
    if (!this.isConfigured || !this.baseUrl) {
      throw new Error('❌ WhisperSilent não configurado. Use a opção 7.14 para configurar IP:PORTA');
    }
  }

  /**
   * Make HTTP request to WhisperSilent API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method (GET, POST)
   * @param {object} data - Request data for POST requests
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    this.checkConfiguration();

    // Atualizar estatísticas
    this.connectionStats.totalRequests++;

    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        timeout: 15000, // Aumentei para 15s
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (data && method === 'POST') {
        config.data = data;
      }

      const response = await axios(config);
      
      // Sucesso
      this.connectionStats.successfulRequests++;
      
      return { success: true, data: response.data };
    } catch (error) {
      // Falha
      this.connectionStats.failedRequests++;
      
      let errorMessage = 'Erro de conexão';
      
      if (error.response) {
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
        if (error.response.data && error.response.data.error) {
          errorMessage += ` - ${error.response.data.error}`;
        }
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Conexão recusada. Verifique se o servidor está rodando';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Timeout na conexão (15s)';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Servidor não encontrado. Verifique o IP/porta';
      }

      logger.error(`WhisperSilent API Error (${endpoint}):`, error.message);
      return { success: false, error: errorMessage };
    }
  }

  // ==================== HEALTH MONITORING ====================

  /**
   * Basic health check
   */
  async getHealth() {
    const result = await this.makeRequest('/health');
    if (result.success) {
      const data = result.data;
      const summary = data.summary || {};
      this.lastHealthCheck = Date.now();
      
      const connectionStats = this.getConnectionStats();
      
      return {
        success: true,
        message: `🟢 *Status WhisperSilent:* ${data.status || 'unknown'}
⏱️ *Uptime do sistema:* ${this.formatUptime(data.uptime_seconds)}

📊 *Resumo do Sistema:*
• Pipeline: ${summary.pipeline_running ? '✅ Ativo' : '❌ Inativo'}
• Transcrições: ${summary.total_transcriptions || 0}
• CPU: ${summary.cpu_usage || 0}%
• Memória: ${summary.memory_usage || 0}%
• Erros recentes: ${summary.recent_errors_count || 0}
• Taxa de sucesso API: ${summary.api_success_rate || 0}%

🔗 *Conexão (Bot → WhisperSilent):*
• Requisições: ${connectionStats.total} (${connectionStats.successRate}% sucesso)
• URL: ${this.baseUrl}`
      };
    }
    return result;
  }

  /**
   * Detailed health information
   */
  async getHealthDetailed() {
    const result = await this.makeRequest('/health/detailed');
    if (result.success) {
      const data = result.data;
      const systemMetrics = data.system_metrics || {};
      const transcriptionMetrics = data.transcription_metrics || {};
      const componentStatus = data.component_status || {};
      
      return {
        success: true,
        message: `📊 *Status Detalhado do Sistema*

🟢 *Status:* ${data.status || 'unknown'}
⏱️ *Uptime:* ${Math.floor((data.uptime_seconds || 0) / 3600)}h ${Math.floor(((data.uptime_seconds || 0) % 3600) / 60)}m

💻 *Sistema:*
• CPU: ${systemMetrics.cpu_percent || 0}%
• Memória: ${systemMetrics.memory_percent || 0}% (${Math.round(systemMetrics.memory_used_mb || 0)}MB/${Math.round(systemMetrics.memory_total_mb || 0)}MB)
• Disco: ${systemMetrics.disk_usage_percent || 0}%
• Threads: ${systemMetrics.process_threads || 0}

🎤 *Transcrições:*
• Processados: ${transcriptionMetrics.total_chunks_processed || 0}
• Sucessos: ${transcriptionMetrics.successful_transcriptions || 0}
• Falhas: ${transcriptionMetrics.failed_transcriptions || 0}
• Tempo médio: ${Math.round(transcriptionMetrics.average_processing_time_ms || 0)}ms

🔧 *Componentes:*
• Captura de áudio: ${componentStatus.audio_capture_active ? '✅' : '❌'}
• Processador: ${componentStatus.audio_processor_active ? '✅' : '❌'}
• Whisper: ${componentStatus.whisper_service_active ? '✅' : '❌'}
• API: ${componentStatus.api_service_active ? '✅' : '❌'}
• Pipeline: ${componentStatus.pipeline_running ? '✅' : '❌'}`
      };
    }
    return result;
  }

  /**
   * Pipeline status
   */
  async getStatus() {
    const result = await this.makeRequest('/status');
    if (result.success) {
      const data = result.data;
      return {
        success: true,
        message: `📈 *Status do Pipeline*

• Pipeline: ${data.pipeline_running ? '✅ Rodando' : '❌ Parado'}
• Envio API: ${data.api_sending_enabled ? '✅ Ativo' : '❌ Desativo'}
• Uptime: ${Math.floor(data.uptime_seconds / 3600)}h ${Math.floor((data.uptime_seconds % 3600) / 60)}m`
      };
    }
    return result;
  }

  // ==================== TRANSCRIPTIONS MANAGEMENT ====================

  /**
   * List transcriptions
   */
  async getTranscriptions(limit = 10) {
    const result = await this.makeRequest(`/transcriptions?limit=${limit}`);
    if (result.success) {
      const data = result.data;
      let message = `📋 *Últimas ${limit} Transcrições*\n\n`;
      
      if (data.transcriptions && data.transcriptions.length > 0) {
        data.transcriptions.forEach((trans, index) => {
          const timeStr = this.formatTimestamp(trans.timestamp);
          const sent = trans.api_sent ? '✅ Enviado' : '⏳ Pendente';
          const processingTime = trans.processing_time_ms && !isNaN(trans.processing_time_ms) 
            ? `${Math.round(trans.processing_time_ms)}ms` 
            : 'N/A';
          
          // Limitar texto e garantir que existe
          const text = trans.text || '[Texto vazio]';
          const displayText = text.length > 60 
            ? text.substring(0, 60) + '...' 
            : text;
          
          message += `${index + 1}. ${sent}\n`;
          message += `   🕐 ${timeStr}\n`;
          message += `   💬 "${displayText}"\n`;
          message += `   ⚡ Processamento: ${processingTime}\n\n`;
        });
        
        const totalCount = data.total_count || data.transcriptions.length;
        message += `📊 *Total de registros:* ${totalCount}`;
      } else {
        message += '📭 Nenhuma transcrição encontrada';
      }
      
      return { success: true, message };
    }
    return result;
  }

  /**
   * Search transcriptions
   */
  async searchTranscriptions(query) {
    const result = await this.makeRequest(`/transcriptions/search?q=${encodeURIComponent(query)}`);
    if (result.success) {
      const data = result.data;
      let message = `🔍 *Busca por "${query}"*\n\n`;
      
      if (data.transcriptions && data.transcriptions.length > 0) {
        data.transcriptions.forEach((trans, index) => {
          const timeStr = this.formatTimestamp(trans.timestamp);
          const text = trans.text || '[Texto vazio]';
          const displayText = text.length > 100 
            ? text.substring(0, 100) + '...' 
            : text;
          
          message += `${index + 1}. 🕐 *${timeStr}*\n`;
          message += `   💬 "${displayText}"\n\n`;
        });
        
        const totalCount = data.total_count || data.transcriptions.length;
        message += `📊 *Encontradas:* ${totalCount} ocorrências`;
      } else {
        message += '📭 Nenhum resultado encontrado para essa busca';
      }
      
      return { success: true, message };
    }
    return result;
  }

  /**
   * Get transcription statistics
   */
  async getTranscriptionStats() {
    const result = await this.makeRequest('/transcriptions/statistics');
    if (result.success) {
      const data = result.data;
      let message = `📊 *Estatísticas de Transcrições*

📈 *Totais:*
• Registros: ${data.total_records || 0}
• Enviados para API: ${data.sent_to_api || 0}
• Pendentes: ${data.pending_api_send || 0}
• Taxa de envio: ${data.api_send_rate || 0}%

⏱️ *Performance:*
• Tempo médio: ${Math.round(data.average_processing_time_ms || 0)}ms
• Total de caracteres: ${data.total_characters || 0}`;

      if (data.oldest_timestamp && data.newest_timestamp && 
          !isNaN(data.oldest_timestamp) && !isNaN(data.newest_timestamp)) {
        const oldestDate = new Date(data.oldest_timestamp * 1000);
        const newestDate = new Date(data.newest_timestamp * 1000);
        
        if (!isNaN(oldestDate.getTime()) && !isNaN(newestDate.getTime())) {
          message += `

📅 *Período:*
• Mais antigo: ${oldestDate.toLocaleString('pt-BR')}
• Mais recente: ${newestDate.toLocaleString('pt-BR')}`;
        }
      }
      
      return {
        success: true,
        message
      };
    }
    return result;
  }

  // ==================== AGGREGATION MANAGEMENT ====================

  /**
   * Get aggregation status
   */
  async getAggregationStatus() {
    const result = await this.makeRequest('/aggregation/status');
    if (result.success) {
      const data = result.data;
      let message = `📝 *Status da Agregação*

🔧 *Estado:*
• Habilitado: ${data.enabled ? '✅' : '❌'}
• Executando: ${data.running ? '✅' : '❌'}`;

      if (data.current_hour_start) {
        const currentHour = new Date(data.current_hour_start * 1000);
        message += `

📅 *Hora Atual:*
• Início: ${currentHour.toLocaleString('pt-BR')}
• Transcrições: ${data.current_transcription_count || 0}
• Caracteres: ${data.current_partial_length || 0}`;
      }

      message += `

📊 *Estatísticas:*
• Horas agregadas: ${data.total_aggregated_hours || 0}
• Intervalo silêncio: ${data.min_silence_gap_minutes || 0} min
• Última transcrição: ${Math.round(data.minutes_since_last || 0)} min atrás`;
      
      return {
        success: true,
        message
      };
    }
    return result;
  }

  /**
   * Get aggregated texts
   */
  async getAggregatedTexts(limit = 5) {
    const result = await this.makeRequest(`/aggregation/texts?limit=${limit}`);
    if (result.success) {
      const data = result.data;
      let message = `📚 *Textos Agregados (últimos ${limit})*\n\n`;
      
      if (data.aggregated_texts && data.aggregated_texts.length > 0) {
        data.aggregated_texts.forEach((text, index) => {
          // Tratamento seguro do timestamp
          let timeStr = '⏰ Data não disponível';
          if (text.hour_start && !isNaN(text.hour_start)) {
            const date = new Date(text.hour_start * 1000);
            if (!isNaN(date.getTime())) {
              timeStr = date.toLocaleString('pt-BR');
            }
          }
          
          const transcriptionCount = text.transcription_count || 0;
          const textContent = text.text || '[Conteúdo vazio]';
          const displayText = textContent.length > 120 
            ? textContent.substring(0, 120) + '...' 
            : textContent;
          
          message += `${index + 1}. 🕐 *${timeStr}*\n`;
          message += `   📝 ${transcriptionCount} transcrições agregadas\n`;
          message += `   📄 "${displayText}"\n\n`;
        });
      } else {
        message += '📭 Nenhum texto agregado encontrado';
      }
      
      return { success: true, message };
    }
    return result;
  }

  // ==================== SYSTEM CONTROL ====================

  /**
   * Toggle API sending
   */
  async toggleApiSending() {
    const result = await this.makeRequest('/control/toggle-api-sending', 'POST');
    if (result.success) {
      const data = result.data;
      return {
        success: true,
        message: `🔄 *Envio API ${data.api_sending_enabled ? 'Ativado' : 'Desativado'}*

Status: ${data.api_sending_enabled ? '✅ Ligado' : '❌ Desligado'}
${data.message}`
      };
    }
    return result;
  }

  /**
   * Start pipeline
   */
  async startPipeline() {
    const result = await this.makeRequest('/control/start', 'POST');
    if (result.success) {
      return {
        success: true,
        message: '▶️ *Pipeline Iniciado*\n\nO sistema de transcrição está agora ativo.'
      };
    }
    return result;
  }

  /**
   * Stop pipeline
   */
  async stopPipeline() {
    const result = await this.makeRequest('/control/stop', 'POST');
    if (result.success) {
      return {
        success: true,
        message: '⏹️ *Pipeline Parado*\n\nO sistema de transcrição foi interrompido.'
      };
    }
    return result;
  }

  /**
   * Send unsent transcriptions
   */
  async sendUnsentTranscriptions() {
    const result = await this.makeRequest('/transcriptions/send-unsent', 'POST');
    if (result.success) {
      const data = result.data;
      return {
        success: true,
        message: `📤 *Envio de Transcrições Pendentes*

✅ Enviadas: ${data.sent_count}
❌ Falharam: ${data.failed_count}

${data.message}`
      };
    }
    return result;
  }

  /**
   * Export transcriptions data
   */
  async exportData() {
    const result = await this.makeRequest('/transcriptions/export', 'POST');
    if (result.success) {
      const data = result.data;
      return {
        success: true,
        message: `📁 *Dados Exportados*

✅ ${data.message}
📄 Arquivo: ${data.filename}
🕐 ${new Date(data.timestamp * 1000).toLocaleString('pt-BR')}`
      };
    }
    return result;
  }
}

export default WhisperSilentService;