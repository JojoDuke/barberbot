
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { bridgetAgent } from './agents/bridget-agent';

export const mastra = new Mastra({
  agents: { bridgetAgent },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  bundler: {
    externals: ["supports-color", "twilio"],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    default: { enabled: true },
  },
});
