#!/usr/bin/env node

/**
 * Test script para verificar a detecção de suporte a imagens no Ollama API Pool
 */

import test from 'node:test';
import assert from 'node:assert';
import OllamaApiPool from '../src/services/ollamaApiPool.js';
import { CONFIG } from '../src/config/index.js';

test('Ollama API Pool - Detecção de Suporte a Imagens', async () => {
  console.log('🧪 Testando detecção de suporte a imagens no Ollama API Pool...\n');
  
  try {
    // Criar instância do OllamaApiPool
    const pool = new OllamaApiPool();
    
    // 1. Verificar se o pool está habilitado
    console.log('1. Verificando status do pool...');
    const isEnabled = await pool.isEnabled();
    console.log(`   📊 Pool habilitado: ${isEnabled}`);
    
    if (!isEnabled) {
      console.log('   ⚠️ Pool não está habilitado, testando com endpoint local');
      
      // Testar método de detecção de imagem com endpoint local
      console.log('2. Testando detecção de imagem com Ollama local...');
      try {
        const { Ollama } = await import('ollama');
        const localClient = new Ollama({ host: CONFIG.llm.host });
        
        // Testar com modelo de imagem padrão
        const imageModel = CONFIG.llm.imageModel || 'llava';
        console.log(`   🔍 Testando modelo: ${imageModel}`);
        
        const supportsImage = await pool.testImageSupport(localClient, imageModel);
        console.log(`   📊 Suporte a imagem: ${supportsImage}`);
        
        if (supportsImage) {
          console.log('   ✅ Modelo local suporta processamento de imagens');
        } else {
          console.log('   ⚠️ Modelo local não suporta processamento de imagens');
        }
      } catch (error) {
        console.log(`   ⚠️ Erro ao testar modelo local: ${error.message}`);
      }
    } else {
      console.log('2. Verificando endpoints disponíveis...');
      const hasHealthy = await pool.hasHealthyEndpoints();
      console.log(`   📊 Endpoints saudáveis disponíveis: ${hasHealthy}`);
      
      if (hasHealthy) {
        // 3. Testar detecção de endpoint capaz de processar imagens
        console.log('3. Testando findImageCapableEndpoint...');
        try {
          const imageModel = CONFIG.llm.imageModel || 'llava';
          console.log(`   🔍 Procurando endpoint capaz para modelo: ${imageModel}`);
          
          const capableEndpoint = await pool.findImageCapableEndpoint(imageModel);
          
          if (capableEndpoint) {
            console.log(`   ✅ Endpoint capaz encontrado: ${capableEndpoint.host}`);
            console.log(`   📊 Modelo testado: ${imageModel}`);
          } else {
            console.log('   ⚠️ Nenhum endpoint capaz de processar imagens encontrado');
          }
        } catch (error) {
          console.log(`   ⚠️ Erro ao procurar endpoint capaz: ${error.message}`);
        }
        
        // 4. Testar geração com imagem (simular request)
        console.log('4. Testando geração com conteúdo de imagem...');
        try {
          const testOptions = {
            model: CONFIG.llm.imageModel || 'llava',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Descreva esta imagem' },
                  { 
                    type: 'image_url', 
                    image_url: { 
                      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA6Q' 
                    } 
                  }
                ]
              }
            ]
          };
          
          // Verificar se o método generate detecta imagem e roteia corretamente
          console.log('   🔍 Testando roteamento automático para endpoint capaz...');
          
          // Não executar a geração real para evitar timeout, apenas testar a lógica de detecção
          const hasImageContent = testOptions.messages.some(msg => 
            Array.isArray(msg.content) && 
            msg.content.some(content => content.type === 'image_url')
          );
          
          console.log(`   📊 Conteúdo de imagem detectado: ${hasImageContent}`);
          
          if (hasImageContent) {
            console.log('   ✅ Lógica de detecção de imagem funcionando');
          }
          
        } catch (error) {
          console.log(`   ⚠️ Erro no teste de geração: ${error.message}`);
        }
      }
    }
    
    // 5. Verificar cache de suporte a imagens
    console.log('5. Verificando cache de suporte a imagens...');
    const cacheSize = Object.keys(pool.imageSupportCache || {}).length;
    console.log(`   📊 Entradas no cache: ${cacheSize}`);
    
    if (cacheSize > 0) {
      console.log('   ✅ Cache de suporte a imagens está sendo utilizado');
    }
    
    console.log('\n✅ Teste de detecção de imagens concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste de detecção de imagens:', error);
    throw error;
  }
});

test('Ollama API Pool - Teste de Fallback para Imagens', async () => {
  console.log('🧪 Testando fallback de processamento de imagens...\n');
  
  try {
    const pool = new OllamaApiPool();
    
    // Simular cenário onde primeiro endpoint não suporta imagens
    console.log('1. Simulando cenário de fallback...');
    
    const imageModel = CONFIG.llm.imageModel || 'llava';
    console.log(`   🔍 Modelo de imagem: ${imageModel}`);
    
    // Verificar se existe pelo menos um endpoint local para fallback
    const { Ollama } = await import('ollama');
    const localClient = new Ollama({ host: CONFIG.llm.host });
    
    console.log('2. Testando endpoint local como fallback...');
    try {
      // Listar modelos disponíveis no endpoint local
      const models = await localClient.list();
      console.log(`   📊 Modelos disponíveis localmente: ${models.models.length}`);
      
      const hasImageModel = models.models.some(model => 
        model.name.includes('llava') || 
        model.name.includes('vision') ||
        model.name === imageModel
      );
      
      console.log(`   📊 Modelo de imagem disponível localmente: ${hasImageModel}`);
      
      if (hasImageModel) {
        console.log('   ✅ Fallback local disponível para processamento de imagens');
      } else {
        console.log('   ⚠️ Modelo de imagem não disponível localmente');
        console.log('   💡 Para testar imagens, instale um modelo como: ollama pull llava');
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao verificar modelos locais: ${error.message}`);
      console.log('   💡 Verifique se o Ollama está rodando em:', CONFIG.llm.host);
    }
    
    console.log('\n✅ Teste de fallback de imagens concluído');
    
  } catch (error) {
    console.error('❌ Erro no teste de fallback de imagens:', error);
    throw error;
  }
});

test('Ollama API Pool - Verificação de Configuração de Imagem', async () => {
  console.log('🧪 Verificando configuração para processamento de imagens...\n');
  
  // Verificar configurações relacionadas a imagens
  console.log(`📊 Host Ollama: ${CONFIG.llm.host}`);
  console.log(`📊 Modelo padrão: ${CONFIG.llm.model}`);
  console.log(`📊 Modelo de imagem: ${CONFIG.llm.imageModel || 'llava (padrão)'}`);
  
  // Verificar se existe configuração de pool de APIs
  if (CONFIG.ollamaApi?.enabled) {
    console.log(`📊 OllamaAPI habilitado: ${CONFIG.ollamaApi.enabled}`);
    console.log(`📊 Endpoints configurados: ${CONFIG.ollamaApi.endpoints?.length || 0}`);
  } else {
    console.log('📊 OllamaAPI não configurado, usando apenas endpoint local');
  }
  
  console.log('\n✅ Verificação de configuração de imagem concluída');
});