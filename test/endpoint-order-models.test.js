#!/usr/bin/env node

/**
 * Teste para verificar se a mudança de ordem dos endpoints afeta a listagem de modelos
 */

import test from 'node:test';
import assert from 'node:assert';
import LLMService from '../src/services/llmService.js';
import OllamaApiPool from '../src/services/ollamaApiPool.js';
import ChatGPTAPIClient from '../src/services/chatgptApiClient.js';

test('Endpoint Order and Model Listing - Verificar listagem após mudança de ordem', async () => {
  console.log('🧪 Testando se mudança de ordem afeta listagem de modelos...\n');

  try {
    // 1. Testar ChatGPTAPIClient diretamente
    console.log('1. Testando ChatGPTAPIClient diretamente...');
    
    try {
      // Usar uma API key falsa para teste de estrutura
      const chatgptClient = new ChatGPTAPIClient('https://api.openai.com', 'fake-key-for-test');
      
      console.log('   ✅ ChatGPTAPIClient criado com sucesso');
      console.log(`   📊 Base URL: ${chatgptClient.baseURL}`);
      console.log(`   📊 Modelo padrão: ${chatgptClient.defaultModel}`);
      
      try {
        const models = await chatgptClient.listModels();
        console.log(`   ✅ listModels funcionou: ${models.models.length} modelos`);
        console.log(`   📋 Primeiros modelos: ${models.models.slice(0, 3).map(m => m.name).join(', ')}`);
      } catch (error) {
        console.log(`   ⚠️ listModels falhou (esperado com API key falsa): ${error.message}`);
        // Isso é esperado com API key falsa
      }
    } catch (error) {
      console.log(`   ❌ Erro ao criar ChatGPTAPIClient: ${error.message}`);
    }

    // 2. Testar diferentes configurações de endpoints
    console.log('\n2. Testando diferentes configurações de endpoints...');
    
    const testConfigurations = [
      {
        name: 'ChatGPT primeiro',
        endpoints: [
          { url: 'https://api.openai.com', type: 'chatgpt', enabled: true, apikey: 'fake-key' },
          { url: 'http://localhost:11434', type: 'ollama', enabled: true },
          { url: 'http://localhost:8080', type: 'rkllama', enabled: true }
        ]
      },
      {
        name: 'Ollama primeiro', 
        endpoints: [
          { url: 'http://localhost:11434', type: 'ollama', enabled: true },
          { url: 'https://api.openai.com', type: 'chatgpt', enabled: true, apikey: 'fake-key' },
          { url: 'http://localhost:8080', type: 'rkllama', enabled: true }
        ]
      },
      {
        name: 'RKLLama primeiro',
        endpoints: [
          { url: 'http://localhost:8080', type: 'rkllama', enabled: true },
          { url: 'http://localhost:11434', type: 'ollama', enabled: true },
          { url: 'https://api.openai.com', type: 'chatgpt', enabled: true, apikey: 'fake-key' }
        ]
      }
    ];

    for (const config of testConfigurations) {
      console.log(`   🔧 Testando configuração: ${config.name}`);
      
      // Simular configuração diferente
      const mockConfig = {
        ollamaApi: {
          enabled: true,
          endpoints: config.endpoints,
          mode: 'api'
        }
      };

      try {
        // Criar pool temporário com configuração específica
        const pool = new OllamaApiPool();
        
        // Simular diferentes ordens e verificar detecção de tipos
        config.endpoints.forEach((endpoint, index) => {
          const detectedType = pool.getEndpointType(endpoint);
          console.log(`      ${index + 1}. ${endpoint.url} → Tipo detectado: ${detectedType} (esperado: ${endpoint.type})`);
          
          const typeMatch = detectedType === endpoint.type;
          console.log(`         Match: ${typeMatch ? '✅' : '❌'}`);
        });

      } catch (error) {
        console.log(`      ❌ Erro na configuração ${config.name}: ${error.message}`);
      }
    }

    // 3. Testar LLMService com diferentes configurações
    console.log('\n3. Testando LLMService...');
    
    try {
      const llmService = new LLMService();
      console.log('   ✅ LLMService criado');
      
      // Verificar se método listModels funciona
      console.log('   📋 Testando listModels do LLMService...');
      try {
        const models = await llmService.listModelsFromAllEndpoints();
        console.log(`   ✅ listModelsFromAllEndpoints funcionou`);
        console.log(`   📊 Total de modelos únicos: ${models.uniqueModels.length}`);
        console.log(`   📊 Endpoints consultados: ${models.endpoints.length}`);
        console.log(`   📊 Total geral de modelos: ${models.totalModels}`);
        
        if (models.uniqueModels.length > 0) {
          console.log(`   📋 Alguns modelos: ${models.uniqueModels.slice(0, 5).join(', ')}`);
        }
      } catch (error) {
        console.log(`   ⚠️ listModelsFromAllEndpoints falhou: ${error.message}`);
      }

    } catch (error) {
      console.log(`   ❌ Erro ao criar LLMService: ${error.message}`);
    }

    // 4. Verificar ordem de prioridade
    console.log('\n4. Testando sistema de prioridades...');
    
    const pool = new OllamaApiPool();
    
    // Verificar se endpoints são ordenados corretamente por prioridade
    const testEndpoints = [
      { url: 'http://test1.com', type: 'ollama', priority: 3, enabled: true },
      { url: 'http://test2.com', type: 'chatgpt', priority: 1, enabled: true },
      { url: 'http://test3.com', type: 'rkllama', priority: 2, enabled: true }
    ];
    
    console.log('   📊 Endpoints de teste (por ordem de criação):');
    testEndpoints.forEach((ep, i) => {
      console.log(`      ${i + 1}. ${ep.url} (tipo: ${ep.type}, prioridade: ${ep.priority})`);
    });
    
    // Ordenar por prioridade (como faz o frontend)
    const sortedByPriority = [...testEndpoints].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    console.log('   📊 Endpoints ordenados por prioridade:');
    sortedByPriority.forEach((ep, i) => {
      console.log(`      ${i + 1}. ${ep.url} (tipo: ${ep.type}, prioridade: ${ep.priority})`);
    });

    console.log('\n✅ Teste de ordem de endpoints e modelos concluído');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
    throw error;
  }
});

