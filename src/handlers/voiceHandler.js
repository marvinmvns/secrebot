import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';

export default class VoiceHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleVozCommand(contactId) {
    try {
      const currentVoiceSetting = this.whatsAppBot.getUserPreference(contactId, 'voiceResponse', false);
      
      let message = `🔊 *Configurações de Voz*\n\n`;
      message += `📊 **Status atual:** ${currentVoiceSetting ? '🔊 Ativado' : '🔇 Desativado'}\n\n`;
      
      if (currentVoiceSetting) {
        message += `✅ **Respostas por voz ativadas**\n`;
        message += `🎤 Suas mensagens de texto serão convertidas em áudio\n\n`;
        message += `🔧 **Opções:**\n`;
        message += `1️⃣ **Desativar** - Voltar para texto\n`;
        message += `2️⃣ **Configurar** - Ajustar TTS\n`;
        message += `3️⃣ **Testar** - Ouvir amostra\n`;
      } else {
        message += `🔇 **Respostas por texto**\n`;
        message += `📝 Respostas são enviadas como texto normal\n\n`;
        message += `🔧 **Opções:**\n`;
        message += `1️⃣ **Ativar voz** - Converter respostas em áudio\n`;
        message += `2️⃣ **Configurar TTS** - Ajustar voz\n`;
        message += `3️⃣ **Testar voz** - Ouvir amostra\n`;
      }
      
      message += `\n💡 Digite o número da opção desejada.`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, 'VOICE_CONFIG');
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar configurações de voz:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao acessar configurações de voz.');
      return false;
    }
  }

  async handleTTSConfigCommand(contactId) {
    try {
      const ttsConfig = await this.getTTSConfiguration();
      
      let message = `🎤 *Configuração Text-to-Speech*\n\n`;
      
      if (ttsConfig.available) {
        message += `✅ **TTS disponível:** ${ttsConfig.provider}\n`;
        
        if (ttsConfig.provider === 'ElevenLabs') {
          message += `🎯 **Provedor:** ElevenLabs Premium\n`;
          message += `🔊 **Qualidade:** Alta\n`;
          message += `⚡ **Velocidade:** Rápida\n`;
          
          if (ttsConfig.voices && ttsConfig.voices.length > 0) {
            message += `\n🎙️ **Vozes disponíveis:**\n`;
            ttsConfig.voices.slice(0, 5).forEach((voice, index) => {
              message += `${index + 1}. ${voice.name} (${voice.language})\n`;
            });
            if (ttsConfig.voices.length > 5) {
              message += `... e mais ${ttsConfig.voices.length - 5} vozes\n`;
            }
          }
        } else if (ttsConfig.provider === 'Piper') {
          message += `🎯 **Provedor:** Piper Local\n`;
          message += `🔊 **Qualidade:** Boa\n`;
          message += `⚡ **Velocidade:** Muito rápida\n`;
          message += `💾 **Offline:** Funciona sem internet\n`;
        }
        
        message += `\n🔧 **Configurações:**\n`;
        message += `1️⃣ **Trocar voz** - Escolher outra voz\n`;
        message += `2️⃣ **Ajustar velocidade** - Configurar ritmo\n`;
        message += `3️⃣ **Testar atual** - Ouvir configuração\n`;
        message += `4️⃣ **Trocar provedor** - Piper ↔ ElevenLabs\n`;
      } else {
        message += `❌ **TTS não configurado**\n\n`;
        message += `💡 **Opções de configuração:**\n`;
        message += `🔧 Configure uma das opções:\n\n`;
        message += `**1. Piper (Local - Gratuito)**\n`;
        message += `• Rápido e offline\n`;
        message += `• Qualidade boa\n`;
        message += `• Sem custos\n\n`;
        message += `**2. ElevenLabs (Online - Pago)**\n`;
        message += `• Alta qualidade\n`;
        message += `• Muitas vozes\n`;
        message += `• Requer API key\n\n`;
        message += `🔧 **Ações:**\n`;
        message += `1️⃣ **Configurar Piper** - Instalar localmente\n`;
        message += `2️⃣ **Configurar ElevenLabs** - Inserir API key\n`;
        message += `3️⃣ **Testar disponível** - Ver o que funciona\n`;
      }
      
      message += `\n❌ Digite "cancelar" para sair.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, 'TTS_CONFIG');
      
      return true;
    } catch (error) {
      logger.error('❌ Erro ao mostrar configuração TTS:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao acessar configurações TTS.');
      return false;
    }
  }

  async processVoiceConfigMessage(contactId, text) {
    try {
      const option = text.trim();
      const currentVoiceSetting = this.whatsAppBot.getUserPreference(contactId, 'voiceResponse', false);
      
      if (option.toLowerCase() === 'cancelar' || option.toLowerCase() === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Configuração de voz cancelada.');
        return;
      }
      
      switch(option) {
        case '1':
          if (currentVoiceSetting) {
            // Desativar voz
            this.whatsAppBot.setUserPreference(contactId, 'voiceResponse', false);
            await this.whatsAppBot.sendResponse(contactId, '🔇 *Respostas por voz desativadas!*\n\n📝 Voltando para respostas em texto.');
          } else {
            // Ativar voz
            const ttsAvailable = await this.checkTTSAvailability();
            if (ttsAvailable.available) {
              this.whatsAppBot.setUserPreference(contactId, 'voiceResponse', true);
              await this.whatsAppBot.sendResponse(contactId, `🔊 *Respostas por voz ativadas!*\n\n🎤 Usando: ${ttsAvailable.provider}\n💬 Suas próximas respostas serão em áudio.`);
            } else {
              await this.whatsAppBot.sendResponse(contactId, '❌ *TTS não disponível*\n\nConfigure primeiro o Text-to-Speech:\n• Use !ttsconfig para configurar');
            }
          }
          break;
          
        case '2':
          // Configurar TTS
          await this.handleTTSConfigCommand(contactId);
          return;
          
        case '3':
          // Testar voz
          await this.testTTSVoice(contactId);
          break;
          
        default:
          await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida! Digite 1, 2, 3 ou "cancelar".');
          return;
      }
      
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro ao processar configuração de voz:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar configuração.');
    }
  }

  async processTTSConfigMessage(contactId, text) {
    try {
      const option = text.trim();
      
      if (option.toLowerCase() === 'cancelar' || option.toLowerCase() === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Configuração TTS cancelada.');
        return;
      }
      
      const ttsConfig = await this.getTTSConfiguration();
      
      if (!ttsConfig.available) {
        // TTS não configurado
        switch(option) {
          case '1':
            await this.configurePiper(contactId);
            break;
          case '2':
            await this.configureElevenLabs(contactId);
            break;
          case '3':
            await this.testAvailableTTS(contactId);
            break;
          default:
            await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida! Digite 1, 2, 3 ou "cancelar".');
            return;
        }
      } else {
        // TTS configurado
        switch(option) {
          case '1':
            await this.selectTTSVoice(contactId);
            break;
          case '2':
            await this.adjustTTSSpeed(contactId);
            break;
          case '3':
            await this.testTTSVoice(contactId);
            break;
          case '4':
            await this.switchTTSProvider(contactId);
            break;
          default:
            await this.whatsAppBot.sendResponse(contactId, '❌ Opção inválida! Digite 1, 2, 3, 4 ou "cancelar".');
            return;
        }
      }
      
      await this.whatsAppBot.setMode(contactId, null);
    } catch (error) {
      logger.error('❌ Erro ao processar configuração TTS:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar configuração TTS.');
    }
  }

  async getTTSConfiguration() {
    try {
      if (!this.whatsAppBot.ttsService) {
        return { available: false, provider: null };
      }
      
      const config = await this.whatsAppBot.ttsService.getConfiguration();
      return config || { available: false, provider: null };
    } catch (error) {
      logger.error('❌ Erro ao obter configuração TTS:', error);
      return { available: false, provider: null };
    }
  }

  async checkTTSAvailability() {
    try {
      if (!this.whatsAppBot.ttsService) {
        return { available: false, provider: null };
      }
      
      const isAvailable = await this.whatsAppBot.ttsService.isAvailable();
      const provider = await this.whatsAppBot.ttsService.getCurrentProvider();
      
      return { available: isAvailable, provider: provider };
    } catch (error) {
      logger.error('❌ Erro ao verificar disponibilidade TTS:', error);
      return { available: false, provider: null };
    }
  }

  async testTTSVoice(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎤 Gerando teste de voz...', true);
      
      const testText = 'Olá! Este é um teste da funcionalidade de texto para fala. A configuração está funcionando corretamente.';
      
      if (this.whatsAppBot.ttsService) {
        const audioResult = await this.whatsAppBot.ttsService.generateSpeech(testText, {
          userId: contactId
        });
        
        if (audioResult.success && audioResult.audioBuffer) {
          // Send audio message
          await this.whatsAppBot.sendAudioMessage(contactId, audioResult.audioBuffer, 'Teste de TTS');
          await this.whatsAppBot.sendResponse(contactId, '✅ *Teste concluído!*\n\n🔊 Como ficou a qualidade do áudio?');
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ *Erro no teste:* ${audioResult.error || 'Falha na geração'}`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, '❌ *Serviço TTS não disponível*\n\nConfigure primeiro o Text-to-Speech.');
      }
    } catch (error) {
      logger.error('❌ Erro ao testar TTS:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao testar voz. Verifique a configuração.');
    }
  }

  async configurePiper(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔧 *Configurando Piper TTS*\n\n⏳ Verificando instalação...', true);
      
      // Check if Piper is installed
      if (this.whatsAppBot.ttsService) {
        const piperStatus = await this.whatsAppBot.ttsService.checkPiper();
        
        if (piperStatus.installed) {
          await this.whatsAppBot.sendResponse(contactId, 
            '✅ *Piper já instalado!*\n\n' +
            `📍 **Localização:** ${piperStatus.path}\n` +
            `🎙️ **Modelos:** ${piperStatus.models ? piperStatus.models.length : 0}\n` +
            `🌐 **Idioma:** Português (pt)\n\n` +
            '🔊 Piper TTS configurado e pronto para uso!'
          );
        } else {
          await this.whatsAppBot.sendResponse(contactId, 
            '⚠️ *Piper não instalado*\n\n' +
            '🔧 **Para instalar:**\n' +
            '1. Execute: `make install-piper`\n' +
            '2. Ou baixe manualmente do GitHub\n' +
            '3. Configure o modelo português\n\n' +
            '📖 **Documentação:** README.md'
          );
        }
      }
    } catch (error) {
      logger.error('❌ Erro ao configurar Piper:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao configurar Piper TTS.');
    }
  }

  async configureElevenLabs(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, 
        '🎤 *Configurando ElevenLabs TTS*\n\n' +
        '🔑 **Você precisa de uma API Key do ElevenLabs**\n\n' +
        '📋 **Passos:**\n' +
        '1. Acesse: https://elevenlabs.io\n' +
        '2. Crie uma conta\n' +
        '3. Obtenha sua API Key\n' +
        '4. Configure no arquivo .env:\n' +
        '   `ELEVENLABS_API_KEY=sua_api_key`\n\n' +
        '💡 **Benefícios:**\n' +
        '• Vozes ultra-realistas\n' +
        '• Muitas opções de idiomas\n' +
        '• Qualidade premium\n\n' +
        '⚠️ **Nota:** Serviço pago (créditos)'
      );
    } catch (error) {
      logger.error('❌ Erro ao mostrar configuração ElevenLabs:', error);
    }
  }

  async testAvailableTTS(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🧪 Testando provedores TTS disponíveis...', true);
      
      const providers = [];
      
      // Test Piper
      if (this.whatsAppBot.ttsService) {
        const piperTest = await this.whatsAppBot.ttsService.testPiper();
        if (piperTest.available) {
          providers.push({
            name: 'Piper',
            status: 'available',
            quality: 'boa',
            speed: 'rápida',
            cost: 'gratuito'
          });
        }
        
        // Test ElevenLabs
        const elevenLabsTest = await this.whatsAppBot.ttsService.testElevenLabs();
        if (elevenLabsTest.available) {
          providers.push({
            name: 'ElevenLabs', 
            status: 'available',
            quality: 'excelente',
            speed: 'média',
            cost: 'pago'
          });
        }
      }
      
      if (providers.length > 0) {
        let message = `🧪 *Provedores TTS Disponíveis:*\n\n`;
        
        providers.forEach((provider, index) => {
          message += `✅ **${index + 1}. ${provider.name}**\n`;
          message += `   🔊 Qualidade: ${provider.quality}\n`;
          message += `   ⚡ Velocidade: ${provider.speed}\n`;
          message += `   💰 Custo: ${provider.cost}\n\n`;
        });
        
        message += `💡 **Recomendação:**\n`;
        if (providers.find(p => p.name === 'Piper')) {
          message += `• Use **Piper** para rapidez e gratuidade\n`;
        }
        if (providers.find(p => p.name === 'ElevenLabs')) {
          message += `• Use **ElevenLabs** para máxima qualidade\n`;
        }
        
        await this.whatsAppBot.sendResponse(contactId, message);
      } else {
        await this.whatsAppBot.sendResponse(contactId, 
          '❌ *Nenhum provedor TTS disponível*\n\n' +
          '🔧 **Configure um dos provedores:**\n' +
          '• Piper: `make install-piper`\n' +
          '• ElevenLabs: Configure ELEVENLABS_API_KEY'
        );
      }
    } catch (error) {
      logger.error('❌ Erro ao testar TTS disponível:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao testar provedores TTS.');
    }
  }

  async selectTTSVoice(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🎙️ Carregando vozes disponíveis...', true);
      
      if (!this.whatsAppBot.ttsService) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Serviço TTS não disponível.');
        return;
      }
      
      const voices = await this.whatsAppBot.ttsService.getAvailableVoices();
      
      if (!voices || voices.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhuma voz disponível no provedor atual.');
        return;
      }
      
      let message = `🎙️ *Vozes Disponíveis (${voices.length})*\n\n`;
      
      voices.slice(0, 10).forEach((voice, index) => {
        const current = voice.id === this.getCurrentVoiceId(contactId) ? ' ⭐' : '';
        message += `**${index + 1}.** ${voice.name}${current}\n`;
        if (voice.language) message += `   🌐 ${voice.language}\n`;
        if (voice.gender) message += `   👤 ${voice.gender}\n`;
      });
      
      if (voices.length > 10) {
        message += `\n... e mais ${voices.length - 10} vozes\n`;
      }
      
      message += `\n💡 Digite o número da voz desejada.`;
      message += `\n❌ Digite "cancelar" para sair.`;
      
      // Store voices for selection
      this.whatsAppBot.setUserPreference(contactId, 'availableVoices', voices);
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, 'SELECT_VOICE');
    } catch (error) {
      logger.error('❌ Erro ao listar vozes:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao carregar vozes.');
    }
  }

  async adjustTTSSpeed(contactId) {
    try {
      const currentSpeed = this.whatsAppBot.getUserPreference(contactId, 'ttsSpeed', 1.0);
      
      let message = `⚡ *Configurar Velocidade da Fala*\n\n`;
      message += `📊 **Velocidade atual:** ${currentSpeed}x\n\n`;
      message += `🎛️ **Opções:**\n`;
      message += `1️⃣ **0.5x** - Muito lenta\n`;
      message += `2️⃣ **0.8x** - Lenta\n`;
      message += `3️⃣ **1.0x** - Normal ⭐\n`;
      message += `4️⃣ **1.2x** - Rápida\n`;
      message += `5️⃣ **1.5x** - Muito rápida\n`;
      message += `6️⃣ **Personalizada** - Digite valor (0.5-2.0)\n`;
      
      message += `\n💡 Digite o número da velocidade desejada.`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, 'ADJUST_SPEED');
    } catch (error) {
      logger.error('❌ Erro ao configurar velocidade:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao configurar velocidade.');
    }
  }

  async switchTTSProvider(contactId) {
    try {
      const currentProvider = await this.getCurrentProvider();
      
      let message = `🔄 *Trocar Provedor TTS*\n\n`;
      message += `📊 **Atual:** ${currentProvider}\n\n`;
      
      if (currentProvider === 'Piper') {
        message += `🔄 **Disponível:** ElevenLabs\n`;
        message += `✅ **Vantagens:**\n`;
        message += `• Qualidade superior\n`;
        message += `• Mais vozes\n`;
        message += `• Naturalidade\n`;
        message += `❌ **Desvantagens:**\n`;
        message += `• Pago (créditos)\n`;
        message += `• Requer internet\n`;
      } else {
        message += `🔄 **Disponível:** Piper\n`;
        message += `✅ **Vantagens:**\n`;
        message += `• Gratuito\n`;
        message += `• Rápido\n`;
        message += `• Funciona offline\n`;
        message += `❌ **Desvantagens:**\n`;
        message += `• Qualidade menor\n`;
        message += `• Menos vozes\n`;
      }
      
      message += `\n❓ **Deseja trocar?**\n`;
      message += `✅ Digite "sim" para confirmar\n`;
      message += `❌ Digite "não" para cancelar`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, 'SWITCH_PROVIDER');
    } catch (error) {
      logger.error('❌ Erro ao mostrar troca de provedor:', error);
      await this.whatsAppBot.sendResponse(contactId, '❌ Erro ao configurar troca de provedor.');
    }
  }

  // Helper methods
  getCurrentVoiceId(contactId) {
    return this.whatsAppBot.getUserPreference(contactId, 'selectedVoiceId', null);
  }

  async getCurrentProvider() {
    try {
      if (this.whatsAppBot.ttsService) {
        return await this.whatsAppBot.ttsService.getCurrentProvider();
      }
      return 'Não configurado';
    } catch (error) {
      return 'Desconhecido';
    }
  }

  async sendVoiceResponse(contactId, text) {
    try {
      const voiceEnabled = this.whatsAppBot.getUserPreference(contactId, 'voiceResponse', false);
      
      if (!voiceEnabled || !this.whatsAppBot.ttsService) {
        // Send as text if voice is disabled or TTS not available
        await this.whatsAppBot.sendResponse(contactId, text);
        return;
      }
      
      // Generate speech
      const audioResult = await this.whatsAppBot.ttsService.generateSpeech(text, {
        userId: contactId,
        speed: this.whatsAppBot.getUserPreference(contactId, 'ttsSpeed', 1.0),
        voiceId: this.getCurrentVoiceId(contactId)
      });
      
      if (audioResult.success && audioResult.audioBuffer) {
        // Send audio message
        await this.whatsAppBot.sendAudioMessage(contactId, audioResult.audioBuffer, 'TTS Response');
        
        // Also send text as backup/accessibility
        await this.whatsAppBot.sendResponse(contactId, `📝 ${text}`);
      } else {
        // Fallback to text if TTS fails
        logger.warn(`❌ TTS failed for ${contactId}: ${audioResult.error}`);
        await this.whatsAppBot.sendResponse(contactId, text);
      }
    } catch (error) {
      logger.error('❌ Erro ao enviar resposta por voz:', error);
      // Fallback to text
      await this.whatsAppBot.sendResponse(contactId, text);
    }
  }
}