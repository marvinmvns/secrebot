#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import FlowExecutionService from '../src/services/flowExecutionService.js';
import FlowDataService from '../src/services/flowDataService.js';
import logger from '../src/utils/logger.js';
import { CONFIG } from '../src/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Flow Test Runner - Execute flows with mocks and snapshots
 * Usage: node test/flow-test-runner.js [options]
 */

class FlowTestRunner {
    constructor() {
        this.mongoClient = null;
        this.db = null;
        this.flowExecutionService = null;
        this.flowDataService = null;
        this.mocks = new Map();
        this.snapshots = new Map();
        this.testResults = [];
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
            
            this.flowExecutionService = new FlowExecutionService(this.db);
            await this.flowExecutionService.init();
            
            // Load test configuration
            await this.loadTestConfiguration();
            
            logger.info('🧪 Flow Test Runner initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize Flow Test Runner:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.mongoClient) {
            await this.mongoClient.close();
            logger.info('🧪 MongoDB connection closed');
        }
    }

    /**
     * Load test configuration and mocks
     */
    async loadTestConfiguration() {
        try {
            // Load mock configurations
            await this.loadMocks();
            
            // Load existing snapshots
            await this.loadSnapshots();
            
            logger.info(`🧪 Test configuration loaded - ${this.mocks.size} mocks, ${this.snapshots.size} snapshots`);
        } catch (error) {
            logger.warn('⚠️ Error loading test configuration:', error);
        }
    }

