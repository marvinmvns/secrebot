import { ElevenLabsClient } from "elevenlabs";
import { CONFIG } from "../config/index.js";
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

class TtsService {
  validatePiperPaths() {
    try {
      fsSync.accessSync(CONFIG.piper.executable, fsSync.constants.X_OK);
      fsSync.accessSync(CONFIG.piper.model, fsSync.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  constructor() {
    this.piperEnabled = false;
    if (CONFIG.elevenlabs.apiKey) {
      try {
        this.client = new ElevenLabsClient({
          apiKey: CONFIG.elevenlabs.apiKey,
        });
        console.log("✅ Cliente ElevenLabs inicializado.");
      } catch (error) {
        console.error("❌ Erro ao inicializar cliente ElevenLabs:", error);
        this.client = null;
      }
    } else if (CONFIG.piper.enabled) {
      if (this.validatePiperPaths()) {
        console.log("✅ Uso do TTS local Piper habilitado.");
        this.piperEnabled = true;
      } else {
        console.error("❌ Caminhos do Piper ou modelo inválidos. TTS local desativado.");
      }
      this.client = null;
    } else {
      console.warn("⚠️ Nenhuma configuração de TTS encontrada. Respostas por voz estarão desabilitadas.");
      this.client = null;
    }
  }

  async generateAudio(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error("Texto inválido fornecido para geração de áudio.");
    }

    console.log(`🎙️ Solicitando TTS para: "${text.substring(0, 50)}..."`);

    if (this.client) {
      try {
        const audioStream = await this.client.generate({
          voice: CONFIG.elevenlabs.voiceId,
          model_id: CONFIG.elevenlabs.modelId,
          text: text,
          voice_settings: {
            stability: CONFIG.elevenlabs.stability,
            similarity_boost: CONFIG.elevenlabs.similarityBoost,
          }
        });

        const chunks = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);

        console.log(`✅ Áudio gerado (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        return audioBuffer;
      } catch (error) {
        console.error("❌ Erro na API ElevenLabs:", error);
        const errorMessage = error.message || "Erro desconhecido ao gerar áudio";
        throw new Error(`Falha ao gerar áudio TTS: ${errorMessage}`);
      }
    } else if (this.piperEnabled) {
      if (!this.validatePiperPaths()) {
        throw new Error('Configuração do Piper inválida');
      }
      const wavPath = path.join('/tmp', `piper_${Date.now()}.wav`);
      const oggPath = wavPath.replace('.wav', '.ogg');
      try {
        await new Promise((resolve, reject) => {
          const piper = spawn(
            CONFIG.piper.executable,
            ['--model', CONFIG.piper.model, '--output_file', wavPath]
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
        console.log(`✅ Áudio gerado pelo Piper (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        return audioBuffer;
      } catch (error) {
        console.error('❌ Erro ao executar Piper:', error);
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

