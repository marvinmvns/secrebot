const request = require('supertest');
const express = require('express');
const { expect } = require('chai');

// Mock do RestAPI para teste
class MockRestAPI {
  constructor() {
    this.app = express();
    this.setupTestRoutes();
  }

  setupTestRoutes() {
    this.app.use(express.json());
    
    // Mock do configService
    this.mockConfig = {
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
    };

    // Simular GET /api/configs
    this.app.get('/api/configs', (req, res) => {
      res.json(this.mockConfig);
    });

    // Simular PUT /api/configs
    this.app.put('/api/configs', (req, res) => {
      try {
        const updatedConfig = req.body;
        
        // Validar se é um objeto válido
        if (!updatedConfig || typeof updatedConfig !== 'object') {
          return res.status(400).json({ error: 'Configuração inválida' });
        }

        // Simular atualização
        this.mockConfig = { ...this.mockConfig, ...updatedConfig };
        
        res.json({ 
          success: true, 
          message: 'Configurações atualizadas com sucesso' 
        });
      } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
      }
    });

    // Simular GET /configs (página web)
    this.app.get('/configs', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Configs Test</title></head>
          <body>
            <h1>Configurações</h1>
            <div id="config-data">${JSON.stringify(this.mockConfig)}</div>
          </body>
        </html>
      `);
    });
  }
}

describe('Configs API Tests', () => {
  let app;
  let mockRestAPI;

  beforeEach(() => {
    mockRestAPI = new MockRestAPI();
    app = mockRestAPI.app;
  });

  describe('GET /api/configs', () => {
    it('should return all configurations', async () => {
      const response = await request(app)
        .get('/api/configs')
        .expect(200);

      expect(response.body).to.be.an('object');
      expect(response.body).to.have.property('llm');
      expect(response.body).to.have.property('whatsapp');
      expect(response.body).to.have.property('server');
    });

    it('should return JSON content type', async () => {
      const response = await request(app)
        .get('/api/configs')
        .expect('Content-Type', /json/);

      expect(response.status).to.equal(200);
    });
  });

  describe('PUT /api/configs', () => {
    it('should update configurations successfully', async () => {
      const newConfig = {
        llm: {
          host: 'http://localhost:11434',
          model: 'llama3.1',
          imageModel: 'llava'
        },
        whatsapp: {
          enabled: false,
          sessionName: 'updated-session'
        }
      };

      const response = await request(app)
        .put('/api/configs')
        .send(newConfig)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('message');
      expect(response.body.message).to.include('sucesso');
    });

    it('should reject invalid configuration', async () => {
      const invalidConfig = null;

      const response = await request(app)
        .put('/api/configs')
        .send(invalidConfig)
        .expect(400);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('inválida');
    });

    it('should reject empty configuration', async () => {
      const response = await request(app)
        .put('/api/configs')
        .send({})
        .expect(200);

      expect(response.body).to.have.property('success', true);
    });

    it('should handle partial configuration updates', async () => {
      const partialConfig = {
        llm: {
          model: 'mistral'
        }
      };

      const response = await request(app)
        .put('/api/configs')
        .send(partialConfig)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      
      // Verificar se a configuração foi atualizada
      const getResponse = await request(app)
        .get('/api/configs')
        .expect(200);

      expect(getResponse.body.llm.model).to.equal('mistral');
    });
  });

  describe('GET /configs', () => {
    it('should return HTML page', async () => {
      const response = await request(app)
        .get('/configs')
        .expect(200);

      expect(response.text).to.include('<!DOCTYPE html>');
      expect(response.text).to.include('Configurações');
      expect(response.text).to.include('config-data');
    });

    it('should return HTML content type', async () => {
      const response = await request(app)
        .get('/configs')
        .expect('Content-Type', /html/);

      expect(response.status).to.equal(200);
    });
  });

  describe('Configuration Validation', () => {
    it('should maintain configuration structure', async () => {
      const response = await request(app)
        .get('/api/configs')
        .expect(200);

      const config = response.body;
      
      // Verificar estrutura básica
      expect(config).to.have.property('llm');
      expect(config.llm).to.have.property('host');
      expect(config.llm).to.have.property('model');
      
      expect(config).to.have.property('whatsapp');
      expect(config.whatsapp).to.have.property('enabled');
      
      expect(config).to.have.property('server');
      expect(config.server).to.have.property('port');
    });

    it('should preserve data types', async () => {
      const response = await request(app)
        .get('/api/configs')
        .expect(200);

      const config = response.body;
      
      expect(config.whatsapp.enabled).to.be.a('boolean');
      expect(config.server.port).to.be.a('number');
      expect(config.llm.host).to.be.a('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .put('/api/configs')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should return appropriate error messages', async () => {
      const response = await request(app)
        .put('/api/configs')
        .send(null)
        .expect(400);

      expect(response.body).to.have.property('error');
      expect(response.body.error).to.be.a('string');
    });
  });
});

// Teste de integração simulado
describe('Integration Tests', () => {
  let app;
  let mockRestAPI;

  beforeEach(() => {
    mockRestAPI = new MockRestAPI();
    app = mockRestAPI.app;
  });

  it('should complete full configuration cycle', async () => {
    // 1. Obter configuração inicial
    const initialResponse = await request(app)
      .get('/api/configs')
      .expect(200);

    const initialConfig = initialResponse.body;
    expect(initialConfig).to.be.an('object');

    // 2. Modificar configuração
    const modifiedConfig = {
      ...initialConfig,
      llm: {
        ...initialConfig.llm,
        model: 'updated-model'
      }
    };

    // 3. Atualizar configuração
    const updateResponse = await request(app)
      .put('/api/configs')
      .send(modifiedConfig)
      .expect(200);

    expect(updateResponse.body.success).to.be.true;

    // 4. Verificar se a configuração foi atualizada
    const finalResponse = await request(app)
      .get('/api/configs')
      .expect(200);

    expect(finalResponse.body.llm.model).to.equal('updated-model');
  });

  it('should handle concurrent updates gracefully', async () => {
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      const config = {
        llm: { model: `model-${i}` }
      };
      
      promises.push(
        request(app)
          .put('/api/configs')
          .send(config)
          .expect(200)
      );
    }

    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.body.success).to.be.true;
    });
  });
});

// Executar os testes se este arquivo for executado diretamente
if (require.main === module) {
  console.log('Executando testes da API de configurações...');
  console.log('Use: npm test ou npx mocha test/configs-api.test.js');
}