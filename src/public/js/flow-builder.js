// Flow Builder JavaScript
class FlowBuilder {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.svg = document.getElementById('connection-svg');
        this.nodes = new Map();
        this.connections = [];
        this.selectedNode = null;
        this.connecting = false;
        this.connectionStart = null;
        this.dragOffset = { x: 0, y: 0 };
        this.nodeCounter = 0;
        this.flowData = {
            id: null,
            name: '',
            description: '',
            nodes: [],
            connections: []
        };
        
        this.initializeEventListeners();
        this.updateStats();
    }
    
    initializeEventListeners() {
        // Drag and drop from palette
        const nodeItems = document.querySelectorAll('.node-item');
        nodeItems.forEach(item => {
            item.addEventListener('dragstart', this.handleDragStart.bind(this));
        });
        
        // Canvas drop
        this.canvas.addEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleDrop.bind(this));
        
        // Canvas click (deselect)
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Resize handler
        window.addEventListener('resize', this.updateSVGSize.bind(this));
        this.updateSVGSize();
    }
    
    handleDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
    
    handleDrop(e) {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData('text/plain');
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - 100; // Offset para centralizar
        const y = e.clientY - rect.top - 50;
        
        this.createNode(nodeType, x, y);
    }
    
    handleCanvasClick(e) {
        if (e.target === this.canvas) {
            this.deselectNode();
        }
    }
    
    createNode(type, x, y) {
        const nodeId = `node_${++this.nodeCounter}`;
        const nodeData = this.getNodeTemplate(type);
        
        const nodeElement = document.createElement('div');
        nodeElement.className = `flow-node ${type}`;
        nodeElement.style.left = `${x}px`;
        nodeElement.style.top = `${y}px`;
        nodeElement.dataset.nodeId = nodeId;
        
        nodeElement.innerHTML = `
            <div class="node-header">
                <div class="node-title">${nodeData.title}</div>
                <div class="node-controls">
                    <button onclick="flowBuilder.editNode('${nodeId}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="flowBuilder.deleteNode('${nodeId}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="node-content">
                ${nodeData.content}
            </div>
            <div class="connection-point input" onclick="flowBuilder.handleConnectionPoint(event, '${nodeId}', 'input')"></div>
            <div class="connection-point output" onclick="flowBuilder.handleConnectionPoint(event, '${nodeId}', 'output')"></div>
        `;
        
        // Adicionar event listeners
        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectNode(nodeId);
        });
        
        nodeElement.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node-controls')) return;
            this.startDrag(e, nodeElement);
        });
        
        this.canvas.appendChild(nodeElement);
        
        // Armazenar dados do nó
        this.nodes.set(nodeId, {
            id: nodeId,
            type: type,
            x: x,
            y: y,
            data: nodeData.data,
            element: nodeElement
        });
        
        this.updateStats();
        this.selectNode(nodeId);
    }
    
    getNodeTemplate(type) {
        const templates = {
            start: {
                title: 'Início',
                content: '<small class="text-muted">Ponto de entrada do fluxo</small>',
                data: { trigger: 'keyword', value: '' }
            },
            message: {
                title: 'Mensagem',
                content: '<small class="text-muted">Clique para configurar a mensagem</small>',
                data: { text: 'Olá! Como posso ajudar?', delay: 0 }
            },
            condition: {
                title: 'Condição',
                content: '<small class="text-muted">Configurar condição</small>',
                data: { condition: 'contains', value: '', trueAction: '', falseAction: '' }
            },
            input: {
                title: 'Entrada',
                content: '<small class="text-muted">Aguardar entrada do usuário</small>',
                data: { timeout: 60, variable: 'userInput' }
            },
            delay: {
                title: 'Delay',
                content: '<small class="text-muted">Aguardar tempo</small>',
                data: { seconds: 3 }
            },
            llm: {
                title: 'IA/LLM',
                content: '<small class="text-muted">Resposta inteligente</small>',
                data: { model: 'default', prompt: '', context: true }
            },
            webhook: {
                title: 'Webhook',
                content: '<small class="text-muted">Chamar API externa</small>',
                data: { url: '', method: 'POST', headers: {}, body: '' }
            },
            youtube: {
                title: 'YouTube',
                content: '<small class="text-muted">Processar vídeo YouTube</small>',
                data: { url: '', action: 'transcript', outputVariable: 'youtubeResult' }
            },
            calories: {
                title: 'Calorias',
                content: '<small class="text-muted">Calcular calorias</small>',
                data: { food: '', outputVariable: 'calories' }
            },
            linkedin: {
                title: 'LinkedIn',
                content: '<small class="text-muted">Scraper LinkedIn</small>',
                data: { profileUrl: '', outputVariable: 'linkedinData' }
            },
            telegram: {
                title: 'Telegram',
                content: '<small class="text-muted">Enviar para Telegram</small>',
                data: { chatId: '', message: '', botToken: '' }
            },
            tts: {
                title: 'TTS',
                content: '<small class="text-muted">Texto para fala</small>',
                data: { text: '', voice: 'default', speed: 1.0, outputVariable: 'audioFile' }
            },
            transcribe: {
                title: 'Transcrever',
                content: '<small class="text-muted">Áudio para texto</small>',
                data: { audioFile: '', model: 'whisper', outputVariable: 'transcription' }
            },
            calendar: {
                title: 'Calendário',
                content: '<small class="text-muted">Google Calendar</small>',
                data: { action: 'create', title: '', description: '', startTime: '', endTime: '' }
            },
            scheduler: {
                title: 'Agendador',
                content: '<small class="text-muted">Agendar execução</small>',
                data: { scheduleType: 'once', datetime: '', cron: '', targetFlow: '' }
            },
            variable: {
                title: 'Variável',
                content: '<small class="text-muted">Definir/usar variável</small>',
                data: { action: 'set', name: '', value: '', operation: 'assign' }
            },
            end: {
                title: 'Fim',
                content: '<small class="text-muted">Finalizar fluxo</small>',
                data: { message: 'Conversa finalizada!' }
            }
        };
        
        return templates[type] || templates.message;
    }
    
    selectNode(nodeId) {
        // Remover seleção anterior
        if (this.selectedNode) {
            this.selectedNode.element.classList.remove('selected');
        }
        
        // Selecionar novo nó
        const node = this.nodes.get(nodeId);
        if (node) {
            this.selectedNode = node;
            node.element.classList.add('selected');
            this.showProperties(node);
        }
    }
    
    deselectNode() {
        if (this.selectedNode) {
            this.selectedNode.element.classList.remove('selected');
            this.selectedNode = null;
            this.hideProperties();
        }
    }
    
    showProperties(node) {
        const propertiesContent = document.getElementById('properties-content');
        const html = this.generatePropertiesHTML(node);
        propertiesContent.innerHTML = html;
    }
    
    hideProperties() {
        const propertiesContent = document.getElementById('properties-content');
        propertiesContent.innerHTML = '<p class="text-muted">Selecione um nó para editar suas propriedades</p>';
    }
    
    generatePropertiesHTML(node) {
        const { type, data } = node;
        
        let html = `<h6>Propriedades - ${this.getNodeTemplate(type).title}</h6>`;
        
        switch (type) {
            case 'start':
                html += `
                    <div class="form-group">
                        <label>Tipo de Trigger</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'trigger', this.value)">
                            <option value="keyword" ${data.trigger === 'keyword' ? 'selected' : ''}>Palavra-chave</option>
                            <option value="any" ${data.trigger === 'any' ? 'selected' : ''}>Qualquer mensagem</option>
                            <option value="button" ${data.trigger === 'button' ? 'selected' : ''}>Botão</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valor</label>
                        <input type="text" class="form-control" value="${data.value || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'value', this.value)"
                               placeholder="Palavra-chave ou texto do botão">
                    </div>
                `;
                break;
                
            case 'message':
                html += `
                    <div class="form-group">
                        <label>Mensagem</label>
                        <textarea class="form-control" rows="3" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'text', this.value)"
                                  placeholder="Digite sua mensagem...">${data.text || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Delay (segundos)</label>
                        <input type="number" class="form-control" value="${data.delay || 0}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'delay', parseInt(this.value))"
                               min="0" max="300">
                    </div>
                `;
                break;
                
            case 'condition':
                html += `
                    <div class="form-group">
                        <label>Tipo de Condição</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'condition', this.value)">
                            <option value="contains" ${data.condition === 'contains' ? 'selected' : ''}>Contém</option>
                            <option value="equals" ${data.condition === 'equals' ? 'selected' : ''}>Igual a</option>
                            <option value="starts" ${data.condition === 'starts' ? 'selected' : ''}>Começa com</option>
                            <option value="ends" ${data.condition === 'ends' ? 'selected' : ''}>Termina com</option>
                            <option value="regex" ${data.condition === 'regex' ? 'selected' : ''}>Regex</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Valor</label>
                        <input type="text" class="form-control" value="${data.value || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'value', this.value)"
                               placeholder="Valor para comparação">
                    </div>
                `;
                break;
                
            case 'input':
                html += `
                    <div class="form-group">
                        <label>Timeout (segundos)</label>
                        <input type="number" class="form-control" value="${data.timeout || 60}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'timeout', parseInt(this.value))"
                               min="10" max="300">
                    </div>
                    <div class="form-group">
                        <label>Variável</label>
                        <input type="text" class="form-control" value="${data.variable || 'userInput'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'variable', this.value)"
                               placeholder="Nome da variável">
                    </div>
                `;
                break;
                
            case 'delay':
                html += `
                    <div class="form-group">
                        <label>Tempo (segundos)</label>
                        <input type="number" class="form-control" value="${data.seconds || 3}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'seconds', parseInt(this.value))"
                               min="1" max="300">
                    </div>
                `;
                break;
                
            case 'llm':
                html += `
                    <div class="form-group">
                        <label>Modelo</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'model', this.value)">
                            <option value="default" ${data.model === 'default' ? 'selected' : ''}>Padrão</option>
                            <option value="gpt" ${data.model === 'gpt' ? 'selected' : ''}>GPT</option>
                            <option value="claude" ${data.model === 'claude' ? 'selected' : ''}>Claude</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Prompt</label>
                        <textarea class="form-control" rows="3" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'prompt', this.value)"
                                  placeholder="Prompt para a IA...">${data.prompt || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" ${data.context ? 'checked' : ''} 
                                   onchange="flowBuilder.updateNodeData('${node.id}', 'context', this.checked)">
                            Usar contexto da conversa
                        </label>
                    </div>
                `;
                break;
                
            case 'webhook':
                html += `
                    <div class="form-group">
                        <label>URL</label>
                        <input type="url" class="form-control" value="${data.url || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'url', this.value)"
                               placeholder="https://api.exemplo.com/webhook">
                    </div>
                    <div class="form-group">
                        <label>Método</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'method', this.value)">
                            <option value="POST" ${data.method === 'POST' ? 'selected' : ''}>POST</option>
                            <option value="GET" ${data.method === 'GET' ? 'selected' : ''}>GET</option>
                            <option value="PUT" ${data.method === 'PUT' ? 'selected' : ''}>PUT</option>
                            <option value="DELETE" ${data.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'youtube':
                html += `
                    <div class="form-group">
                        <label>URL do YouTube</label>
                        <input type="url" class="form-control" value="${data.url || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'url', this.value)"
                               placeholder="https://youtube.com/watch?v=...">
                    </div>
                    <div class="form-group">
                        <label>Ação</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'action', this.value)">
                            <option value="transcript" ${data.action === 'transcript' ? 'selected' : ''}>Transcrever</option>
                            <option value="download" ${data.action === 'download' ? 'selected' : ''}>Download</option>
                            <option value="info" ${data.action === 'info' ? 'selected' : ''}>Informações</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Variável de Saída</label>
                        <input type="text" class="form-control" value="${data.outputVariable || 'youtubeResult'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'outputVariable', this.value)"
                               placeholder="youtubeResult">
                    </div>
                `;
                break;
                
            case 'calories':
                html += `
                    <div class="form-group">
                        <label>Alimento/Comida</label>
                        <input type="text" class="form-control" value="${data.food || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'food', this.value)"
                               placeholder="Ex: 100g arroz">
                    </div>
                    <div class="form-group">
                        <label>Variável de Saída</label>
                        <input type="text" class="form-control" value="${data.outputVariable || 'calories'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'outputVariable', this.value)"
                               placeholder="calories">
                    </div>
                `;
                break;
                
            case 'linkedin':
                html += `
                    <div class="form-group">
                        <label>URL do Perfil LinkedIn</label>
                        <input type="url" class="form-control" value="${data.profileUrl || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'profileUrl', this.value)"
                               placeholder="https://linkedin.com/in/...">
                    </div>
                    <div class="form-group">
                        <label>Variável de Saída</label>
                        <input type="text" class="form-control" value="${data.outputVariable || 'linkedinData'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'outputVariable', this.value)"
                               placeholder="linkedinData">
                    </div>
                `;
                break;
                
            case 'telegram':
                html += `
                    <div class="form-group">
                        <label>Chat ID</label>
                        <input type="text" class="form-control" value="${data.chatId || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'chatId', this.value)"
                               placeholder="@canal ou ID numérico">
                    </div>
                    <div class="form-group">
                        <label>Mensagem</label>
                        <textarea class="form-control" rows="3" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'message', this.value)"
                                  placeholder="Mensagem a enviar...">${data.message || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Token do Bot (opcional)</label>
                        <input type="text" class="form-control" value="${data.botToken || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'botToken', this.value)"
                               placeholder="Deixe vazio para usar padrão">
                    </div>
                `;
                break;
                
            case 'tts':
                html += `
                    <div class="form-group">
                        <label>Texto</label>
                        <textarea class="form-control" rows="3" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'text', this.value)"
                                  placeholder="Texto a ser falado...">${data.text || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Voz</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'voice', this.value)">
                            <option value="default" ${data.voice === 'default' ? 'selected' : ''}>Padrão</option>
                            <option value="male" ${data.voice === 'male' ? 'selected' : ''}>Masculina</option>
                            <option value="female" ${data.voice === 'female' ? 'selected' : ''}>Feminina</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Velocidade</label>
                        <input type="range" class="form-control" min="0.5" max="2.0" step="0.1" 
                               value="${data.speed || 1.0}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'speed', parseFloat(this.value))">
                        <small class="text-muted">Velocidade: ${data.speed || 1.0}x</small>
                    </div>
                    <div class="form-group">
                        <label>Variável de Saída</label>
                        <input type="text" class="form-control" value="${data.outputVariable || 'audioFile'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'outputVariable', this.value)"
                               placeholder="audioFile">
                    </div>
                `;
                break;
                
            case 'transcribe':
                html += `
                    <div class="form-group">
                        <label>Arquivo de Áudio</label>
                        <input type="text" class="form-control" value="${data.audioFile || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'audioFile', this.value)"
                               placeholder="Caminho ou variável do arquivo">
                    </div>
                    <div class="form-group">
                        <label>Modelo</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'model', this.value)">
                            <option value="whisper" ${data.model === 'whisper' ? 'selected' : ''}>Whisper</option>
                            <option value="whisper-large" ${data.model === 'whisper-large' ? 'selected' : ''}>Whisper Large</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Variável de Saída</label>
                        <input type="text" class="form-control" value="${data.outputVariable || 'transcription'}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'outputVariable', this.value)"
                               placeholder="transcription">
                    </div>
                `;
                break;
                
            case 'calendar':
                html += `
                    <div class="form-group">
                        <label>Ação</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'action', this.value)">
                            <option value="create" ${data.action === 'create' ? 'selected' : ''}>Criar Evento</option>
                            <option value="list" ${data.action === 'list' ? 'selected' : ''}>Listar Eventos</option>
                            <option value="update" ${data.action === 'update' ? 'selected' : ''}>Atualizar Evento</option>
                            <option value="delete" ${data.action === 'delete' ? 'selected' : ''}>Excluir Evento</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" class="form-control" value="${data.title || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'title', this.value)"
                               placeholder="Título do evento">
                    </div>
                    <div class="form-group">
                        <label>Descrição</label>
                        <textarea class="form-control" rows="2" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'description', this.value)"
                                  placeholder="Descrição do evento...">${data.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Data/Hora Início</label>
                        <input type="datetime-local" class="form-control" value="${data.startTime || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'startTime', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Data/Hora Fim</label>
                        <input type="datetime-local" class="form-control" value="${data.endTime || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'endTime', this.value)">
                    </div>
                `;
                break;
                
            case 'scheduler':
                html += `
                    <div class="form-group">
                        <label>Tipo de Agendamento</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'scheduleType', this.value)">
                            <option value="once" ${data.scheduleType === 'once' ? 'selected' : ''}>Uma vez</option>
                            <option value="recurring" ${data.scheduleType === 'recurring' ? 'selected' : ''}>Recorrente</option>
                            <option value="cron" ${data.scheduleType === 'cron' ? 'selected' : ''}>Cron</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Data/Hora</label>
                        <input type="datetime-local" class="form-control" value="${data.datetime || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'datetime', this.value)">
                    </div>
                    <div class="form-group">
                        <label>Expressão Cron (se aplicável)</label>
                        <input type="text" class="form-control" value="${data.cron || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'cron', this.value)"
                               placeholder="0 0 * * *">
                    </div>
                    <div class="form-group">
                        <label>Fluxo de Destino</label>
                        <input type="text" class="form-control" value="${data.targetFlow || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'targetFlow', this.value)"
                               placeholder="ID do fluxo a executar">
                    </div>
                `;
                break;
                
            case 'variable':
                html += `
                    <div class="form-group">
                        <label>Ação</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'action', this.value)">
                            <option value="set" ${data.action === 'set' ? 'selected' : ''}>Definir</option>
                            <option value="get" ${data.action === 'get' ? 'selected' : ''}>Obter</option>
                            <option value="increment" ${data.action === 'increment' ? 'selected' : ''}>Incrementar</option>
                            <option value="decrement" ${data.action === 'decrement' ? 'selected' : ''}>Decrementar</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nome da Variável</label>
                        <input type="text" class="form-control" value="${data.name || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'name', this.value)"
                               placeholder="nomeVariavel">
                    </div>
                    <div class="form-group">
                        <label>Valor</label>
                        <input type="text" class="form-control" value="${data.value || ''}" 
                               onchange="flowBuilder.updateNodeData('${node.id}', 'value', this.value)"
                               placeholder="Valor ou {{outraVariavel}}">
                    </div>
                    <div class="form-group">
                        <label>Operação</label>
                        <select class="form-control" onchange="flowBuilder.updateNodeData('${node.id}', 'operation', this.value)">
                            <option value="assign" ${data.operation === 'assign' ? 'selected' : ''}>Atribuir</option>
                            <option value="append" ${data.operation === 'append' ? 'selected' : ''}>Concatenar</option>
                            <option value="prepend" ${data.operation === 'prepend' ? 'selected' : ''}>Prefixar</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'end':
                html += `
                    <div class="form-group">
                        <label>Mensagem de Finalização</label>
                        <textarea class="form-control" rows="2" 
                                  onchange="flowBuilder.updateNodeData('${node.id}', 'message', this.value)"
                                  placeholder="Mensagem ao finalizar...">${data.message || ''}</textarea>
                    </div>
                `;
                break;
        }
        
        return html;
    }
    
    updateNodeData(nodeId, property, value) {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.data[property] = value;
            this.updateNodeContent(node);
        }
    }
    
    updateNodeContent(node) {
        const contentElement = node.element.querySelector('.node-content');
        const { type, data } = node;
        
        switch (type) {
            case 'message':
                contentElement.innerHTML = `<small class="text-muted">${data.text ? data.text.substring(0, 50) + '...' : 'Configurar mensagem'}</small>`;
                break;
            case 'condition':
                contentElement.innerHTML = `<small class="text-muted">${data.condition || 'Configurar condição'}: ${data.value || ''}</small>`;
                break;
            case 'delay':
                contentElement.innerHTML = `<small class="text-muted">Aguardar ${data.seconds || 3}s</small>`;
                break;
            case 'llm':
                contentElement.innerHTML = `<small class="text-muted">${data.model || 'default'}: ${data.prompt ? data.prompt.substring(0, 30) + '...' : 'Configurar prompt'}</small>`;
                break;
            case 'webhook':
                contentElement.innerHTML = `<small class="text-muted">${data.method || 'POST'}: ${data.url || 'Configurar URL'}</small>`;
                break;
            case 'youtube':
                contentElement.innerHTML = `<small class="text-muted">${data.action || 'transcript'}: ${data.url ? 'Configurado' : 'Configurar URL'}</small>`;
                break;
            case 'calories':
                contentElement.innerHTML = `<small class="text-muted">Calcular: ${data.food || 'Configurar alimento'}</small>`;
                break;
            case 'linkedin':
                contentElement.innerHTML = `<small class="text-muted">Perfil: ${data.profileUrl ? 'Configurado' : 'Configurar URL'}</small>`;
                break;
            case 'telegram':
                contentElement.innerHTML = `<small class="text-muted">Chat: ${data.chatId || 'Configurar'}</small>`;
                break;
            case 'tts':
                contentElement.innerHTML = `<small class="text-muted">${data.voice || 'default'}: ${data.text ? data.text.substring(0, 30) + '...' : 'Configurar texto'}</small>`;
                break;
            case 'transcribe':
                contentElement.innerHTML = `<small class="text-muted">${data.model || 'whisper'}: ${data.audioFile || 'Configurar áudio'}</small>`;
                break;
            case 'calendar':
                contentElement.innerHTML = `<small class="text-muted">${data.action || 'create'}: ${data.title || 'Configurar'}</small>`;
                break;
            case 'scheduler':
                contentElement.innerHTML = `<small class="text-muted">${data.scheduleType || 'once'}: ${data.datetime ? new Date(data.datetime).toLocaleString() : 'Configurar'}</small>`;
                break;
            case 'variable':
                contentElement.innerHTML = `<small class="text-muted">${data.action || 'set'}: ${data.name || 'Configurar'}</small>`;
                break;
        }
    }
    
    startDrag(e, element) {
        e.preventDefault();
        const rect = element.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        const handleMouseMove = (e) => {
            const canvasRect = this.canvas.getBoundingClientRect();
            const x = e.clientX - canvasRect.left - this.dragOffset.x;
            const y = e.clientY - canvasRect.top - this.dragOffset.y;
            
            element.style.left = `${Math.max(0, x)}px`;
            element.style.top = `${Math.max(0, y)}px`;
            
            // Atualizar posição no objeto do nó
            const nodeId = element.dataset.nodeId;
            const node = this.nodes.get(nodeId);
            if (node) {
                node.x = x;
                node.y = y;
            }
            
            this.updateConnections();
        };
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    handleConnectionPoint(e, nodeId, type) {
        e.stopPropagation();
        
        if (!this.connecting) {
            // Iniciar conexão
            this.connecting = true;
            this.connectionStart = { nodeId, type };
            this.canvas.classList.add('connecting');
            
            // Adicionar linha temporária
            this.createTempLine(e);
        } else {
            // Finalizar conexão
            this.connecting = false;
            this.canvas.classList.remove('connecting');
            
            // Remover linha temporária
            this.removeTempLine();
            
            // Criar conexão se válida
            if (this.connectionStart.nodeId !== nodeId && 
                this.connectionStart.type !== type) {
                this.createConnection(this.connectionStart, { nodeId, type });
            }
            
            this.connectionStart = null;
        }
    }
    
    createConnection(start, end) {
        const connection = {
            id: `conn_${Date.now()}`,
            from: start.nodeId,
            to: end.nodeId,
            fromType: start.type,
            toType: end.type
        };
        
        this.connections.push(connection);
        this.updateConnections();
        this.updateStats();
    }
    
    createTempLine(e) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'temp-line');
        line.setAttribute('id', 'temp-line');
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        line.setAttribute('x1', x);
        line.setAttribute('y1', y);
        line.setAttribute('x2', x);
        line.setAttribute('y2', y);
        
        this.svg.appendChild(line);
        
        // Adicionar evento de movimento do mouse
        this.tempLineMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x2 = e.clientX - rect.left;
            const y2 = e.clientY - rect.top;
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
        };
        
        document.addEventListener('mousemove', this.tempLineMouseMove);
    }
    
    removeTempLine() {
        const tempLine = document.getElementById('temp-line');
        if (tempLine) {
            tempLine.remove();
        }
        
        if (this.tempLineMouseMove) {
            document.removeEventListener('mousemove', this.tempLineMouseMove);
            this.tempLineMouseMove = null;
        }
    }
    
    updateConnections() {
        // Limpar linhas existentes
        const existingLines = this.svg.querySelectorAll('line:not(.temp-line)');
        existingLines.forEach(line => line.remove());
        
        // Desenhar todas as conexões
        this.connections.forEach(connection => {
            const fromNode = this.nodes.get(connection.from);
            const toNode = this.nodes.get(connection.to);
            
            if (fromNode && toNode) {
                const line = this.createConnectionLine(fromNode, toNode);
                this.svg.appendChild(line);
            }
        });
    }
    
    createConnectionLine(fromNode, toNode) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        
        // Calcular posições dos pontos de conexão
        const fromRect = fromNode.element.getBoundingClientRect();
        const toRect = toNode.element.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const x1 = fromRect.right - canvasRect.left;
        const y1 = fromRect.top + fromRect.height / 2 - canvasRect.top;
        const x2 = toRect.left - canvasRect.left;
        const y2 = toRect.top + toRect.height / 2 - canvasRect.top;
        
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#667eea');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        
        return line;
    }
    
    updateSVGSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.svg.setAttribute('width', rect.width);
        this.svg.setAttribute('height', rect.height);
        
        // Adicionar marcador de seta se não existir
        if (!this.svg.querySelector('#arrowhead')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '9');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
            polygon.setAttribute('fill', '#667eea');
            
            marker.appendChild(polygon);
            defs.appendChild(marker);
            this.svg.appendChild(defs);
        }
    }
    
    updateStats() {
        document.getElementById('node-count').textContent = this.nodes.size;
        document.getElementById('connection-count').textContent = this.connections.length;
    }
    
    deleteNode(nodeId) {
        if (confirm('Tem certeza que deseja excluir este nó?')) {
            const node = this.nodes.get(nodeId);
            if (node) {
                // Remover conexões associadas
                this.connections = this.connections.filter(conn => 
                    conn.from !== nodeId && conn.to !== nodeId
                );
                
                // Remover elemento do DOM
                node.element.remove();
                
                // Remover do Map
                this.nodes.delete(nodeId);
                
                // Limpar seleção se era o nó selecionado
                if (this.selectedNode && this.selectedNode.id === nodeId) {
                    this.selectedNode = null;
                    this.hideProperties();
                }
                
                this.updateConnections();
                this.updateStats();
            }
        }
    }
    
    editNode(nodeId) {
        this.selectNode(nodeId);
    }
    
    serializeFlow() {
        const nodes = Array.from(this.nodes.values()).map(node => ({
            id: node.id,
            type: node.type,
            x: node.x,
            y: node.y,
            data: node.data
        }));
        
        const flowData = {
            name: this.flowData.name,
            description: this.flowData.description,
            nodes: nodes,
            connections: this.connections,
            metadata: {
                version: '1.0',
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            }
        };
        
        // Se tem ID, incluir para update
        if (this.flowData.id) {
            flowData.id = this.flowData.id;
        }
        
        return flowData;
    }
    
    loadFlow(flowData) {
        this.clearCanvas();
        
        this.flowData = {
            id: flowData.id || null,
            name: flowData.name || '',
            description: flowData.description || ''
        };
        
        // Recriar nós
        flowData.nodes.forEach(nodeData => {
            const nodeElement = document.createElement('div');
            nodeElement.className = `flow-node ${nodeData.type}`;
            nodeElement.style.left = `${nodeData.x}px`;
            nodeElement.style.top = `${nodeData.y}px`;
            nodeElement.dataset.nodeId = nodeData.id;
            
            const template = this.getNodeTemplate(nodeData.type);
            nodeElement.innerHTML = `
                <div class="node-header">
                    <div class="node-title">${template.title}</div>
                    <div class="node-controls">
                        <button onclick="flowBuilder.editNode('${nodeData.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="flowBuilder.deleteNode('${nodeData.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="node-content">
                    ${template.content}
                </div>
                <div class="connection-point input" onclick="flowBuilder.handleConnectionPoint(event, '${nodeData.id}', 'input')"></div>
                <div class="connection-point output" onclick="flowBuilder.handleConnectionPoint(event, '${nodeData.id}', 'output')"></div>
            `;
            
            // Adicionar event listeners
            nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectNode(nodeData.id);
            });
            
            nodeElement.addEventListener('mousedown', (e) => {
                if (e.target.closest('.node-controls')) return;
                this.startDrag(e, nodeElement);
            });
            
            this.canvas.appendChild(nodeElement);
            
            // Armazenar dados do nó
            this.nodes.set(nodeData.id, {
                ...nodeData,
                element: nodeElement
            });
            
            // Atualizar conteúdo do nó
            this.updateNodeContent(this.nodes.get(nodeData.id));
        });
        
        // Recriar conexões
        this.connections = flowData.connections || [];
        this.updateConnections();
        this.updateStats();
        
        // Atualizar status
        document.getElementById('flow-status').textContent = 'Carregado';
    }
    
    clearCanvas() {
        // Limpar nós
        this.nodes.forEach(node => {
            node.element.remove();
        });
        this.nodes.clear();
        
        // Limpar conexões
        this.connections = [];
        this.updateConnections();
        
        // Limpar seleção
        this.selectedNode = null;
        this.hideProperties();
        
        // Resetar contador
        this.nodeCounter = 0;
        
        this.updateStats();
        document.getElementById('flow-status').textContent = 'Não salvo';
    }
}

