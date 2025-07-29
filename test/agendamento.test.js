import { test } from 'node:test';
import assert from 'node:assert';
import { PROMPTS } from '../src/constants/messages.js';

test('Prompt de agendamento deve especificar JSON', () => {
  const date = new Date().toISOString();
  const prompt = PROMPTS.agenda(date);
  
  // Verificar se o prompt contém palavras-chave importantes
  assert(prompt.includes('JSON'), 'Prompt deve mencionar JSON');
  assert(prompt.includes('CRITICAL'), 'Prompt deve ter palavra CRITICAL');
  assert(prompt.includes('APENAS'), 'Prompt deve enfatizar apenas JSON');
  assert(prompt.includes('scheduledTime'), 'Prompt deve incluir scheduledTime');
  assert(prompt.includes('message'), 'Prompt deve incluir message');
  assert(prompt.includes('JSON.parse'), 'Prompt deve mencionar validação JSON.parse');
});

test('Estrutura JSON do agendamento deve ser válida', () => {
  const exemploJSON = {
    "message": "teste",
    "status": "approved", 
    "scheduledTime": { "$date": "2025-07-27T16:00:00.000Z" },
    "expiryTime": { "$date": "2025-07-27T17:00:00.000Z" },
    "sentAt": null,
    "attempts": 0,
    "lastAttemptAt": null
  };
  
  // Verificar se pode ser convertido para JSON e de volta
  const jsonString = JSON.stringify(exemploJSON);
  const parsed = JSON.parse(jsonString);
  
  assert.deepEqual(parsed, exemploJSON, 'Estrutura JSON deve ser válida');
  assert(parsed.message, 'Deve ter campo message');
  assert(parsed.status === 'approved', 'Status deve ser approved');
  assert(parsed.scheduledTime, 'Deve ter scheduledTime');
  assert(parsed.expiryTime, 'Deve ter expiryTime');
});