import { MongoClient } from 'mongodb';
import pLimit from 'p-limit';
import si from 'systeminformation';
import Utils from '../utils/index.js'; // Ajustar caminho se necessário
import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES, COMMANDS } from '../config/index.js'; // Ajustar caminho se necessário
import logger from '../utils/logger.js';

// ============ Scheduler ============
class Scheduler {
  constructor() {
    this.client = null;
    this.db = null;
    this.schedCollection = null;
    this.userSchedules = new Map(); // Cache para deleção
    this.currentConcurrency = CONFIG.scheduler.concurrency || 5;
  }

  async getDynamicConcurrency() {
    if (!CONFIG.scheduler.dynamic.enabled) {
      return this.currentConcurrency;
    }

    try {
      const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
      const cpuUsage = load.currentLoad / 100;
      const memUsage = (mem.total - mem.available) / mem.total;

      let newConcurrency = this.currentConcurrency;

      if (cpuUsage < CONFIG.scheduler.dynamic.cpuThreshold &&
          memUsage < CONFIG.scheduler.dynamic.memThreshold) {
        newConcurrency = Math.min(
          this.currentConcurrency + 1,
          CONFIG.scheduler.dynamic.max
        );
      } else if (
        cpuUsage > CONFIG.scheduler.dynamic.cpuThreshold ||
        memUsage > CONFIG.scheduler.dynamic.memThreshold
      ) {
        newConcurrency = Math.max(
          this.currentConcurrency - 1,
          CONFIG.scheduler.dynamic.min
        );
      }

      if (newConcurrency !== this.currentConcurrency) {
        logger.info(`⚙️ Concurrency ajustada para ${newConcurrency} (CPU: ${(
          cpuUsage * 100
        ).toFixed(1)}%, MEM: ${(memUsage * 100).toFixed(1)}%)`);
        this.currentConcurrency = newConcurrency;
      }

      return this.currentConcurrency;
    } catch (err) {
      logger.error('❌ Erro ao verificar uso de hardware:', err);
      return this.currentConcurrency;
    }
  }

  async connect() {
    try {
      logger.verbose(CONFIG.mongo.uri);
      this.client = new MongoClient(CONFIG.mongo.uri);
      await this.client.connect();
      logger.success('✅ Conectado ao MongoDB.');
      this.db = this.client.db(CONFIG.mongo.dbName);
      this.schedCollection = this.db.collection(CONFIG.mongo.collectionName);

      // Garantir índices (pode ser feito uma vez na inicialização)
      await this.schedCollection.createIndex({ recipient: 1, status: 1 });
      await this.schedCollection.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });
      logger.info('📊 Índices do MongoDB garantidos.');

    } catch (err) {
      logger.error('❌ Erro ao conectar ao MongoDB:', err);
      throw err;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      logger.info('🔌 Conexão com MongoDB encerrada.');
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
      logger.error('❌ Erro ao listar agendamentos:', err);
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
      logger.error('❌ Erro ao listar agendamentos para deleção:', err);
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
      logger.error('❌ Erro ao deletar agendamento:', err);
      // Limpar cache em caso de erro
      this.userSchedules.delete(contactId);
      return ERROR_MESSAGES.GENERIC;
    }
  }

  async insertSchedule(scheduleData) {
    if (!this.schedCollection) throw new Error('Conexão com DB não estabelecida para inserir agendamento.');
    try {
      const result = await this.schedCollection.insertOne(scheduleData);
      logger.verbose(`💾 Agendamento inserido: ${result.insertedId}`);
      return result.acknowledged;
    } catch (err) {
      logger.error('❌ Erro ao inserir agendamento:', err);
      throw err;
    }
  }

  async processScheduledMessages(client) {
    if (!this.schedCollection) {
      logger.warn('⚠️ Scheduler: Coleção do MongoDB não disponível.');
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
        logger.service(`⏰ Processando ${messages.length} mensagens agendadas...`);
      }

      const concurrency = await this.getDynamicConcurrency();
      const limit = pLimit(concurrency);
      const results = await Promise.allSettled(
        messages.map(message =>
          limit(() => this.sendScheduledMessage(client, message))
        )
      );

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`❌ Erro ao processar mensagem agendada ${messages[index]._id}:`, result.reason);
        }
      });
    } catch (err) {
      logger.error('❌ Erro geral ao processar agendamentos:', err);
    }
  }

  async sendScheduledMessage(client, message) {
    if (!this.schedCollection) throw new Error('Conexão com DB não estabelecida para enviar agendamento.');
    const messageId = message._id;
    try {
      const recipientId = Utils.formatRecipientId(message.recipient); // Usar Utils
      logger.service(`📤 Enviando mensagem agendada para ${recipientId}...`);
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
      logger.success(`✅ Mensagem agendada ${messageId} enviada e marcada como 'sent'.`);
    } catch (err) {
      logger.error(`❌ Falha ao enviar mensagem agendada ${messageId}:`, err);
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
        logger.warn(`⚠️ Mensagem agendada ${messageId} marcada como 'failed'.`);
      } else {
        logger.warn(`⚠️ Tentativa ${attempts} falhou para mensagem agendada ${messageId}. Tentará novamente mais tarde.`);
      }

      try {
        await this.schedCollection.updateOne({ _id: messageId }, updateFields);
      } catch (updateError) {
        logger.error(`❌ Falha CRÍTICA ao atualizar status da mensagem agendada ${messageId} após erro de envio:`, updateError);
      }

      // Re-lança o erro original para ser logado no processScheduledMessages ok
      throw err;
    }
  }

  async getStats() {
    if (!this.schedCollection) {
      return {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        upcoming: []
      };
    }
    try {
      const [total, pending, sent, failed, upcoming] = await Promise.all([
        this.schedCollection.countDocuments({}),
        this.schedCollection.countDocuments({ status: 'approved' }),
        this.schedCollection.countDocuments({ status: 'sent' }),
        this.schedCollection.countDocuments({ status: 'failed' }),
        this.schedCollection
          .find({ status: 'approved' })
          .sort({ scheduledTime: 1 })
          .limit(5)
          .toArray()
      ]);

      return {
        total,
        pending,
        sent,
        failed,
        upcoming: upcoming.map(item => ({
          message: item.message,
          scheduledTime: item.scheduledTime
        }))
      };
    } catch (err) {
      logger.error('❌ Erro ao obter estatísticas do scheduler:', err);
      return {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        upcoming: []
      };
    }
  }
}

export default Scheduler;
