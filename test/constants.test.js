import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, NUMERIC_SHORTCUTS, CHAT_MODES } from '../src/constants/commands.js';
import { MENU_MESSAGE, ERROR_MESSAGES } from '../src/constants/messages.js';

test('COMMANDS should contain expected commands', () => {
  assert.equal(COMMANDS.AJUDA, '!ajuda');
  assert.equal(COMMANDS.DEEP, '!deep');
  assert.equal(COMMANDS.AGENDA, '!agendabot');
  assert.equal(COMMANDS.VOLTAR, '!voltar');
  assert.equal(COMMANDS.RESUMIRVIDEO2, '!resumirvideo2');
});

test('NUMERIC_SHORTCUTS should map correctly to commands', () => {
  assert.equal(NUMERIC_SHORTCUTS['1'], 'submenu_agenda');
  assert.equal(NUMERIC_SHORTCUTS['1.1'], COMMANDS.AGENDA);
  assert.equal(NUMERIC_SHORTCUTS['0'], COMMANDS.VOLTAR);
  assert.equal(NUMERIC_SHORTCUTS['2.3.2'], COMMANDS.RESUMIRVIDEO2);
});

test('CHAT_MODES should contain expected modes', () => {
  assert.equal(CHAT_MODES.ASSISTANT, 'assistant');
  assert.equal(CHAT_MODES.AGENDABOT, 'agendabot');
  assert.equal(CHAT_MODES.TRANSCRICAO, 'transcricao');
});

test('MENU_MESSAGE should contain welcome message', () => {
  assert.ok(MENU_MESSAGE.includes('SECREBOT'));
  assert.ok(MENU_MESSAGE.includes('MENU PRINCIPAL'));
  assert.ok(MENU_MESSAGE.includes('AGENDA & LEMBRETES'));
});

test('ERROR_MESSAGES should contain expected errors', () => {
  assert.ok(ERROR_MESSAGES.GENERIC.includes('Erro ao processar'));
  assert.ok(ERROR_MESSAGES.NO_SCHEDULES.includes('Nenhum agendamento'));
  assert.ok(ERROR_MESSAGES.AUDIO_REQUIRED.includes('Áudio necessário'));
});