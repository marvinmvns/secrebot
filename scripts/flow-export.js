#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import FlowDataService from '../src/services/flowDataService.js';
import logger from '../src/utils/logger.js';
import { CONFIG } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * CLI script for exporting flows
 * Usage: node scripts/flow-export.js [options]
 */

class FlowExporter {
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
            
            logger.info('📦 Flow Exporter initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Flow Exporter:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            logger.info('📦 MongoDB connection closed');
        }
    }

    /**
     * Export flows to files
     */
    async exportFlows(options = {}) {
        const {
            flowIds = [],
            outputDir = 'exports',
            format = 'json',
            includeVersions = false,
            includeMetadata = true,
            compress = false
        } = options;

        try {
            // Ensure output directory exists
            await fs.mkdir(outputDir, { recursive: true });

            let flows = [];

            if (flowIds.length > 0) {
                // Export specific flows
                for (const flowId of flowIds) {
                    const flow = await this.flowDataService.loadFlow(flowId);
                    if (flow) {
                        flows.push(flow);
                    } else {
                        logger.warn(`⚠️ Flow ${flowId} not found`);
                    }
                }
            } else {
                // Export all flows
                const result = await this.flowDataService.listFlows({ limit: 1000 });
                flows = result.flows || [];
            }

            if (flows.length === 0) {
                logger.warn('⚠️ No flows to export');
                return { success: false, message: 'No flows found' };
            }

            logger.info(`📦 Exporting ${flows.length} flows to ${outputDir}`);

            const exportResults = [];

            for (const flow of flows) {
                try {
                    const result = await this.exportSingleFlow(flow, {
                        outputDir,
                        format,
                        includeVersions,
                        includeMetadata,
                        compress
                    });
                    exportResults.push(result);
                } catch (error) {
                    logger.error(`❌ Error exporting flow ${flow.id}:`, error);
                    exportResults.push({
                        flowId: flow.id,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Generate export manifest
            const manifest = await this.generateExportManifest(flows, exportResults, options);
            const manifestPath = path.join(outputDir, 'export-manifest.json');
            await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

            const successCount = exportResults.filter(r => r.success).length;
            const failureCount = exportResults.length - successCount;

            logger.info(`✅ Export completed: ${successCount} successes, ${failureCount} failures`);
            logger.info(`📄 Export manifest saved to: ${manifestPath}`);

            return {
                success: true,
                exported: successCount,
                failed: failureCount,
                manifestPath,
                results: exportResults
            };

        } catch (error) {
            logger.error('❌ Export failed:', error);
            throw error;
        }
    }

    /**
     * Export a single flow
     */
    async exportSingleFlow(flow, options = {}) {
        const {
            outputDir,
            format,
            includeVersions,
            includeMetadata,
            compress
        } = options;

        // Prepare flow data for export
        const exportData = this.prepareFlowForExport(flow, {
            includeMetadata,
            includeVersions
        });

        // Generate filename
        const sanitizedName = flow.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const filename = `flow-${sanitizedName}-${flow.id}.${format}`;
        const filePath = path.join(outputDir, filename);

        let content;
        switch (format) {
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                break;
            case 'yaml':
                // Note: Would need yaml library for full implementation
                content = this.convertToYaml(exportData);
                break;
            default:
                content = JSON.stringify(exportData, null, 2);
        }

        await fs.writeFile(filePath, content, 'utf8');

        // Get versions if requested
        let versionFiles = [];
        if (includeVersions) {
            versionFiles = await this.exportFlowVersions(flow.id, outputDir);
        }

        logger.info(`📦 Exported: ${flow.name} → ${filename}`);

        return {
            flowId: flow.id,
            flowName: flow.name,
            success: true,
            filePath,
            fileSize: Buffer.byteLength(content, 'utf8'),
            versionFiles,
            format
        };
    }

    /**
     * Prepare flow data for export
     */
    prepareFlowForExport(flow, options = {}) {
        const { includeMetadata, includeVersions } = options;

        const exportData = {
            id: flow.id,
            name: flow.name,
            description: flow.description,
            alias: flow.alias,
            version: flow.version || '1.0.0',
            nodes: flow.nodes || [],
            edges: flow.edges || [],
            connections: flow.connections || [], // Legacy compatibility
            exportedAt: new Date().toISOString(),
            exportVersion: '1.0.0'
        };

        if (includeMetadata) {
            exportData.metadata = {
                createdAt: flow.createdAt,
                lastModified: flow.lastModified,
                createdBy: flow.metadata?.createdBy,
                category: flow.metadata?.category,
                tags: flow.metadata?.tags || [],
                isTemplate: flow.metadata?.isTemplate || false,
                templateSource: flow.metadata?.templateSource,
                // Stats
                totalExecutions: flow.totalExecutions || 0,
                lastExecutionTime: flow.lastExecutionTime,
                // Remove sensitive data
                ...this.sanitizeMetadata(flow.metadata || {})
            };
        }

        if (includeVersions && flow.versioning) {
            exportData.versioning = {
                version: flow.versioning.version,
                status: flow.versioning.status,
                createdAt: flow.versioning.createdAt,
                publishedAt: flow.versioning.publishedAt,
                baseVersion: flow.versioning.baseVersion
            };
        }

        return exportData;
    }

    /**
     * Export flow versions
     */
    async exportFlowVersions(flowId, outputDir) {
        try {
            const versions = await this.flowDataService.getFlowVersions(flowId);
            const versionFiles = [];

            const versionsDir = path.join(outputDir, 'versions', flowId);
            await fs.mkdir(versionsDir, { recursive: true });

            for (const version of versions) {
                try {
                    const versionFlow = await this.flowDataService.getFlowVersion(flowId, version.version);
                    if (versionFlow) {
                        const filename = `version-${version.version}.json`;
                        const filePath = path.join(versionsDir, filename);
                        
                        const versionData = this.prepareFlowForExport(versionFlow, {
                            includeMetadata: true,
                            includeVersions: true
                        });

                        await fs.writeFile(filePath, JSON.stringify(versionData, null, 2), 'utf8');
                        versionFiles.push({
                            version: version.version,
                            status: version.status,
                            filePath,
                            filename
                        });
                    }
                } catch (error) {
                    logger.warn(`⚠️ Error exporting version ${version.version}:`, error.message);
                }
            }

            return versionFiles;
        } catch (error) {
            logger.warn(`⚠️ Error exporting versions for flow ${flowId}:`, error);
            return [];
        }
    }

    /**
     * Generate export manifest
     */
    async generateExportManifest(flows, exportResults, options) {
        const manifest = {
            exportInfo: {
                timestamp: new Date().toISOString(),
                exportedBy: 'flow-export-cli',
                version: '1.0.0',
                totalFlows: flows.length,
                successfulExports: exportResults.filter(r => r.success).length,
                failedExports: exportResults.filter(r => !r.success).length
            },
            options: {
                format: options.format || 'json',
                includeVersions: options.includeVersions || false,
                includeMetadata: options.includeMetadata || true,
                compress: options.compress || false
            },
            flows: exportResults.map(result => ({
                flowId: result.flowId,
                flowName: result.flowName,
                success: result.success,
                filePath: result.filePath,
                fileSize: result.fileSize,
                format: result.format,
                versionCount: result.versionFiles?.length || 0,
                error: result.error
            })),
            statistics: {
                totalFileSize: exportResults
                    .filter(r => r.success)
                    .reduce((sum, r) => sum + (r.fileSize || 0), 0),
                averageFlowSize: flows.length > 0 ? 
                    Math.round(exportResults
                        .filter(r => r.success)
                        .reduce((sum, r) => sum + (r.fileSize || 0), 0) / flows.length) : 0,
                nodeTypes: this.getNodeTypeStatistics(flows),
                categories: this.getCategoryStatistics(flows)
            }
        };

        return manifest;
    }

    /**
     * Get node type statistics
     */
    getNodeTypeStatistics(flows) {
        const nodeTypes = {};
        
        for (const flow of flows) {
            for (const node of flow.nodes || []) {
                nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
            }
        }

        return nodeTypes;
    }

    /**
     * Get category statistics
     */
    getCategoryStatistics(flows) {
        const categories = {};
        
        for (const flow of flows) {
            const category = flow.metadata?.category || 'uncategorized';
            categories[category] = (categories[category] || 0) + 1;
        }

        return categories;
    }

    /**
     * Sanitize metadata (remove sensitive information)
     */
    sanitizeMetadata(metadata) {
        const sanitized = { ...metadata };
        
        // Remove sensitive fields
        delete sanitized.apiKeys;
        delete sanitized.secrets;
        delete sanitized.credentials;
        delete sanitized.internalIds;
        
        return sanitized;
    }

    /**
     * Convert to YAML (simplified version)
     */
    convertToYaml(data) {
        // This is a simplified YAML conversion
        // In a real implementation, you'd use a proper YAML library
        return JSON.stringify(data, null, 2)
            .replace(/"/g, '')
            .replace(/,$/gm, '')
            .replace(/^\s*{\s*$/gm, '')
            .replace(/^\s*}\s*$/gm, '');
    }

    /**
     * List available flows
     */
    async listFlows() {
        try {
            const result = await this.flowDataService.listFlows({ limit: 100 });
            const flows = result.flows || [];

            console.log('\n📋 Flows disponíveis para export:\n');
            
            if (flows.length === 0) {
                console.log('Nenhum flow encontrado.\n');
                return;
            }

            flows.forEach((flow, index) => {
                const category = flow.metadata?.category || 'general';
                const nodeCount = flow.nodes?.length || 0;
                const lastModified = flow.lastModified ? 
                    new Date(flow.lastModified).toLocaleDateString('pt-BR') : 'N/A';
                
                console.log(`${index + 1}. ${flow.name} (${flow.id})`);
                console.log(`   Alias: ${flow.alias}`);
                console.log(`   Categoria: ${category} | Nodes: ${nodeCount} | Modificado: ${lastModified}`);
                console.log(`   Descrição: ${flow.description || 'Sem descrição'}\n`);
            });

        } catch (error) {
            logger.error('❌ Error listing flows:', error);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const exporter = new FlowExporter();

    try {
        const options = parseArgs(args);

        if (options.help) {
            showHelp();
            return;
        }

        await exporter.initialize();
        
        try {
            if (options.list) {
                await exporter.listFlows();
            } else {
                const result = await exporter.exportFlows(options);
                
                if (result.success) {
                    console.log(`\n✅ Export concluído com sucesso!`);
                    console.log(`   Flows exportados: ${result.exported}`);
                    console.log(`   Falhas: ${result.failed}`);
                    console.log(`   Manifest: ${result.manifestPath}`);
                } else {
                    console.log(`\n❌ Export falhou: ${result.message}`);
                }
            }
            
        } finally {
            await exporter.cleanup();
        }
        
    } catch (error) {
        logger.error('❌ Flow export failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        flowIds: [],
        outputDir: 'exports',
        format: 'json',
        includeVersions: false,
        includeMetadata: true,
        compress: false
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
                
            case '--flows':
                options.flowIds = args[++i].split(',');
                break;
                
            case '--output':
            case '-o':
                options.outputDir = args[++i];
                break;
                
            case '--format':
            case '-f':
                options.format = args[++i];
                break;
                
            case '--include-versions':
                options.includeVersions = true;
                break;
                
            case '--no-metadata':
                options.includeMetadata = false;
                break;
                
            case '--compress':
                options.compress = true;
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
Flow Exporter

Usage: node scripts/flow-export.js [options]

Options:
  -h, --help                  Show this help message
  -l, --list                  List available flows
  --flows <flowIds>           Comma-separated list of flow IDs to export
  -o, --output <dir>          Output directory (default: exports)
  -f, --format <format>       Export format: json, yaml (default: json)
  --include-versions          Include all flow versions
  --no-metadata               Exclude metadata from export
  --compress                  Compress exported files

Examples:
  # List all available flows
  node scripts/flow-export.js --list

  # Export all flows
  node scripts/flow-export.js

  # Export specific flows
  node scripts/flow-export.js --flows flow1,flow2 --output my-exports

  # Export with versions and compress
  node scripts/flow-export.js --include-versions --compress

  # Export to YAML format
  node scripts/flow-export.js --format yaml --output yaml-exports

The exported files include:
  - Flow definition (nodes, edges, metadata)
  - Export manifest with statistics
  - Version history (if --include-versions)
  - Sanitized metadata (sensitive data removed)
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default FlowExporter;