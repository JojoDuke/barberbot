import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoServicesTool = createTool({
    id: 'get-reservanto-services',
    description: 'Get list of services offered by the Reservanto business',
    inputSchema: z.object({}),
    outputSchema: z.object({
        services: z.array(z.object({
            id: z.number(),
            name: z.string(),
            description: z.string(),
            duration: z.number().describe('Duration in minutes'),
            price: z.number(),
            currency: z.string(),
        })),
    }),
    execute: async () => {
        const client = getReservantoClient();
        const response: any = await client.getServices();

        const serviceList = response.BookingServices || response.Items || [];

        return {
            services: serviceList.map((s: any) => ({
                id: s.Id || s.BookingServiceId,
                name: s.Name,
                description: s.Description || '',
                duration: s.Duration,
                price: s.Price || 0,
                currency: s.Currency || 'CZK',
            })),
        };
    },
});
