import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoResourcesTool = createTool({
    id: 'get-reservanto-resources',
    description: 'Get list of booking resources (employees/barbers/chairs) for the Reservanto business',
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
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
        const client = await getReservantoClient(context.businessId);

        // Resiliency: verify locationId exists for this merchant
        const locations = await client.getLocations();
        const locationItems = locations.Items || [];

        let locationId = context.locationId;
        if (locationId) {
            const exists = locationItems.find(l => l.Id === locationId);
            if (!exists) {
                console.warn(`⚠️ Provided locationId ${locationId} not found, using default ${locationItems[0]?.Id}`);
                locationId = locationItems[0]?.Id;
            }
        }

        const response: any = await client.getBookingResources(locationId);
        const resourceList = response.Items || [];

        return {
            resources: resourceList.map((r: any) => ({
                id: r.Id || r.BookingResourceId,
                name: r.Name,
                email: r.Email || '',
                phone: r.Phone || '',
                description: r.Description || '',
                locationId: r.LocationId,
            })),
        };
    },
});
