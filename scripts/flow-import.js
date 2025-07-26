#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import FlowDataService from '../src/services/flowDataService.js';
import logger from '../src/utils/logger.js';
import { CONFIG } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * CLI script for importing flows
 * Usage: node scripts/flow-import.js [options]
 */

class FlowImporter {
    constructor() {
        this.mongoClient = null;
        this.db = null;
        this.flowDataService = null;
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
            
            logger.info('📥 Flow Importer initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Flow Importer:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            logger.info('📥 MongoDB connection closed');
        }
    }

    /**
     * Import flows from files or directory
     */
    async importFlows(options = {}) {
        const {
            source,
            importDir = 'exports',
            overwrite = false,
            validateBeforeImport = true,
            dryRun = false,
            includeVersions = false
        } = options;

        try {
            let filesToImport = [];

            if (source) {
                // Import specific file
                if (await this.fileExists(source)) {
                    filesToImport.push(source);
                } else {
                    throw new Error(`File not found: ${source}`);
                }
            } else {
                // Import from directory
                filesToImport = await this.findFlowFiles(importDir);
            }

            if (filesToImport.length === 0) {
                logger.warn('⚠️ No flow files found to import');
                return { success: false, message: 'No files found' };
            }

            logger.info(`📥 Importing ${filesToImport.length} flow files`);

            const importResults = [];

            for (const filePath of filesToImport) {
                try {
                    const result = await this.importSingleFlow(filePath, {
                        overwrite,
                        validateBeforeImport,
                        dryRun,
                        includeVersions
                    });
                    importResults.push(result);
                } catch (error) {
                    logger.error(`❌ Error importing ${filePath}:`, error);
                    importResults.push({
                        filePath,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = importResults.filter(r => r.success).length;
            const failureCount = importResults.length - successCount;

            logger.info(`✅ Import completed: ${successCount} successes, ${failureCount} failures`);

            return {
                success: true,
                imported: successCount,
                failed: failureCount,
                dryRun,
                results: importResults
            };

        } catch (error) {
            logger.error('❌ Import failed:', error);
            throw error;
        }
    }

    /**
     * Import a single flow file
     */
    async importSingleFlow(filePath, options = {}) {
        const {
            overwrite,
            validateBeforeImport,
            dryRun,
            includeVersions
        } = options;

        // Read and parse flow file
        const flowData = await this.readFlowFile(filePath);
        
        if (!flowData) {
            throw new Error(`Failed to read flow data from ${filePath}`);
        }

        // Validate flow data
        if (validateBeforeImport) {
            const validation = await this.validateFlowData(flowData);
            if (!validation.valid) {
                throw new Error(`Flow validation failed: ${validation.errors.join(', ')}`);
            }
        }

        // Check if flow already exists
        const existingFlow = await this.flowDataService.loadFlow(flowData.id);
        const isUpdate = !!existingFlow;

        if (isUpdate && !overwrite) {
            throw new Error(`Flow ${flowData.id} already exists (use --overwrite to replace)`);
        }

        // Prepare flow for import
        const importFlow = this.prepareFlowForImport(flowData, {
            isUpdate,
            originalFilePath: filePath
        });

        let result = {
            filePath,
            flowId: flowData.id,
            flowName: flowData.name,
            success: false,
            isUpdate,
            dryRun
        };

        if (dryRun) {
            result.success = true;
            result.message = 'Dry run - no changes made';
            logger.info(`🔍 [DRY RUN] Would ${isUpdate ? 'update' : 'create'}: ${flowData.name} (${flowData.id})`);
        } else {
            // Import the flow
            const saveResult = await this.flowDataService.saveFlow(importFlow);
            
            if (saveResult.success) {
                result.success = true;
                result.message = `Flow ${isUpdate ? 'updated' : 'created'} successfully`;
                
                // Import versions if available and requested
                if (includeVersions) {
                    await this.importFlowVersions(flowData.id, path.dirname(filePath));
                }
                
                logger.info(`📥 ${isUpdate ? 'Updated' : 'Created'}: ${flowData.name} (${flowData.id})`);
            } else {
                throw new Error('Failed to save flow to database');
            }
        }

        return result;
    }

    /**
     * Read flow file
     */
    async readFlowFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const extension = path.extname(filePath).toLowerCase();

            switch (extension) {
                case '.json':
                    return JSON.parse(content);
                case '.yaml':
                case '.yml':
                    // Note: Would need yaml library for full implementation
                    return this.parseYaml(content);
                default:
                    // Try JSON as fallback
                    return JSON.parse(content);
            }
        } catch (error) {
            logger.error(`❌ Error reading file ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Validate flow data
     */
    async validateFlowData(flowData) {
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        // Check required fields
        const requiredFields = ['id', 'name', 'nodes'];
        for (const field of requiredFields) {
            if (!flowData[field]) {
                validation.errors.push(`Missing required field: ${field}`);
                validation.valid = false;
            }
        }

        // Validate nodes structure
        if (flowData.nodes) {
            if (!Array.isArray(flowData.nodes)) {
                validation.errors.push('Nodes must be an array');
                validation.valid = false;
            } else {
                for (const node of flowData.nodes) {
                    if (!node.id || !node.type) {
                        validation.errors.push(`Node missing id or type: ${JSON.stringify(node)}`);
                        validation.valid = false;
                    }
                }
            }
        }

        // Validate edges structure
        if (flowData.edges) {
            if (!Array.isArray(flowData.edges)) {
                validation.errors.push('Edges must be an array');
                validation.valid = false;
            } else {
                for (const edge of flowData.edges) {
                    if (!edge.source || !edge.target) {
                        validation.errors.push(`Edge missing source or target: ${JSON.stringify(edge)}`);
                        validation.valid = false;
                    }
                }
            }
        }

        // Check for start node
        if (flowData.nodes) {
            const startNodes = flowData.nodes.filter(node => node.type === 'start');
            if (startNodes.length === 0) {
                validation.warnings.push('No start node found');
            } else if (startNodes.length > 1) {
                validation.warnings.push('Multiple start nodes found');
            }
        }

        // Validate alias format
        if (flowData.alias && !/^[a-z0-9-]+$/.test(flowData.alias)) {
            validation.warnings.push('Alias should contain only lowercase letters, numbers, and hyphens');
        }

        return validation;
    }

    /**
     * Prepare flow for import
     */
    prepareFlowForImport(flowData, options = {}) {
        const { isUpdate, originalFilePath } = options;

        const importFlow = {
            id: flowData.id,
            name: flowData.name,
            description: flowData.description || '',
            alias: flowData.alias || flowData.id,
            version: flowData.version || '1.0.0',
            nodes: flowData.nodes || [],
            edges: flowData.edges || [],
            connections: flowData.connections || [], // Legacy compatibility
            lastModified: new Date(),
            metadata: {
                ...flowData.metadata,
                importedAt: new Date().toISOString(),
                importedFrom: originalFilePath,
                importVersion: '1.0.0',
                originalExportedAt: flowData.exportedAt
            }
        };

        // Set creation date
        if (!isUpdate) {
            importFlow.createdAt = flowData.createdAt || new Date().toISOString();
        }

        // Clean up nodes (ensure proper structure)
        importFlow.nodes = this.cleanupNodes(importFlow.nodes);

        // Clean up edges (ensure proper structure)
        importFlow.edges = this.cleanupEdges(importFlow.edges);

        return importFlow;
    }

    /**
     * Cleanup nodes structure
     */
    cleanupNodes(nodes) {
        return nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: node.position || { x: 0, y: 0 },
            data: {
                ...node.data,
                // Ensure label exists
                label: node.data?.label || this.generateNodeLabel(node.type)
            }
        }));
    }

    /**
     * Cleanup edges structure
     */
    cleanupEdges(edges) {
        return edges.map(edge => ({
            id: edge.id || `edge-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            source: edge.source,
            target: edge.target,
            label: edge.label || '',
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle
        }));
    }

    /**
     * Generate default node label
     */
    generateNodeLabel(nodeType) {
        const labels = {
            start: 'Início',
            message: 'Mensagem',
            condition: 'Condição',
            llm: 'LLM',
            webhook: 'Webhook',
            delay: 'Atraso',
            variable: 'Variável'
        };
        
        return labels[nodeType] || nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
    }

    /**
     * Import flow versions
     */
    async importFlowVersions(flowId, baseDir) {
        try {
            const versionsDir = path.join(baseDir, 'versions', flowId);
            
            if (await this.directoryExists(versionsDir)) {
                const versionFiles = await fs.readdir(versionsDir);
                
                for (const file of versionFiles) {
                    if (file.endsWith('.json')) {
                        const versionPath = path.join(versionsDir, file);
                        const versionData = await this.readFlowFile(versionPath);
                        
                        if (versionData && versionData.versioning) {
                            // Import as draft version
                            await this.flowDataService.createDraftVersion(
                                flowId,
                                versionData,
                                'flow-import-cli'
                            );
                            
                            logger.info(`📥 Imported version: ${versionData.versioning.version}`);
                        }
                    }
                }
            }
        } catch (error) {
            logger.warn(`⚠️ Error importing versions for flow ${flowId}:`, error);
        }
    }

    /**
     * Find flow files in directory
     */
    async findFlowFiles(importDir) {
        try {
            if (!(await this.directoryExists(importDir))) {
                throw new Error(`Directory not found: ${importDir}`);
            }

            const files = await fs.readdir(importDir);
            const flowFiles = [];

            for (const file of files) {
                const filePath = path.join(importDir, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isFile() && this.isFlowFile(file)) {
                    flowFiles.push(filePath);
                }
            }

            return flowFiles;
        } catch (error) {
            logger.error(`❌ Error finding flow files in ${importDir}:`, error);
            return [];
        }
    }

    /**
     * Check if file is a flow file
     */
    isFlowFile(filename) {
        const flowFilePatterns = [
            /^flow-.*\.json$/,
            /^.*-flow\.json$/,
            /\.flow\.json$/,
            /\.flow\.yaml$/,
            /\.flow\.yml$/
        ];

        return flowFilePatterns.some(pattern => pattern.test(filename)) ||
               (filename.endsWith('.json') && !filename.includes('manifest'));
    }

    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if directory exists
     */
    async directoryExists(dirPath) {
        try {
            const stat = await fs.stat(dirPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Parse YAML (simplified)
     */
    parseYaml(content) {
        // This is a very simplified YAML parser
        // In a real implementation, you'd use a proper YAML library
        try {
            // For now, just try to parse as JSON
            return JSON.parse(content);
        } catch {
            throw new Error('YAML parsing not fully implemented - use JSON format');
        }
    }

    /**
     * List importable files
     */
    async listImportableFiles(importDir = 'exports') {
        try {
            const files = await this.findFlowFiles(importDir);

            console.log(`\n📁 Arquivos importáveis em ${importDir}:\n`);
            
            if (files.length === 0) {
                console.log('Nenhum arquivo de flow encontrado.\n');
                return;
            }

            for (const filePath of files) {
                try {
                    const flowData = await this.readFlowFile(filePath);
                    if (flowData) {
                        const fileSize = (await fs.stat(filePath)).size;
                        const nodeCount = flowData.nodes?.length || 0;
                        const exportedAt = flowData.exportedAt ? 
                            new Date(flowData.exportedAt).toLocaleDateString('pt-BR') : 'N/A';
                        
                        console.log(`📄 ${path.basename(filePath)}`);
                        console.log(`   Flow: ${flowData.name} (${flowData.id})`);
                        console.log(`   Alias: ${flowData.alias || 'N/A'}`);
                        console.log(`   Nodes: ${nodeCount} | Tamanho: ${Math.round(fileSize/1024)}KB | Exportado: ${exportedAt}`);
                        console.log(`   Descrição: ${flowData.description || 'Sem descrição'}\n`);
                    }
                } catch (error) {
                    console.log(`❌ ${path.basename(filePath)} - Erro ao ler arquivo\n`);
                }
            }

        } catch (error) {
            logger.error('❌ Error listing importable files:', error);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const importer = new FlowImporter();

    try {
        const options = parseArgs(args);

        if (options.help) {
            showHelp();
            return;
        }

        await importer.initialize();
        
        try {
            if (options.list) {
                await importer.listImportableFiles(options.importDir);
            } else {
                const result = await importer.importFlows(options);
                
                if (result.success) {
                    console.log(`\n✅ Import ${result.dryRun ? 'simulado' : 'concluído'} com sucesso!`);
                    console.log(`   Flows ${result.dryRun ? 'que seriam ' : ''}importados: ${result.imported}`);
                    console.log(`   Falhas: ${result.failed}`);
                    
                    if (!result.dryRun && result.imported > 0) {
                        console.log('\nFlows importados podem ser usados com:');
                        console.log('   !flow start <alias>');
                        console.log('   http://localhost:3000/flow-builder?id=<flowId>');
                    }
                } else {
                    console.log(`\n❌ Import falhou: ${result.message}`);
                }
            }
            
        } finally {
            await importer.cleanup();
        }
        
    } catch (error) {
        logger.error('❌ Flow import failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        importDir: 'exports',
        overwrite: false,
        validateBeforeImport: true,
        dryRun: false,
        includeVersions: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
                
            case '--list':
            case '-l':
                options.list = true;
                break;
                
            case '--source':
            case '-s':
                options.source = args[++i];
                break;
                
            case '--dir':
            case '-d':
                options.importDir = args[++i];
                break;
                
            case '--overwrite':
                options.overwrite = true;
                break;
                
            case '--no-validate':
                options.validateBeforeImport = false;
                break;
                
            case '--dry-run':
                options.dryRun = true;
                break;
                
            case '--include-versions':
                options.includeVersions = true;
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
Flow Importer

Usage: node scripts/flow-import.js [options]

Options:
  -h, --help                  Show this help message
  -l, --list                  List importable files
  -s, --source <file>         Import specific file
  -d, --dir <directory>       Import directory (default: exports)
  --overwrite                 Overwrite existing flows
  --no-validate               Skip validation before import
  --dry-run                   Simulate import without making changes
  --include-versions          Import flow versions if available

Examples:
  # List importable files
  node scripts/flow-import.js --list

  # Import all flows from exports directory
  node scripts/flow-import.js

  # Import specific file
  node scripts/flow-import.js --source exports/flow-academia-123.json

  # Import with overwrite
  node scripts/flow-import.js --overwrite --dir my-flows

  # Dry run to see what would be imported
  node scripts/flow-import.js --dry-run

  # Import from different directory
  node scripts/flow-import.js --dir backups/flows --include-versions

The importer will:
  - Validate flow structure before import
  - Check for existing flows (use --overwrite to replace)
  - Import flow versions if available
  - Update metadata with import information
  - Create alias mappings for flow execution
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default FlowImporter;