import logger from '../utils/logger.js';
import { CONFIG, COMMANDS } from '../config/index.js';

export default class SystemHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleVozCommand(contactId) {
    // Delegate to voice handler or utility handler
    const voiceEnabled = this.whatsAppBot.toggleVoicePreference(contactId);
    const message = voiceEnabled ? '🔊 Voz ativada!' : '📝 Modo texto ativado!';
    await this.whatsAppBot.sendResponse(contactId, message, true);
  }

  async handleTTSConfigCommand(contactId) {
    const configUrl = `${CONFIG.app.webUrl || 'http://localhost:3000'}/tts-config`;
    const message = `🔊 *Configuração de Text-to-Speech*

Para configurar o TTS (ElevenLabs ou Piper), acesse:
${configUrl}

*Funcionalidades Disponíveis:*
• ⚙️ Configuração de ElevenLabs
• 🖥️ Configuração de Piper TTS local
• 🔊 Controles globais de ativação
• 🎤 Testes de funcionalidade
• 📊 Carregamento automático de vozes

*Configurações Atuais:*
• TTS Global: ${CONFIG.tts?.enabled ? '✅ Ativo' : '❌ Inativo'}
• ElevenLabs: ${CONFIG.elevenlabs?.apiKey ? '✅ Configurado' : '❌ Não configurado'}
• Piper: ${CONFIG.piper?.enabled ? '✅ Ativo' : '❌ Inativo'}
• Telegram TTS: ${CONFIG.telegram?.enableTTS ? '✅ Ativo' : '❌ Inativo'}

Use o link acima para configurar todos os parâmetros de TTS.`;

    await this.whatsAppBot.sendResponse(contactId, message, true);
  }

  async handleReiniciarOllamaCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '🔄 *REINICIAR APLICAÇÃO (OLLAMA)*\n\n⚠️ **ATENÇÃO:** Esta operação irá:\n• Reiniciar toda a aplicação SecreBot\n• Descarregar todos os modelos Ollama\n• Limpar todas as conexões ativas\n• Recarregar configurações\n\n⏳ A aplicação será reiniciada em 10 segundos...\n\n📱 **Você receberá uma confirmação** quando o sistema voltar online.', true);
      
      logger.flow(`🔄 REINÍCIO DA APLICAÇÃO solicitado por ${contactId}`);
      logger.flow(`⚠️ A aplicação será reiniciada em 10 segundos para permitir limpeza do Ollama`);
      
      // Salvar informação do usuário que solicitou restart para notificar depois
      const restartInfo = {
        requestedBy: contactId,
        requestedAt: new Date().toISOString(),
        reason: 'ollama_restart'
      };
      
      // Salvar em arquivo temporário para recuperar após restart
      const fs = await import('fs/promises');
      const path = await import('path');
      const restartFile = path.join(process.cwd(), '.restart-info.json');
      
      try {
        await fs.writeFile(restartFile, JSON.stringify(restartInfo, null, 2));
        logger.file(`💾 Informações de restart salvas em ${restartFile}`);
      } catch (err) {
        logger.warn('⚠️ Não foi possível salvar informações de restart', { message: err.message });
      }
      
      // Aguardar 10 segundos para dar tempo da mensagem chegar
      setTimeout(async () => {
        logger.flow('🔄 Iniciando reinício da aplicação...');
        
        try {
          // Tentar descarregar modelos rapidamente antes do restart
          const models = await this.whatsAppBot.llmService.ollamaClient?.list();
          if (models && models.models) {
            logger.flow(`📊 Tentando descarregar ${models.models.length} modelos antes do restart...`);
            for (const model of models.models.slice(0, 3)) { // Apenas os 3 primeiros para não demorar
              try {
                await this.whatsAppBot.llmService.unloadModel(model.name);
                logger.success(`✅ Modelo ${model.name} descarregado`);
              } catch (err) {
                logger.warn(`⚠️ Erro ao descarregar ${model.name}`, { message: err.message });
              }
            }
          }
        } catch (err) {
          logger.warn('⚠️ Erro ao descarregar modelos pre-restart', { message: err.message });
        }
        
        // Detectar ambiente e executar restart apropriado
        if (process.env.PM2_HOME || process.env.name || process.env.PM_ID || process.env.pm_id || process.env.PM2_JSON_PROCESSING) {
          // Executando via PM2
          logger.flow('🔄 Executando restart via PM2...');
          logger.verbose(`📊 PM2 vars: PM2_HOME=${process.env.PM2_HOME}, name=${process.env.name}, PM_ID=${process.env.PM_ID}`);
          process.exit(0); // PM2 irá reiniciar automaticamente
        } else if (process.env.DOCKER_CONTAINER) {
          // Executando em container Docker
          logger.flow('🔄 Executando restart em container Docker...');
          process.exit(0); // Docker restart policy irá reiniciar
        } else {
          // Executando diretamente - tentar restart gracioso
          logger.flow('🔄 Executando restart direto...');
          
          // Tentar usar processo pai se disponível
          if (process.send) {
            process.send('restart');
          }
          
          // Forçar saída para restart manual
          setTimeout(() => {
            process.exit(0);
          }, 1000);
        }
        
      }, 10000); // 10 segundos de delay
      
    } catch (err) {
      logger.error(`❌ Erro ao preparar reinício para ${contactId}`, err);
      await this.whatsAppBot.sendResponse(contactId, `❌ *ERRO AO REINICIAR APLICAÇÃO*\n\n🚫 **Erro:** ${err.message}\n\n⚠️ **Recomendação:** Tente reiniciar manualmente usando PM2 ou Docker.\n\n🔙 Para voltar ao menu: ${COMMANDS.VOLTAR}`);
    }
  }

  isImageModel(modelName) {
    // Detectar se é modelo de imagem baseado no nome
    const imageModelNames = ['llava', 'bakllava', 'moondream', 'vision'];
    return imageModelNames.some(name => modelName.toLowerCase().includes(name));
  }
}