import { test } from 'node:test';
import assert from 'node:assert/strict';
import fetch from 'node-fetch';
import { Ollama } from 'ollama';

/**
 * Script de Teste Inteligente para Flows usando LLM
 * 
 * Este script usa inteligência artificial para testar flows de forma autônoma:
 * - Analisa as respostas do bot
 * - Decide qual ação tomar baseado no contexto
 * - Detecta erros de rotas automaticamente
 * - Testa cenários diversos de navegação
 */

const API_BASE = 'http://localhost:3000';
const LLM_CLIENT = new Ollama({ host: 'http://localhost:11434' });

class FlowLLMTester {
    constructor() {
        this.sessionId = null;
        this.conversationHistory = [];
        this.errors = [];
        this.testResults = [];
        this.maxSteps = 200; // Máximo de passos por teste
    }

    /**
     * Prompt especializado para o LLM analisar e responder flows
     */
    getAnalysisPrompt(botResponse, conversationHistory) {
        return `Você é um testador inteligente de flows conversacionais para uma academia de jiu-jitsu.

CONTEXTO DO FLOW:
O bot é um assistente de atendimento que oferece:
- Informações da academia
- Planos e preços 
- Aula experimental grátis
- Especialista IA para dúvidas
- Localização e contato
- Histórias de sucesso

HISTÓRICO DA CONVERSA:
${conversationHistory.map(item => `${item.sender}: "${item.message}"`).join('\n')}

ÚLTIMA RESPOSTA DO BOT:
"${botResponse}"

INSTRUÇÕES:
1. Analise a resposta do bot e determine qual é a melhor ação a tomar
2. Se o bot apresenta opções numeradas (1-6), escolha uma opção diferente a cada teste
3. Se o bot faz uma pergunta, responda de forma realista
4. Se o bot oferece botões como CONTINUAR, MENU, EXPERIMENTAL, CONTATO, teste-os
5. Varie as respostas para testar diferentes cenários
6. Se detectar erro ou flow quebrado, responda "ERRO_DETECTADO"

TIPOS DE RESPOSTA QUE VOCÊ DEVE DAR:
- Para menus numerados: responda com o número (ex: "1", "2", "3")
- Para perguntas sobre nome: responda nomes realistas (ex: "Maria", "João")  
- Para perguntas sobre experiência: "Sim" ou "Não"
- Para botões de navegação: "CONTINUAR", "MENU", "EXPERIMENTAL", "CONTATO"
- Para perguntas sobre jiu-jitsu: faça perguntas realistas sobre o esporte
- Para comandos inválidos (teste): ocasionalmente envie comandos errados como "xyz", "abc"

RESPONDA APENAS COM A MENSAGEM A SER ENVIADA (sem explicações ou aspas adicionais).`;
    }

