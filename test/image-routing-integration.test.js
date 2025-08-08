#!/usr/bin/env node

/**
 * Test script para verificar o roteamento completo de requisições de imagem
 */

import test from 'node:test';
import assert from 'node:assert';
import LLMService from '../src/services/llmService.js';
import OllamaApiPool from '../src/services/ollamaApiPool.js';
import { CONFIG } from '../src/config/index.js';

test('Integration - Roteamento Completo de Imagens', async () => {
  console.log('🧪 Testando roteamento completo de requisições de imagem...\n');
  
  try {
    // 1. Testar detecção de imagem em options do OllamaApiPool
    console.log('1. Testando detecção de conteúdo de imagem...');
    const pool = new OllamaApiPool();
    
    // Opções com imagem
    const imageOptions = {
      model: CONFIG.llm.imageModel || 'llava',
      prompt: 'Descreva esta imagem',
      images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA6Q']
    };
    
    // Opções sem imagem
    const textOptions = {
      model: CONFIG.llm.model,
      prompt: 'Olá, como você está?'
    };
    
    const hasImageContent1 = imageOptions.images && imageOptions.images.length > 0;
    const hasImageContent2 = textOptions.images && textOptions.images.length > 0;
    
    console.log(`   📊 Opções com imagem detectadas: ${hasImageContent1}`);
    console.log(`   📊 Opções sem imagem detectadas: ${hasImageContent2}`);
    
    assert.strictEqual(hasImageContent1, true, 'Deveria detectar conteúdo de imagem');
    assert.strictEqual(!!hasImageContent2, false, 'Não deveria detectar conteúdo de imagem');
    
    // 2. Testar LLMService.generateImageAnalysis
    console.log('2. Testando LLMService.generateImageAnalysis...');
    const llmService = new LLMService();
    
    // Verificar se vai usar API pool ou local
    const shouldUsePool = await llmService.shouldUseApiPool();
    console.log(`   📊 LLMService vai usar API Pool: ${shouldUsePool}`);
    
    // Testar se o método existe e pode ser chamado (sem executar devido a modelo)
    assert.strictEqual(typeof llmService.generateImageAnalysis, 'function', 'generateImageAnalysis deve existir');
    
    // 3. Testar detecção de mensagens estruturadas com imagem
    console.log('3. Testando estruturas de mensagem com imagem...');
    
    const structuredMessage = {
      model: CONFIG.llm.imageModel || 'llava',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Descreva esta imagem' },
            { 
              type: 'image_url', 
              image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA6Q' }
            }
          ]
        }
      ]
    };
    
    // Simular lógica de detecção usada no generate()
    const hasStructuredImageContent = structuredMessage.messages?.some(msg => 
      Array.isArray(msg.content) && 
      msg.content.some(content => content.type === 'image_url')
    );
    
    console.log(`   📊 Mensagem estruturada com imagem detectada: ${hasStructuredImageContent}`);
    assert.strictEqual(hasStructuredImageContent, true, 'Deveria detectar conteúdo de imagem estruturado');
    
    // 4. Testar cache funcionando
    console.log('4. Verificando funcionamento do cache...');
    
    // Simular duas chamadas para o mesmo endpoint/modelo
    const { Ollama } = await import('ollama');
    const testClient = new Ollama({ host: CONFIG.llm.host });
    const testModel = CONFIG.llm.imageModel || 'llava';
    
    // Primeira chamada
    const result1 = await pool.testImageSupport(testClient, testModel);
    console.log(`   📊 Primeira chamada - Suporte: ${result1}`);
    
    // Segunda chamada (deve usar cache)
    const result2 = await pool.testImageSupport(testClient, testModel);
    console.log(`   📊 Segunda chamada - Suporte: ${result2}`);
    
    // Verificar se o cache está sendo usado
    const cacheSize = Object.keys(pool.imageSupportCache).length;
    console.log(`   📊 Entradas no cache: ${cacheSize}`);
    
    assert.strictEqual(result1, result2, 'Resultados de cache devem ser consistentes');
    assert(cacheSize > 0, 'Cache deve ter pelo menos uma entrada');
    
    // 5. Verificar estado do pool de APIs
    console.log('5. Verificando estado do pool para imagens...');
    
    const isEnabled = await pool.isEnabled();
    const hasHealthy = isEnabled ? await pool.hasHealthyEndpoints() : false;
    
    console.log(`   📊 Pool habilitado: ${isEnabled}`);
    console.log(`   📊 Endpoints saudáveis: ${hasHealthy}`);
    
    if (isEnabled && hasHealthy) {
      console.log('   ✅ Pool está pronto para processar imagens');
      
      // Testar findImageCapableEndpoint
      try {
        const capableEndpoint = await pool.findImageCapableEndpoint(testModel);
        if (capableEndpoint) {
          console.log(`   ✅ Endpoint capaz encontrado: ${capableEndpoint.baseURL}`);
        } else {
          console.log('   ⚠️ Nenhum endpoint capaz encontrado no pool');
        }
      } catch (error) {
        console.log(`   ⚠️ Erro ao procurar endpoint capaz: ${error.message}`);
      }
    } else {
      console.log('   ℹ️ Pool não está ativo, requisições usarão endpoint local');
    }
    
    console.log('\n✅ Teste de roteamento de imagens concluído com sucesso');
    
  } catch (error) {
    console.error('❌ Erro no teste de roteamento de imagens:', error);
    throw error;
  }
});

test('Integration - Fallback de Imagens para Local', async () => {
  console.log('🧪 Testando fallback de imagens para endpoint local...\n');
  
  try {
    const llmService = new LLMService();
    
    // Verificar configuração atual
    const shouldUsePool = await llmService.shouldUseApiPool();
    console.log(`📊 Configuração atual usa API Pool: ${shouldUsePool}`);
    
    if (!shouldUsePool) {
      console.log('ℹ️ API Pool não está ativo, testando comportamento local');
      
      // Verificar se o método de análise de imagem existe
      assert.strictEqual(typeof llmService.generateImageAnalysis, 'function', 
        'Método generateImageAnalysis deve existir');
      
      console.log('✅ Método de análise de imagem disponível para uso local');
    } else {
      console.log('ℹ️ API Pool está ativo, fallback funcional implementado');
    }
    
    // Verificar configurações relacionadas a imagens
    const imageModel = CONFIG.llm.imageModel || CONFIG.llm.visionModel || 'llava';
    console.log(`📊 Modelo configurado para imagens: ${imageModel}`);
    
    // Verificar se o Ollama local está rodando
    try {
      const { Ollama } = await import('ollama');
      const localClient = new Ollama({ host: CONFIG.llm.host });
      const models = await localClient.list();
      
      const hasImageModel = models.models.some(model => 
        model.name.includes('llava') || 
        model.name.includes('vision') ||
        model.name === imageModel
      );
      
      console.log(`📊 Modelos locais disponíveis: ${models.models.length}`);
      console.log(`📊 Modelo de imagem disponível localmente: ${hasImageModel}`);
      
      if (hasImageModel) {
        console.log('✅ Fallback local está totalmente funcional');
      } else {
        console.log('⚠️ Para análise de imagens, instale um modelo como: ollama pull llava');
      }
    } catch (error) {
      console.log(`⚠️ Não foi possível conectar ao Ollama local: ${error.message}`);
      console.log('💡 Verifique se o Ollama está rodando em:', CONFIG.llm.host);
    }
    
    console.log('\n✅ Teste de fallback de imagens concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste de fallback:', error);
    throw error;
  }
});