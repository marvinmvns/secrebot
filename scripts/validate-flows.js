#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import FlowValidator from '../src/validators/flowValidator.js';
import logger from '../src/utils/logger.js';
import { CONFIG } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * CLI script for validating flows
 * Usage: node scripts/validate-flows.js [options]
 */

class FlowValidationCLI {
    constructor() {
        this.validator = new FlowValidator();
        this.mongoClient = null;
        this.db = null;
    }

    async initialize() {
        try {
            // Connect to MongoDB
            this.mongoClient = new MongoClient(CONFIG.mongo.uri);
            await this.mongoClient.connect();
            this.db = this.mongoClient.db(CONFIG.mongo.dbName);
            
            logger.info('📊 Connected to MongoDB for flow validation');
        } catch (error) {
            logger.error('❌ Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            logger.info('📊 MongoDB connection closed');
        }
    }

    /**
     * Get all flows from database
     */
    async getAllFlows() {
        try {
            const collection = this.db.collection('flows');
            const flows = await collection.find({}).toArray();
            
            logger.info(`📊 Found ${flows.length} flows in database`);
            return flows;
        } catch (error) {
            logger.error('❌ Error fetching flows from database:', error);
            throw error;
        }
    }

    /**
     * Get flows from template directory
     */
    async getTemplateFlows() {
        try {
            const templateDir = path.join(process.cwd(), 'template');
            const files = await fs.readdir(templateDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            const flows = [];
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(templateDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const flow = JSON.parse(content);
                    flows.push(flow);
                } catch (error) {
                    logger.warn(`⚠️ Error reading template ${file}:`, error.message);
                }
            }
            
            logger.info(`📊 Found ${flows.length} template flows`);
            return flows;
        } catch (error) {
            logger.error('❌ Error reading template flows:', error);
            return [];
        }
    }

    /**
     * Validate flows with options
     */
    async validateFlows(options = {}) {
        const {
            source = 'database', // 'database', 'templates', 'both'
            output = 'console',   // 'console', 'file', 'json'
            rules = [],           // Specific rules to run
            flowIds = [],         // Specific flow IDs to validate
            minScore = 0,         // Minimum score threshold
            format = 'text'       // 'text', 'json'
        } = options;

        let flows = [];

        // Get flows based on source
        if (source === 'database' || source === 'both') {
            const dbFlows = await this.getAllFlows();
            flows.push(...dbFlows);
        }

        if (source === 'templates' || source === 'both') {
            const templateFlows = await this.getTemplateFlows();
            flows.push(...templateFlows);
        }

        // Filter by specific flow IDs if provided
        if (flowIds.length > 0) {
            flows = flows.filter(flow => flowIds.includes(flow.id || flow._id));
        }

        if (flows.length === 0) {
            logger.warn('⚠️ No flows found to validate');
            return;
        }

        logger.info(`🔍 Validating ${flows.length} flows...`);

        // Validate flows
        const validationOptions = {};
        if (rules.length > 0) {
            validationOptions.rules = rules;
        }

        const results = await this.validator.validateFlows(flows, validationOptions);

        // Filter by minimum score if specified
        const filteredResults = minScore > 0 
            ? results.filter(result => result.score >= minScore)
            : results;

        // Generate report
        const report = this.validator.generateReport(filteredResults, format);

        // Output results
        await this.outputResults(report, output, format);

        // Summary statistics
        const summary = this.generateSummary(results);
        console.log('\n' + '='.repeat(50));
        console.log('VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total flows: ${summary.total}`);
        console.log(`Valid flows: ${summary.valid} (${summary.validPercent}%)`);
        console.log(`Invalid flows: ${summary.invalid} (${summary.invalidPercent}%)`);
        console.log(`Average score: ${summary.averageScore}`);
        console.log(`Total errors: ${summary.totalErrors}`);
        console.log(`Total warnings: ${summary.totalWarnings}`);
        console.log(`Total info: ${summary.totalInfo}`);

        return {
            results: filteredResults,
            summary,
            report
        };
    }

    /**
     * Output validation results
     */
    async outputResults(report, output, format) {
        switch (output) {
            case 'console':
                console.log(report);
                break;
                
            case 'file':
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const extension = format === 'json' ? 'json' : 'txt';
                const filename = `flow-validation-${timestamp}.${extension}`;
                const filePath = path.join(process.cwd(), 'reports', filename);
                
                // Ensure reports directory exists
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, report, 'utf8');
                
                logger.info(`📄 Validation report saved to: ${filePath}`);
                break;
                
            case 'json':
                console.log(report);
                break;
                
            default:
                console.log(report);
        }
    }

    /**
     * Generate summary statistics
     */
    generateSummary(results) {
        const total = results.length;
        const valid = results.filter(r => r.valid).length;
        const invalid = total - valid;
        
        const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length || 0), 0);
        const totalWarnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0);
        const totalInfo = results.reduce((sum, r) => sum + (r.info?.length || 0), 0);
        
        const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
        const averageScore = total > 0 ? Math.round(totalScore / total) : 0;
        
        return {
            total,
            valid,
            invalid,
            validPercent: total > 0 ? Math.round((valid / total) * 100) : 0,
            invalidPercent: total > 0 ? Math.round((invalid / total) * 100) : 0,
            averageScore,
            totalErrors,
            totalWarnings,
            totalInfo
        };
    }

    /**
     * List available validation rules
     */
    listRules() {
        const rules = this.validator.getRules();
        
        console.log('Available Validation Rules');
        console.log('='.repeat(50));
        
        const categories = [...new Set(rules.map(r => r.category))];
        
        for (const category of categories) {
            console.log(`\n${category.toUpperCase()}:`);
            const categoryRules = rules.filter(r => r.category === category);
            
            for (const rule of categoryRules) {
                const levelIcon = {
                    error: '❌',
                    warning: '⚠️',
                    info: 'ℹ️'
                }[rule.level] || '•';
                
                console.log(`  ${levelIcon} ${rule.name} - ${rule.description}`);
            }
        }
    }

    /**
     * Show resilience patterns for a flow
     */
    async checkResiliencePatterns(flowId) {
        await this.initialize();
        
        try {
            const collection = this.db.collection('flows');
            const flow = await collection.findOne({ _id: flowId });
            
            if (!flow) {
                logger.error(`❌ Flow ${flowId} not found`);
                return;
            }
            
            const patterns = await this.validator.checkResiliencePatterns(flow);
            
            console.log(`Resilience Patterns for Flow: ${flow.name} (${flowId})`);
            console.log('='.repeat(50));
            
            Object.entries(patterns).forEach(([pattern, present]) => {
                const icon = present ? '✅' : '❌';
                const patternName = pattern.replace(/([A-Z])/g, ' $1').toLowerCase();
                console.log(`${icon} ${patternName}`);
            });
            
        } finally {
            await this.cleanup();
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const cli = new FlowValidationCLI();

    try {
        // Parse command line arguments
        const options = parseArgs(args);

        if (options.help) {
            showHelp();
            return;
        }

        if (options.listRules) {
            cli.listRules();
            return;
        }

        if (options.checkPatterns) {
            await cli.checkResiliencePatterns(options.checkPatterns);
            return;
        }

        // Initialize and run validation
        await cli.initialize();
        
        try {
            await cli.validateFlows(options);
            
            logger.info('✅ Flow validation completed successfully');
        } finally {
            await cli.cleanup();
        }
        
    } catch (error) {
        logger.error('❌ Flow validation failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        source: 'database',
        output: 'console',
        format: 'text',
        rules: [],
        flowIds: [],
        minScore: 0
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
                
            case '--list-rules':
                options.listRules = true;
                break;
                
            case '--source':
            case '-s':
                options.source = args[++i];
                break;
                
            case '--output':
            case '-o':
                options.output = args[++i];
                break;
                
            case '--format':
            case '-f':
                options.format = args[++i];
                break;
                
            case '--rules':
            case '-r':
                options.rules = args[++i].split(',');
                break;
                
            case '--flows':
                options.flowIds = args[++i].split(',');
                break;
                
            case '--min-score':
                options.minScore = parseInt(args[++i], 10);
                break;
                
            case '--check-patterns':
                options.checkPatterns = args[++i];
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
Flow Validation CLI

Usage: node scripts/validate-flows.js [options]

Options:
  -h, --help              Show this help message
  --list-rules            List all available validation rules
  -s, --source <source>   Source of flows: database, templates, both (default: database)
  -o, --output <output>   Output method: console, file, json (default: console)
  -f, --format <format>   Output format: text, json (default: text)
  -r, --rules <rules>     Comma-separated list of specific rules to run
  --flows <flowIds>       Comma-separated list of specific flow IDs to validate
  --min-score <score>     Only show flows with score >= threshold
  --check-patterns <id>   Check resilience patterns for a specific flow

Examples:
  # Validate all flows in database
  node scripts/validate-flows.js

  # Validate template flows only
  node scripts/validate-flows.js --source templates

  # Validate specific flows with output to file
  node scripts/validate-flows.js --flows flow1,flow2 --output file

  # Run only structure and resilience rules
  node scripts/validate-flows.js --rules has_start_node,condition_two_outputs

  # Show flows with score >= 80
  node scripts/validate-flows.js --min-score 80

  # Check resilience patterns for a specific flow
  node scripts/validate-flows.js --check-patterns my-flow-id

  # List all available validation rules
  node scripts/validate-flows.js --list-rules
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default FlowValidationCLI;