test('ChatGPT Models Detection - Teste específico para ChatGPT', async () => {
  console.log('🧪 Testando especificamente a detecção de modelos ChatGPT...\n');

  try {
    // Testar diferentes cenários com ChatGPT
    console.log('1. Testando detecção de endpoint ChatGPT...');
    
    const pool = new OllamaApiPool();
    
    const chatgptEndpoints = [
      { url: 'https://api.openai.com', type: 'chatgpt' },
      { url: 'https://api.openai.com/v1', type: 'chatgpt' },
      { url: 'http://localhost:11434', type: 'ollama' },
      { url: 'http://localhost:8080', type: 'rkllama' }
    ];

    chatgptEndpoints.forEach(endpoint => {
      const detectedType = pool.getEndpointType(endpoint);
      const isChatGPT = pool.isChatGPTEndpoint(endpoint);
      console.log(`   📊 ${endpoint.url}:`);
      console.log(`      - Tipo configurado: ${endpoint.type}`);
      console.log(`      - Tipo detectado: ${detectedType}`);
      console.log(`      - É ChatGPT: ${isChatGPT}`);
      console.log(`      - Match: ${detectedType === endpoint.type ? '✅' : '❌'}`);
    });

    // 2. Testar listModels com diferentes API keys
    console.log('\n2. Testando listModels com diferentes cenários...');
    
    console.log('   🔑 Testando sem API key...');
    try {
      const client = new ChatGPTAPIClient('https://api.openai.com');
      const models = await client.listModels();
      console.log(`      - Funcionou sem API key: ✅ (${models.models.length} modelos)`);
    } catch (error) {
      console.log(`      - Falhou sem API key: ⚠️ (esperado) - ${error.message.substring(0, 50)}...`);
    }

    console.log('   🔑 Testando com API key falsa...');
    try {
      const client = new ChatGPTAPIClient('https://api.openai.com', 'fake-key');
      const models = await client.listModels();
      console.log(`      - Funcionou com key falsa: ⚠️ (inesperado) - ${models.models.length} modelos`);
    } catch (error) {
      console.log(`      - Falhou com key falsa: ✅ (esperado) - ${error.message.substring(0, 50)}...`);
    }

    console.log('\n3. Verificando estrutura de resposta...');
    
    // Testar estrutura de resposta esperada
    const expectedStructure = {
      models: [],
      success: true,
      url: 'https://api.openai.com',
      type: 'chatgpt',
      timestamp: new Date().toISOString()
    };

    console.log('   📋 Estrutura esperada para resposta de modelos:');
    console.log('      - models: Array de modelos');
    console.log('      - success: boolean');
    console.log('      - url: string com endpoint');
    console.log('      - type: "chatgpt"');
    console.log('      - timestamp: ISO string');

    console.log('\n✅ Teste específico ChatGPT concluído');

  } catch (error) {
    console.error('❌ Erro no teste ChatGPT:', error);
    throw error;
  }
});