    /**
     * Inicia uma sessão de teste
     */
    async startTestSession(flowId) {
        try {
            const response = await fetch(`${API_BASE}/api/flow/test/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flowId })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(`Falha ao iniciar sessão: ${data.error}`);
            }

            this.sessionId = data.sessionId;
            
            // Adicionar mensagens iniciais ao histórico
            if (data.initialMessages) {
                data.initialMessages.forEach(msg => {
                    this.conversationHistory.push({
                        sender: 'BOT',
                        message: msg,
                        timestamp: new Date()
                    });
                });
            }

            console.log(`✅ Sessão iniciada: ${this.sessionId}`);
            console.log(`📨 Mensagem inicial: ${data.initialMessages?.[0]?.substring(0, 100)}...`);
            
            return data;
        } catch (error) {
            console.error(`❌ Erro ao iniciar sessão: ${error.message}`);
            throw error;
        }
    }

    /**
     * Envia mensagem e recebe resposta
     */
    async sendMessage(message) {
        try {
            const response = await fetch(`${API_BASE}/api/flow/test/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message: message
                })
            });

            const data = await response.json();
            
            // Adicionar ao histórico
            this.conversationHistory.push({
                sender: 'USER',
                message: message,
                timestamp: new Date()
            });

            if (data.success && data.response) {
                this.conversationHistory.push({
                    sender: 'BOT',
                    message: data.response,
                    timestamp: new Date()
                });
            }

            return data;
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem: ${error.message}`);
            this.errors.push({
                type: 'SEND_ERROR',
                message: error.message,
                step: this.conversationHistory.length
            });
            throw error;
        }
    }

    /**
     * Usa LLM para analisar resposta e gerar próxima ação
     */
    async analyzeAndRespond(botResponse) {
        try {
            const prompt = this.getAnalysisPrompt(botResponse, this.conversationHistory);
            
            const response = await LLM_CLIENT.generate({
                model: 'llama3.2:latest',
                prompt: prompt,
                options: {
                    temperature: 0.7,
                    max_tokens: 100
                }
            });

            let nextAction = response.response.trim();
            
            // Limpar resposta de possíveis aspas ou formatação
            nextAction = nextAction.replace(/^["']|["']$/g, '');
            
            // Verificar se é um erro detectado
            if (nextAction === 'ERRO_DETECTADO') {
                this.errors.push({
                    type: 'LLM_DETECTED_ERROR',
                    message: 'LLM detectou erro no flow',
                    botResponse: botResponse,
                    step: this.conversationHistory.length
                });
                return null;
            }

            console.log(`🤖 LLM decidiu responder: "${nextAction}"`);
            return nextAction;
            
        } catch (error) {
            console.error(`❌ Erro no LLM: ${error.message}`);
            this.errors.push({
                type: 'LLM_ERROR',
                message: error.message,
                step: this.conversationHistory.length
            });
            
            // Fallback: resposta padrão baseada na mensagem do bot
            return this.getFallbackResponse(botResponse);
        }
    }

    /**
     * Resposta de fallback quando LLM falha
     */
    getFallbackResponse(botResponse) {
        const text = botResponse.toLowerCase();
        
        if (text.includes('nome')) {
            return 'João Testador';
        } else if (text.includes('experiência') || text.includes('pratica')) {
            return 'Não';
        } else if (text.includes('1️⃣') && text.includes('6️⃣')) {
            // Menu principal - escolher opção aleatória
            return Math.floor(Math.random() * 6) + 1 + '';
        } else if (text.includes('continuar') || text.includes('menu') || text.includes('experimental')) {
            const options = ['CONTINUAR', 'MENU', 'EXPERIMENTAL', 'CONTATO'];
            return options[Math.floor(Math.random() * options.length)];
        } else {
            return 'ok';
        }
    }

    /**
     * Para sessão de teste
     */
    async stopTestSession() {
        if (!this.sessionId) return;
        
        try {
            await fetch(`${API_BASE}/api/flow/test/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
            
            console.log(`🛑 Sessão finalizada: ${this.sessionId}`);
        } catch (error) {
            console.error(`❌ Erro ao finalizar sessão: ${error.message}`);
        }
    }

    /**
     * Executa teste completo do flow
     */
    async runFullTest(flowId, testName) {
        console.log(`\n🚀 Iniciando teste: ${testName}`);
        console.log(`📋 Flow ID: ${flowId}`);
        
        try {
            // Iniciar sessão
            const startResult = await this.startTestSession(flowId);
            
            let step = 0;
            let lastBotResponse = startResult.initialMessages?.[0] || '';
            
            // Loop de conversa
            while (step < this.maxSteps) {
                step++;
                console.log(`\n--- PASSO ${step} ---`);
                
                // LLM analisa e decide próxima ação
                const nextAction = await this.analyzeAndRespond(lastBotResponse);
                
                if (!nextAction) {
                    console.log(`❌ Teste interrompido - erro detectado no passo ${step}`);
                    break;
                }
                
                console.log(`📤 Enviando: "${nextAction}"`);
                
                // Enviar mensagem
                const result = await this.sendMessage(nextAction);
                
                if (!result.success) {
                    this.errors.push({
                        type: 'API_ERROR',
                        message: result.error || 'Erro desconhecido',
                        step: step
                    });
                    console.log(`❌ Erro na API: ${result.error}`);
                    break;
                }
                
                if (result.response) {
                    lastBotResponse = result.response;
                    console.log(`📥 Bot respondeu: "${lastBotResponse.substring(0, 100)}..."`);
                } else {
                    console.log(`📥 Bot sem resposta`);
                }
                
                // Verificar se sessão ainda está ativa
                if (!result.sessionActive) {
                    console.log(`🏁 Sessão finalizada pelo flow no passo ${step}`);
                    break;
                }
                
                // Pausa para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            await this.stopTestSession();
            
            // Resultado do teste
            const testResult = {
                testName,
                flowId,
                steps: step,
                errors: this.errors.length,
                success: this.errors.length === 0,
                conversationLength: this.conversationHistory.length,
                errorDetails: this.errors
            };
            
            this.testResults.push(testResult);
            
            console.log(`\n📊 RESULTADO DO TESTE: ${testName}`);
            console.log(`✅ Passos executados: ${step}`);
            console.log(`❌ Erros encontrados: ${this.errors.length}`);
            console.log(`📝 Mensagens trocadas: ${this.conversationHistory.length}`);
            
            if (this.errors.length > 0) {
                console.log(`\n🐛 ERROS DETECTADOS:`);
                this.errors.forEach((error, index) => {
                    console.log(`${index + 1}. ${error.type}: ${error.message} (Passo ${error.step})`);
                });
            }
            
            return testResult;
            
        } catch (error) {
            console.error(`❌ Erro geral no teste: ${error.message}`);
            await this.stopTestSession();
            throw error;
        }
    }

    /**
     * Limpa dados para novo teste
     */
    reset() {
        this.sessionId = null;
        this.conversationHistory = [];
        this.errors = [];
    }

    /**
     * Gera relatório final de todos os testes
     */
    generateReport() {
        console.log(`\n📈 RELATÓRIO FINAL DOS TESTES`);
        console.log(`===============================`);
        
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(t => t.success).length;
        const failedTests = totalTests - successfulTests;
        
        console.log(`🎯 Total de testes: ${totalTests}`);
        console.log(`✅ Testes bem-sucedidos: ${successfulTests}`);
        console.log(`❌ Testes com falhas: ${failedTests}`);
        console.log(`📊 Taxa de sucesso: ${totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0}%`);
        
        if (failedTests > 0) {
            console.log(`\n🚨 RESUMO DOS PROBLEMAS ENCONTRADOS:`);
            
            const errorTypes = {};
            this.testResults.forEach(test => {
                test.errorDetails.forEach(error => {
                    errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
                });
            });
            
            Object.entries(errorTypes).forEach(([type, count]) => {
                console.log(`- ${type}: ${count} ocorrência(s)`);
            });
        }
        
        return {
            totalTests,
            successfulTests,
            failedTests,
            successRate: totalTests > 0 ? (successfulTests / totalTests) * 100 : 0,
            testResults: this.testResults
        };
    }
}

