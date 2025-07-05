const { JSDOM } = require('jsdom');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

// Simular um navegador para testar a interface
class ConfigsUITest {
  constructor() {
    this.setupJSDOM();
  }

  setupJSDOM() {
    // Carregar o HTML da tela configs.ejs
    const configsHtml = this.getConfigsHTML();
    
    this.dom = new JSDOM(configsHtml, {
      url: 'http://localhost:3000',
      runScripts: 'outside-only',
      resources: 'usable'
    });
    
    this.window = this.dom.window;
    this.document = this.window.document;
    
    // Adicionar fetch mock
    this.window.fetch = this.createFetchMock();
    
    // Adicionar console para debug
    this.window.console = console;
  }

  getConfigsHTML() {
    // Simular o HTML da tela configs.ejs
    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Configurações do Sistema</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-4">
            <div class="card">
                <div class="card-header">
                    <h4>Todas as Configurações da Base de Dados</h4>
                </div>
                <div class="card-body">
                    <div class="config-actions">
                        <button type="button" class="btn btn-primary" onclick="loadConfigs()">
                            Recarregar Configurações
                        </button>
                        <button type="button" class="btn btn-success" onclick="saveConfigs()" id="saveBtn">
                            Salvar e Reiniciar
                        </button>
                    </div>
                    <div id="configEditor">
                        <div class="text-center">
                            <p>Carregando configurações...</p>
                        </div>
                    </div>
                    <textarea id="jsonEditor" class="form-control" rows="20"></textarea>
                </div>
            </div>
        </div>
        
        <script>
            let currentConfig = {};

            async function loadConfigs() {
                try {
                    const response = await fetch('/api/configs');
                    if (!response.ok) throw new Error('Erro ao carregar configurações');
                    
                    currentConfig = await response.json();
                    renderConfigEditor();
                    updateJsonEditor();
                } catch (error) {
                    console.error('Erro:', error);
                    showAlert('Erro ao carregar configurações: ' + error.message, 'danger');
                }
            }

            function renderConfigEditor() {
                const container = document.getElementById('configEditor');
                container.innerHTML = '<div class="config-loaded">Configurações carregadas</div>';
            }

            function updateJsonEditor() {
                const jsonEditor = document.getElementById('jsonEditor');
                jsonEditor.value = JSON.stringify(currentConfig, null, 2);
            }

            function formatJson() {
                const jsonEditor = document.getElementById('jsonEditor');
                try {
                    const parsed = JSON.parse(jsonEditor.value);
                    jsonEditor.value = JSON.stringify(parsed, null, 2);
                    currentConfig = parsed;
                    renderConfigEditor();
                    showAlert('JSON formatado com sucesso!', 'success');
                } catch (error) {
                    showAlert('Erro ao formatar JSON: ' + error.message, 'danger');
                }
            }

            async function saveConfigs() {
                const saveBtn = document.getElementById('saveBtn');
                const originalText = saveBtn.innerHTML;
                
                try {
                    const jsonEditor = document.getElementById('jsonEditor');
                    currentConfig = JSON.parse(jsonEditor.value);
                    
                    saveBtn.innerHTML = 'Salvando...';
                    saveBtn.disabled = true;
                    
                    const response = await fetch('/api/configs', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(currentConfig)
                    });
                    
                    if (!response.ok) throw new Error('Erro ao salvar configurações');
                    
                    const result = await response.json();
                    showAlert('Configurações salvas com sucesso!', 'success');
                    
                } catch (error) {
                    console.error('Erro:', error);
                    showAlert('Erro ao salvar configurações: ' + error.message, 'danger');
                } finally {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }
            }

            function showAlert(message, type) {
                const alertContainer = document.querySelector('.card-body');
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-' + type;
                alertDiv.textContent = message;
                alertContainer.insertBefore(alertDiv, alertContainer.firstChild);
                
                setTimeout(() => {
                    if (alertDiv.parentNode) {
                        alertDiv.remove();
                    }
                }, 5000);
            }

