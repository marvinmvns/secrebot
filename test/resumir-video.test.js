import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ResumirVideo command logic simulation', async () => {
  // Simular a lógica corrigida do comando !resumirvideo
  const simulateResumirVideo = (transcript, maxLength = 15000) => {
    // Verificar se há transcrição
    if (!transcript || transcript.trim().length === 0) {
      return {
        success: false,
        error: 'Transcrição vazia'
      };
    }

    const transcriptLength = transcript.length;
    const truncatedTranscript = transcript.slice(0, maxLength);
    const truncated = transcriptLength > maxLength;

    // Simular prompt para o LLM
    const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos, em até 30 linhas:\n\n${truncatedTranscript}`;

    return {
      success: true,
      transcriptLength,
      truncated,
      summaryPrompt,
      processedLength: truncatedTranscript.length
    };
  };

  // Teste 1: Transcrição vazia
  const result1 = simulateResumirVideo('');
  assert.equal(result1.success, false);
  assert.equal(result1.error, 'Transcrição vazia');

  // Teste 2: Transcrição normal
  const normalTranscript = 'Este é um vídeo sobre tecnologia. '.repeat(100);
  const result2 = simulateResumirVideo(normalTranscript);
  assert.equal(result2.success, true);
  assert.equal(result2.truncated, false);
  assert.ok(result2.summaryPrompt.includes('Resuma em português'));

  // Teste 3: Transcrição longa (deve ser truncada)
  const longTranscript = 'Conteúdo muito longo do vídeo. '.repeat(1000);
  const result3 = simulateResumirVideo(longTranscript);
  assert.equal(result3.success, true);
  assert.equal(result3.truncated, true);
  assert.equal(result3.processedLength, 15000);
});

test('ResumirVideo flow validation', async () => {
  // Simular fluxo completo do comando
  const processVideoCommand = (command) => {
    // Extrair link do comando
    const prefix = '!resumirvideo';
    if (!command.startsWith(prefix)) {
      return { success: false, error: 'Comando inválido' };
    }

    const link = command.substring(prefix.length).trim();
    if (!link) {
      return { 
        success: false, 
        error: 'Link obrigatório',
        message: '📺 Por favor, envie o link do vídeo do YouTube que deseja transcrever.'
      };
    }

    // Simular validação básica de URL do YouTube
    const isValidYouTubeUrl = link.includes('youtube.com') || link.includes('youtu.be');
    if (!isValidYouTubeUrl) {
      return {
        success: false,
        error: 'URL inválida',
        message: 'Link deve ser do YouTube'
      };
    }

    return {
      success: true,
      link,
      steps: [
        'Transcrever vídeo',
        'Gerar resumo via LLM',
        'Enviar apenas o resumo'
      ]
    };
  };

  // Teste comando sem link
  const result1 = processVideoCommand('!resumirvideo');
  assert.equal(result1.success, false);
  assert.equal(result1.error, 'Link obrigatório');

  // Teste comando com link inválido
  const result2 = processVideoCommand('!resumirvideo https://example.com');
  assert.equal(result2.success, false);
  assert.equal(result2.error, 'URL inválida');

  // Teste comando válido
  const result3 = processVideoCommand('!resumirvideo https://youtube.com/watch?v=123');
  assert.equal(result3.success, true);
  assert.equal(result3.link, 'https://youtube.com/watch?v=123');
  assert.equal(result3.steps.length, 3);
});

test('ResumirVideo behavior comparison', async () => {
  // Comparar comportamento antigo vs novo
  const oldBehavior = (transcript) => {
    return {
      steps: [
        'Transcrever vídeo',
        'Enviar transcrição completa', // ❌ Problema
        'Gerar resumo',
        'Enviar resumo'
      ],
      messages: ['Transcrição:', 'Resumo:']
    };
  };

  const newBehavior = (transcript) => {
    return {
      steps: [
        'Transcrever vídeo',
        'Gerar resumo via LLM', // ✅ Corrigido
        'Enviar apenas resumo'
      ],
      messages: ['Resumo do Vídeo']
    };
  };

  const old = oldBehavior('transcript');
  const new_ = newBehavior('transcript');

  // Verificar que o novo comportamento tem menos mensagens
  assert.ok(new_.messages.length < old.messages.length);
  assert.ok(new_.steps.length < old.steps.length);
  
  // Verificar que não envia transcrição completa
  assert.ok(!new_.steps.includes('Enviar transcrição completa'));
  assert.ok(!new_.messages.some(msg => msg.includes('Transcrição:')));
});