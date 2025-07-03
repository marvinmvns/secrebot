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

    return new Promise((resolve, reject) => {
      const proc = spawn(execPath, args, { cwd: WHISPER_CPP_PATH });
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Whisper process timed out'));
      }, CONFIG.audio.timeoutMs);

      proc.stderr.on('data', d => {
        stderr += d.toString();
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on('close', code => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr || `Whisper exited with code ${code}`));
        }
      });
    });
  }

  async transcribe(audioBuffer, inputFormat = 'ogg') {
    return this.queue.add(async () => {
      logger.service('🎤 Iniciando transcrição de áudio...');
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
