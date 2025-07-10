import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import FlowDataService from '../src/services/flowDataService.js';

describe('FlowDataService', () => {
    let mongod;
    let client;
    let db;
    let flowDataService;

    beforeEach(async () => {
        // Inicializar MongoDB em memória para testes
        mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        client = new MongoClient(uri);
        await client.connect();
        db = client.db('test');
        
        flowDataService = new FlowDataService(db);
    });

    afterEach(async () => {
        if (client) {
            await client.close();
        }
        if (mongod) {
            await mongod.stop();
        }
    });

    it('deve inicializar o serviço corretamente', async () => {
        const result = await flowDataService.init();
        assert.strictEqual(result, true);
        assert.strictEqual(flowDataService.migrationCompleted, true);
    });

    it('deve salvar e carregar um flow', async () => {
        await flowDataService.init();
        
        const flowData = {
            id: 'test-flow-1',
            name: 'Teste Flow',
            description: 'Flow para teste',
            nodes: [
                { id: 'node1', type: 'start', data: {} },
                { id: 'node2', type: 'message', data: { text: 'Olá!' } }
            ],
            connections: [
                { from: 'node1', to: 'node2' }
            ]
        };

        // Salvar
        const saveResult = await flowDataService.saveFlow(flowData);
        assert.strictEqual(saveResult.success, true);
        assert.strictEqual(saveResult.flowId, 'test-flow-1');

        // Carregar
        const loadedFlow = await flowDataService.loadFlow('test-flow-1');
        assert.strictEqual(loadedFlow.id, 'test-flow-1');
        assert.strictEqual(loadedFlow.name, 'Teste Flow');
        assert.strictEqual(loadedFlow.nodes.length, 2);
    });

    it('deve realizar migração de dados da config', async () => {
        // Simular dados antigos na config
        const configCollection = db.collection('config');
        await configCollection.insertOne({
            _id: 'app',
            values: {
                flows: {
                    'flow1': {
                        id: 'flow1',
                        name: 'Flow Antigo',
                        description: 'Flow da configuração antiga',
                        nodes: [{ id: 'node1', type: 'start', data: {} }],
                        connections: []
                    }
                }
            }
        });

        // Inicializar serviço (deve fazer migração)
        await flowDataService.init();

        // Verificar se o flow foi migrado
        const migratedFlow = await flowDataService.loadFlow('flow1');
        assert.strictEqual(migratedFlow.id, 'flow1');
        assert.strictEqual(migratedFlow.name, 'Flow Antigo');
        assert.ok(migratedFlow.migratedAt);

        // Verificar se dados foram removidos da config
        const configDoc = await configCollection.findOne({ _id: 'app' });
        assert.strictEqual(configDoc.values.flows, undefined);
    });

    it('deve listar flows corretamente', async () => {
        await flowDataService.init();

        // Adicionar alguns flows
        await flowDataService.saveFlow({
            id: 'flow1',
            name: 'Flow 1',
            nodes: [],
            connections: []
        });

        await flowDataService.saveFlow({
            id: 'flow2', 
            name: 'Flow 2',
            nodes: [],
            connections: []
        });

        // Listar
        const result = await flowDataService.listFlows();
        assert.strictEqual(result.total, 2);
        assert.strictEqual(result.flows.length, 2);
    });

    it('deve excluir flow corretamente', async () => {
        await flowDataService.init();

        // Salvar flow
        await flowDataService.saveFlow({
            id: 'flow-to-delete',
            name: 'Flow para Deletar',
            nodes: [],
            connections: []
        });

        // Verificar que existe
        let exists = await flowDataService.flowExists('flow-to-delete');
        assert.strictEqual(exists, true);

        // Excluir
        const deleteResult = await flowDataService.deleteFlow('flow-to-delete');
        assert.strictEqual(deleteResult.success, true);

        // Verificar que não existe mais
        exists = await flowDataService.flowExists('flow-to-delete');
        assert.strictEqual(exists, false);
    });

    it('deve buscar flows por critério', async () => {
        await flowDataService.init();

        // Adicionar flows com diferentes nomes
        await flowDataService.saveFlow({
            id: 'flow1',
            name: 'Academia Jiu-Jitsu',
            description: 'Flow para academia',
            nodes: [],
            connections: []
        });

        await flowDataService.saveFlow({
            id: 'flow2',
            name: 'E-commerce Store',
            description: 'Flow para loja',
            nodes: [],
            connections: []
        });

        // Buscar por "academia"
        const searchResult = await flowDataService.searchFlows('academia');
        assert.strictEqual(searchResult.total, 1);
        assert.strictEqual(searchResult.flows[0]._id, 'flow1');
    });

    it('deve obter estatísticas corretamente', async () => {
        await flowDataService.init();

        // Adicionar flow com nós
        await flowDataService.saveFlow({
            id: 'flow1',
            name: 'Flow com Nós',
            nodes: [
                { id: 'node1', type: 'start', data: {} },
                { id: 'node2', type: 'message', data: { text: 'Teste' } },
                { id: 'node3', type: 'condition', data: { condition: 'equals', value: 'sim' } }
            ],
            connections: [
                { from: 'node1', to: 'node2' },
                { from: 'node2', to: 'node3' }
            ]
        });

        const stats = await flowDataService.getStats();
        assert.strictEqual(stats.totalFlows, 1);
        assert.strictEqual(stats.totalNodes, 3);
        assert.strictEqual(stats.totalConnections, 2);
        assert.strictEqual(stats.nodeTypes.start, 1);
        assert.strictEqual(stats.nodeTypes.message, 1);
        assert.strictEqual(stats.nodeTypes.condition, 1);
        assert.strictEqual(stats.averageNodesPerFlow, 3);
    });
});