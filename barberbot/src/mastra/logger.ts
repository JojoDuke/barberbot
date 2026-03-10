import { PinoLogger } from '@mastra/loggers';

export const logger = new PinoLogger({
    name: 'BarberBot',
    level: 'info',
});

// Helper to log API requests/responses in a structured way
export const logApi = (platform: 'Reservio' | 'Reservanto', method: string, endpoint: string, data?: any, isError = false) => {
    const emoji = isError ? '❌' : '📡';
    logger.info(`${emoji} [${platform}] ${method} ${endpoint}`, data ? { data } : {});
};
