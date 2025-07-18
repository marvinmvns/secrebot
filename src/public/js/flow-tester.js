// Flow Tester JavaScript
class FlowTester {
    constructor() {
        this.selectedFlowId = null;
        this.selectedFlowName = null;
        this.testSessionId = null;
        this.isTestActive = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadFlows();
        this.updateWelcomeTime();
    }
    
    initializeElements() {
        this.flowList = document.getElementById('flowList');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.sessionInfo = document.getElementById('sessionInfo');
        this.sessionId = document.getElementById('sessionId');
        this.flowName = document.getElementById('flowName');
    }
    
    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTest());
        this.stopBtn.addEventListener('click', () => this.stopTest());
        this.clearBtn.addEventListener('click', () => this.clearChat());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.sendBtn.disabled = !this.messageInput.value.trim() || !this.isTestActive;
        });
    }
    
    updateWelcomeTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('welcomeTime').textContent = timeString;
    }
    
    async loadFlows() {
        try {
            const response = await fetch('/api/flow/list');
            const data = await response.json();
            
            if (data.success && data.flows && data.flows.length > 0) {
                this.renderFlowList(data.flows);
            } else {
                this.flowList.innerHTML = `
                    <div class="no-flows">
                        <i class="fas fa-info-circle me-2"></i>
                        Nenhum fluxo encontrado
                    </div>
                `;
            }
        } catch (error) {
            console.error('Erro ao carregar fluxos:', error);
            this.flowList.innerHTML = `
                <div class="no-flows text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Erro ao carregar fluxos
                </div>
            `;
        }
    }
    
    renderFlowList(flows) {
        this.flowList.innerHTML = flows.map(flow => `
            <div class="flow-item" data-flow-id="${flow.id}" data-flow-name="${flow.name}">
                <div class="flow-title">${flow.name}</div>
                ${flow.description ? `<div class="flow-description">${flow.description}</div>` : ''}
                ${flow.alias ? `<div class="flow-alias">Alias: ${flow.alias}</div>` : ''}
            </div>
        `).join('');
        
        // Adicionar event listeners aos itens
        this.flowList.querySelectorAll('.flow-item').forEach(item => {
            item.addEventListener('click', () => this.selectFlow(item));
        });
    }
    
    selectFlow(item) {
        // Remover seleção anterior
        this.flowList.querySelectorAll('.flow-item').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Selecionar novo flow
        item.classList.add('selected');
        this.selectedFlowId = item.dataset.flowId;
        this.selectedFlowName = item.dataset.flowName;
        
        // Atualizar UI
        this.flowName.textContent = this.selectedFlowName;
        this.startBtn.disabled = false;
        
        console.log('Flow selecionado:', this.selectedFlowId, this.selectedFlowName);
    }
    
    async startTest() {
        if (!this.selectedFlowId) {
            this.showAlert('Selecione um fluxo primeiro', 'warning');
            return;
        }
        
        try {
            this.startBtn.disabled = true;
            this.startBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Iniciando...';
            
            const response = await fetch('/api/flow/test/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    flowId: this.selectedFlowId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.testSessionId = data.sessionId;
                this.isTestActive = data.sessionActive || true;
                
                // Atualizar UI
                this.updateTestStatus(true);
                this.sessionId.textContent = this.testSessionId;
                this.sessionInfo.style.display = 'block';
                this.messageInput.disabled = false;
                this.stopBtn.disabled = false;
                
                this.addMessage('🚀 Teste iniciado! O fluxo foi ativado.', 'system');
                
                // Exibir mensagens iniciais capturadas durante a execução do fluxo
                if (data.initialMessages && data.initialMessages.length > 0) {
                    data.initialMessages.forEach(message => {
                        this.addMessage(message, 'bot');
                    });
                }
                
                // Verificar se a sessão ainda está ativa após execução inicial
                if (!data.sessionActive) {
                    setTimeout(() => {
                        this.addMessage('🏁 Fluxo finalizado automaticamente.', 'system');
                        this.stopTest();
                    }, 500);
                }
                
            } else {
                throw new Error(data.error || 'Erro ao iniciar teste');
            }
            
        } catch (error) {
            console.error('Erro ao iniciar teste:', error);
            this.showAlert('Erro ao iniciar teste: ' + error.message, 'danger');
        } finally {
            this.startBtn.disabled = false;
            this.startBtn.innerHTML = '<i class="fas fa-play me-2"></i>Iniciar Teste';
        }
    }
    
    async stopTest() {
        if (!this.testSessionId) return;
        
        try {
            this.stopBtn.disabled = true;
            this.stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Parando...';
            
            const response = await fetch('/api/flow/test/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.testSessionId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.isTestActive = false;
                this.testSessionId = null;
                
                // Atualizar UI
                this.updateTestStatus(false);
                this.sessionInfo.style.display = 'none';
                this.messageInput.disabled = true;
                this.messageInput.value = '';
                this.sendBtn.disabled = true;
                
                this.addMessage('🛑 Teste finalizado.', 'system');
            } else {
                throw new Error(data.error || 'Erro ao parar teste');
            }
            
        } catch (error) {
            console.error('Erro ao parar teste:', error);
            this.showAlert('Erro ao parar teste: ' + error.message, 'danger');
        } finally {
            this.stopBtn.disabled = true;
            this.stopBtn.innerHTML = '<i class="fas fa-stop me-2"></i>Parar Teste';
        }
    }
    
    clearChat() {
        const welcomeMessage = this.chatMessages.querySelector('.message');
        this.chatMessages.innerHTML = '';
        this.chatMessages.appendChild(welcomeMessage);
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isTestActive || !this.testSessionId) return;
        
        // Adicionar mensagem do usuário
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        
        // Mostrar indicador de digitação
        this.showTypingIndicator();
        
        try {
            const response = await fetch('/api/flow/test/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.testSessionId,
                    message: message
                })
            });
            
            const data = await response.json();
            
            // Remover indicador de digitação
            this.hideTypingIndicator();
            
            if (data.success) {
                if (data.response) {
                    this.addMessage(data.response, 'bot');
                }
                
                // Verificar se sessão ainda está ativa
                if (!data.sessionActive) {
                    this.addMessage('🏁 Fluxo finalizado.', 'system');
                    await this.stopTest();
                }
            } else {
                this.addMessage('❌ Erro: ' + (data.error || 'Erro desconhecido'), 'system');
            }
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('Erro ao enviar mensagem:', error);
            this.addMessage('❌ Erro de conexão', 'system');
        }
    }
    
    async checkForBotResponse() {
        if (!this.isTestActive || !this.testSessionId) return;
        
        try {
            const response = await fetch(`/api/flow/test/status/${this.testSessionId}`);
            const data = await response.json();
            
            if (data.success && data.sessionActive) {
                // Se houver resposta automática, ela seria capturada aqui
                // Por enquanto, apenas verificamos se a sessão ainda está ativa
            }
        } catch (error) {
            console.error('Erro ao verificar status:', error);
        }
    }
    
    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type === 'user' ? 'user' : 'bot'}`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        if (type === 'system') {
            messageDiv.className = 'message message-bot';
            messageDiv.style.background = '#e3f2fd';
            messageDiv.style.color = '#1565c0';
            messageDiv.style.fontStyle = 'italic';
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-time">${timeString}</div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    updateTestStatus(active) {
        if (active) {
            this.statusIndicator.className = 'status-indicator status-active';
            this.statusIndicator.innerHTML = '<i class="fas fa-circle me-1"></i>Teste ativo';
        } else {
            this.statusIndicator.className = 'status-indicator status-inactive';
            this.statusIndicator.innerHTML = '<i class="fas fa-circle me-1"></i>Nenhum teste ativo';
        }
    }
    
    showAlert(message, type) {
        // Criar alert temporário
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 400px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Remove automaticamente após 5 segundos
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    new FlowTester();
});