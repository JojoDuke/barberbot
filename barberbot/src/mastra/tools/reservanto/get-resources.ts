import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoResourcesTool = createTool({
    id: 'get-reservanto-resources',
    description: 'Get list of booking resources (employees/barbers/chairs) for the Reservanto business',
    inputSchema: z.object({
        locationId: z.number().optional().describe('Filter by specific location ID'),
    }),
    outputSchema: z.object({
        resources: z.array(z.object({
            id: z.number(),
            name: z.string(),
            email: z.string(),
            phone: z.string(),
            description: z.string(),
            locationId: z.number(),
        })),
    }),
    execute: async ({ context }) => {
        const client = getReservantoClient();
        const response = await client.getBookingResources(context.locationId);

        return {
            resources: response.Items.map(r => ({
                id: r.Id,
                name: r.Name,
                email: r.Email,
                phone: r.Phone,
                description: r.Description,
                locationId: r.LocationId,
            })),
        };
    },
});
