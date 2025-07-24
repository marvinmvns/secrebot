import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MongoClient } from 'mongodb';
import SessionService from '../src/services/sessionService.js';

describe('SessionService', () => {
  let client;
  let db;
  let sessionService;

  const testPhoneNumber = '+5511999999999';
  const testPhoneNumber2 = '+5511888888888';

  // Setup e teardown
  test('Setup MongoDB connection', async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/secrebottest';
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    
    // Limpar coleção de teste
    await db.collection('sessions').deleteMany({});
    
    sessionService = new SessionService(db);
    await sessionService.init();
  });

  test('Should save and retrieve session data', async () => {
    const sessionData = {
      chatMode: 'ASSISTANT',
      navigationState: 'MAIN_MENU',
      customData: { 
        testKey: 'testValue',
        count: 42
      }
    };

    // Salvar sessão
    const saveResult = await sessionService.saveSession(testPhoneNumber, sessionData);
    assert.strictEqual(saveResult, true, 'Session should be saved successfully');

    // Recuperar sessão
    const retrievedSession = await sessionService.getSession(testPhoneNumber);
    assert.strictEqual(retrievedSession.chatMode, 'ASSISTANT');
    assert.strictEqual(retrievedSession.navigationState, 'MAIN_MENU');
    assert.strictEqual(retrievedSession.customData.testKey, 'testValue');
    assert.strictEqual(retrievedSession.customData.count, 42);
  });

  test('Should set and get chat mode', async () => {
    // Definir modo
    const setResult = await sessionService.setChatMode(testPhoneNumber2, 'TRANSCRICAO');
    assert.strictEqual(setResult, true, 'Chat mode should be set successfully');

    // Recuperar sessão para verificar
    const session = await sessionService.getSession(testPhoneNumber2);
    assert.strictEqual(session.chatMode, 'TRANSCRICAO');
  });

  test('Should set and get navigation state', async () => {
    // Definir estado de navegação
    const setResult = await sessionService.setNavigationState(testPhoneNumber, 'SUB_MENU_1');
    assert.strictEqual(setResult, true, 'Navigation state should be set successfully');

    // Recuperar sessão para verificar
    const session = await sessionService.getSession(testPhoneNumber);
    assert.strictEqual(session.navigationState, 'SUB_MENU_1');
  });

  test('Should save and clear LLM context', async () => {
    const testContext = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];

    // Salvar contexto
    const saveResult = await sessionService.saveLLMContext(testPhoneNumber, 'ASSISTANT', testContext);
    assert.strictEqual(saveResult, true, 'LLM context should be saved successfully');

    // Verificar se foi salvo
    const session = await sessionService.getSession(testPhoneNumber);
    assert.deepStrictEqual(session.llmContext.ASSISTANT, testContext);

    // Limpar contexto
    const clearResult = await sessionService.clearLLMContext(testPhoneNumber, 'ASSISTANT');
    assert.strictEqual(clearResult, true, 'LLM context should be cleared successfully');

    // Verificar se foi removido
    const sessionAfterClear = await sessionService.getSession(testPhoneNumber);
    assert.strictEqual(sessionAfterClear.llmContext.ASSISTANT, undefined);
  });

  test('Should save custom data', async () => {
    // Salvar dados customizados
    await sessionService.saveCustomData(testPhoneNumber, 'preference', 'value1');
    await sessionService.saveCustomData(testPhoneNumber, 'setting', { nested: true, count: 5 });

    // Verificar se foram salvos
    const session = await sessionService.getSession(testPhoneNumber);
    assert.strictEqual(session.customData.preference, 'value1');
    assert.deepStrictEqual(session.customData.setting, { nested: true, count: 5 });
  });

  test('Should clear session', async () => {
    // Limpar sessão
    const clearResult = await sessionService.clearSession(testPhoneNumber);
    assert.strictEqual(clearResult, true, 'Session should be cleared successfully');

    // Verificar se foi removida
    const session = await sessionService.getSession(testPhoneNumber);
    assert.strictEqual(session, null);
  });

  test('Should list active sessions', async () => {
    // Criar algumas sessões de teste
    await sessionService.setChatMode('+5511111111111', 'ASSISTANT');
    await sessionService.setChatMode('+5511222222222', 'TRANSCRICAO');
    
    // Listar sessões ativas
    const activeSessions = await sessionService.getActiveSessions(7);
    assert.ok(activeSessions.length >= 2, 'Should have at least 2 active sessions');
    
    const phoneNumbers = activeSessions.map(s => s.phoneNumber);
    assert.ok(phoneNumbers.includes('+5511111111111'));
    assert.ok(phoneNumbers.includes('+5511222222222'));
  });

  test('Should return null for non-existent session', async () => {
    const session = await sessionService.getSession('+5511000000000');
    assert.strictEqual(session, null);
  });

  test('Cleanup MongoDB connection', async () => {
    // Limpar dados de teste
    await db.collection('sessions').deleteMany({});
    
    // Fechar conexão
    await client.close();
    console.log('✅ MongoDB connection closed');
  });
});