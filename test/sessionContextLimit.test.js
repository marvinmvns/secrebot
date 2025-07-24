import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MongoClient } from 'mongodb';
import SessionService from '../src/services/sessionService.js';

describe('SessionService Context Limit (15KB)', () => {
  let client;
  let db;
  let sessionService;

  const testPhoneNumber = '+5511123456789';

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

  test('Should calculate context size correctly', () => {
    const smallContext = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    
    const size = sessionService.calculateContextSize(smallContext);
    console.log(`Small context size: ${size} bytes`);
    assert.ok(size > 0, 'Context should have a positive size');
    assert.ok(size < 1024, 'Small context should be less than 1KB');
  });

  test('Should detect oversized context', () => {
    // Criar contexto grande com strings repetidas
    const largeText = 'Esta é uma mensagem muito longa que será repetida muitas vezes para criar um contexto grande. '.repeat(200);
    const oversizedContext = [];
    
    // Adicionar muitas mensagens para exceder 15KB
    for (let i = 0; i < 50; i++) {
      oversizedContext.push({ role: 'user', content: `${largeText} Mensagem ${i}` });
      oversizedContext.push({ role: 'assistant', content: `Resposta para a mensagem ${i}: ${largeText}` });
    }
    
    const size = sessionService.calculateContextSize(oversizedContext);
    console.log(`Large context size: ${size} bytes (${(size/1024).toFixed(2)} KB)`);
    
    assert.ok(size > 15 * 1024, 'Context should exceed 15KB limit');
    assert.ok(sessionService.isContextOversized(oversizedContext), 'Context should be detected as oversized');
  });

  test('Should truncate oversized context', () => {
    // Criar contexto que excede 15KB
    const largeText = 'Texto muito longo para criar um contexto grande. '.repeat(300);
    const oversizedContext = [
      { role: 'system', content: 'Você é um assistente útil.' }
    ];
    
    // Adicionar muitas mensagens
    for (let i = 0; i < 100; i++) {
      oversizedContext.push({ role: 'user', content: `Pergunta ${i}: ${largeText}` });
      oversizedContext.push({ role: 'assistant', content: `Resposta ${i}: ${largeText}` });
    }
    
    const originalSize = sessionService.calculateContextSize(oversizedContext);
    console.log(`Original context size: ${originalSize} bytes`);
    
    // Truncar contexto
    const truncatedContext = sessionService.truncateContext(oversizedContext);
    const truncatedSize = sessionService.calculateContextSize(truncatedContext);
    
    console.log(`Truncated context size: ${truncatedSize} bytes`);
    console.log(`Messages before: ${oversizedContext.length}, after: ${truncatedContext.length}`);
    
    // Verificações
    assert.ok(truncatedSize <= 15 * 1024, 'Truncated context should be under 15KB');
    assert.ok(truncatedContext.length < oversizedContext.length, 'Should have fewer messages after truncation');
    assert.strictEqual(truncatedContext[0].role, 'system', 'Should preserve system message');
    assert.ok(!sessionService.isContextOversized(truncatedContext), 'Truncated context should not be oversized');
  });

  test('Should save oversized context with auto-truncation', async () => {
    // Criar contexto que excede 15KB
    const largeText = 'Esta é uma mensagem longa para testar o limite. '.repeat(500);
    const oversizedContext = [];
    
    for (let i = 0; i < 60; i++) {
      oversizedContext.push({ role: 'user', content: `${largeText} Msg ${i}` });
      oversizedContext.push({ role: 'assistant', content: `${largeText} Resposta ${i}` });
    }
    
    const originalSize = sessionService.calculateContextSize(oversizedContext);
    console.log(`Saving context with size: ${originalSize} bytes`);
    
    // Salvar contexto (deve truncar automaticamente)
    const saveResult = await sessionService.saveLLMContext(testPhoneNumber, 'ASSISTANT', oversizedContext);
    assert.strictEqual(saveResult, true, 'Should save successfully even with large context');
    
    // Recuperar e verificar
    const session = await sessionService.getSession(testPhoneNumber);
    const savedContext = session.llmContext.ASSISTANT;
    const savedSize = sessionService.calculateContextSize(savedContext);
    
    console.log(`Saved context size: ${savedSize} bytes`);
    console.log(`Messages saved: ${savedContext.length}`);
    
    assert.ok(savedSize <= 15 * 1024, 'Saved context should be under 15KB');
    assert.ok(savedContext.length > 0, 'Should have at least some messages');
    assert.ok(savedContext.length < oversizedContext.length, 'Should have fewer messages than original');
  });

  test('Should preserve small contexts unchanged', async () => {
    const smallContext = [
      { role: 'user', content: 'Como você está?' },
      { role: 'assistant', content: 'Estou bem, obrigado por perguntar!' },
      { role: 'user', content: 'Ótimo!' }
    ];
    
    const originalSize = sessionService.calculateContextSize(smallContext);
    console.log(`Small context size: ${originalSize} bytes`);
    
    // Salvar contexto pequeno
    await sessionService.saveLLMContext(testPhoneNumber, 'CHAT', smallContext);
    
    // Recuperar e verificar
    const session = await sessionService.getSession(testPhoneNumber);
    const savedContext = session.llmContext.CHAT;
    
    assert.deepStrictEqual(savedContext, smallContext, 'Small context should be saved unchanged');
    assert.strictEqual(savedContext.length, smallContext.length, 'Should have same number of messages');
  });

  test('Should handle context with system message correctly', () => {
    const contextWithSystem = [
      { role: 'system', content: 'Você é um assistente especializado em tecnologia.' },
      { role: 'user', content: 'Texto longo. '.repeat(2000) },
      { role: 'assistant', content: 'Resposta longa. '.repeat(2000) },
      { role: 'user', content: 'Mais texto longo. '.repeat(2000) }
    ];
    
    const truncated = sessionService.truncateContext(contextWithSystem);
    
    // Deve preservar a mensagem de sistema
    assert.strictEqual(truncated[0].role, 'system', 'System message should be preserved');
    assert.strictEqual(truncated[0].content, 'Você é um assistente especializado em tecnologia.', 'System message content should be unchanged');
    assert.ok(truncated.length >= 1, 'Should have at least the system message');
  });

  test('Cleanup', async () => {
    // Limpar dados de teste
    await db.collection('sessions').deleteMany({});
    await client.close();
    console.log('✅ Context limit tests completed');
  });
});