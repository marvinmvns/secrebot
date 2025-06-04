import { MongoClient } from 'mongodb';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES, COMMANDS } from '../config/index.js'; // Ajustar caminho se necessário

// ============ Scheduler ============
class Scheduler {
  constructor() {
    this.db = null;
    this.schedCollection = null;
    this.userSchedules = new Map(); // Cache para deleção
  }

  async connect() {
    try {
      const client = await MongoClient.connect(CONFIG.mongo.uri, {
        // As opções useNewUrlParser e useUnifiedTopology são depreciadas
        // O driver moderno as habilita por padrão quando necessário
      });
      console.log('✅ Conectado ao MongoDB.');
      this.db = client.db(CONFIG.mongo.dbName);
      this.schedCollection = this.db.collection(CONFIG.mongo.collectionName);

      // Garantir índices (pode ser feito uma vez na inicialização)
      await this.schedCollection.createIndex({ recipient: 1, status: 1 });
      await this.schedCollection.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });
      console.log('📊 Índices do MongoDB garantidos.');

    } catch (err) {
      console.error('❌ Erro ao conectar ao MongoDB:', err);
      throw err;
    }
  }

  async listSchedules(contactId) {
    if (!this.schedCollection) return ERROR_MESSAGES.GENERIC;
    try {
      const recipientNumber = contactId.replace(/\D/g, '');
      const schedules = await this.schedCollection
        .find({
          recipient: recipientNumber,
          status: 'approved'
        })
        .sort({ scheduledTime: 1 })
        .limit(10)
        .toArray();

      if (!schedules.length) {
        return ERROR_MESSAGES.NO_SCHEDULES;
      }

      // Usa o fuso local da máquina, respeitando o locale pt-BR
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      const lista = schedules.map((item, index) =>
        `${index + 1}️⃣ *Mensagem:* ${item.message}\n   📅 *Data/Hora:* ${formatter.format(new Date(item.scheduledTime))}`
      ).join('\n\n');

      return `📋 *Seus Próximos Agendamentos:*\n\n${lista}\n\n🔙 Para voltar: ${COMMANDS.VOLTAR}`;
    } catch (err) {
      console.error('❌ Erro ao listar agendamentos:', err);
      return ERROR_MESSAGES.GENERIC;
    }
  }

  async listSchedulesForDeletion(contactId) {
    if (!this.schedCollection) return { message: ERROR_MESSAGES.GENERIC, schedules: [] };
    try {
      const recipientNumber = contactId.replace(/\D/g, '');
      const schedules = await this.schedCollection
        .find({
          recipient: recipientNumber,
          status: 'approved'
        })
        .sort({ scheduledTime: 1 })
        .limit(10) // Limitar para facilitar a escolha
        .toArray();

      if (!schedules.length) {
        return { message: ERROR_MESSAGES.NO_SCHEDULES, schedules: [] };
      }

      // Armazenar temporariamente para deleção por número
      this.userSchedules.set(contactId, schedules);

      const lista = schedules.map((item, index) =>
        // Formata usando locale pt-BR no fuso local
        `${index + 1}️⃣ *Mensagem:* ${item.message}\n   📅 *Data/Hora:* ${new Date(item.scheduledTime).toLocaleString('pt-BR')}`
      ).join('\n\n');

      return {
        message: `🗑️ *Escolha o agendamento para deletar:*\n\n${lista}\n\n🔢 Digite apenas o número (1, 2, 3...)\n🔙 Para cancelar: ${COMMANDS.VOLTAR}`,
        schedules: schedules // Retorna para referência se necessário
      };
    } catch (err) {
      console.error('❌ Erro ao listar agendamentos para deleção:', err);
      return { message: ERROR_MESSAGES.GENERIC, schedules: [] };
    }
  }

  async deleteSchedule(contactId, scheduleNumber) {
    if (!this.schedCollection) return ERROR_MESSAGES.GENERIC;
    try {
      const schedules = this.userSchedules.get(contactId);

      if (!schedules || schedules.length === 0) {
        // Limpar cache se estiver vazio ou não existir mais
        this.userSchedules.delete(contactId);
        return `❌ Nenhum agendamento encontrado para deletar. Use ${COMMANDS.DELETAR} novamente.`;
      }

      const index = parseInt(scheduleNumber) - 1;

      if (isNaN(index) || index < 0 || index >= schedules.length) {
        return ERROR_MESSAGES.INVALID_NUMBER;
      }

      const scheduleToDelete = schedules[index];

      const result = await this.schedCollection.deleteOne({ _id: scheduleToDelete._id });

      if (result.deletedCount === 1) {
        // Limpar cache após deleção bem-sucedida
        this.userSchedules.delete(contactId);
        return SUCCESS_MESSAGES.SCHEDULE_DELETED(
          scheduleToDelete.message,
          new Date(scheduleToDelete.scheduledTime).toLocaleString('pt-BR')
        );
      } else {
        // Limpar cache se a deleção falhar por algum motivo inesperado
        this.userSchedules.delete(contactId);
        return ERROR_MESSAGES.GENERIC;
      }
    } catch (err) {
      console.error('❌ Erro ao deletar agendamento:', err);
      // Limpar cache em caso de erro
      this.userSchedules.delete(contactId);
      return ERROR_MESSAGES.GENERIC;
    }
  }

  async insertSchedule(scheduleData) {
    if (!this.schedCollection) throw new Error('Conexão com DB não estabelecida para inserir agendamento.');
    try {
      const result = await this.schedCollection.insertOne(scheduleData);
      console.log(`💾 Agendamento inserido: ${result.insertedId}`);
      return result.acknowledged;
    } catch (err) {
      console.error('❌ Erro ao inserir agendamento:', err);
      throw err;
    }
  }

  async processScheduledMessages(client) {
    if (!this.schedCollection) {
      console.warn('⚠️ Scheduler: Coleção do MongoDB não disponível.');
      return;
    }

    const now = Utils.getCurrentDateInGMTMinus3(); // Usar Utils
    const retryThreshold = new Date(now.getTime() - CONFIG.scheduler.retryDelay);

    try {
      const messages = await this.schedCollection.find({
        status: 'approved',
        sentAt: null,
        attempts: { $lt: CONFIG.scheduler.maxAttempts },
        scheduledTime: { $lte: now },
        $or: [
          { lastAttemptAt: null },
          { lastAttemptAt: { $lte: retryThreshold } }
        ]
      }).toArray();

      if (messages.length > 0) {
        console.log(`⏰ Processando ${messages.length} mensagens agendadas...`);
      }

      const results = await Promise.allSettled(
        messages.map(message => this.sendScheduledMessage(client, message))
      );

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Erro ao processar mensagem agendada ${messages[index]._id}:`, result.reason);
        }
      });
    } catch (err) {
      console.error('❌ Erro geral ao processar agendamentos:', err);
    }
  }

  async sendScheduledMessage(client, message) {
    if (!this.schedCollection) throw new Error('Conexão com DB não estabelecida para enviar agendamento.');
    const messageId = message._id;
    try {
      const recipientId = Utils.formatRecipientId(message.recipient); // Usar Utils
      console.log(`📤 Enviando mensagem agendada para ${recipientId}...`);
      await client.sendMessage(recipientId, `⏰ *Lembrete Agendado:*\n\n${message.message}`);

      await this.schedCollection.updateOne(
        { _id: messageId },
        {
          $set: {
            sentAt: Utils.getCurrentDateInGMTMinus3(), // Usar Utils
            status: 'sent'
          }
        }
      );
      console.log(`✅ Mensagem agendada ${messageId} enviada e marcada como 'sent'.`);
    } catch (err) {
      console.error(`❌ Falha ao enviar mensagem agendada ${messageId}:`, err);
      const attempts = (message.attempts || 0) + 1;
      const now = Utils.getCurrentDateInGMTMinus3(); // Usar Utils

      const updateFields = {
        $inc: { attempts: 1 },
        $set: { lastAttemptAt: now }
      };

      // Verifica se expirou ou atingiu limite de tentativas
      const expiryTime = message.expiryTime ? new Date(message.expiryTime) : null;
      if (attempts >= CONFIG.scheduler.maxAttempts || (expiryTime && expiryTime <= now)) {
        updateFields.$set.status = 'failed';
        updateFields.$set.error = err.message || 'Erro desconhecido no envio';
        console.warn(`⚠️ Mensagem agendada ${messageId} marcada como 'failed'.`);
      } else {
        console.warn(`⚠️ Tentativa ${attempts} falhou para mensagem agendada ${messageId}. Tentará novamente mais tarde.`);
      }

      try {
        await this.schedCollection.updateOne({ _id: messageId }, updateFields);
      } catch (updateError) {
        console.error(`❌ Falha CRÍTICA ao atualizar status da mensagem agendada ${messageId} após erro de envio:`, updateError);
      }

      // Re-lança o erro original para ser logado no processScheduledMessages ok
      throw err;
    }
  }
}

export default Scheduler;