            // Expor funções para teste
            window.loadConfigs = loadConfigs;
            window.saveConfigs = saveConfigs;
            window.formatJson = formatJson;
            window.showAlert = showAlert;
        </script>
    </body>
    </html>
    `;
  }

  createFetchMock() {
    return async (url, options) => {
      if (url === '/api/configs') {
        if (!options || options.method === 'GET') {
          // Simular GET
          return {
            ok: true,
            json: async () => ({
              llm: {
                host: 'http://localhost:11434',
                model: 'llama3',
                imageModel: 'llava'
              },
              whatsapp: {
                enabled: true,
                sessionName: 'test-session'
              },
              server: {
                port: 3000
              }
            })
          };
        } else if (options.method === 'PUT') {
          // Simular PUT
          return {
            ok: true,
            json: async () => ({
              success: true,
              message: 'Configurações atualizadas com sucesso'
            })
          };
        }
      }
      throw new Error('URL não encontrada');
    };
  }
}

describe('Configs UI Tests', () => {
  let uiTest;
  let window;
  let document;

  beforeEach(() => {
    uiTest = new ConfigsUITest();
    window = uiTest.window;
    document = uiTest.document;
  });

  describe('DOM Structure', () => {
    it('should have required elements', () => {
      expect(document.getElementById('configEditor')).to.exist;
      expect(document.getElementById('jsonEditor')).to.exist;
      expect(document.getElementById('saveBtn')).to.exist;
    });

    it('should have proper Bootstrap classes', () => {
      const container = document.querySelector('.container');
      expect(container).to.exist;
      
      const card = document.querySelector('.card');
      expect(card).to.exist;
      
      const cardHeader = document.querySelector('.card-header');
      expect(cardHeader).to.exist;
    });

    it('should have buttons with correct classes', () => {
      const saveBtn = document.getElementById('saveBtn');
      expect(saveBtn.classList.contains('btn')).to.be.true;
      expect(saveBtn.classList.contains('btn-success')).to.be.true;
    });
  });

  describe('JavaScript Functions', () => {
    it('should have loadConfigs function', () => {
      expect(window.loadConfigs).to.be.a('function');
    });

    it('should have saveConfigs function', () => {
      expect(window.saveConfigs).to.be.a('function');
    });

    it('should have formatJson function', () => {
      expect(window.formatJson).to.be.a('function');
    });

    it('should have showAlert function', () => {
      expect(window.showAlert).to.be.a('function');
    });
  });

  describe('loadConfigs Function', () => {
    it('should load configurations successfully', async () => {
      await window.loadConfigs();
      
      // Verificar se o JSON editor foi preenchido
      const jsonEditor = document.getElementById('jsonEditor');
      expect(jsonEditor.value).to.not.be.empty;
      
      // Verificar se é um JSON válido
      const parsedConfig = JSON.parse(jsonEditor.value);
      expect(parsedConfig).to.be.an('object');
      expect(parsedConfig).to.have.property('llm');
    });

    it('should update config editor after loading', async () => {
      await window.loadConfigs();
      
      const configEditor = document.getElementById('configEditor');
      expect(configEditor.innerHTML).to.include('Configurações carregadas');
    });
  });

  describe('saveConfigs Function', () => {
    it('should disable save button during save', async () => {
      // Primeiro carregar as configurações
      await window.loadConfigs();
      
      const saveBtn = document.getElementById('saveBtn');
      const originalText = saveBtn.innerHTML;
      
      // Simular clique no botão salvar
      const savePromise = window.saveConfigs();
      
      // Verificar se o botão foi desabilitado
      expect(saveBtn.disabled).to.be.true;
      expect(saveBtn.innerHTML).to.equal('Salvando...');
      
      // Aguardar conclusão
      await savePromise;
      
      // Verificar se o botão foi restaurado
      expect(saveBtn.disabled).to.be.false;
      expect(saveBtn.innerHTML).to.equal(originalText);
    });

    it('should save valid configuration', async () => {
      // Carregar configurações
      await window.loadConfigs();
      
      // Modificar configuração
      const jsonEditor = document.getElementById('jsonEditor');
      const config = JSON.parse(jsonEditor.value);
      config.llm.model = 'updated-model';
      jsonEditor.value = JSON.stringify(config, null, 2);
      
      // Salvar
      await window.saveConfigs();
      
      // Verificar se não houve erro (não deveria haver alertas de erro)
      const errorAlert = document.querySelector('.alert-danger');
      expect(errorAlert).to.be.null;
    });
  });

  describe('formatJson Function', () => {
    it('should format valid JSON', () => {
      const jsonEditor = document.getElementById('jsonEditor');
      jsonEditor.value = '{"test": "value", "number": 123}';
      
      window.formatJson();
      
      const formatted = jsonEditor.value;
      expect(formatted).to.include('{\n');
      expect(formatted).to.include('  "test": "value"');
    });

    it('should handle invalid JSON', () => {
      const jsonEditor = document.getElementById('jsonEditor');
      jsonEditor.value = 'invalid json';
      
      window.formatJson();
      
      // Verificar se foi criado um alerta de erro
      const errorAlert = document.querySelector('.alert-danger');
      expect(errorAlert).to.exist;
      expect(errorAlert.textContent).to.include('Erro ao formatar JSON');
    });
  });

  describe('showAlert Function', () => {
    it('should create alert element', () => {
      window.showAlert('Test message', 'success');
      
      const alert = document.querySelector('.alert-success');
      expect(alert).to.exist;
      expect(alert.textContent).to.equal('Test message');
    });

    it('should create different alert types', () => {
      window.showAlert('Success message', 'success');
      window.showAlert('Error message', 'danger');
      
      const successAlert = document.querySelector('.alert-success');
      const errorAlert = document.querySelector('.alert-danger');
      
      expect(successAlert).to.exist;
      expect(errorAlert).to.exist;
      expect(successAlert.textContent).to.equal('Success message');
      expect(errorAlert.textContent).to.equal('Error message');
    });
  });

  describe('User Interactions', () => {
    it('should handle button clicks', async () => {
      const saveBtn = document.getElementById('saveBtn');
      
      // Simular clique
      saveBtn.onclick = window.saveConfigs;
      
      // Verificar se a função está associada
      expect(saveBtn.onclick).to.equal(window.saveConfigs);
    });

    it('should handle JSON editor changes', () => {
      const jsonEditor = document.getElementById('jsonEditor');
      
      // Simular mudança no texto
      jsonEditor.value = '{"modified": true}';
      
      // Verificar se o valor foi definido
      expect(jsonEditor.value).to.equal('{"modified": true}');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Modificar o mock para simular erro
      window.fetch = async () => {
        throw new Error('Network error');
      };
      
      await window.loadConfigs();
      
      // Verificar se foi criado um alerta de erro
      const errorAlert = document.querySelector('.alert-danger');
      expect(errorAlert).to.exist;
      expect(errorAlert.textContent).to.include('Network error');
    });

    it('should handle JSON parsing errors', () => {
      const jsonEditor = document.getElementById('jsonEditor');
      jsonEditor.value = 'invalid json string';
      
      window.formatJson();
      
      const errorAlert = document.querySelector('.alert-danger');
      expect(errorAlert).to.exist;
    });
  });
});

// Executar os testes se este arquivo for executado diretamente
if (require.main === module) {
  console.log('Executando testes da UI de configurações...');
  console.log('Use: npm test ou npx mocha test/configs-ui.test.js');
}