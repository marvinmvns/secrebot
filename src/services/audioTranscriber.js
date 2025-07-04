import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { WHISPER_CPP_PATH, WHISPER_CPP_MAIN_PATH, MODEL_OBJECT } from 'nodejs-whisper/dist/constants.js';
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
      logger.debug(`📊 Audio buffer size: ${audioBuffer.length} bytes, format: ${inputFormat}`);
      
      const timestamp = Date.now();
      const tempOutputPath = path.join(__dirname, `audio_${timestamp}.wav`);

      try {
        // Verifica se o modelo está disponível
        const modelFile = MODEL_OBJECT[CONFIG.audio.model];
        const modelPath = path.join(WHISPER_CPP_PATH, 'models', modelFile);
        
        try {
          await fs.access(modelPath);
        } catch (error) {
          throw new Error(`Modelo Whisper '${CONFIG.audio.model}' não encontrado em ${modelPath}. Verifique se o modelo foi baixado.`);
        }

        await new Promise((resolve, reject) => {
          const inputStream = Readable.from(audioBuffer);
          ffmpeg(inputStream)
            .inputFormat(inputFormat)
            .outputOptions(`-ar ${CONFIG.audio.sampleRate}`)
            .toFormat('wav')
            .on('error', (err) => {
              logger.error('Erro no FFMPEG:', err);
              reject(err);
            })
            .on('end', resolve)
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
        
        // Executa o Whisper com controle de timeout
        await this.runWhisper(tempOutputPath, options);
        
        const transcriptionPath = `${tempOutputPath}.txt`;
        const transcription = await fs.readFile(transcriptionPath, 'utf8');
        
        // Usa o método estático de Utils para limpar arquivos
        await Utils.cleanupFile(tempOutputPath);
        await Utils.cleanupFile(transcriptionPath);
        
        logger.success('✅ Transcrição concluída.');
        return transcription.trim();
        
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
