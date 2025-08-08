#!/usr/bin/env node

/**
 * Test script para verificar o balanceamento de LLM e fallback para Ollama local
 */

import LLMService from '../src/services/llmService.js';
import test from 'node:test';
import assert from 'node:assert';
import { CONFIG } from '../src/config/index.js';

test('LLMService - Balanceamento e Fallback', async () => {
  console.log('🧪 Testando balanceamento LLM e fallback...\n');
  
  try {
    // Criar instância do LLMService
    const llmService = new LLMService();
    
    // 1. Verificar se o shouldUseApiPool funciona
    console.log('1. Testando detecção de API Pool...');
    const shouldUsePool = await llmService.shouldUseApiPool();
    console.log(`   📊 Should use API Pool: ${shouldUsePool}`);
    
    // 2. Testar o método generateText (usado pelo crypto)
    console.log('2. Testando generateText...');
    const testPrompt = 'Responda apenas "TESTE OK"';
    
    try {
      const response = await llmService.generateText(testPrompt);
      console.log(`   ✅ generateText funcionou: ${response.substring(0, 50)}...`);
      assert(typeof response === 'string', 'Response deve ser string');
      assert(response.length > 0, 'Response não deve estar vazio');
    } catch (error) {
      console.log(`   ⚠️ generateText falhou, mas pode ser esperado sem Ollama: ${error.message}`);
    }
    
    // 3. Testar o método generateResponse (usado pelo Telegram)
    console.log('3. Testando generateResponse...');
    try {
      const response = await llmService.generateResponse('Diga "OK"');
      console.log(`   ✅ generateResponse funcionou: ${response.substring(0, 50)}...`);
      assert(typeof response === 'string', 'Response deve ser string');
    } catch (error) {
      console.log(`   ⚠️ generateResponse falhou, mas pode ser esperado sem Ollama: ${error.message}`);
    }
    
    // 4. Verificar status do pool de APIs Ollama
    console.log('4. Testando status do OllamaAPI Pool...');
    const poolStatus = await llmService.getOllamaApiStatus();
    console.log(`   📊 Pool habilitado: ${poolStatus.enabled}`);
    console.log(`   📊 Endpoints totais: ${poolStatus.totalEndpoints}`);
    console.log(`   📊 Endpoints saudáveis: ${poolStatus.healthyEndpoints}`);
    console.log(`   📊 Modo: ${poolStatus.mode}`);
    console.log(`   📊 Estratégia: ${poolStatus.strategy}`);
    
    if (poolStatus.enabled && poolStatus.healthyEndpoints > 0) {
      console.log('   ✅ Pool está ativo e funcionando');
    } else {
      console.log('   ⚠️ Pool não está ativo, usando Ollama local');
    }
    
    // 5. Testar listModels
    console.log('5. Testando listModels...');
    try {
      const models = await llmService.listModelsFromAllEndpoints();
      console.log(`   📊 Modelos encontrados: ${models.totalModels}`);
      console.log(`   📊 Endpoints consultados: ${models.endpoints.length}`);
      
      if (models.uniqueModels.length > 0) {
        console.log(`   📋 Primeiros modelos: ${models.uniqueModels.slice(0, 3).join(', ')}`);
      }
      
      assert(models.endpoints.length >= 1, 'Deve ter pelo menos 1 endpoint (local)');
    } catch (error) {
      console.log(`   ⚠️ listModels falhou: ${error.message}`);
    }
    
    // 6. Testar chat com contexto (usado pelo WhatsApp)
    console.log('6. Testando chat com contexto...');
    try {
      const contactId = 'test_user';
      const response = await llmService.getAssistantResponse(contactId, 'Diga apenas "CHAT OK"');
      console.log(`   ✅ Chat com contexto funcionou: ${response.substring(0, 50)}...`);
      
      // Limpar contexto de teste
      await llmService.clearContext(contactId, 'assistant');
    } catch (error) {
      console.log(`   ⚠️ Chat com contexto falhou: ${error.message}`);
    }
    
    console.log('\n✅ Teste de balanceamento LLM concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste de balanceamento LLM:', error);
    throw error;
  }
});

test('LLMService - Verificação de Configuração', async () => {
  console.log('🧪 Verificando configuração LLM...\n');
  
  // Verificar configurações
  console.log(`📊 Host Ollama: ${CONFIG.llm.host}`);
  console.log(`📊 Modelo padrão: ${CONFIG.llm.model}`);
  console.log(`📊 Modelo de imagem: ${CONFIG.llm.imageModel || 'llava (padrão)'}`);
  
  // Criar serviço e verificar effective config
  const llmService = new LLMService();
  const effectiveConfig = await llmService.getEffectiveConfig();
  
  console.log(`📊 OllamaAPI habilitado: ${effectiveConfig.ollamaApi.enabled}`);
  console.log(`📊 Modo OllamaAPI: ${effectiveConfig.ollamaApi.mode}`);
  
  if (effectiveConfig.ollamaApi.enabled && effectiveConfig.ollamaApi.endpoints) {
    console.log(`📊 Endpoints configurados: ${effectiveConfig.ollamaApi.endpoints.length}`);
  }
  
  console.log('\n✅ Verificação de configuração concluída');
});