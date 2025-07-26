#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import FlowDataService from '../src/services/flowDataService.js';
import logger from '../src/utils/logger.js';
import { CONFIG } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

/**
 * CLI script for creating new flows
 * Usage: node scripts/flow-new.js [options]
 */

class FlowCreator {
    constructor() {
        this.mongoClient = null;
        this.db = null;
        this.flowDataService = null;
        this.rl = null;
    }

    async initialize() {
        try {
            // Connect to MongoDB
            this.mongoClient = new MongoClient(CONFIG.mongo.uri);
            await this.mongoClient.connect();
            this.db = this.mongoClient.db(CONFIG.mongo.dbName);
            
            // Initialize services
            this.flowDataService = new FlowDataService(this.db);
            await this.flowDataService.init();
            
            // Setup readline interface
            this.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            logger.info('🔧 Flow Creator initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Flow Creator:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.rl) {
            this.rl.close();
        }
        if (this.mongoClient) {
            await this.mongoClient.close();
            logger.info('🔧 MongoDB connection closed');
        }
    }

    /**
     * Create a new flow interactively
     */
    async createFlowInteractive() {
        console.log('\n🎯 Criando um novo flow...\n');
        
        try {
            // Gather basic flow information
            const flowData = await this.gatherFlowInformation();
            
            // Choose flow template
            const template = await this.chooseTemplate();
            
            // Create the flow
            const flow = this.generateFlow(flowData, template);
            
            // Save to database
            const result = await this.flowDataService.saveFlow(flow);
            
            if (result.success) {
                console.log(`\n✅ Flow '${flow.name}' criado com sucesso!`);
                console.log(`   ID: ${flow.id}`);
                console.log(`   Alias: ${flow.alias}`);
                console.log(`   Descrição: ${flow.description}`);
                console.log(`\nPara testar o flow:`);
                console.log(`   !flow start ${flow.alias}`);
                console.log(`\nPara editar no Flow Builder:`);
                console.log(`   http://localhost:3000/flow-builder?id=${flow.id}`);
            } else {
                logger.error('❌ Erro ao salvar o flow');
            }
            
        } catch (error) {
            logger.error('❌ Erro ao criar flow:', error);
        }
    }

    /**
     * Create flow from template
     */
    async createFromTemplate(templateName, options = {}) {
        try {
            const template = await this.loadTemplate(templateName);
            if (!template) {
                throw new Error(`Template '${templateName}' não encontrado`);
            }

            // Use provided options or defaults
            const flowData = {
                name: options.name || template.name || `Flow baseado em ${templateName}`,
                description: options.description || template.description || '',
                alias: options.alias || templateName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                ...options
            };

            const flow = this.generateFlow(flowData, template);
            
            // Save to database
            const result = await this.flowDataService.saveFlow(flow);
            
            if (result.success) {
                console.log(`✅ Flow '${flow.name}' criado a partir do template '${templateName}'`);
                console.log(`   ID: ${flow.id}`);
                console.log(`   Alias: ${flow.alias}`);
            } else {
                logger.error('❌ Erro ao salvar o flow');
            }
            
            return result;
        } catch (error) {
            logger.error(`❌ Erro ao criar flow a partir do template '${templateName}':`, error);
            throw error;
        }
    }

    /**
     * Gather flow information from user input
     */
    async gatherFlowInformation() {
        const flowData = {};
        
        flowData.name = await this.question('Nome do flow: ');
        flowData.description = await this.question('Descrição (opcional): ');
        flowData.alias = await this.question(`Alias para execução (padrão: ${this.generateAlias(flowData.name)}): `) || this.generateAlias(flowData.name);
        
        // Validate alias
        if (!/^[a-z0-9-]+$/.test(flowData.alias)) {
            console.log('⚠️ Alias deve conter apenas letras minúsculas, números e hífens');
            flowData.alias = this.generateAlias(flowData.name);
            console.log(`   Usando alias: ${flowData.alias}`);
        }
        
        return flowData;
    }

    /**
     * Choose flow template
     */
    async chooseTemplate() {
        const templates = await this.listAvailableTemplates();
        
        console.log('\n📋 Templates disponíveis:');
        console.log('0. Flow vazio (apenas start + message)');
        
        templates.forEach((template, index) => {
            console.log(`${index + 1}. ${template.name} - ${template.description || 'Sem descrição'}`);
        });
        
        const choice = await this.question('\nEscolha um template (0-' + templates.length + '): ');
        const templateIndex = parseInt(choice, 10);
        
        if (templateIndex === 0) {
            return null; // Empty flow
        } else if (templateIndex > 0 && templateIndex <= templates.length) {
            return templates[templateIndex - 1];
        } else {
            console.log('⚠️ Opção inválida, usando flow vazio');
            return null;
        }
    }

    /**
     * List available templates
     */
    async listAvailableTemplates() {
        try {
            const templateDir = path.join(process.cwd(), 'template');
            const files = await fs.readdir(templateDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            const templates = [];
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(templateDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const template = JSON.parse(content);
                    template.filename = file;
                    templates.push(template);
                } catch (error) {
                    logger.warn(`⚠️ Erro ao ler template ${file}:`, error.message);
                }
            }
            
            return templates;
        } catch (error) {
            logger.warn('⚠️ Erro ao listar templates:', error);
            return [];
        }
    }

    /**
     * Load specific template
     */
    async loadTemplate(templateName) {
        try {
            const templateDir = path.join(process.cwd(), 'template');
            const templateFile = templateName.endsWith('.json') ? templateName : `${templateName}.json`;
            const filePath = path.join(templateDir, templateFile);
            
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            logger.error(`❌ Erro ao carregar template '${templateName}':`, error);
            return null;
        }
    }

    /**
     * Generate flow from data and template
     */
    generateFlow(flowData, template) {
        const flowId = this.generateFlowId(flowData.name);
        
        let flow = {
            id: flowId,
            name: flowData.name,
            description: flowData.description || '',
            alias: flowData.alias,
            createdAt: new Date().toISOString(),
            version: '1.0.0',
            metadata: {
                createdBy: 'flow-creator-cli',
                isTemplate: false,
                category: flowData.category || 'general'
            },
            nodes: [],
            edges: [],
            connections: [] // Legacy field
        };

        if (template) {
            // Use template as base
            flow = {
                ...flow,
                nodes: this.adaptTemplateNodes(template.nodes || [], flowId),
                edges: template.edges || [],
                connections: template.connections || [],
                metadata: {
                    ...flow.metadata,
                    templateSource: template.name || template.filename,
                    category: template.metadata?.category || 'general'
                }
            };
        } else {
            // Create minimal flow
            flow.nodes = this.createMinimalFlow(flowId);
            flow.edges = [
                {
                    id: 'edge-1',
                    source: 'start-1',
                    target: 'message-1'
                }
            ];
        }

        return flow;
    }

    /**
     * Adapt template nodes for new flow
     */
    adaptTemplateNodes(templateNodes, flowId) {
        return templateNodes.map(node => ({
            ...node,
            id: node.id || `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            data: {
                ...node.data,
                // Update any flow-specific references
                flowId: flowId
            }
        }));
    }

    /**
     * Create minimal flow structure
     */
    createMinimalFlow(flowId) {
        return [
            {
                id: 'start-1',
                type: 'start',
                position: { x: 100, y: 100 },
                data: {
                    label: 'Início',
                    message: 'Flow iniciado'
                }
            },
            {
                id: 'message-1',
                type: 'message',
                position: { x: 300, y: 100 },
                data: {
                    label: 'Mensagem Principal',
                    message: `Bem-vindo ao flow! Este é um flow básico criado via CLI.\n\nPara sair, digite: !flow stop`,
                    isMainMenu: true
                }
            }
        ];
    }

    /**
     * Generate unique flow ID
     */
    generateFlowId(name) {
        const base = name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 30);
        
        const timestamp = Date.now().toString(36);
        return `${base}-${timestamp}`;
    }

    /**
     * Generate alias from name
     */
    generateAlias(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 20);
    }

    /**
     * Wrapper for readline question
     */
    question(query) {
        return new Promise(resolve => {
            this.rl.question(query, resolve);
        });
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const creator = new FlowCreator();

    try {
        const options = parseArgs(args);

        if (options.help) {
            showHelp();
            return;
        }

        await creator.initialize();
        
        try {
            if (options.template) {
                // Create from template
                await creator.createFromTemplate(options.template, {
                    name: options.name,
                    description: options.description,
                    alias: options.alias
                });
            } else {
                // Interactive creation
                await creator.createFlowInteractive();
            }
            
        } finally {
            await creator.cleanup();
        }
        
    } catch (error) {
        logger.error('❌ Flow creation failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
                
            case '--template':
            case '-t':
                options.template = args[++i];
                break;
                
            case '--name':
            case '-n':
                options.name = args[++i];
                break;
                
            case '--description':
            case '-d':
                options.description = args[++i];
                break;
                
            case '--alias':
            case '-a':
                options.alias = args[++i];
                break;
        }
    }

    return options;
}

/**
 * Show help message
 */
function showHelp() {
    console.log(`
Flow Creator

Usage: node scripts/flow-new.js [options]

Options:
  -h, --help                  Show this help message
  -t, --template <name>       Create flow from template
  -n, --name <name>           Flow name
  -d, --description <desc>    Flow description  
  -a, --alias <alias>         Flow alias for execution

Examples:
  # Interactive flow creation
  node scripts/flow-new.js

  # Create from template
  node scripts/flow-new.js --template academia

  # Create with specific options
  node scripts/flow-new.js --template suporte --name "Atendimento Cliente" --alias atendimento

Templates available:
  - academia: Personal training and fitness flows
  - suporte: Customer support flows
  - vendas: Sales and lead generation flows
  - consultorio: Medical consultation flows
  - jiu-jitsu: Martial arts training flows

The created flow will be saved to the database and can be:
  - Executed via WhatsApp: !flow start <alias>
  - Edited in Flow Builder: http://localhost:3000/flow-builder?id=<flowId>
  - Tested with: make test-flows --flows <flowId>
  - Validated with: make validate-flows --flows <flowId>
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default FlowCreator;