import { ElevenLabsClient } from "elevenlabs";
// Remove direct import of CONFIG
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import logger from '../utils/logger.js';

class TtsService {
  constructor(config) {
    this.config = config; // Store the config object
    this.client = null;
    this.piperEnabled = false;
    logger.debug(`[TtsService] Constructor - Piper Enabled: ${this.config.piper?.enabled}, Executable: ${this.config.piper?.executable}, Model: ${this.config.piper?.model}`);
  }

  validatePiperPaths() {
    try {
      fsSync.accessSync(this.config.piper.executable, fsSync.constants.X_OK);
      fsSync.accessSync(this.config.piper.model, fsSync.constants.R_OK);
      return true;
    } catch (e) {
      logger.error(`[TtsService] validatePiperPaths error: ${e.message}`);
      return false;
    }
  }

  async initialize() {
    logger.debug(`[TtsService] Initialize - Piper Enabled: ${this.config.piper?.enabled}, Executable: ${this.config.piper?.executable}, Model: ${this.config.piper?.model}`);
    if (this.config.elevenlabs.apiKey) {
      try {
        this.client = new ElevenLabsClient({
          apiKey: this.config.elevenlabs.apiKey,
        });
        logger.success("✅ Cliente ElevenLabs inicializado.");
      } catch (error) {
        logger.error("❌ Erro ao inicializar cliente ElevenLabs:", error);
        this.client = null;
      }
    } else if (this.config.piper.enabled) {
      if (this.validatePiperPaths()) {
        logger.success("✅ Uso do TTS local Piper habilitado.");
        this.piperEnabled = true;
      } else {
        logger.error("❌ Caminhos do Piper ou modelo inválidos. TTS local desativado.");
      }
      this.client = null;
    } else {
      logger.warn("⚠️ Nenhuma configuração de TTS encontrada. Respostas por voz estarão desabilitadas.");
      this.client = null;
    }
  }

  async generateAudio(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error("Texto inválido fornecido para geração de áudio.");
    }

    logger.service(`🎙️ Solicitando TTS para: "${text.substring(0, 50)}..."`);

    if (this.client) { // ElevenLabs
      try {
        const audioStream = await this.client.generate({
          voice: this.config.elevenlabs.voiceId,
          model_id: this.config.elevenlabs.modelId,
          text: text,
          voice_settings: {
            stability: this.config.elevenlabs.stability,
            similarity_boost: this.config.elevenlabs.similarityBoost,
          }
        });

        const chunks = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        logger.success(`✅ Áudio gerado (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        return audioBuffer;
      } catch (error) {
        logger.error("❌ Erro na API ElevenLabs:", error);
        const errorMessage = error.message || "Erro desconhecido ao gerar áudio";
        throw new Error(`Falha ao gerar áudio TTS: ${errorMessage}`);
      }
    } else if (this.piperEnabled) { // Piper
      if (!this.validatePiperPaths()) {
        throw new Error('Configuração do Piper inválida');
      }
      const wavPath = path.join('/tmp', `piper_${Date.now()}.wav`);
      const oggPath = wavPath.replace('.wav', '.ogg');
      try {
        await new Promise((resolve, reject) => {
          // Configurar LD_LIBRARY_PATH para Piper
          const env = { ...process.env };
          const piperDir = path.dirname(path.dirname(this.config.piper.executable));
          const binDir = path.join(piperDir, 'bin');
          env.LD_LIBRARY_PATH = `${binDir}:${env.LD_LIBRARY_PATH || ''}`;
          
          const piper = spawn(
            this.config.piper.executable,
            ['--model', this.config.piper.model, '--output_file', wavPath],
            { env }
          );
          piper.stdin.write(text);
          piper.stdin.end();
          piper.on('exit', code =>
            code === 0 ? resolve() : reject(new Error(`piper exited with code ${code}`))
          );
        });

        await new Promise((resolve, reject) => {
          ffmpeg(wavPath)
            .audioCodec('libopus')
            .toFormat('ogg')
            .on('end', resolve)
            .on('error', err => reject(err))
            .save(oggPath);
        }).catch(err => {
          throw new Error(`Failed to convert TTS audio to OGG: ${err.message}`);
        });

        const audioBuffer = await fs.readFile(oggPath);
        await fs.unlink(wavPath);
        await fs.unlink(oggPath);
        logger.success(`✅ Áudio gerado pelo Piper (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        return audioBuffer;
      } catch (error) {
        logger.error('❌ Erro ao executar Piper:', error);
        try {
          await fs.unlink(wavPath);
          await fs.unlink(oggPath);
        } catch {}
        throw new Error('Falha ao gerar áudio TTS com Piper');
      }
    } else {
      throw new Error('Nenhum serviço de TTS configurado');
    }
  }
}

export default TtsService;

