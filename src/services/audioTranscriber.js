import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { nodewhisper } from 'nodejs-whisper';
import ffmpeg from 'fluent-ffmpeg';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, __dirname, getDynamicConfig } from '../config/index.js'; // Ajustar caminho se necessário
import JobQueue from './jobQueue.js';
import logger from '../utils/logger.js';
import WhisperAPIPool from './whisperApiPool.js';
import { getMetricsService } from './metricsService.js';

// ============ Transcritor de Áudio ============
class AudioTranscriber {
  constructor(configService = null, llmService = null) {
    this.configService = configService;
    this.llmService = llmService;
    this.queue = new JobQueue(
      CONFIG.queues.whisperConcurrency,
      CONFIG.queues.memoryThresholdGB
    );
    this.whisperApiPool = new WhisperAPIPool(configService);
    this.realtimeSessions = new Map(); // Stores active real-time transcription sessions
    this.metricsService = getMetricsService();
  }

  startRealtimeTranscription() {
    const sessionId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.realtimeSessions.set(sessionId, { 
      audioBuffer: Buffer.alloc(0), 
      lastTranscription: '',
      lastChunkTime: Date.now()
    });
    logger.info(`🎤 Real-time transcription session started: ${sessionId}`);
    return sessionId;
  }

  async processRealtimeChunk(sessionId, audioChunk, isLastChunk = false) {
    const session = this.realtimeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Real-time session ${sessionId} not found.`);
    }

    if (audioChunk.length === 0) {
      logger.warn(`⚠️ Received empty audio chunk for session ${sessionId}. Skipping processing.`);
      return session.lastTranscription; // Return last known transcription
    }

    session.audioBuffer = Buffer.concat([session.audioBuffer, audioChunk]);
    session.lastChunkTime = Date.now();

    let currentTranscription = '';

    if (isLastChunk) {
      logger.info(`🎤 Finalizing real-time transcription for session ${sessionId}. Total buffer size: ${session.audioBuffer.length} bytes.`);
      currentTranscription = await this.transcribe(session.audioBuffer, 'ogg'); // Assuming ogg for now
      this.realtimeSessions.delete(sessionId);
      logger.info(`🎤 Real-time transcription session ${sessionId} ended.`);
    } else {
      // For real-time feedback, transcribe the entire accumulated buffer
      logger.debug(`🎤 Processing real-time chunk for session ${sessionId}. Accumulated buffer size: ${session.audioBuffer.length} bytes.`);
      try {
        currentTranscription = await this.transcribe(session.audioBuffer, 'ogg'); 
      } catch (error) {
        logger.warn(`⚠️ Error transcribing real-time chunk for session ${sessionId}: ${error.message}`);
        currentTranscription = session.lastTranscription; 
      }
    }
    session.lastTranscription = currentTranscription;
    return currentTranscription;
  }

  // Existing methods follow...

  // ... (rest of the class methods) ...

  async getEffectiveWhisperOptions() {
    let mongoConfig = null;
    if (this.configService) {
      try {
        mongoConfig = await this.configService.getConfig();
      } catch (error) {
        logger.warn('⚠️ Erro ao obter configuração do MongoDB para whisperOptions, usando configuração padrão:', error.message);
      }
    }
    
    if (mongoConfig?.whisperApi?.whisperOptions) {
      return { ...CONFIG.whisperApi.whisperOptions, ...mongoConfig.whisperApi.whisperOptions };
    }
    
    return CONFIG.whisperApi.whisperOptions;
  }

  async transcribeWithAutoDownload(filePath, modelName = CONFIG.audio.model) {
    try {
      logger.debug(`🔄 Iniciando transcrição com auto-download do modelo: ${modelName}`);
      
      // Get effective whisperOptions (merged from config and MongoDB)
      const whisperOptions = await this.getEffectiveWhisperOptions();
      
      const options = {
        modelName: modelName,
        autoDownloadModelName: modelName,
        verbose: true,
        removeWavFileAfterTranscription: false,
        withCuda: false,
        whisperOptions: { 
          ...whisperOptions,
          language: CONFIG.audio.language 
        },
        logger: logger
      };

      logger.debug('🚀 Executando nodejs-whisper com auto-download...');
      const transcription = await nodewhisper(filePath, options);
      
      logger.success(`✅ Transcrição concluída com auto-download. Modelo: ${modelName}`);
      return transcription.trim();
      
    } catch (error) {
      logger.error(`❌ Erro na transcrição com auto-download:`, error);
      throw new Error(`Falha na transcrição com auto-download: ${error.message}`);
    }
  }

  async runWhisper(filePath, options) {
    const execPath = path.join(WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH);
    const modelFile = MODEL_OBJECT[options.modelName];
    const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
    
    // Build args with whisperOptions
    const args = ['-m', modelPath, '-f', filePath, '-l', options.whisperOptions.language];
    
    // Add output format options
    if (options.whisperOptions.outputInText) args.push('-otxt');
    if (options.whisperOptions.outputInSrt) args.push('-osrt');
    if (options.whisperOptions.outputInVtt) args.push('-ovtt');
    if (options.whisperOptions.outputInLrc) args.push('-olrc');
    if (options.whisperOptions.outputInWords) args.push('-owts');
    if (options.whisperOptions.outputInCsv) args.push('-ocsv');
    if (options.whisperOptions.outputInJson) args.push('-oj');
    if (options.whisperOptions.outputInJsonFull) args.push('-of');
    
    // Add other options
    if (options.whisperOptions.translateToEnglish) args.push('--translate');
    if (options.whisperOptions.splitOnWord) args.push('--split-on-word');
    if (options.whisperOptions.timestamps_length) {
      args.push('--length');
      args.push(String(options.whisperOptions.timestamps_length));
    }

    // Log detalhado para debug
    logger.debug('🔧 Whisper Debug Info:', {
      execPath,
      modelFile,
      modelPath,
      filePath,
      args: args.join(' '),
      cwd: WHISPER_CPP_PATH,
      timeout: CONFIG.audio.timeoutMs
    });

    // Verificar se o executável existe
    try {
      await fs.access(execPath, fs.constants.F_OK | fs.constants.X_OK);
      logger.debug(`✅ Executável Whisper encontrado: ${execPath}`);
    } catch (error) {
      logger.error(`❌ Executável Whisper não encontrado ou não executável: ${execPath}`);
      throw new Error(`Whisper executable not found or not executable: ${execPath}`);
    }

    return new Promise((resolve, reject) => {
      logger.debug(`🚀 Iniciando processo Whisper: ${execPath} ${args.join(' ')}`);
      
      const proc = spawn(execPath, args, { 
        cwd: WHISPER_CPP_PATH,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      const timer = setTimeout(() => {
        logger.error('⏰ Whisper process timeout após', CONFIG.audio.timeoutMs, 'ms');
        proc.kill('SIGKILL');
        reject(new Error(`Whisper process timed out after ${CONFIG.audio.timeoutMs}ms`));
      }, CONFIG.audio.timeoutMs);

      proc.stdout.on('data', d => {
        const data = d.toString();
        stdout += data;
        if (options.verbose) {
          logger.debug('📤 Whisper STDOUT:', data.trim());
        }
      });

      proc.stderr.on('data', d => {
        const data = d.toString();
        stderr += data;
        logger.debug('📥 Whisper STDERR:', data.trim());
      });

      proc.on('error', err => {
        clearTimeout(timer);
        logger.error('❌ Whisper process error:', err);
        reject(err);
      });

      proc.on('close', code => {
        clearTimeout(timer);
        logger.debug(`🏁 Whisper process finished with code: ${code}`);
        
        if (stdout) logger.debug('📤 Final STDOUT:', stdout.trim());
        if (stderr) logger.debug('📥 Final STDERR:', stderr.trim());
        
        if (code === 0) {
          logger.debug('✅ Whisper process completed successfully');
          resolve();
        } else {
          const errorMsg = stderr || `Whisper exited with code ${code}`;
          logger.error('❌ Whisper process failed:', errorMsg);
          reject(new Error(errorMsg));
        }
      });
    });
  }

  async getEffectiveConfig() {
    let mongoConfig = null;
    if (this.configService) {
      try {
        mongoConfig = await this.configService.getConfig();
      } catch (error) {
        logger.warn('⚠️ Erro ao obter configuração do MongoDB, usando configuração padrão:', error.message);
      }
    }
    return getDynamicConfig(mongoConfig);
  }

  async transcribe(audioBuffer, inputFormat = 'ogg', userId = 'unknown') {
    return this.queue.add(async () => {
      const startTime = Date.now();
      const audioSize = audioBuffer.length;
      
      logger.service('🎤 Iniciando transcrição de áudio...');
      
      // Obter configuração efetiva (MongoDB tem prioridade)
      const effectiveConfig = await this.getEffectiveConfig();
      
      logger.verbose(`📊 Audio buffer details:`, {
        size: audioBuffer.length,
        format: inputFormat,
        sizeInMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
        timestamp: new Date().toISOString(),
        mode: effectiveConfig.whisperApi.mode,
        enabled: effectiveConfig.whisperApi.enabled
      });

      try {
        let result;
        let mode, endpoint;

        // Verifica se deve usar API ou modo local usando configuração efetiva
        if (effectiveConfig.whisperApi.mode === 'api' && effectiveConfig.whisperApi.enabled && await this.whisperApiPool.isEnabled() && this.whisperApiPool.hasHealthyEndpoints()) {
          logger.info('🌐 Usando modo API para transcrição (configuração do MongoDB)');
          mode = 'api';
          endpoint = 'api_pool';
          result = await this.transcribeViaAPI(audioBuffer, inputFormat);
        } else {
          logger.info('🏠 Usando modo local para transcrição');
          mode = 'local';
          endpoint = 'local';
          result = await this.transcribeLocally(audioBuffer, inputFormat);
        }

        // Record metrics for successful transcription
        const duration = (Date.now() - startTime) / 1000;
        
        if (this.metricsService.enabled) {
          this.metricsService.recordWhisperRequest(
            userId,
            mode,
            endpoint,
            'success',
            duration,
            audioSize
          );
        }

        return result;
      } catch (error) {
        // Record metrics for failed transcription
        const duration = (Date.now() - startTime) / 1000;
        const mode = effectiveConfig.whisperApi.mode === 'api' ? 'api' : 'local';
        const endpoint = mode === 'api' ? 'api_pool' : 'local';
        
        if (this.metricsService.enabled) {
          this.metricsService.recordWhisperRequest(
            userId,
            mode,
            endpoint,
            'error',
            duration,
            audioSize
          );
          this.metricsService.recordError('whisper_transcription_error', 'whisper_service', userId);
        }

        throw error;
      }
    });
  }

  async transcribeWithEndpointInfo(audioBuffer, inputFormat = 'ogg') {
    return this.queue.add(async () => {
      logger.service('🎤 Iniciando transcrição de áudio com informações de endpoint...');
      
      // Obter configuração efetiva (MongoDB tem prioridade)
      const effectiveConfig = await this.getEffectiveConfig();
      
      logger.verbose(`📊 Audio buffer details:`, {
        size: audioBuffer.length,
        format: inputFormat,
        sizeInMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
        timestamp: new Date().toISOString(),
        mode: effectiveConfig.whisperApi.mode,
        enabled: effectiveConfig.whisperApi.enabled
      });

      // Verifica se deve usar API ou modo local usando configuração efetiva
      if (effectiveConfig.whisperApi.mode === 'api' && effectiveConfig.whisperApi.enabled && await this.whisperApiPool.isEnabled() && this.whisperApiPool.hasHealthyEndpoints()) {
        logger.info('🌐 Usando modo API para transcrição (configuração do MongoDB)');
        return await this.transcribeViaAPIWithEndpointInfo(audioBuffer, inputFormat);
      }
      
      logger.info('🏠 Usando modo local para transcrição');
      const transcription = await this.transcribeLocally(audioBuffer, inputFormat);
      return {
        transcription,
        endpoint: {
          type: 'local',
          url: 'Whisper Local (CPU)',
          mode: 'local'
        }
      };
    });
  }

  /**
   * Remove timestamp lines from Whisper transcription output
   * @param {string} text - The text containing timestamps
   * @returns {string} The cleaned text without timestamp lines
   */
  removeTimestampsFromText(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    // Pattern to match timestamp lines: [HH:MM:SS.mmm] -> [HH:MM:SS.mmm]
    const timestampPattern = /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3,4}\]\s*->\s*\[\d{2}:\d{2}:\d{2}\.\d{3,4}\]\s*$/gm;
    
    // Split text into lines, filter out timestamp lines, and rejoin
    const lines = text.split('\n');
    const cleanedLines = lines.filter(line => !timestampPattern.test(line));
    
    return cleanedLines.join('\n').trim();
  }

  async transcribeViaAPI(audioBuffer, inputFormat = 'ogg') {
    try {
      const timestamp = Date.now();
      const filename = `audio_${timestamp}.${inputFormat}`;
      
      logger.debug(`🌐 Iniciando transcrição via API para arquivo: ${filename}`);
      
      // Get effective whisperOptions for API transcription
      const whisperOptions = await this.getEffectiveWhisperOptions();
      
      const options = {
        language: CONFIG.audio.language,
        cleanup: true,
        ...whisperOptions
      };

      let transcription = await this.whisperApiPool.transcribe(audioBuffer, filename, options);
      
      // Remove timestamps if the option is enabled
      if (options.removeTimestamps) {
        logger.debug('🧹 Removendo timestamps da transcrição...');
        transcription = this.removeTimestampsFromText(transcription);
      }
      
      logger.success('✅ Transcrição via API concluída com sucesso');
      return transcription;
      
    } catch (error) {
      logger.error('❌ Erro na transcrição via API:', error);
      
      // Always try local fallback when API fails, regardless of mode
      logger.warn('🔄 Todos os endpoints API falharam, tentando modo local como fallback...');
      try {
        return await this.transcribeLocally(audioBuffer, inputFormat);
      } catch (localError) {
        logger.error('❌ Fallback local também falhou:', localError.message);
        throw new Error(`API transcription failed: ${error.message}. Local fallback failed: ${localError.message}`);
      }
    }
  }

  async transcribeViaAPIWithEndpointInfo(audioBuffer, inputFormat = 'ogg') {
    try {
      const timestamp = Date.now();
      const filename = `audio_${timestamp}.${inputFormat}`;
      
      logger.debug(`🌐 Iniciando transcrição via API para arquivo: ${filename}`);
      
      // Get effective whisperOptions for API transcription
      const whisperOptions = await this.getEffectiveWhisperOptions();
      
      const options = {
        language: CONFIG.audio.language,
        cleanup: true,
        ...whisperOptions
      };

      // Use the load balancing method that returns endpoint info
      const result = await this.whisperApiPool.transcribeWithLoadBalancing(audioBuffer, filename, options);
      
      // Handle different possible response structures
      let transcription;
      if (result.result && result.result.result && result.result.result.text) {
        // New API structure: result.result.result.text
        transcription = result.result.result.text;
      } else if (result.result && result.result.text) {
        // Previous structure: result.result.text
        transcription = result.result.text;
      } else if (result.result && typeof result.result === 'string') {
        // String result: result.result
        transcription = result.result;
      } else if (result.text) {
        // Direct text: result.text
        transcription = result.text;
      } else if (typeof result.result === 'object' && result.result.transcription) {
        // Alternative structure: result.result.transcription
        transcription = result.result.transcription;
      } else {
        logger.error('❌ Estrutura de resposta inesperada:', result);
        throw new Error('Estrutura de resposta da API inesperada');
      }
      
      // Remove timestamps if the option is enabled
      if (options.removeTimestamps) {
        logger.debug('🧹 Removendo timestamps da transcrição...');
        transcription = this.removeTimestampsFromText(transcription);
      }
      
      logger.success('✅ Transcrição via API concluída com sucesso');
      
      return {
        transcription,
        endpoint: {
          type: 'api',
          url: result.endpoint,
          mode: 'api',
          duration: result.duration
        }
      };
      
    } catch (error) {
      logger.error('❌ Erro na transcrição via API:', error);
      
      // Always try local fallback when API fails, regardless of mode
      logger.warn('🔄 Todos os endpoints API falharam, tentando modo local como fallback...');
      try {
        const transcription = await this.transcribeLocally(audioBuffer, inputFormat);
        return {
          transcription,
          endpoint: {
            type: 'local',
            url: 'Whisper Local (CPU) - Fallback após falha na API',
            mode: 'local-fallback'
          }
        };
      } catch (localError) {
        logger.error('❌ Fallback local também falhou:', localError.message);
        throw new Error(`API transcription failed: ${error.message}. Local fallback failed: ${localError.message}`);
      }
    }
  }

  async transcribeLocally(audioBuffer, inputFormat = 'ogg') {
    const timestamp = Date.now();
    const tempOutputPath = path.join(__dirname, `audio_${timestamp}.wav`);
    logger.verbose(`📁 Arquivo temporário: ${tempOutputPath}`);

    try {
      // Verifica se o modelo está disponível
      const modelFile = MODEL_OBJECT[CONFIG.audio.model];
      const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
      logger.verbose(`🔍 Verificando modelo Whisper:`, {
        model: CONFIG.audio.model,
        modelFile,
        modelPath,
        language: CONFIG.audio.language
      });
      
      try {
        await fs.access(modelPath);
        logger.verbose(`✅ Modelo Whisper encontrado e acessível: ${modelPath}`);
      } catch (error) {
        logger.warn(`⚠️ Modelo Whisper não encontrado: ${modelPath}`);
        logger.info(`🔄 Tentando baixar automaticamente o modelo '${CONFIG.audio.model}'...`);
        
        try {
          const transcription = await this.transcribeWithAutoDownload(tempOutputPath, CONFIG.audio.model);
          logger.success(`✅ Transcrição concluída com download automático do modelo`);
          
          // Limpa arquivos temporários
          await Utils.cleanupFile(tempOutputPath);
          
          return transcription;
        } catch (autoDownloadError) {
          logger.error(`❌ Falha no download automático do modelo:`, autoDownloadError);
          throw new Error(`Modelo Whisper '${CONFIG.audio.model}' não encontrado em ${modelPath} e falha no download automático: ${autoDownloadError.message}`);
        }
      }

      logger.verbose(`🔄 Iniciando conversão de áudio com FFMPEG:`, {
        inputFormat,
        outputFormat: 'wav',
        sampleRate: CONFIG.audio.sampleRate,
        outputPath: tempOutputPath
      });

      await new Promise((resolve, reject) => {
        const inputStream = Readable.from(audioBuffer);
        const ffmpegCommand = ffmpeg(inputStream)
          .inputFormat(inputFormat)
          .outputOptions(`-ar ${CONFIG.audio.sampleRate}`)
          .toFormat('wav')
          .on('start', (commandLine) => {
            logger.verbose(`🚀 FFMPEG comando: ${commandLine}`);
          })
          .on('progress', (progress) => {
            logger.verbose(`⏳ FFMPEG progresso: ${progress.percent}%`);
          })
          .on('error', (err) => {
            logger.error('❌ Erro no FFMPEG:', err);
            reject(err);
          })
          .on('end', () => {
            logger.verbose('✅ Conversão FFMPEG concluída');
            resolve();
          })
          .save(tempOutputPath);
      });
        
      const options = {
        modelName: CONFIG.audio.model,
        autoDownloadModelName: CONFIG.audio.model,
        verbose: true,
        removeWavFileAfterTranscription: false,
        withCuda: false,
        whisperOptions: { 
          outputInText: true, 
          language: CONFIG.audio.language 
        }
      };
      
      logger.verbose(`🎙️ Iniciando transcrição Whisper:`, {
        model: options.modelName,
        language: options.whisperOptions.language,
        inputFile: tempOutputPath,
        timeout: CONFIG.audio.timeoutMs
      });
      
      // Executa o Whisper com controle de timeout
      const whisperStartTime = Date.now();
      await this.runWhisper(tempOutputPath, options);
      const whisperEndTime = Date.now();
      
      logger.verbose(`⏱️ Transcrição Whisper concluída em ${whisperEndTime - whisperStartTime}ms`);
      
      const transcriptionPath = `${tempOutputPath}.txt`;
      logger.verbose(`📄 Lendo transcrição de: ${transcriptionPath}`);
      
      const transcription = await fs.readFile(transcriptionPath, 'utf8');
      logger.verbose(`📝 Transcrição obtida:`, {
        length: transcription.length,
        preview: transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''),
        wordCount: transcription.split(' ').length
      });
      
      // Usa o método estático de Utils para limpar arquivos
      logger.verbose(`🧹 Limpando arquivos temporários...`);
      await Utils.cleanupFile(tempOutputPath);
      await Utils.cleanupFile(transcriptionPath);
      logger.verbose(`✅ Arquivos temporários removidos`);
      
      const finalTranscription = transcription.trim();
      logger.success(`✅ Transcrição local concluída. Resultado: ${finalTranscription.length} caracteres, ${finalTranscription.split(' ').length} palavras`);
      return finalTranscription;
      
    } catch (err) {
      logger.error('❌ Erro na transcrição local de áudio:', err);
      // Tenta limpar o arquivo temporário mesmo em caso de erro
      await Utils.cleanupFile(tempOutputPath);
      throw err;
    }
  }

  async transcribeAndSummarize(audioBuffer, inputFormat = 'ogg', userId = 'unknown') {
    const startTime = Date.now();
    const audioSize = audioBuffer.length;
    
    try {
      logger.service('🎤 Iniciando transcrição e resumo de áudio...');
      
      const transcription = await this.transcribe(audioBuffer, inputFormat, userId);
      
      logger.service('🧠 Gerando resumo com LLM...');
      const summaryPrompt = `Analise a seguinte transcrição de áudio e crie um resumo estruturado e claro:

TRANSCRIÇÃO:
"${transcription}"

O resumo deve incluir os principais pontos discutidos, eventos importantes e qualquer informação relevante mencionada. Evite detalhes excessivos e mantenha o foco nos aspectos mais significativos da conversa. O resumo deve ser escrito em português e ser facilmente compreensível.
Mantenha o resumo conciso mas informativo, destacando os pontos mais importantes do áudio.`;

      let summary;
      if (this.llmService) {
        summary = await this.llmService.generateText(summaryPrompt);
      } else {
        // Fallback to direct Ollama call if LLMService is not available
        const { Ollama } = await import('ollama');
        const ollamaClient = new Ollama({ host: CONFIG.llm.host });
        const response = await ollamaClient.generate({
          model: CONFIG.llm.model,
          prompt: summaryPrompt,
          stream: false
        });
        summary = response.response;
      }

      logger.success('✅ Transcrição e resumo concluídos.');
      
      const summaryText = typeof summary === 'string' ? summary : summary.response;
      
      // Record metrics for successful transcription and summarization
      const duration = (Date.now() - startTime) / 1000;
      const effectiveConfig = await this.getEffectiveConfig();
      const mode = effectiveConfig.whisperApi.mode === 'api' ? 'api' : 'local';
      const endpoint = mode === 'api' ? 'api_pool' : 'local';
      
      if (this.metricsService.enabled) {
        this.metricsService.recordWhisperRequest(
          userId,
          mode,
          endpoint,
          'success',
          duration,
          audioSize
        );
      }
      
      return {
        transcription: transcription,
        summary: summaryText,
        combined: `🎤 **TRANSCRIÇÃO COMPLETA:**\n\n${transcription}\n\n---\n\n${summaryText}`
      };
      
    } catch (err) {
      // Record metrics for failed transcription and summarization
      const duration = (Date.now() - startTime) / 1000;
      const effectiveConfig = await this.getEffectiveConfig();
      const mode = effectiveConfig.whisperApi.mode === 'api' ? 'api' : 'local';
      const endpoint = mode === 'api' ? 'api_pool' : 'local';
      
      if (this.metricsService.enabled) {
        this.metricsService.recordWhisperRequest(
          userId,
          mode,
          endpoint,
          'error',
          duration,
          audioSize
        );
        this.metricsService.recordError('whisper_transcribe_summarize_error', 'whisper_service', userId);
      }
      
      logger.error('❌ Erro na transcrição e resumo de áudio:', err);
      throw err;
    }
  }

  async getWhisperApiStatus() {
    const effectiveConfig = await this.getEffectiveConfig();
    const isEnabled = await this.whisperApiPool.isEnabled();

    if (!isEnabled) {
      return {
        available: false,
        mode: effectiveConfig.whisperApi.mode,
        message: 'Whisper API não está habilitado na configuração.',
        clients: []
      };
    }

    try {
      const poolStatus = await this.whisperApiPool.getPoolStatus();
      
      // O frontend espera uma propriedade `clients`
      return {
        available: true,
        mode: effectiveConfig.whisperApi.mode,
        clients: poolStatus.endpoints || [], // Mapeia endpoints para clients
        healthy: poolStatus.healthyEndpoints > 0,
        stats: {
          total: poolStatus.totalEndpoints,
          healthy: poolStatus.healthyEndpoints,
          unhealthy: poolStatus.totalEndpoints - poolStatus.healthyEndpoints
        }
      };
    } catch (error) {
      logger.error('Erro ao obter status do Whisper API Pool:', error);
      return {
        available: true, // Still enabled, but in error state
        mode: effectiveConfig.whisperApi.mode,
        error: error.message,
        clients: [],
        healthy: false
      };
    }
  }

  async getMode() {
    const effectiveConfig = await this.getEffectiveConfig();
    if (effectiveConfig.whisperApi.mode === 'api' && await this.whisperApiPool.isEnabled() && this.whisperApiPool.hasHealthyEndpoints()) {
      return 'api';
    }
    return 'local';
  }

  async onConfigurationChanged() {
    logger.info('🔄 Configuração alterada, reinicializando WhisperAPIPool...');
    await this.whisperApiPool.reinitialize();
  }

  destroy() {
    logger.info('🗑️ Destruindo AudioTranscriber...');
    this.whisperApiPool.destroy();
  }
}

export default AudioTranscriber;
