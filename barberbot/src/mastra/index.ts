
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { sharedStorage } from './storage';
import { bridgetAgent } from './agents/bridget-agent';

export const mastra = new Mastra({
  agents: { bridgetAgent },
  storage: sharedStorage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'warn',
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: false },
  },
});
