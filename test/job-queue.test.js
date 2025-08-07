import { test } from 'node:test';
import assert from 'node:assert';
import { getJobQueueMonitor } from '../src/services/jobQueueMonitor.js';
import { getJobQueueWrapper } from '../src/services/jobQueueWrapper.js';

test('JobQueueMonitor - criar e gerenciar job', async () => {
  const monitor = getJobQueueMonitor();
  
  // Criar um job
  const job = await monitor.createJob('test-job', { test: 'data' }, { priority: 'high' });
  
  assert.ok(job.jobId);
  assert.strictEqual(job.type, 'test-job');
  assert.strictEqual(job.status, 'pending');
  assert.strictEqual(job.priority, 'high');
  assert.deepStrictEqual(job.data, { test: 'data' });
  
  // Atualizar status
  await monitor.updateJobStatus(job.jobId, 'processing');
  const updatedJob = await monitor.getJob(job.jobId);
  assert.strictEqual(updatedJob.status, 'processing');
  
  // Completar job
  await monitor.updateJobStatus(job.jobId, 'completed', { result: 'success' });
  const completedJob = await monitor.getJob(job.jobId);
  assert.strictEqual(completedJob.status, 'completed');
  assert.deepStrictEqual(completedJob.result, { result: 'success' });
  
  // Limpar job de teste
  await monitor.deleteJob(job.jobId);
});

test('JobQueueMonitor - obter estatísticas', async () => {
  const monitor = getJobQueueMonitor();
  
  const stats = await monitor.getJobStats();
  
  assert.ok(typeof stats.total === 'number');
  assert.ok(typeof stats.pending === 'number');
  assert.ok(typeof stats.processing === 'number');
  assert.ok(typeof stats.completed === 'number');
  assert.ok(typeof stats.failed === 'number');
  assert.ok(typeof stats.by_type === 'object');
});

test('JobQueueMonitor - listar jobs', async () => {
  const monitor = getJobQueueMonitor();
  
  const jobs = await monitor.getAllJobs({}, 10, 0);
  
  assert.ok(Array.isArray(jobs));
  
  if (jobs.length > 0) {
    const job = jobs[0];
    assert.ok(job.jobId);
    assert.ok(job.type);
    assert.ok(job.status);
    assert.ok(job.createdAt);
  }
});

test('JobQueueWrapper - mock de função', async () => {
  const wrapper = getJobQueueWrapper();
  
  // Mock function que simula processamento
  const mockFunction = async (data) => {
    await new Promise(resolve => setTimeout(resolve, 10)); // Simular delay
    return `Processed: ${data.input}`;
  };
  
  const result = await wrapper.wrapWithJobQueue(
    'test-wrapper',
    mockFunction,
    { input: 'test data' },
    { priority: 'medium' }
  );
  
  assert.strictEqual(result.success, true);
  assert.ok(result.jobId);
  assert.strictEqual(result.result, 'Processed: test data');
  
  // Verificar se o job foi registrado
  const monitor = getJobQueueMonitor();
  const job = await monitor.getJob(result.jobId);
  assert.strictEqual(job.status, 'completed');
  assert.strictEqual(job.result, 'Processed: test data');
  
  // Limpar job de teste
  await monitor.deleteJob(result.jobId);
});

test('JobQueueWrapper - tratamento de erro', async () => {
  const wrapper = getJobQueueWrapper();
  
  // Mock function que falha
  const failingFunction = async () => {
    throw new Error('Simulated failure');
  };
  
  try {
    await wrapper.wrapWithJobQueue(
      'test-failing',
      failingFunction,
      { input: 'test data' }
    );
    assert.fail('Deveria ter lançado um erro');
  } catch (error) {
    assert.strictEqual(error.success, false);
    assert.ok(error.jobId);
    assert.strictEqual(error.error, 'Simulated failure');
    
    // Verificar se o job foi marcado como falhou
    const monitor = getJobQueueMonitor();
    const job = await monitor.getJob(error.jobId);
    assert.strictEqual(job.status, 'failed');
    assert.ok(job.error);
    
    // Limpar job de teste
    await monitor.deleteJob(error.jobId);
  }
});

test('JobQueueMonitor - retry job', async () => {
  const monitor = getJobQueueMonitor();
  
  // Criar um job que falhou
  const job = await monitor.createJob('test-retry', { test: 'data' });
  await monitor.updateJobStatus(job.jobId, 'failed', null, { message: 'Test error' });
  
  // Tentar novamente
  const retriedJob = await monitor.retryJob(job.jobId);
  assert.strictEqual(retriedJob.status, 'pending');
  
  // Limpar job de teste
  await monitor.deleteJob(job.jobId);
});

console.log('✅ Todos os testes da fila de jobs passaram!');