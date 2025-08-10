import logger from '../utils/logger.js';
import { CHAT_MODES } from '../config/index.js';
import fs from 'fs/promises';

export default class ScheduleHandler {
  constructor(whatsAppBot) {
    this.whatsAppBot = whatsAppBot;
  }

  async handleAgendaSubmenu(msg, contactId, input) {
    switch (input) {
      case '1.1':
        await this.handleAgendabotCommand(contactId, '');
        return true;
      case '1.2':
        await this.handleListarCommand(contactId);
        return true;
      case '1.3':
        await this.handleDeletarCommand(contactId);
        return true;
      case '1.4':
        await this.handleImportarAgendaCommand(msg, contactId);
        return true;
      case '0':
        await this.whatsAppBot.setNavigationState(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, this.whatsAppBot.getMenuMessage());
        return true;
    }
    return false;
  }

  async handleAgendabotCommand(contactId, originalText) {
    try {
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.SCHEDULER);
      
      let message = '📅 *AgendaBot Ativado*\n\n';
      message += 'Descreva o que deseja agendar de forma natural.\n\n';
      message += '💡 *Exemplos:*\n';
      message += '• "Reunião com cliente amanhã às 14h"\n';
      message += '• "Lembrar de ligar para João na sexta às 10h"\n';
      message += '• "Consulta médica dia 15/12 às 9h30"\n';
      message += '• "Aniversário da Maria em 25 de dezembro"\n\n';
      message += '❌ Digite "cancelar" para sair.';
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar AgendaBot:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar AgendaBot.');
      return false;
    }
  }

  async handleListarCommand(contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '📅 Buscando seus agendamentos...', true);
      
      const schedules = await this.whatsAppBot.scheduler.listSchedules(contactId);
      
      if (!schedules || schedules.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '📅 Você não possui agendamentos.\n\n💡 Use 1.1 para criar um novo agendamento.');
        return true;
      }
      
      let message = `📅 *Seus Agendamentos (${schedules.length})*\n\n`;
      
      // Group by status
      const upcoming = schedules.filter(s => new Date(s.scheduledAt) > new Date() && s.status === 'pending');
      const completed = schedules.filter(s => s.status === 'completed');
      const cancelled = schedules.filter(s => s.status === 'cancelled');
      
      if (upcoming.length > 0) {
        message += `🔮 *Próximos (${upcoming.length}):*\n`;
        upcoming.forEach((schedule, index) => {
          const date = new Date(schedule.scheduledAt);
          const dateStr = date.toLocaleString('pt-BR');
          message += `${index + 1}. ${schedule.description}\n`;
          message += `   📅 ${dateStr}\n`;
          message += `   🆔 ID: ${schedule._id}\n\n`;
        });
      }
      
      if (completed.length > 0) {
        message += `✅ *Concluídos (${completed.length}):*\n`;
        completed.slice(0, 5).forEach((schedule, index) => {
          const date = new Date(schedule.scheduledAt);
          const dateStr = date.toLocaleString('pt-BR');
          message += `${index + 1}. ${schedule.description}\n`;
          message += `   📅 ${dateStr}\n\n`;
        });
        if (completed.length > 5) {
          message += `   ... e mais ${completed.length - 5} concluídos\n\n`;
        }
      }
      
      if (cancelled.length > 0) {
        message += `❌ *Cancelados: ${cancelled.length}*\n\n`;
      }
      
      message += '💡 Use 1.3 para deletar um agendamento específico.';
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao listar agendamentos para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao listar agendamentos.');
      return false;
    }
  }

  async handleDeletarCommand(contactId) {
    try {
      await this.whatsAppBot.setMode(contactId, CHAT_MODES.DELETE_SCHEDULE);
      
      // First, show current schedules
      const schedules = await this.whatsAppBot.scheduler.listSchedules(contactId);
      
      if (!schedules || schedules.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '📅 Você não possui agendamentos para deletar.\n\n💡 Use 1.1 para criar um novo agendamento.');
        await this.whatsAppBot.setMode(contactId, null);
        return true;
      }
      
      let message = `🗑️ *Deletar Agendamento*\n\n`;
      message += `📅 *Seus agendamentos:*\n\n`;
      
      const activeSchedules = schedules.filter(s => s.status !== 'cancelled');
      
      activeSchedules.forEach((schedule, index) => {
        const date = new Date(schedule.scheduledAt);
        const dateStr = date.toLocaleString('pt-BR');
        message += `${index + 1}. ${schedule.description}\n`;
        message += `   📅 ${dateStr}\n`;
        message += `   🆔 ${schedule._id.toString().substring(0, 8)}...\n\n`;
      });
      
      message += '💡 Digite o número do agendamento para deletar.\n';
      message += '🆔 Ou digite os primeiros 8 caracteres do ID.\n';
      message += '❌ Digite "cancelar" para sair.';
      
      await this.whatsAppBot.sendResponse(contactId, message);
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao iniciar deleção para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar deleção.');
      return false;
    }
  }

  async handleImportarAgendaCommand(msg, contactId) {
    try {
      await this.whatsAppBot.sendResponse(contactId, '📥 *Importar Agenda*\n\nEnvie um arquivo .ics (iCalendar) para importar eventos.\n\n💡 Você pode exportar sua agenda do Google Calendar, Outlook, etc.\n\n❌ Digite "cancelar" para sair.');
      await this.whatsAppBot.setMode(contactId, 'IMPORT_CALENDAR');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao iniciar importação de agenda:', error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao iniciar importação.');
      return false;
    }
  }

  async processSchedulerMessage(contactId, text) {
    try {
      const lowerText = text.toLowerCase().trim();
      
      // Allow cancellation
      if (lowerText === 'cancelar' || lowerText === 'sair' || lowerText === 'voltar') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Agendamento cancelado.\n\n📋 Para voltar ao menu: !menu');
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '📅 Processando seu agendamento...', true);
      
      // Use LLM to parse natural language into structured schedule data
      const scheduleData = await this.parseScheduleWithLLM(contactId, text);
      
      if (scheduleData.success) {
        const result = await this.createSchedule(contactId, scheduleData.data);
        
        if (result.success) {
          await this.whatsAppBot.sendResponse(contactId, result.message);
          await this.whatsAppBot.setMode(contactId, null);
          await this.whatsAppBot.sendResponse(contactId, '✅ Agendamento criado com sucesso!\n\n🔙 Para voltar ao menu: !menu');
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ ${result.error}\n\nTente reformular ou digite "cancelar" para sair.`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, `❌ ${scheduleData.error}\n\nTente ser mais específico com data e horário.\n\n💡 Exemplo: "Reunião amanhã às 14h"\n\nOu digite "cancelar" para sair.`);
      }
    } catch (error) {
      logger.error(`❌ Erro ao processar agendamento para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar agendamento.');
    }
  }

  async processDeleteScheduleMessage(contactId, text) {
    try {
      const input = text.trim();
      
      if (input.toLowerCase() === 'cancelar' || input.toLowerCase() === 'sair') {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Deleção cancelada.');
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '🗑️ Processando deleção...', true);
      
      // Get user schedules
      const schedules = await this.whatsAppBot.scheduler.listSchedules(contactId);
      const activeSchedules = schedules.filter(s => s.status !== 'cancelled');
      
      let scheduleToDelete = null;
      
      // Try to match by number
      const num = parseInt(input);
      if (!isNaN(num) && num > 0 && num <= activeSchedules.length) {
        scheduleToDelete = activeSchedules[num - 1];
      } else {
        // Try to match by ID prefix
        scheduleToDelete = activeSchedules.find(s => 
          s._id.toString().toLowerCase().startsWith(input.toLowerCase())
        );
      }
      
      if (!scheduleToDelete) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Agendamento não encontrado.\n\nVerifique o número ou ID e tente novamente.\nOu digite "cancelar" para sair.');
        return;
      }
      
      // Confirm deletion
      const date = new Date(scheduleToDelete.scheduledAt);
      const dateStr = date.toLocaleString('pt-BR');
      
      await this.whatsAppBot.sendResponse(contactId, 
        `🗑️ *Confirmar Deleção*\n\n` +
        `📅 ${scheduleToDelete.description}\n` +
        `⏰ ${dateStr}\n\n` +
        `❓ Tem certeza que deseja deletar?\n\n` +
        `✅ Digite "sim" para confirmar\n` +
        `❌ Digite "não" ou "cancelar" para cancelar`
      );
      
      // Store schedule ID for confirmation
      this.whatsAppBot.setUserPreference(contactId, 'scheduleToDelete', scheduleToDelete._id);
      await this.whatsAppBot.setMode(contactId, 'CONFIRM_DELETE_SCHEDULE');
      
    } catch (error) {
      logger.error(`❌ Erro ao processar deleção para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar deleção.');
    }
  }

  async processConfirmDeleteScheduleMessage(contactId, text) {
    try {
      const input = text.toLowerCase().trim();
      const scheduleId = this.whatsAppBot.getUserPreference(contactId, 'scheduleToDelete');
      
      if (!scheduleId) {
        await this.whatsAppBot.setMode(contactId, null);
        await this.whatsAppBot.sendResponse(contactId, '❌ Sessão expirada. Tente novamente.');
        return;
      }
      
      if (input === 'sim' || input === 's' || input === 'confirmar') {
        // Delete the schedule
        const result = await this.whatsAppBot.scheduler.deleteSchedule(scheduleId);
        
        if (result.success) {
          await this.whatsAppBot.sendResponse(contactId, '✅ Agendamento deletado com sucesso!');
        } else {
          await this.whatsAppBot.sendResponse(contactId, `❌ Erro ao deletar: ${result.error}`);
        }
      } else {
        await this.whatsAppBot.sendResponse(contactId, '❌ Deleção cancelada.');
      }
      
      // Clean up
      this.whatsAppBot.setUserPreference(contactId, 'scheduleToDelete', null);
      await this.whatsAppBot.setMode(contactId, null);
      await this.whatsAppBot.sendResponse(contactId, '\n🔙 Para voltar ao menu: !menu');
      
    } catch (error) {
      logger.error(`❌ Erro na confirmação de deleção para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro na confirmação.');
    }
  }

  async processImportCalendarMessage(msg, contactId) {
    try {
      // Check if message has attachment
      if (!msg.hasMedia) {
        await this.whatsAppBot.sendResponse(contactId, '📥 Por favor, envie um arquivo .ics para importar.\n\nOu digite "cancelar" para sair.');
        return;
      }
      
      await this.whatsAppBot.sendResponse(contactId, '📥 Processando arquivo de agenda...', true);
      
      // Download and process ICS file
      const attachment = await msg.downloadMedia();
      const filename = msg._data.filename || 'calendar.ics';
      
      if (!filename.toLowerCase().endsWith('.ics')) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Formato inválido. Envie apenas arquivos .ics\n\nOu digite "cancelar" para sair.');
        return;
      }
      
      // Parse ICS content
      const icsContent = Buffer.from(attachment.data, 'base64').toString('utf8');
      const events = await this.parseICSContent(icsContent);
      
      if (events.length === 0) {
        await this.whatsAppBot.sendResponse(contactId, '❌ Nenhum evento válido encontrado no arquivo.\n\nVerifique o arquivo e tente novamente.');
        await this.whatsAppBot.setMode(contactId, null);
        return;
      }
      
      // Import events
      let imported = 0;
      let errors = 0;
      
      for (const event of events) {
        try {
          const result = await this.createSchedule(contactId, event);
          if (result.success) {
            imported++;
          } else {
            errors++;
          }
        } catch (error) {
          errors++;
          logger.error('❌ Erro ao importar evento:', error);
        }
      }
      
      let message = `📥 *Importação Concluída*\n\n`;
      message += `✅ Importados: ${imported} eventos\n`;
      if (errors > 0) {
        message += `❌ Erros: ${errors} eventos\n`;
      }
      message += `📊 Total processados: ${events.length} eventos`;
      
      await this.whatsAppBot.sendResponse(contactId, message);
      await this.whatsAppBot.setMode(contactId, null);
      await this.whatsAppBot.sendResponse(contactId, '\n🔙 Para voltar ao menu: !menu');
      
    } catch (error) {
      logger.error(`❌ Erro ao processar importação para ${contactId}:`, error);
      await this.whatsAppBot.sendErrorMessage(contactId, 'Erro ao processar importação.');
    }
  }

  async parseScheduleWithLLM(contactId, text) {
    try {
      const prompt = `
Parse the following schedule request into structured data:

Text: "${text}"

Extract:
1. Description (what to do)
2. Date and time (when)
3. Type (meeting, reminder, appointment, etc.)

Current date/time: ${new Date().toISOString()}

Respond in JSON format:
{
  "description": "string",
  "scheduledAt": "ISO date string",
  "type": "string",
  "success": true/false,
  "error": "string if failed"
}

If date/time is ambiguous or missing, set success to false with explanation.
`;

      const response = await this.whatsAppBot.llmService.getAssistantResponse(prompt, {
        userId: contactId,
        system: "You are a schedule parsing assistant. Always respond with valid JSON."
      });

      if (response.success) {
        try {
          const parsed = JSON.parse(response.response);
          return parsed;
        } catch (parseError) {
          return {
            success: false,
            error: 'Erro ao interpretar agendamento. Tente ser mais específico com data e horário.'
          };
        }
      } else {
        return {
          success: false,
          error: 'Erro ao processar agendamento com IA.'
        };
      }
    } catch (error) {
      logger.error('❌ Erro ao usar LLM para parsing:', error);
      return {
        success: false,
        error: 'Erro interno ao processar agendamento.'
      };
    }
  }

  async createSchedule(contactId, scheduleData) {
    try {
      const result = await this.whatsAppBot.scheduler.schedule(
        contactId,
        scheduleData.description,
        new Date(scheduleData.scheduledAt),
        {
          type: scheduleData.type || 'reminder',
          priority: scheduleData.priority || 'normal'
        }
      );

      if (result.success) {
        const date = new Date(scheduleData.scheduledAt);
        const dateStr = date.toLocaleString('pt-BR');
        
        return {
          success: true,
          message: `✅ *Agendamento Criado*\n\n📅 ${scheduleData.description}\n⏰ ${dateStr}\n🆔 ${result.scheduleId}`
        };
      } else {
        return {
          success: false,
          error: result.error || 'Erro ao criar agendamento'
        };
      }
    } catch (error) {
      logger.error('❌ Erro ao criar agendamento:', error);
      return {
        success: false,
        error: 'Erro interno ao criar agendamento'
      };
    }
  }

  async parseICSContent(icsContent) {
    try {
      const events = [];
      const lines = icsContent.split('\n');
      let currentEvent = null;
      
      for (let line of lines) {
        line = line.trim();
        
        if (line === 'BEGIN:VEVENT') {
          currentEvent = {};
        } else if (line === 'END:VEVENT' && currentEvent) {
          if (currentEvent.summary && currentEvent.dtstart) {
            events.push({
              description: currentEvent.summary,
              scheduledAt: currentEvent.dtstart,
              type: 'imported'
            });
          }
          currentEvent = null;
        } else if (currentEvent) {
          if (line.startsWith('SUMMARY:')) {
            currentEvent.summary = line.replace('SUMMARY:', '');
          } else if (line.startsWith('DTSTART:')) {
            const dateStr = line.replace('DTSTART:', '');
            currentEvent.dtstart = this.parseICSDate(dateStr);
          }
        }
      }
      
      return events;
    } catch (error) {
      logger.error('❌ Erro ao fazer parse do ICS:', error);
      return [];
    }
  }

  parseICSDate(dateStr) {
    try {
      // Handle different ICS date formats
      if (dateStr.includes('T')) {
        // DateTime format: 20241210T140000Z
        const cleanDate = dateStr.replace(/[TZ]/g, '');
        const year = cleanDate.substring(0, 4);
        const month = cleanDate.substring(4, 6);
        const day = cleanDate.substring(6, 8);
        const hour = cleanDate.substring(8, 10) || '00';
        const minute = cleanDate.substring(10, 12) || '00';
        
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
      } else {
        // Date only format: 20241210
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        return new Date(`${year}-${month}-${day}T12:00:00`);
      }
    } catch (error) {
      logger.error('❌ Erro ao fazer parse da data ICS:', error);
      return new Date();
    }
  }
}