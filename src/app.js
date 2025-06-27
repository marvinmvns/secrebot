import { ApplicationFactory } from './core/applicationFactory.js';

async function main() {
  const appFactory = new ApplicationFactory();
  
  try {
    const services = await appFactory.initializeApplication();
    await appFactory.startAPI();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