// Funções globais
let flowBuilder;

document.addEventListener('DOMContentLoaded', () => {
    flowBuilder = new FlowBuilder();
    
    // Verificar se há um ID de fluxo na URL para carregar
    const urlParams = new URLSearchParams(window.location.search);
    const flowId = urlParams.get('id');
    
    if (flowId) {
        loadFlowById(flowId);
    }
});

function saveFlow() {
    // Preencher modal com dados atuais
    document.getElementById('flowName').value = flowBuilder.flowData.name || '';
    document.getElementById('flowDescription').value = flowBuilder.flowData.description || '';
    
    const modal = new bootstrap.Modal(document.getElementById('saveModal'));
    modal.show();
}

function loadFlow() {
    // Mostrar lista de fluxos salvos
    fetch('/api/flow/list')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.flows.length > 0) {
                showFlowSelector(data.flows);
            } else {
                // Fallback para carregar do arquivo
                loadFlowFromFile();
            }
        })
        .catch(error => {
            console.error('Erro ao listar fluxos:', error);
            loadFlowFromFile();
        });
}

function loadFlowFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const flowData = JSON.parse(e.target.result);
                    flowBuilder.loadFlow(flowData);
                    alert('Fluxo carregado com sucesso!');
                } catch (error) {
                    alert('Erro ao carregar fluxo: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function showFlowSelector(flows) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Carregar Fluxo</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="list-group">
                        ${flows.map(flow => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 class="mb-1">${flow.name}</h6>
                                    <p class="mb-1 text-muted">${flow.description || 'Sem descrição'}</p>
                                    <small>Criado em: ${new Date(flow.createdAt).toLocaleString()}</small>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="loadFlowById('${flow.id}')">
                                    Carregar
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <hr>
                    <button class="btn btn-secondary" onclick="loadFlowFromFile()">
                        <i class="fas fa-file-upload"></i> Carregar do Arquivo
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

function loadFlowById(flowId) {
    fetch(`/api/flow/${flowId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                flowBuilder.loadFlow(data.flow);
                alert('Fluxo carregado com sucesso!');
                
                // Fechar modal
                const modal = document.querySelector('.modal.show');
                if (modal) {
                    bootstrap.Modal.getInstance(modal).hide();
                }
            } else {
                alert('Erro ao carregar fluxo: ' + data.error);
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            alert('Erro ao comunicar com o servidor.');
        });
}

function testFlow() {
    const flowData = flowBuilder.serializeFlow();
    
    // Validar fluxo
    if (flowData.nodes.length === 0) {
        alert('Adicione pelo menos um nó ao fluxo antes de testar.');
        return;
    }
    
    // Enviar para o backend para teste
    fetch('/api/flow/test', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(flowData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Teste do fluxo iniciado! Verifique o WhatsApp.');
        } else {
            alert('Erro ao testar fluxo: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao comunicar com o servidor.');
    });
}

function clearCanvas() {
    if (confirm('Tem certeza que deseja limpar todo o canvas?')) {
        flowBuilder.clearCanvas();
    }
}

function goBack() {
    window.history.back();
}

function performSave() {
    const name = document.getElementById('flowName').value;
    const description = document.getElementById('flowDescription').value;
    
    if (!name.trim()) {
        alert('Por favor, informe um nome para o fluxo.');
        return;
    }
    
    flowBuilder.flowData.name = name;
    flowBuilder.flowData.description = description;
    
    const flowData = flowBuilder.serializeFlow();
    
    // Salvar no backend
    fetch('/api/flow/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(flowData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Fluxo salvo com sucesso!');
            document.getElementById('flow-status').textContent = 'Salvo';
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
            modal.hide();
        } else {
            alert('Erro ao salvar fluxo: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao comunicar com o servidor.');
    });
}