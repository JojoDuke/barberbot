
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { sharedStorage } from './storage';
import { bridgetAgent } from './agents/bridget-agent';

// Mastra is the main entry point for the application. It is responsible for initializing the agents and the storage.
export const mastra = new Mastra({
  agents: { bridgetAgent },
  storage: sharedStorage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: false },
  },
});
