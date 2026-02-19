import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoAvailabilityTool = createTool({
    id: 'get-reservanto-availability',
    description: 'Check available booking slots for a service in a given time range',
    inputSchema: z.object({
        serviceId: z.number().describe('The Reservanto service ID'),
        resourceId: z.number().optional().describe('Optional specific employee/resource ID'),
        locationId: z.number().optional().describe('Optional specific location ID'),
        startDate: z.string().describe('ISO date string for interval start'),
        endDate: z.string().describe('ISO date string for interval end'),
    }),
    outputSchema: z.object({
        availableSlots: z.array(z.string().describe('ISO date strings of available start times')),
    }),
    execute: async ({ context }) => {
        const client = getReservantoClient();
        const start = new Date(context.startDate);
        const end = new Date(context.endDate);

        let slots: number[] = [];

        if (context.resourceId) {
            const res = await client.getAvailableSlots(context.resourceId, context.serviceId, start, end);
            slots = res.Starts;
        } else if (context.locationId) {
            const res = await client.getAvailableSlotsForLocation(context.locationId, context.serviceId, start, end);
            slots = res.Starts.map(s => s.Start);
        } else {
            // If neither resource nor location is provided, we might need a default location
            // For now, let's fetch locations and use the first one if not provided
            const locations = await client.getLocations();
            if (locations.Items.length > 0) {
                const res = await client.getAvailableSlotsForLocation(locations.Items[0].Id, context.serviceId, start, end);
                slots = res.Starts.map(s => s.Start);
            }
        }

        return {
            availableSlots: Array.from(new Set(slots))
                .sort((a, b) => a - b)
                .map(s => new Date(s * 1000).toISOString()),
        };
    },
});
