import { ElevenLabsClient, stream } from "elevenlabs";
import { CONFIG } from "../config/index.js";
import fs from 'fs/promises'; // Para debug, se necessário

class TtsService {
  constructor() {
    if (!CONFIG.elevenlabs.apiKey) {
      console.warn("⚠️ Chave da API ElevenLabs (ELEVENLABS_API_KEY) não configurada. Respostas por voz estarão desabilitadas.");
      this.client = null;
    } else {
      try {
        this.client = new ElevenLabsClient({
          apiKey: CONFIG.elevenlabs.apiKey,
        });
        console.log("✅ Cliente ElevenLabs inicializado.");
      } catch (error) {
        console.error("❌ Erro ao inicializar cliente ElevenLabs:", error);
        this.client = null;
      }
    }
  }

  async generateAudio(text) {
    if (!this.client) {
      throw new Error("Cliente ElevenLabs não inicializado. Verifique a chave da API.");
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error("Texto inválido fornecido para geração de áudio.");
    }

    console.log(`🎙️ Solicitando TTS para: "${text.substring(0, 50)}..."`);

    try {
      const audioStream = await this.client.generate({
        voice: CONFIG.elevenlabs.voiceId,
        model_id: CONFIG.elevenlabs.modelId,
        text: text,
        voice_settings: {
          stability: CONFIG.elevenlabs.stability,
          similarity_boost: CONFIG.elevenlabs.similarityBoost,
          // style: 0.0, // Ajustar se necessário
          // use_speaker_boost: true // Ajustar se necessário
        },
        // output_format: "mp3_44100_128" // Verificar formatos suportados se necessário
      });

      // Coletar os chunks do stream em um buffer
      const chunks = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      console.log(`✅ Áudio gerado (${(audioBuffer.length / 1024).toFixed(2)} KB)`);

      // Opcional: Salvar para debug
      // const debugPath = `/home/ubuntu/tts_debug_${Date.now()}.mp3`;
      // await fs.writeFile(debugPath, audioBuffer);
      // console.log(`💾 Áudio de debug salvo em: ${debugPath}`);

      return audioBuffer;

    } catch (error) {
      console.error("❌ Erro na API ElevenLabs:", error);
      // Tentar extrair mensagem de erro mais específica, se disponível
      const errorMessage = error.message || "Erro desconhecido ao gerar áudio";
      throw new Error(`Falha ao gerar áudio TTS: ${errorMessage}`);
    }
  }
}

export default TtsService;

