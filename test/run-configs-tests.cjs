#!/usr/bin/env node

/**
 * Script para executar todos os testes relacionados à funcionalidade de configurações
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  async runTest(testFile, description) {
    console.log(`\n🧪 Executando: ${description}`);
    console.log(`📁 Arquivo: ${testFile}`);
    console.log('='.repeat(60));
    
    return new Promise((resolve) => {
      const testPath = path.join(__dirname, testFile);
      
      // Verificar se o arquivo existe
      if (!fs.existsSync(testPath)) {
        console.log(`❌ Arquivo de teste não encontrado: ${testPath}`);
        this.testResults.push({
          file: testFile,
          description,
          status: 'error',
          error: 'Arquivo não encontrado'
        });
        resolve(false);
        return;
      }

      const mocha = spawn('npx', ['mocha', testPath, '--reporter', 'spec'], {
        cwd: path.dirname(__dirname),
        stdio: 'inherit'
      });

      mocha.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${description} - PASSOU`);
          this.testResults.push({
            file: testFile,
            description,
            status: 'passed'
          });
          this.passedTests++;
        } else {
          console.log(`❌ ${description} - FALHOU`);
          this.testResults.push({
            file: testFile,
            description,
            status: 'failed',
            exitCode: code
          });
          this.failedTests++;
        }
        this.totalTests++;
        resolve(code === 0);
      });

      mocha.on('error', (error) => {
        console.log(`❌ Erro ao executar ${description}:`, error.message);
        this.testResults.push({
          file: testFile,
          description,
          status: 'error',
          error: error.message
        });
        this.failedTests++;
        this.totalTests++;
        resolve(false);
      });
    });
  }

  async runAllTests() {
    console.log('🚀 Iniciando testes da funcionalidade de configurações...\n');
    
    // Lista de testes para executar
    const tests = [
      {
        file: 'configs-api.test.cjs',
        description: 'Testes da API de Configurações'
      },
      {
        file: 'configs-ui.test.cjs',
        description: 'Testes da Interface de Configurações'
      }
    ];

    // Executar todos os testes
    for (const test of tests) {
      await this.runTest(test.file, test.description);
    }

    // Exibir sumário
    this.printSummary();
    
    // Retornar true se todos os testes passaram
    return this.failedTests === 0;
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMÁRIO DOS TESTES');
    console.log('='.repeat(60));
    
    console.log(`📈 Total de testes executados: ${this.totalTests}`);
    console.log(`✅ Testes que passaram: ${this.passedTests}`);
    console.log(`❌ Testes que falharam: ${this.failedTests}`);
    
    if (this.failedTests === 0) {
      console.log('\n🎉 Todos os testes passaram! A funcionalidade está funcionando corretamente.');
    } else {
      console.log('\n⚠️  Alguns testes falharam. Verifique os detalhes acima.');
    }
    
    console.log('\n📋 Detalhes dos testes:');
    this.testResults.forEach((result, index) => {
      const status = result.status === 'passed' ? '✅' : 
                     result.status === 'failed' ? '❌' : '⚠️';
      console.log(`${index + 1}. ${status} ${result.description}`);
      
      if (result.error) {
        console.log(`   Erro: ${result.error}`);
      }
      if (result.exitCode) {
        console.log(`   Código de saída: ${result.exitCode}`);
      }
    });
  }
}

// Verificar dependências
function checkDependencies() {
  console.log('🔍 Verificando dependências...');
  
  const requiredPackages = [
    'mocha',
    'chai',
    'supertest',
    'jsdom'
  ];
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log('❌ package.json não encontrado');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  const missingPackages = requiredPackages.filter(pkg => !allDependencies[pkg]);
  
  if (missingPackages.length > 0) {
    console.log('❌ Pacotes ausentes:', missingPackages.join(', '));
    console.log('💡 Execute: npm install --save-dev', missingPackages.join(' '));
    return false;
  }
  
  console.log('✅ Todas as dependências estão instaladas');
  return true;
}

// Função para testar a API em execução
async function testLiveAPI() {
  console.log('\n🌐 Testando API em execução...');
  
  try {
    const response = await fetch('http://localhost:3000/api/configs');
    
    if (response.ok) {
      console.log('✅ API está respondendo corretamente');
      const data = await response.json();
      console.log('📊 Dados retornados:', Object.keys(data));
      return true;
    } else {
      console.log('❌ API retornou erro:', response.status);
      return false;
    }
  } catch (error) {
    console.log('⚠️  API não está acessível:', error.message);
    console.log('💡 Certifique-se de que a aplicação esteja rodando em http://localhost:3000');
    return false;
  }
}

// Executar todos os testes
async function main() {
  console.log('🧪 EXECUTOR DE TESTES - CONFIGURAÇÕES\n');
  
  // Verificar dependências
  if (!checkDependencies()) {
    process.exit(1);
  }
  
  // Executar testes unitários
  const testRunner = new TestRunner();
  const allTestsPassed = await testRunner.runAllTests();
  
  // Testar API em execução (opcional)
  if (typeof fetch !== 'undefined') {
    await testLiveAPI();
  }
  
  // Sair com código apropriado
  process.exit(allTestsPassed ? 0 : 1);
}

// Executar se este script for chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro ao executar testes:', error);
    process.exit(1);
  });
}

module.exports = { TestRunner, checkDependencies, testLiveAPI };