// Testes automatizados
test('Teste LLM: Flow Academia Jiu-Jitsu V2', async () => {
    const tester = new FlowLLMTester();
    
    try {
        const result = await tester.runFullTest(
            'academia-jiu-jitsu-v2-atendime',
            'Teste Navegação Completa'
        );
        
        // Verificar se o teste foi bem-sucedido
        assert.ok(result.success, `Teste falhou com ${result.errors} erro(s)`);
        assert.ok(result.steps >= 3, 'Teste deve ter pelo menos 3 passos');
        
    } catch (error) {
        console.error('Erro no teste:', error);
        assert.fail(`Teste falhou: ${error.message}`);
    }
});

test('Teste LLM: Flow Academia Jiu-Jitsu Básico', async () => {
    const tester = new FlowLLMTester();
    
    try {
        const result = await tester.runFullTest(
            'academia-jiu-jitsu-atendimento',
            'Teste Flow Básico'
        );
        
        assert.ok(result.success, `Teste falhou com ${result.errors} erro(s)`);
        
    } catch (error) {
        console.error('Erro no teste:', error);
        assert.fail(`Teste falhou: ${error.message}`);
    }
});

test('Teste LLM: Múltiplos Cenários', async () => {
    const tester = new FlowLLMTester();
    
    const scenarios = [
        { flowId: 'academia-jiu-jitsu-v2-atendime', name: 'Cenário 1 - Menu Principal' },
        { flowId: 'academia-jiu-jitsu-v2-atendime', name: 'Cenário 2 - Experimental' },
        { flowId: 'academia-jiu-jitsu-v2-atendime', name: 'Cenário 3 - Especialista IA' }
    ];
    
    for (const scenario of scenarios) {
        tester.reset();
        
        try {
            await tester.runFullTest(scenario.flowId, scenario.name);
        } catch (error) {
            console.error(`Erro no ${scenario.name}:`, error);
        }
    }
    
    // Gerar relatório final
    const report = tester.generateReport();
    
    // Pelo menos 70% dos testes devem passar
    assert.ok(report.successRate >= 70, `Taxa de sucesso muito baixa: ${report.successRate}%`);
});

export default FlowLLMTester;