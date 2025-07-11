import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
import { nodewhisper } from 'nodejs-whisper';
import ffmpeg from 'fluent-ffmpeg';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, __dirname } from '../config/index.js'; // Ajustar caminho se necessário
import JobQueue from './jobQueue.js';
import logger from '../utils/logger.js';
import { Ollama } from 'ollama';

// ============ Transcritor de Áudio ============
class AudioTranscriber {
  constructor() {
    this.queue = new JobQueue(
      CONFIG.queues.whisperConcurrency,
      CONFIG.queues.memoryThresholdGB
    );
    this.ollamaClient = new Ollama({ host: CONFIG.llm.host });
  }

  async transcribeWithAutoDownload(filePath, modelName = CONFIG.audio.model) {
    try {
      logger.debug(`🔄 Iniciando transcrição com auto-download do modelo: ${modelName}`);
      
      const options = {
        modelName: modelName,
        autoDownloadModelName: modelName,
        verbose: true,
        removeWavFileAfterTranscription: false,
        withCuda: false,
        whisperOptions: { 
          outputInText: true, 
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
    const args = ['-m', modelPath, '-f', filePath, '-otxt', '-l', options.whisperOptions.language];

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

  async transcribe(audioBuffer, inputFormat = 'ogg') {
    return this.queue.add(async () => {
      logger.service('🎤 Iniciando transcrição de áudio...');
      logger.verbose(`📊 Audio buffer details:`, {
        size: audioBuffer.length,
        format: inputFormat,
        sizeInMB: (audioBuffer.length / 1024 / 1024).toFixed(2),
        timestamp: new Date().toISOString()
      });
      
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
        logger.success(`✅ Transcrição concluída. Resultado: ${finalTranscription.length} caracteres, ${finalTranscription.split(' ').length} palavras`);
        return finalTranscription;
        
      } catch (err) {
        logger.error('❌ Erro na transcrição de áudio:', err);
        // Tenta limpar o arquivo temporário mesmo em caso de erro
        await Utils.cleanupFile(tempOutputPath);
        throw err;
      }
    });
  }

  async transcribeAndSummarize(audioBuffer, inputFormat = 'ogg') {
    try {
      logger.service('🎤 Iniciando transcrição e resumo de áudio...');
      
      const transcription = await this.transcribe(audioBuffer, inputFormat);
      
      logger.service('🧠 Gerando resumo com LLM...');
      const summaryPrompt = `Analise a seguinte transcrição de áudio e crie um resumo estruturado e claro:

TRANSCRIÇÃO:
"${transcription}"

O resumo deve incluir os principais pontos discutidos, eventos importantes e qualquer informação relevante mencionada. Evite detalhes excessivos e mantenha o foco nos aspectos mais significativos da conversa. O resumo deve ser escrito em português e ser facilmente compreensível.
Mantenha o resumo conciso mas informativo, destacando os pontos mais importantes do áudio.`;

      const summary = await this.ollamaClient.generate({
        model: CONFIG.llm.model,
        prompt: summaryPrompt,
        stream: false
      });

      logger.success('✅ Transcrição e resumo concluídos.');
      
      return {
        transcription: transcription,
        summary: summary.response,
        combined: `🎤 **TRANSCRIÇÃO COMPLETA:**\n\n${transcription}\n\n---\n\n${summary.response}`
      };
      
    } catch (err) {
      logger.error('❌ Erro na transcrição e resumo de áudio:', err);
      throw err;
    }
  }
}

export default AudioTranscriber;
