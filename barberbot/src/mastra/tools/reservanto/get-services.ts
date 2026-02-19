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
        const response = await client.getServices();

        return {
            services: response.Items.map(s => ({
                id: s.Id,
                name: s.Name,
                description: s.Description,
                duration: s.Duration,
                price: s.Price,
                currency: s.Currency,
            })),
        };
    },
});
