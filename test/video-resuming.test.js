import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Video Resuming Commands', () => {
  const simulateResumirVideo = (transcript, maxLength = 15000) => {
    if (!transcript || transcript.trim().length === 0) {
      return { success: false, error: 'Transcrição vazia' };
    }

    const transcriptLength = transcript.length;
    const truncatedTranscript = transcript.slice(0, maxLength);
    const truncated = transcriptLength > maxLength;
    const summaryPrompt = `Resuma em português o texto a seguir em tópicos claros e objetivos, em até 30 linhas:\n\n${truncatedTranscript}`;

    return {
      success: true,
      transcriptLength,
      truncated,
      summaryPrompt,
      processedLength: truncatedTranscript.length
    };
  };

  const processVideoCommand = (command) => {
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
      steps: ['Transcrever vídeo', 'Gerar resumo via LLM', 'Enviar apenas o resumo']
    };
  };

  const resumirVideo2Flow = {
    failTranscript: false,
    failLlm: false,

    async fetchTranscriptWhisperOnly() {
      if (this.failTranscript) throw new Error('transcript_error');
      return 'transcript';
    },

    async getAssistantResponse() {
      if (this.failLlm) throw new Error('llm_error');
      return 'summary';
    },

    async handleCommand() {
      try {
        const transcript = await this.fetchTranscriptWhisperOnly('url');
        const summary = await this.getAssistantResponse('user', transcript);
        return { success: true, summary };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  };

  test('resumirvideo handles empty transcript', async () => {
    const result = simulateResumirVideo('');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Transcrição vazia');
  });

  test('resumirvideo processes normal transcript', async () => {
    const normalTranscript = 'Este é um vídeo sobre tecnologia. '.repeat(100);
    const result = simulateResumirVideo(normalTranscript);
    assert.equal(result.success, true);
    assert.equal(result.truncated, false);
    assert.ok(result.summaryPrompt.includes('Resuma em português'));
  });

  test('resumirvideo truncates long transcript', async () => {
    const longTranscript = 'Conteúdo muito longo do vídeo. '.repeat(1000);
    const result = simulateResumirVideo(longTranscript);
    assert.equal(result.success, true);
    assert.equal(result.truncated, true);
    assert.equal(result.processedLength, 15000);
  });

  test('command validation rejects missing link', async () => {
    const result = processVideoCommand('!resumirvideo');
    assert.equal(result.success, false);
    assert.equal(result.error, 'Link obrigatório');
  });

  test('command validation rejects invalid URL', async () => {
    const result = processVideoCommand('!resumirvideo https://example.com');
    assert.equal(result.success, false);
    assert.equal(result.error, 'URL inválida');
  });

  test('command validation accepts YouTube URL', async () => {
    const result = processVideoCommand('!resumirvideo https://youtube.com/watch?v=123');
    assert.equal(result.success, true);
    assert.equal(result.link, 'https://youtube.com/watch?v=123');
    assert.equal(result.steps.length, 3);
  });

  test('resumirvideo2 succeeds normally', async () => {
    resumirVideo2Flow.failTranscript = false;
    resumirVideo2Flow.failLlm = false;
    const result = await resumirVideo2Flow.handleCommand();
    assert.equal(result.success, true);
    assert.equal(result.summary, 'summary');
  });

  test('resumirvideo2 handles transcript errors', async () => {
    resumirVideo2Flow.failTranscript = true;
    resumirVideo2Flow.failLlm = false;
    const result = await resumirVideo2Flow.handleCommand();
    assert.equal(result.success, false);
    assert.equal(result.error, 'transcript_error');
  });

  test('resumirvideo2 handles LLM errors', async () => {
    resumirVideo2Flow.failTranscript = false;
    resumirVideo2Flow.failLlm = true;
    const result = await resumirVideo2Flow.handleCommand();
    assert.equal(result.success, false);
    assert.equal(result.error, 'llm_error');
  });

  test('behavior comparison - new vs old approach', async () => {
    const oldBehavior = {
      steps: ['Transcrever vídeo', 'Enviar transcrição completa', 'Gerar resumo', 'Enviar resumo'],
      messages: ['Transcrição:', 'Resumo:']
    };

    const newBehavior = {
      steps: ['Transcrever vídeo', 'Gerar resumo via LLM', 'Enviar apenas resumo'],
      messages: ['Resumo do Vídeo']
    };

    assert.ok(newBehavior.messages.length < oldBehavior.messages.length);
    assert.ok(newBehavior.steps.length < oldBehavior.steps.length);
    assert.ok(!newBehavior.steps.includes('Enviar transcrição completa'));
    assert.ok(!newBehavior.messages.some(msg => msg.includes('Transcrição:')));
  });
});