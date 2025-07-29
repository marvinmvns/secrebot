import { ApplicationFactory } from './core/applicationFactory.js';
import logger from './utils/logger.js';

logger.debug('Application starting up...'); // Added for debugging logger initialization

async function main() {
  const appFactory = new ApplicationFactory();
  
  try {
    const services = await appFactory.initializeApplication();
    await appFactory.startAPI();
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

main();
