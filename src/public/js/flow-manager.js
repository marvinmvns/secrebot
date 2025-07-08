// Flow Manager JavaScript
class FlowManager {
    constructor() {
        this.flows = [];
        this.currentDeleteFlowId = null;
        this.currentDuplicateFlowId = null;
        this.stats = {};
        
        this.init();
    }
    
    async init() {
        await this.loadFlows();
        await this.loadStats();
        this.setupEventListeners();
        this.updateStatsDisplay();
    }
    
    setupEventListeners() {
        // Busca em tempo real
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', this.debounce(() => {
            this.searchFlows(searchInput.value);
        }, 300));
        
        // Ordenação
        const sortSelect = document.getElementById('sort-select');
        sortSelect.addEventListener('change', () => {
            this.sortFlows();
        });
    }
    
    async loadFlows() {
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/flow/list');
            const data = await response.json();
            
            if (data.success) {
                this.flows = data.flows;
                this.displayFlows(this.flows);
            } else {
                this.showError('Erro ao carregar fluxos: ' + data.error);
            }
            
        } catch (error) {
            console.error('Erro ao carregar fluxos:', error);
            this.showError('Erro ao comunicar com o servidor');
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/flow/stats');
            const data = await response.json();
            
            if (data.success) {
                this.stats = data.stats;
            }
            
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }
    
    updateStatsDisplay() {
        document.getElementById('total-flows').textContent = this.stats.totalFlows || 0;
        document.getElementById('total-nodes').textContent = this.stats.totalNodes || 0;
        document.getElementById('total-connections').textContent = this.stats.totalConnections || 0;
        document.getElementById('avg-nodes').textContent = this.stats.averageNodesPerFlow || 0;
    }
    
    displayFlows(flows) {
        const container = document.getElementById('flows-container');
        const emptyState = document.getElementById('empty-state');
        
        if (!flows || flows.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        const html = flows.map(flow => this.createFlowCard(flow)).join('');
        container.innerHTML = html;
    }
    
    createFlowCard(flow) {
        const createdDate = new Date(flow.createdAt).toLocaleDateString('pt-BR');
        const modifiedDate = new Date(flow.lastModified).toLocaleDateString('pt-BR');
        const nodeTypeIcons = {
            'start': 'fas fa-play',
            'message': 'fas fa-comment',
            'condition': 'fas fa-code-branch',
            'input': 'fas fa-keyboard',
            'delay': 'fas fa-clock',
            'llm': 'fas fa-robot',
            'webhook': 'fas fa-plug',
            'end': 'fas fa-stop'
        };
        
        return `
            <div class="flow-card" data-flow-id="${flow.id}">
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <div class="d-flex align-items-center mb-2">
                            <h5 class="mb-0 me-3">${flow.name}</h5>
                            <span class="flow-status status-active">Ativo</span>
                        </div>
                        
                        <p class="text-muted mb-2">
                            ${flow.description || 'Sem descrição'}
                        </p>
                        
                        <div class="flow-meta">
                            <div class="row g-3">
                                <div class="col-auto">
                                    <i class="fas fa-circle-nodes me-1"></i>
                                    ${flow.nodeCount} nós
                                </div>
                                <div class="col-auto">
                                    <i class="fas fa-link me-1"></i>
                                    ${flow.connectionCount} conexões
                                </div>
                                <div class="col-auto">
                                    <i class="fas fa-calendar me-1"></i>
                                    Criado em ${createdDate}
                                </div>
                                <div class="col-auto">
                                    <i class="fas fa-edit me-1"></i>
                                    Modificado em ${modifiedDate}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-4 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-primary btn-sm" 
                                    onclick="flowManager.editFlow('${flow.id}')" 
                                    title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-success btn-sm" 
                                    onclick="flowManager.duplicateFlow('${flow.id}')" 
                                    title="Duplicar">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-outline-info btn-sm" 
                                    onclick="flowManager.exportFlow('${flow.id}')" 
                                    title="Exportar">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="btn btn-outline-warning btn-sm" 
                                    onclick="flowManager.testFlow('${flow.id}')" 
                                    title="Testar">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn btn-outline-danger btn-sm" 
                                    onclick="flowManager.deleteFlow('${flow.id}', '${flow.name}')" 
                                    title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async searchFlows(query) {
        try {
            if (!query.trim()) {
                this.displayFlows(this.flows);
                return;
            }
            
            const response = await fetch(`/api/flow/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayFlows(data.flows);
            }
            
        } catch (error) {
            console.error('Erro na busca:', error);
        }
    }
    
    sortFlows() {
        const sortBy = document.getElementById('sort-select').value;
        const sortedFlows = [...this.flows];
        
        sortedFlows.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'created':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'modified':
                    return new Date(b.lastModified) - new Date(a.lastModified);
                case 'nodes':
                    return b.nodeCount - a.nodeCount;
                default:
                    return 0;
            }
        });
        
        this.displayFlows(sortedFlows);
    }
    
    editFlow(flowId) {
        window.location.href = `/flow-builder?id=${flowId}`;
    }
    
    deleteFlow(flowId, flowName) {
        this.currentDeleteFlowId = flowId;
        document.getElementById('delete-flow-name').textContent = flowName;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
    
    async confirmDelete() {
        if (!this.currentDeleteFlowId) return;
        
        try {
            const response = await fetch(`/api/flow/${this.currentDeleteFlowId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Fluxo excluído com sucesso!');
                await this.loadFlows();
                await this.loadStats();
                this.updateStatsDisplay();
            } else {
                this.showError('Erro ao excluir fluxo: ' + data.error);
            }
            
        } catch (error) {
            console.error('Erro ao excluir fluxo:', error);
            this.showError('Erro ao comunicar com o servidor');
        }
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        this.currentDeleteFlowId = null;
    }
    
    duplicateFlow(flowId) {
        this.currentDuplicateFlowId = flowId;
        const flow = this.flows.find(f => f.id === flowId);
        
        if (flow) {
            document.getElementById('duplicate-name').value = `${flow.name} (Cópia)`;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('duplicateModal'));
        modal.show();
    }
    
    async confirmDuplicate() {
        if (!this.currentDuplicateFlowId) return;
        
        const newName = document.getElementById('duplicate-name').value.trim();
        if (!newName) {
            this.showError('Nome do novo fluxo é obrigatório');
            return;
        }
        
        try {
            const response = await fetch(`/api/flow/${this.currentDuplicateFlowId}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newName })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Fluxo duplicado com sucesso!');
                await this.loadFlows();
                await this.loadStats();
                this.updateStatsDisplay();
            } else {
                this.showError('Erro ao duplicar fluxo: ' + data.error);
            }
            
        } catch (error) {
            console.error('Erro ao duplicar fluxo:', error);
            this.showError('Erro ao comunicar com o servidor');
        }
        
        // Fechar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('duplicateModal'));
        modal.hide();
        this.currentDuplicateFlowId = null;
    }
    
    async exportFlow(flowId) {
        try {
            const response = await fetch(`/api/flow/${flowId}/export`);
            
            if (response.ok) {
                const blob = await response.blob();
                const filename = response.headers.get('Content-Disposition')
                    ?.split('filename=')[1]?.replace(/"/g, '') || 'flow.json';
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                this.showSuccess('Fluxo exportado com sucesso!');
            } else {
                this.showError('Erro ao exportar fluxo');
            }
            
        } catch (error) {
            console.error('Erro ao exportar fluxo:', error);
            this.showError('Erro ao comunicar com o servidor');
        }
    }
    
    async testFlow(flowId) {
        try {
            // Carregar dados do fluxo
            const response = await fetch(`/api/flow/${flowId}`);
            const data = await response.json();
            
            if (!data.success) {
                this.showError('Erro ao carregar fluxo para teste');
                return;
            }
            
            // Testar fluxo
            const testResponse = await fetch('/api/flow/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data.flow)
            });
            
            const testData = await testResponse.json();
            
            if (testData.success) {
                this.showSuccess('Teste do fluxo iniciado! Verifique o WhatsApp.');
            } else {
                this.showError('Erro no teste: ' + testData.error);
            }
            
        } catch (error) {
            console.error('Erro ao testar fluxo:', error);
            this.showError('Erro ao comunicar com o servidor');
        }
    }
    
    importFlow() {
        const modal = new bootstrap.Modal(document.getElementById('importModal'));
        modal.show();
    }
    
    async performImport() {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showError('Selecione um arquivo para importar');
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('flowFile', file);
            
            const response = await fetch('/api/flow/import', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Fluxo importado com sucesso!');
                await this.loadFlows();
                await this.loadStats();
                this.updateStatsDisplay();
                
                // Fechar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('importModal'));
                modal.hide();
            } else {
                this.showError('Erro ao importar fluxo: ' + data.error);
            }
            
        } catch (error) {
            console.error('Erro ao importar fluxo:', error);
            this.showError('Erro ao processar arquivo');
        }
    }
    
    async refreshFlows() {
        await this.loadFlows();
        await this.loadStats();
        this.updateStatsDisplay();
        this.showSuccess('Fluxos atualizados!');
    }
    
    async exportAllFlows() {
        try {
            const flows = this.flows;
            const exportData = {
                flows: flows,
                exportedAt: new Date().toISOString(),
                total: flows.length
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `all_flows_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showSuccess('Todos os fluxos exportados com sucesso!');
            
        } catch (error) {
            console.error('Erro ao exportar todos os fluxos:', error);
            this.showError('Erro ao exportar fluxos');
        }
    }
    
    async validateAllFlows() {
        try {
            let validFlows = 0;
            let invalidFlows = 0;
            const errors = [];
            
            for (const flow of this.flows) {
                const response = await fetch(`/api/flow/${flow.id}`);
                const data = await response.json();
                
                if (data.success) {
                    const validateResponse = await fetch('/api/flow/validate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(data.flow)
                    });
                    
                    const validateData = await validateResponse.json();
                    
                    if (validateData.success && validateData.validation.valid) {
                        validFlows++;
                    } else {
                        invalidFlows++;
                        errors.push(`${flow.name}: ${validateData.validation.error}`);
                    }
                }
            }
            
            let message = `Validação concluída!\n✅ ${validFlows} fluxos válidos\n❌ ${invalidFlows} fluxos com problemas`;
            
            if (errors.length > 0) {
                message += '\n\nErros encontrados:\n' + errors.join('\n');
            }
            
            if (invalidFlows > 0) {
                this.showError(message);
            } else {
                this.showSuccess(message);
            }
            
        } catch (error) {
            console.error('Erro ao validar fluxos:', error);
            this.showError('Erro ao validar fluxos');
        }
    }
    
    viewStats() {
        const stats = this.stats;
        let message = `📊 Estatísticas dos Fluxos\n\n`;
        message += `📁 Total de Fluxos: ${stats.totalFlows || 0}\n`;
        message += `🔗 Total de Nós: ${stats.totalNodes || 0}\n`;
        message += `⚡ Total de Conexões: ${stats.totalConnections || 0}\n`;
        message += `📈 Média de Nós por Fluxo: ${stats.averageNodesPerFlow || 0}\n\n`;
        
        if (stats.nodeTypes && Object.keys(stats.nodeTypes).length > 0) {
            message += `🎛️ Tipos de Nós:\n`;
            Object.entries(stats.nodeTypes).forEach(([type, count]) => {
                message += `   • ${type}: ${count}\n`;
            });
        }
        
        if (stats.lastModified) {
            const lastModified = new Date(stats.lastModified).toLocaleString('pt-BR');
            message += `\n🕒 Última Modificação: ${lastModified}`;
        }
        
        alert(message);
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        loading.style.display = show ? 'block' : 'none';
    }
    
    showSuccess(message) {
        this.showAlert(message, 'success');
    }
    
    showError(message) {
        this.showAlert(message, 'danger');
    }
    
    showAlert(message, type) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const container = document.querySelector('.manager-container');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Funções globais
let flowManager;

document.addEventListener('DOMContentLoaded', () => {
    flowManager = new FlowManager();
});

function refreshFlows() {
    flowManager.refreshFlows();
}

function importFlow() {
    flowManager.importFlow();
}

function exportAllFlows() {
    flowManager.exportAllFlows();
}

function validateAllFlows() {
    flowManager.validateAllFlows();
}

function viewStats() {
    flowManager.viewStats();
}

function confirmDelete() {
    flowManager.confirmDelete();
}

function confirmDuplicate() {
    flowManager.confirmDuplicate();
}

function performImport() {
    flowManager.performImport();
}