    /**
     * Load mock configurations from test/mocks directory
     */
    async loadMocks() {
        try {
            const mocksDir = path.join(process.cwd(), 'test', 'mocks');
            
            try {
                const files = await fs.readdir(mocksDir);
                const jsonFiles = files.filter(file => file.endsWith('.json'));
                
                for (const file of jsonFiles) {
                    const filePath = path.join(mocksDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const mockConfig = JSON.parse(content);
                    
                    const mockName = path.basename(file, '.json');
                    this.mocks.set(mockName, mockConfig);
                    
                    logger.debug(`🎭 Loaded mock: ${mockName}`);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    logger.info('📁 Creating test/mocks directory');
                    await fs.mkdir(mocksDir, { recursive: true });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            logger.warn('⚠️ Error loading mocks:', error);
        }
    }

    /**
     * Load snapshots from test/snapshots directory
     */
    async loadSnapshots() {
        try {
            const snapshotsDir = path.join(process.cwd(), 'test', 'snapshots');
            
            try {
                const files = await fs.readdir(snapshotsDir);
                const jsonFiles = files.filter(file => file.endsWith('.json'));
                
                for (const file of jsonFiles) {
                    const filePath = path.join(snapshotsDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const snapshot = JSON.parse(content);
                    
                    const snapshotName = path.basename(file, '.json');
                    this.snapshots.set(snapshotName, snapshot);
                    
                    logger.debug(`📸 Loaded snapshot: ${snapshotName}`);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    logger.info('📁 Creating test/snapshots directory');
                    await fs.mkdir(snapshotsDir, { recursive: true });
                } else {
                    throw error;
                }
            }
        } catch (error) {
            logger.warn('⚠️ Error loading snapshots:', error);
        }
    }

    /**
     * Run tests for specific flows
     */
    async runTests(options = {}) {
        const {
            flowIds = [],
            source = 'database', // 'database', 'templates', 'both'
            mockMode = 'auto',   // 'auto', 'strict', 'none'
            updateSnapshots = false,
            verbose = false
        } = options;

        let flows = [];

        // Get flows to test
        if (source === 'database' || source === 'both') {
            const dbFlows = await this.getFlowsForTesting(flowIds);
            flows.push(...dbFlows);
        }

        if (source === 'templates' || source === 'both') {
            const templateFlows = await this.getTemplateFlows();
            flows.push(...templateFlows);
        }

        if (flows.length === 0) {
            logger.warn('⚠️ No flows found to test');
            return { success: false, message: 'No flows to test' };
        }

        logger.info(`🧪 Starting tests for ${flows.length} flows`);

        // Run tests for each flow
        for (const flow of flows) {
            await this.runFlowTest(flow, { mockMode, updateSnapshots, verbose });
        }

        // Generate test report
        const report = this.generateTestReport();
        
        return report;
    }

    /**
     * Get flows from database for testing
     */
    async getFlowsForTesting(flowIds = []) {
        try {
            if (flowIds.length > 0) {
                const flows = [];
                for (const flowId of flowIds) {
                    const flow = await this.flowDataService.loadFlow(flowId);
                    if (flow) {
                        flows.push(flow);
                    }
                }
                return flows;
            } else {
                const result = await this.flowDataService.listFlows({ limit: 100 });
                return result.flows || [];
            }
        } catch (error) {
            logger.error('❌ Error getting flows for testing:', error);
            return [];
        }
    }

    /**
     * Get template flows
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
            
            return flows;
        } catch (error) {
            logger.error('❌ Error reading template flows:', error);
            return [];
        }
    }

    /**
     * Run test for a single flow
     */
    async runFlowTest(flow, options = {}) {
        const { mockMode, updateSnapshots, verbose } = options;
        
        logger.info(`🧪 Testing flow: ${flow.name} (${flow.id})`);
        
        const testStartTime = Date.now();
        const testResult = {
            flowId: flow.id,
            flowName: flow.name,
            startTime: testStartTime,
            endTime: null,
            duration: 0,
            success: false,
            testCases: [],
            errors: [],
            snapshots: {
                created: 0,
                updated: 0,
                matched: 0,
                failed: 0
            }
        };

        try {
            // Generate test cases for the flow
            const testCases = this.generateTestCases(flow);
            
            for (const testCase of testCases) {
                const caseResult = await this.runTestCase(flow, testCase, { mockMode, updateSnapshots, verbose });
                testResult.testCases.push(caseResult);
                
                // Update snapshot counters
                if (caseResult.snapshot) {
                    if (caseResult.snapshot.created) testResult.snapshots.created++;
                    if (caseResult.snapshot.updated) testResult.snapshots.updated++;
                    if (caseResult.snapshot.matched) testResult.snapshots.matched++;
                    if (caseResult.snapshot.failed) testResult.snapshots.failed++;
                }
            }
            
            // Determine overall success
            testResult.success = testResult.testCases.every(tc => tc.success);
            
        } catch (error) {
            logger.error(`❌ Error testing flow ${flow.id}:`, error);
            testResult.errors.push({
                type: 'flow_test_error',
                message: error.message,
                stack: error.stack
            });
        } finally {
            testResult.endTime = Date.now();
            testResult.duration = testResult.endTime - testResult.startTime;
            this.testResults.push(testResult);
        }

        const status = testResult.success ? '✅' : '❌';
        logger.info(`${status} Flow test completed: ${flow.name} (${testResult.duration}ms)`);
    }

    /**
     * Generate test cases for a flow
     */
    generateTestCases(flow) {
        const testCases = [];
        const nodes = flow.nodes || [];
        
        // Basic flow execution test
        testCases.push({
            name: 'basic_execution',
            description: 'Test basic flow execution from start to completion',
            input: {
                startNodeId: nodes.find(n => n.type === 'start')?.id,
                initialData: {},
                userId: 'test_user_001'
            },
            expectedNodes: this.getExpectedExecutionPath(flow),
            timeout: 30000
        });

        // Test different input scenarios
        const conditionNodes = nodes.filter(n => n.type === 'condition');
        for (const conditionNode of conditionNodes) {
            // Generate test cases for true/false paths
            testCases.push({
                name: `condition_true_${conditionNode.id}`,
                description: `Test condition node ${conditionNode.id} true path`,
                input: {
                    startNodeId: nodes.find(n => n.type === 'start')?.id,
                    initialData: { [conditionNode.id + '_result']: true },
                    userId: 'test_user_002'
                },
                expectedNodes: this.getExpectedPath(flow, conditionNode.id, true),
                timeout: 30000
            });

            testCases.push({
                name: `condition_false_${conditionNode.id}`,
                description: `Test condition node ${conditionNode.id} false path`,
                input: {
                    startNodeId: nodes.find(n => n.type === 'start')?.id,
                    initialData: { [conditionNode.id + '_result']: false },
                    userId: 'test_user_003'
                },
                expectedNodes: this.getExpectedPath(flow, conditionNode.id, false),
                timeout: 30000
            });
        }

        // Test error handling scenarios
        const llmNodes = nodes.filter(n => n.type === 'llm');
        for (const llmNode of llmNodes) {
            testCases.push({
                name: `llm_error_${llmNode.id}`,
                description: `Test LLM node ${llmNode.id} error handling`,
                input: {
                    startNodeId: nodes.find(n => n.type === 'start')?.id,
                    initialData: { [llmNode.id + '_error']: true },
                    userId: 'test_user_004'
                },
                expectedError: true,
                timeout: 30000
            });
        }

        return testCases;
    }

    /**
     * Run a single test case
     */
    async runTestCase(flow, testCase, options = {}) {
        const { mockMode, updateSnapshots, verbose } = options;
        
        if (verbose) {
            logger.info(`  🔧 Running test case: ${testCase.name}`);
        }

        const caseStartTime = Date.now();
        const result = {
            name: testCase.name,
            description: testCase.description,
            success: false,
            duration: 0,
            executedNodes: [],
            finalState: null,
            errors: [],
            snapshot: null
        };

        try {
            // Setup mocks if needed
            const mockContext = this.setupMocks(flow, testCase, mockMode);
            
            // Execute the flow with test input
            const executionResult = await this.executeFlowWithMocks(flow, testCase, mockContext);
            
            result.executedNodes = executionResult.executedNodes || [];
            result.finalState = executionResult.finalState || {};
            
            // Check expectations
            const expectationResult = this.checkExpectations(testCase, executionResult);
            result.success = expectationResult.success;
            result.errors = expectationResult.errors;
            
            // Handle snapshots
            if (updateSnapshots || !this.hasSnapshot(flow.id, testCase.name)) {
                result.snapshot = await this.createOrUpdateSnapshot(flow, testCase, executionResult);
            } else {
                result.snapshot = await this.compareWithSnapshot(flow, testCase, executionResult);
            }
            
        } catch (error) {
            logger.error(`❌ Error in test case ${testCase.name}:`, error);
            result.errors.push({
                type: 'test_case_error',
                message: error.message,
                stack: error.stack
            });
        } finally {
            result.duration = Date.now() - caseStartTime;
        }

        return result;
    }

    /**
     * Setup mocks for flow execution
     */
    setupMocks(flow, testCase, mockMode) {
        const mockContext = {
            llmResponses: new Map(),
            webhookResponses: new Map(),
            apiResponses: new Map(),
            delays: new Map()
        };

        if (mockMode === 'none') {
            return mockContext;
        }

        const nodes = flow.nodes || [];
        
        // Setup LLM mocks
        const llmNodes = nodes.filter(n => n.type === 'llm');
        for (const node of llmNodes) {
            const mockKey = `${flow.id}_${node.id}`;
            const mockConfig = this.mocks.get(mockKey) || this.mocks.get('default_llm');
            
            if (mockConfig) {
                mockContext.llmResponses.set(node.id, mockConfig.response || 'Mock LLM response');
            } else if (mockMode === 'auto') {
                // Generate automatic mock response
                mockContext.llmResponses.set(node.id, `Mock response for LLM node ${node.id}`);
            }
        }

        // Setup webhook mocks
        const webhookNodes = nodes.filter(n => n.type === 'webhook');
        for (const node of webhookNodes) {
            const mockKey = `${flow.id}_${node.id}`;
            const mockConfig = this.mocks.get(mockKey) || this.mocks.get('default_webhook');
            
            if (mockConfig) {
                mockContext.webhookResponses.set(node.id, mockConfig.response || { success: true });
            } else if (mockMode === 'auto') {
                mockContext.webhookResponses.set(node.id, { success: true, data: 'mock data' });
            }
        }

        // Setup delay mocks (speed up delays for testing)
        const delayNodes = nodes.filter(n => n.type === 'delay');
        for (const node of delayNodes) {
            mockContext.delays.set(node.id, 100); // 100ms instead of actual delay
        }

        return mockContext;
    }

    /**
     * Execute flow with mocks applied
     */
    async executeFlowWithMocks(flow, testCase, mockContext) {
        // Create a mock execution context
        const executionContext = {
            flowId: flow.id,
            userId: testCase.input.userId,
            sessionId: `test_session_${Date.now()}`,
            startTime: new Date(),
            variables: new Map(),
            executedNodes: [],
            currentNode: null,
            mockContext: mockContext
        };

        // Initialize with test data
        for (const [key, value] of Object.entries(testCase.input.initialData || {})) {
            executionContext.variables.set(key, value);
        }

        const result = {
            success: false,
            executedNodes: [],
            finalState: {},
            variables: {},
            errors: []
        };

        try {
            // Start execution from the specified node
            let currentNodeId = testCase.input.startNodeId;
            const nodes = flow.nodes || [];
            const edges = flow.edges || [];
            const maxExecutions = 50; // Prevent infinite loops
            let executionCount = 0;

            while (currentNodeId && executionCount < maxExecutions) {
                const node = nodes.find(n => n.id === currentNodeId);
                if (!node) break;

                executionContext.currentNode = node;
                executionContext.executedNodes.push(node.id);

                // Execute node with mocks
                const nodeResult = await this.executeNodeWithMocks(node, executionContext);
                
                if (nodeResult.error) {
                    result.errors.push(nodeResult.error);
                    break;
                }

                // Find next node
                currentNodeId = this.getNextNodeId(node, edges, executionContext, nodeResult);
                executionCount++;
            }

            result.success = result.errors.length === 0;
            result.executedNodes = executionContext.executedNodes;
            result.finalState = Object.fromEntries(executionContext.variables);

        } catch (error) {
            result.errors.push({
                type: 'execution_error',
                message: error.message,
                stack: error.stack
            });
        }

        return result;
    }

    /**
     * Execute a single node with mocks
     */
    async executeNodeWithMocks(node, context) {
        const result = { success: false, output: null, error: null };

        try {
            switch (node.type) {
                case 'start':
                    result.success = true;
                    break;

                case 'message':
                    // Mock message sending
                    result.success = true;
                    result.output = node.data?.message || node.message || '';
                    break;

                case 'llm':
                    const llmResponse = context.mockContext.llmResponses.get(node.id);
                    if (llmResponse) {
                        result.success = true;
                        result.output = llmResponse;
                        context.variables.set(`${node.id}_output`, llmResponse);
                    } else {
                        result.error = { type: 'llm_mock_missing', message: `No mock for LLM node ${node.id}` };
                    }
                    break;

                case 'condition':
                    // Mock condition evaluation
                    const conditionKey = `${node.id}_result`;
                    const conditionResult = context.variables.get(conditionKey);
                    result.success = true;
                    result.output = conditionResult !== undefined ? conditionResult : Math.random() > 0.5;
                    break;

                case 'webhook':
                    const webhookResponse = context.mockContext.webhookResponses.get(node.id);
                    if (webhookResponse) {
                        result.success = true;
                        result.output = webhookResponse;
                        context.variables.set(`${node.id}_output`, webhookResponse);
                    } else {
                        result.error = { type: 'webhook_mock_missing', message: `No mock for webhook node ${node.id}` };
                    }
                    break;

                case 'delay':
                    const delayTime = context.mockContext.delays.get(node.id) || 100;
                    await new Promise(resolve => setTimeout(resolve, delayTime));
                    result.success = true;
                    break;

                case 'variable':
                    const varName = node.data?.variableName || node.variableName;
                    const varValue = node.data?.value || node.value || '';
                    if (varName) {
                        context.variables.set(varName, varValue);
                        result.success = true;
                        result.output = varValue;
                    }
                    break;

                default:
                    result.success = true; // Unknown node types pass by default
            }
        } catch (error) {
            result.error = {
                type: 'node_execution_error',
                message: `Error executing node ${node.id}: ${error.message}`,
                stack: error.stack
            };
        }

        return result;
    }

    /**
     * Get next node ID based on execution result
     */
    getNextNodeId(currentNode, edges, context, nodeResult) {
        const outgoingEdges = edges.filter(edge => edge.source === currentNode.id);
        
        if (outgoingEdges.length === 0) {
            return null; // End of flow
        }

        if (outgoingEdges.length === 1) {
            return outgoingEdges[0].target;
        }

        // Handle condition nodes with multiple outputs
        if (currentNode.type === 'condition') {
            const conditionResult = nodeResult.output;
            
            // Find edge for true/false path
            for (const edge of outgoingEdges) {
                const label = (edge.label || edge.sourceHandle || '').toLowerCase();
                
                if (conditionResult && ['true', 'sim', 'yes', '1'].includes(label)) {
                    return edge.target;
                }
                if (!conditionResult && ['false', 'não', 'nao', 'no', '0'].includes(label)) {
                    return edge.target;
                }
            }
        }

        // Default to first edge
        return outgoingEdges[0].target;
    }

    /**
     * Check test expectations
     */
    checkExpectations(testCase, executionResult) {
        const result = { success: true, errors: [] };

        // Check if expecting an error
        if (testCase.expectedError) {
            if (executionResult.errors.length === 0) {
                result.success = false;
                result.errors.push({
                    type: 'expectation_failed',
                    message: 'Expected an error but execution succeeded'
                });
            }
            return result;
        }

        // Check executed nodes
        if (testCase.expectedNodes && testCase.expectedNodes.length > 0) {
            const missing = testCase.expectedNodes.filter(nodeId => 
                !executionResult.executedNodes.includes(nodeId)
            );
            
            if (missing.length > 0) {
                result.success = false;
                result.errors.push({
                    type: 'missing_nodes',
                    message: `Expected nodes not executed: ${missing.join(', ')}`
                });
            }
        }

        // Check for execution errors
        if (executionResult.errors.length > 0) {
            result.success = false;
            result.errors.push(...executionResult.errors);
        }

        return result;
    }

    /**
     * Check if snapshot exists
     */
    hasSnapshot(flowId, testCaseName) {
        const snapshotKey = `${flowId}_${testCaseName}`;
        return this.snapshots.has(snapshotKey);
    }

    /**
     * Create or update snapshot
     */
    async createOrUpdateSnapshot(flow, testCase, executionResult) {
        const snapshotKey = `${flowId}_${testCase.name}`;
        const flowId = flow.id;
        
        const snapshot = {
            flowId: flowId,
            flowName: flow.name,
            testCase: testCase.name,
            timestamp: new Date().toISOString(),
            executedNodes: executionResult.executedNodes,
            finalState: executionResult.finalState,
            success: executionResult.success,
            nodeCount: executionResult.executedNodes.length,
            checksum: this.calculateChecksum(executionResult)
        };

        const isUpdate = this.snapshots.has(snapshotKey);
        this.snapshots.set(snapshotKey, snapshot);

        // Save to file
        const snapshotsDir = path.join(process.cwd(), 'test', 'snapshots');
        const filePath = path.join(snapshotsDir, `${snapshotKey}.json`);
        
        await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');

        return {
            created: !isUpdate,
            updated: isUpdate,
            matched: false,
            failed: false
        };
    }

    /**
     * Compare execution result with snapshot
     */
    async compareWithSnapshot(flow, testCase, executionResult) {
        const snapshotKey = `${flow.id}_${testCase.name}`;
        const snapshot = this.snapshots.get(snapshotKey);

        if (!snapshot) {
            return { created: false, updated: false, matched: false, failed: true };
        }

        const currentChecksum = this.calculateChecksum(executionResult);
        const matches = snapshot.checksum === currentChecksum;

        return {
            created: false,
            updated: false,
            matched: matches,
            failed: !matches
        };
    }

    /**
     * Calculate checksum for execution result
     */
    calculateChecksum(executionResult) {
        const data = {
            executedNodes: executionResult.executedNodes,
            finalState: executionResult.finalState,
            success: executionResult.success
        };
        
        return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
    }

    /**
     * Get expected execution path for basic test
     */
    getExpectedExecutionPath(flow) {
        const nodes = flow.nodes || [];
        const startNode = nodes.find(n => n.type === 'start');
        
        if (!startNode) return [];
        
        // Simple path following - just return start node for now
        // In a real implementation, this would trace the most likely path
        return [startNode.id];
    }

    /**
     * Get expected path for condition node
     */
    getExpectedPath(flow, conditionNodeId, conditionValue) {
        // Simplified - in real implementation would trace path based on condition
        return [conditionNodeId];
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - successfulTests;
        
        const totalTestCases = this.testResults.reduce((sum, r) => sum + r.testCases.length, 0);
        const successfulTestCases = this.testResults.reduce((sum, r) => 
            sum + r.testCases.filter(tc => tc.success).length, 0);
        
        const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
        
        const report = {
            summary: {
                totalFlows: totalTests,
                successfulFlows: successfulTests,
                failedFlows: failedTests,
                successRate: totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0,
                totalTestCases: totalTestCases,
                successfulTestCases: successfulTestCases,
                failedTestCases: totalTestCases - successfulTestCases,
                testCaseSuccessRate: totalTestCases > 0 ? Math.round((successfulTestCases / totalTestCases) * 100) : 0,
                totalDuration: totalDuration,
                averageDuration: totalTests > 0 ? Math.round(totalDuration / totalTests) : 0
            },
            results: this.testResults,
            snapshots: {
                total: this.snapshots.size,
                created: this.testResults.reduce((sum, r) => sum + r.snapshots.created, 0),
                updated: this.testResults.reduce((sum, r) => sum + r.snapshots.updated, 0),
                matched: this.testResults.reduce((sum, r) => sum + r.snapshots.matched, 0),
                failed: this.testResults.reduce((sum, r) => sum + r.snapshots.failed, 0)
            }
        };

        return report;
    }

    /**
     * Generate text report
     */
    generateTextReport() {
        const report = this.generateTestReport();
        
        let text = '\n';
        text += '='.repeat(60) + '\n';
        text += 'FLOW TEST RUNNER REPORT\n';
        text += '='.repeat(60) + '\n';
        text += `Date: ${new Date().toISOString()}\n`;
        text += `Total Duration: ${report.summary.totalDuration}ms\n\n`;
        
        text += 'SUMMARY:\n';
        text += `• Flows Tested: ${report.summary.totalFlows}\n`;
        text += `• Successful Flows: ${report.summary.successfulFlows} (${report.summary.successRate}%)\n`;
        text += `• Failed Flows: ${report.summary.failedFlows}\n`;
        text += `• Test Cases: ${report.summary.totalTestCases}\n`;
        text += `• Successful Test Cases: ${report.summary.successfulTestCases} (${report.summary.testCaseSuccessRate}%)\n`;
        text += `• Average Duration per Flow: ${report.summary.averageDuration}ms\n\n`;
        
        text += 'SNAPSHOTS:\n';
        text += `• Total Snapshots: ${report.snapshots.total}\n`;
        text += `• Created: ${report.snapshots.created}\n`;
        text += `• Updated: ${report.snapshots.updated}\n`;
        text += `• Matched: ${report.snapshots.matched}\n`;
        text += `• Failed: ${report.snapshots.failed}\n\n`;
        
        text += 'FLOW RESULTS:\n';
        text += '-'.repeat(40) + '\n';
        
        for (const result of report.results) {
            const status = result.success ? '✅' : '❌';
            text += `${status} ${result.flowName} (${result.flowId})\n`;
            text += `   Duration: ${result.duration}ms\n`;
            text += `   Test Cases: ${result.testCases.length} (${result.testCases.filter(tc => tc.success).length} passed)\n`;
            
            if (result.errors.length > 0) {
                text += `   Errors: ${result.errors.length}\n`;
                for (const error of result.errors.slice(0, 3)) { // Show first 3 errors
                    text += `     • ${error.message}\n`;
                }
            }
            text += '\n';
        }
        
        return text;
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const runner = new FlowTestRunner();

    try {
        const options = parseArgs(args);

        if (options.help) {
            showHelp();
            return;
        }

        await runner.initialize();
        
        try {
            const report = await runner.runTests(options);
            
            // Output results
            if (options.format === 'json') {
                console.log(JSON.stringify(report, null, 2));
            } else {
                console.log(runner.generateTextReport());
            }
            
            // Exit with appropriate code
            const success = report.summary?.successRate === 100;
            process.exit(success ? 0 : 1);
            
        } finally {
            await runner.cleanup();
        }
        
    } catch (error) {
        logger.error('❌ Flow test runner failed:', error);
        process.exit(1);
    }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {
        flowIds: [],
        source: 'database',
        mockMode: 'auto',
        updateSnapshots: false,
        verbose: false,
        format: 'text'
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--help':
            case '-h':
                options.help = true;
                break;
                
            case '--flows':
                options.flowIds = args[++i].split(',');
                break;
                
            case '--source':
            case '-s':
                options.source = args[++i];
                break;
                
            case '--mock-mode':
            case '-m':
                options.mockMode = args[++i];
                break;
                
            case '--update-snapshots':
            case '-u':
                options.updateSnapshots = true;
                break;
                
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
                
            case '--format':
            case '-f':
                options.format = args[++i];
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
Flow Test Runner

Usage: node test/flow-test-runner.js [options]

Options:
  -h, --help                  Show this help message
  --flows <flowIds>           Comma-separated list of flow IDs to test
  -s, --source <source>       Source of flows: database, templates, both (default: database)
  -m, --mock-mode <mode>      Mock mode: auto, strict, none (default: auto)
  -u, --update-snapshots      Update snapshots instead of comparing
  -v, --verbose               Verbose output
  -f, --format <format>       Output format: text, json (default: text)

Examples:
  # Test all flows from database
  node test/flow-test-runner.js

  # Test specific flows
  node test/flow-test-runner.js --flows flow1,flow2

  # Test template flows with verbose output
  node test/flow-test-runner.js --source templates --verbose

  # Update snapshots for all flows
  node test/flow-test-runner.js --update-snapshots

  # Test with strict mocking (no auto-generated mocks)
  node test/flow-test-runner.js --mock-mode strict

  # Output results as JSON
  node test/flow-test-runner.js --format json
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default FlowTestRunner;