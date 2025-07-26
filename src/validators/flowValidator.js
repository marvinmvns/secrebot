import logger from '../utils/logger.js';

/**
 * Flow Validator/Linter - Validates flows against resilient design patterns
 */
class FlowValidator {
    constructor() {
        this.rules = new Map();
        this.initializeDefaultRules();
    }

    /**
     * Initialize default validation rules based on resilient design patterns
     */
    initializeDefaultRules() {
        // === STRUCTURE RULES ===
        this.addRule('has_start_node', {
            level: 'error',
            category: 'structure',
            description: 'Flow must have exactly one start node',
            validate: (flow) => {
                const startNodes = (flow.nodes || []).filter(node => node.type === 'start');
                if (startNodes.length === 0) {
                    return { valid: false, message: 'Flow must have a start node' };
                }
                if (startNodes.length > 1) {
                    return { valid: false, message: 'Flow must have exactly one start node' };
                }
                return { valid: true };
            }
        });

        this.addRule('has_main_menu', {
            level: 'error',
            category: 'structure',
            description: 'Flow must have a main menu node (isMainMenu: true)',
            validate: (flow) => {
                const mainMenuNodes = (flow.nodes || []).filter(node => 
                    node.data?.isMainMenu === true || node.isMainMenu === true
                );
                if (mainMenuNodes.length === 0) {
                    return { valid: false, message: 'Flow must have a main menu node (isMainMenu: true)' };
                }
                if (mainMenuNodes.length > 1) {
                    return { valid: false, message: 'Flow must have exactly one main menu node' };
                }
                return { valid: true };
            }
        });

        this.addRule('all_nodes_connected', {
            level: 'warning',
            category: 'structure',
            description: 'All nodes should be reachable from the start node',
            validate: (flow) => {
                const nodes = flow.nodes || [];
                const edges = flow.edges || [];
                
                if (nodes.length === 0) return { valid: true };
                
                const startNodes = nodes.filter(node => node.type === 'start');
                if (startNodes.length === 0) return { valid: true }; // Will be caught by has_start_node rule
                
                const reachableNodes = this.findReachableNodes(startNodes[0].id, edges);
                const unreachableNodes = nodes.filter(node => 
                    node.type !== 'start' && !reachableNodes.has(node.id)
                );
                
                if (unreachableNodes.length > 0) {
                    return {
                        valid: false,
                        message: `Unreachable nodes found: ${unreachableNodes.map(n => n.id).join(', ')}`
                    };
                }
                return { valid: true };
            }
        });

        // === CONDITION NODE RULES ===
        this.addRule('condition_two_outputs', {
            level: 'error',
            category: 'resilience',
            description: 'Condition nodes must have exactly 2 outputs (true/false)',
            validate: (flow) => {
                const conditionNodes = (flow.nodes || []).filter(node => node.type === 'condition');
                const edges = flow.edges || [];
                const violations = [];
                
                for (const node of conditionNodes) {
                    const outputs = edges.filter(edge => edge.source === node.id);
                    if (outputs.length !== 2) {
                        violations.push(`Condition node ${node.id} has ${outputs.length} outputs, must have exactly 2`);
                    }
                    
                    // Check for true/false labels
                    const labels = outputs.map(edge => edge.label?.toLowerCase() || edge.sourceHandle?.toLowerCase()).filter(Boolean);
                    const hasTrue = labels.some(label => ['true', 'sim', 'yes', '1'].includes(label));
                    const hasFalse = labels.some(label => ['false', 'não', 'nao', 'no', '0'].includes(label));
                    
                    if (!hasTrue || !hasFalse) {
                        violations.push(`Condition node ${node.id} outputs must be labeled true/false`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === TIMEOUT RULES ===
        this.addRule('llm_timeout_limits', {
            level: 'warning',
            category: 'resilience',
            description: 'LLM nodes should have timeout ≤ 20 minutes',
            validate: (flow) => {
                const llmNodes = (flow.nodes || []).filter(node => node.type === 'llm');
                const violations = [];
                
                for (const node of llmNodes) {
                    const timeout = node.data?.timeout || node.timeout;
                    if (timeout && timeout > 1200000) { // 20 minutes in ms
                        violations.push(`LLM node ${node.id} timeout is ${timeout}ms (>${1200000}ms)`);
                    }
                    
                    // Recommend using balancer
                    const useBalancer = node.data?.useBalancer || node.useBalancer;
                    if (!useBalancer) {
                        violations.push(`LLM node ${node.id} should use balancer (useBalancer: true)`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === ERROR HANDLING RULES ===
        this.addRule('no_dead_ends', {
            level: 'error',
            category: 'resilience',
            description: 'Nodes should not create dead ends - always provide user options',
            validate: (flow) => {
                const nodes = flow.nodes || [];
                const edges = flow.edges || [];
                const deadEnds = [];
                
                for (const node of nodes) {
                    if (node.type === 'start') continue; // Start nodes don't need outputs
                    
                    const outputs = edges.filter(edge => edge.source === node.id);
                    if (outputs.length === 0) {
                        // Check if it's an intentional endpoint
                        const isEndpoint = node.data?.isEndpoint || 
                                         node.data?.message?.includes('!flow stop') ||
                                         node.data?.message?.includes('fim') ||
                                         node.data?.message?.includes('encerrar');
                        
                        if (!isEndpoint) {
                            deadEnds.push(node.id);
                        }
                    }
                }
                
                if (deadEnds.length > 0) {
                    return {
                        valid: false,
                        message: `Dead end nodes found (should guide users or use !flow stop): ${deadEnds.join(', ')}`
                    };
                }
                return { valid: true };
            }
        });

        this.addRule('flow_stop_usage', {
            level: 'info',
            category: 'resilience',
            description: 'Only !flow stop should exit flows, never automatic termination',
            validate: (flow) => {
                const nodes = flow.nodes || [];
                const violations = [];
                
                for (const node of nodes) {
                    const message = node.data?.message || node.message || '';
                    
                    // Check for automatic termination patterns
                    if (message.includes('fim') || message.includes('encerrar') || message.includes('sair')) {
                        if (!message.includes('!flow stop')) {
                            violations.push(`Node ${node.id} suggests ending without using !flow stop`);
                        }
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === MESSAGE QUALITY RULES ===
        this.addRule('message_content_quality', {
            level: 'warning',
            category: 'quality',
            description: 'Message nodes should have meaningful content',
            validate: (flow) => {
                const messageNodes = (flow.nodes || []).filter(node => node.type === 'message');
                const violations = [];
                
                for (const node of messageNodes) {
                    const message = node.data?.message || node.message || '';
                    
                    if (!message.trim()) {
                        violations.push(`Message node ${node.id} has empty content`);
                        continue;
                    }
                    
                    if (message.length < 10) {
                        violations.push(`Message node ${node.id} has very short content (${message.length} chars)`);
                    }
                    
                    if (message.length > 4000) {
                        violations.push(`Message node ${node.id} has very long content (${message.length} chars), consider breaking it up`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === WEBHOOK RULES ===
        this.addRule('webhook_error_handling', {
            level: 'warning',
            category: 'resilience',
            description: 'Webhook nodes should have error handling paths',
            validate: (flow) => {
                const webhookNodes = (flow.nodes || []).filter(node => node.type === 'webhook');
                const edges = flow.edges || [];
                const violations = [];
                
                for (const node of webhookNodes) {
                    const outputs = edges.filter(edge => edge.source === node.id);
                    const hasErrorPath = outputs.some(edge => 
                        (edge.label || '').toLowerCase().includes('error') ||
                        (edge.sourceHandle || '').toLowerCase().includes('error')
                    );
                    
                    if (!hasErrorPath && outputs.length > 1) {
                        violations.push(`Webhook node ${node.id} should have error handling path`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === VARIABLE RULES ===
        this.addRule('variable_naming', {
            level: 'info',
            category: 'quality',
            description: 'Variables should follow naming conventions',
            validate: (flow) => {
                const variableNodes = (flow.nodes || []).filter(node => node.type === 'variable');
                const violations = [];
                
                for (const node of variableNodes) {
                    const varName = node.data?.variableName || node.variableName || '';
                    
                    if (!varName) {
                        violations.push(`Variable node ${node.id} has no variable name`);
                        continue;
                    }
                    
                    // Check naming convention (camelCase or snake_case)
                    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(varName)) {
                        violations.push(`Variable ${varName} in node ${node.id} doesn't follow naming convention`);
                    }
                    
                    // Check for reserved words
                    const reserved = ['function', 'var', 'let', 'const', 'if', 'else', 'return'];
                    if (reserved.includes(varName.toLowerCase())) {
                        violations.push(`Variable ${varName} in node ${node.id} uses reserved word`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === DELAY RULES ===
        this.addRule('reasonable_delays', {
            level: 'warning',
            category: 'performance',
            description: 'Delay nodes should have reasonable timing',
            validate: (flow) => {
                const delayNodes = (flow.nodes || []).filter(node => node.type === 'delay');
                const violations = [];
                
                for (const node of delayNodes) {
                    const delay = node.data?.delay || node.delay || 0;
                    
                    if (delay > 300000) { // 5 minutes
                        violations.push(`Delay node ${node.id} has very long delay (${delay}ms)`);
                    }
                    
                    if (delay < 1000) { // 1 second
                        violations.push(`Delay node ${node.id} has very short delay (${delay}ms)`);
                    }
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });

        // === FLOW METADATA RULES ===
        this.addRule('flow_metadata_complete', {
            level: 'info',
            category: 'quality',
            description: 'Flow should have complete metadata',
            validate: (flow) => {
                const violations = [];
                
                if (!flow.name || flow.name.trim().length === 0) {
                    violations.push('Flow should have a name');
                }
                
                if (!flow.description || flow.description.trim().length === 0) {
                    violations.push('Flow should have a description');
                }
                
                if (!flow.alias || flow.alias.trim().length === 0) {
                    violations.push('Flow should have an alias for easy invocation');
                }
                
                if (violations.length > 0) {
                    return { valid: false, message: violations.join('; ') };
                }
                return { valid: true };
            }
        });
    }

    /**
     * Add a custom validation rule
     */
    addRule(name, rule) {
        this.rules.set(name, {
            name,
            level: rule.level || 'warning',
            category: rule.category || 'general',
            description: rule.description || '',
            validate: rule.validate
        });
    }

    /**
     * Remove a validation rule
     */
    removeRule(name) {
        return this.rules.delete(name);
    }

    /**
     * Validate a flow against all rules
     */
    async validateFlow(flow, options = {}) {
        const results = {
            valid: true,
            score: 100,
            errors: [],
            warnings: [],
            info: [],
            summary: {
                totalRules: this.rules.size,
                passed: 0,
                failed: 0,
                errors: 0,
                warnings: 0,
                info: 0
            }
        };

        const enabledRules = options.rules || Array.from(this.rules.keys());
        const rulesToRun = enabledRules.filter(ruleName => this.rules.has(ruleName));

        logger.debug(`🔍 Validating flow ${flow.id || flow.name} with ${rulesToRun.length} rules`);

        for (const ruleName of rulesToRun) {
            const rule = this.rules.get(ruleName);
            
            try {
                const result = await rule.validate(flow);
                
                if (result.valid) {
                    results.summary.passed++;
                } else {
                    results.summary.failed++;
                    
                    const violation = {
                        rule: ruleName,
                        category: rule.category,
                        level: rule.level,
                        description: rule.description,
                        message: result.message,
                        node: result.nodeId || null
                    };
                    
                    switch (rule.level) {
                        case 'error':
                            results.errors.push(violation);
                            results.summary.errors++;
                            results.valid = false;
                            results.score -= 20;
                            break;
                        case 'warning':
                            results.warnings.push(violation);
                            results.summary.warnings++;
                            results.score -= 10;
                            break;
                        case 'info':
                            results.info.push(violation);
                            results.summary.info++;
                            results.score -= 5;
                            break;
                    }
                }
            } catch (error) {
                logger.error(`❌ Error running validation rule ${ruleName}:`, error);
                results.errors.push({
                    rule: ruleName,
                    category: 'validation_error',
                    level: 'error',
                    description: 'Validation rule execution failed',
                    message: `Rule execution error: ${error.message}`,
                    node: null
                });
                results.summary.errors++;
                results.valid = false;
            }
        }

        // Ensure score doesn't go below 0
        results.score = Math.max(0, results.score);

        logger.info(`✅ Flow validation completed: ${results.summary.passed}/${this.rules.size} rules passed, score: ${results.score}`);

        return results;
    }

    /**
     * Validate multiple flows
     */
    async validateFlows(flows, options = {}) {
        const results = [];
        
        for (const flow of flows) {
            try {
                const result = await this.validateFlow(flow, options);
                results.push({
                    flowId: flow.id,
                    flowName: flow.name,
                    ...result
                });
            } catch (error) {
                logger.error(`❌ Error validating flow ${flow.id}:`, error);
                results.push({
                    flowId: flow.id,
                    flowName: flow.name,
                    valid: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Generate validation report
     */
    generateReport(validationResults, format = 'text') {
        if (format === 'json') {
            return JSON.stringify(validationResults, null, 2);
        }
        
        let report = '';
        
        if (Array.isArray(validationResults)) {
            // Multiple flows
            report += `Flow Validation Report\n`;
            report += `=====================\n\n`;
            
            for (const result of validationResults) {
                report += `Flow: ${result.flowName} (${result.flowId})\n`;
                report += `Score: ${result.score}/100 | Valid: ${result.valid ? '✅' : '❌'}\n`;
                
                if (result.errors?.length > 0) {
                    report += `\nErrors (${result.errors.length}):\n`;
                    result.errors.forEach(error => {
                        report += `  ❌ [${error.rule}] ${error.message}\n`;
                    });
                }
                
                if (result.warnings?.length > 0) {
                    report += `\nWarnings (${result.warnings.length}):\n`;
                    result.warnings.forEach(warning => {
                        report += `  ⚠️  [${warning.rule}] ${warning.message}\n`;
                    });
                }
                
                if (result.info?.length > 0) {
                    report += `\nInfo (${result.info.length}):\n`;
                    result.info.forEach(info => {
                        report += `  ℹ️  [${info.rule}] ${info.message}\n`;
                    });
                }
                
                report += '\n' + '-'.repeat(50) + '\n\n';
            }
        } else {
            // Single flow
            report += `Flow Validation Report: ${validationResults.flowName || 'Unknown'}\n`;
            report += `${'='.repeat(50)}\n\n`;
            report += `Score: ${validationResults.score}/100\n`;
            report += `Valid: ${validationResults.valid ? '✅' : '❌'}\n`;
            report += `Rules: ${validationResults.summary.passed}/${validationResults.summary.totalRules} passed\n\n`;
            
            if (validationResults.errors?.length > 0) {
                report += `❌ Errors (${validationResults.errors.length}):\n`;
                validationResults.errors.forEach(error => {
                    report += `  • [${error.rule}] ${error.message}\n`;
                });
                report += '\n';
            }
            
            if (validationResults.warnings?.length > 0) {
                report += `⚠️  Warnings (${validationResults.warnings.length}):\n`;
                validationResults.warnings.forEach(warning => {
                    report += `  • [${warning.rule}] ${warning.message}\n`;
                });
                report += '\n';
            }
            
            if (validationResults.info?.length > 0) {
                report += `ℹ️  Info (${validationResults.info.length}):\n`;
                validationResults.info.forEach(info => {
                    report += `  • [${info.rule}] ${info.message}\n`;
                });
                report += '\n';
            }
        }
        
        return report;
    }

    /**
     * Get available validation rules
     */
    getRules() {
        return Array.from(this.rules.entries()).map(([name, rule]) => ({
            name,
            level: rule.level,
            category: rule.category,
            description: rule.description
        }));
    }

    /**
     * Helper method to find reachable nodes
     */
    findReachableNodes(startNodeId, edges) {
        const reachable = new Set();
        const queue = [startNodeId];
        
        while (queue.length > 0) {
            const currentId = queue.shift();
            
            if (reachable.has(currentId)) continue;
            reachable.add(currentId);
            
            // Find all nodes this node connects to
            const outgoingEdges = edges.filter(edge => edge.source === currentId);
            for (const edge of outgoingEdges) {
                if (!reachable.has(edge.target)) {
                    queue.push(edge.target);
                }
            }
        }
        
        return reachable;
    }

    /**
     * Check if flow follows resilient design patterns
     */
    async checkResiliencePatterns(flow) {
        const patterns = {
            hasMainMenu: false,
            hasErrorHandling: false,
            usesFlowStop: false,
            hasTimeouts: false,
            hasFallbacks: false
        };

        const nodes = flow.nodes || [];
        
        // Check for main menu
        patterns.hasMainMenu = nodes.some(node => 
            node.data?.isMainMenu === true || node.isMainMenu === true
        );
        
        // Check for error handling patterns
        patterns.hasErrorHandling = nodes.some(node => {
            const message = node.data?.message || node.message || '';
            return message.includes('erro') || message.includes('error') || 
                   message.includes('tente novamente') || message.includes('try again');
        });
        
        // Check for proper flow termination
        patterns.usesFlowStop = nodes.some(node => {
            const message = node.data?.message || node.message || '';
            return message.includes('!flow stop');
        });
        
        // Check for timeouts in LLM nodes
        patterns.hasTimeouts = nodes.some(node => 
            node.type === 'llm' && (node.data?.timeout || node.timeout)
        );
        
        // Check for fallback patterns
        patterns.hasFallbacks = nodes.some(node => {
            const message = node.data?.message || node.message || '';
            return message.includes('alternativa') || message.includes('alternative') ||
                   message.includes('plano b') || message.includes('fallback');
        });
        
        return patterns;
    }
}

export default FlowValidator;