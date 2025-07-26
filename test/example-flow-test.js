#!/usr/bin/env node

/**
 * Example Flow Test - Demonstrates how to test flows using the Flow Test Runner
 */

import FlowTestRunner from './flow-test-runner.js';
import logger from '../src/utils/logger.js';

async function exampleFlowTest() {
    logger.info('🧪 Starting Example Flow Test');
    
    const runner = new FlowTestRunner();
    
    try {
        await runner.initialize();
        
        // Example: Test a simple flow with basic assertions
        const exampleFlow = {
            id: 'example-test-flow',
            name: 'Example Test Flow',
            description: 'A simple flow for testing purposes',
            nodes: [
                {
                    id: 'start-1',
                    type: 'start',
                    data: { message: 'Flow started' }
                },
                {
                    id: 'message-1',
                    type: 'message', 
                    data: { message: 'Bem-vindo ao teste!' }
                },
                {
                    id: 'condition-1',
                    type: 'condition',
                    data: { 
                        condition: 'user_response == "sim"',
                        description: 'Verificar resposta do usuário'
                    }
                },
                {
                    id: 'llm-1',
                    type: 'llm',
                    data: {
                        prompt: 'Explique o que é inteligência artificial',
                        timeout: 10000
                    }
                },
                {
                    id: 'webhook-1',
                    type: 'webhook',
                    data: {
                        url: 'https://api.example.com/notify',
                        method: 'POST'
                    }
                }
            ],
            edges: [
                { id: 'e1', source: 'start-1', target: 'message-1' },
                { id: 'e2', source: 'message-1', target: 'condition-1' },
                { id: 'e3', source: 'condition-1', target: 'llm-1', label: 'true' },
                { id: 'e4', source: 'condition-1', target: 'webhook-1', label: 'false' },
                { id: 'e5', source: 'llm-1', target: 'webhook-1' }
            ]
        };
        
        // Run test with custom options
        const testOptions = {
            source: 'custom', // We'll provide our own flow
            mockMode: 'auto',
            updateSnapshots: true,
            verbose: true
        };
        
        // Override the getFlowsForTesting method to use our example flow
        const originalGetFlows = runner.getFlowsForTesting.bind(runner);
        runner.getFlowsForTesting = async () => [exampleFlow];
        
        logger.info('🚀 Running flow test with example flow');
        
        const report = await runner.runTests(testOptions);
        
        // Display results
        console.log('\n' + '='.repeat(60));
        console.log('EXAMPLE FLOW TEST RESULTS');
        console.log('='.repeat(60));
        console.log(runner.generateTextReport());
        
        // Restore original method
        runner.getFlowsForTesting = originalGetFlows;
        
        if (report.summary.successRate === 100) {
            logger.info('✅ Example flow test completed successfully!');
        } else {
            logger.warn('⚠️ Example flow test completed with some failures');
        }
        
    } catch (error) {
        logger.error('❌ Example flow test failed:', error);
    } finally {
        await runner.cleanup();
    }
}

// CLI Integration
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Example Flow Test

This script demonstrates how to use the Flow Test Runner to test flows
with mocks and snapshots.

Usage: node test/example-flow-test.js

Features demonstrated:
- Creating test flows programmatically
- Using mocks for LLM and webhook nodes
- Generating and comparing snapshots
- Test reporting and validation

The example creates a simple flow with:
1. Start node
2. Message node 
3. Condition node (with true/false branches)
4. LLM node (with mock response)
5. Webhook node (with mock response)

Results are displayed in a formatted report showing:
- Flow execution paths
- Node execution order
- Mock interactions
- Snapshot comparisons
- Success/failure status
        `);
        return;
    }
    
    await exampleFlowTest();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { exampleFlowTest };