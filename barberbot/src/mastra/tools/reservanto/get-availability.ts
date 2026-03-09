import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoAvailabilityTool = createTool({
    id: 'get-reservanto-availability',
    description: 'Check available booking slots for a service in a given time range',
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
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
        const client = await getReservantoClient(context.businessId);
        const start = new Date(context.startDate);
        const end = new Date(context.endDate);

        let availableSlots: string[] = [];

        try {
            // Recommendation: Always use GetAvailableStartsForLocation as it supports both 
            // standard services and specific "PlaceRentalLike" (e.g. Squash courts)
            const locations = await client.getLocations();
            const locationItems = locations.Items || [];

            // If the agent passed a locationId, but it does NOT exist in the merchant's location list,
            // we should ignore it and use the default location.
            let locationId = locationItems[0]?.Id;
            if (context.locationId) {
                const exists = locationItems.find(l => l.Id === context.locationId);
                if (exists) {
                    locationId = context.locationId;
                } else {
                    console.warn(`⚠️ Provided locationId ${context.locationId} not found for this merchant. Using default ${locationId}.`);
                }
            }

            if (locationId) {
                const res = await client.getAvailableSlotsForLocation(locationId, context.serviceId, start, end);

                // Location response handles multi-resource availability
                if (res.Starts) {
                    if (Array.isArray(res.Starts)) {
                        // Standard list of slots
                        availableSlots = res.Starts.map(s => new Date((s.Start || s) * 1000).toISOString());
                    } else if (typeof res.Starts === 'object') {
                        // Map of resourceId -> timestamps (e.g. for Squash courts)
                        const allTimestamps = Object.values(res.Starts).flat() as number[];
                        availableSlots = Array.from(new Set(allTimestamps))
                            .sort((a, b) => a - b)
                            .map(s => new Date(s * 1000).toISOString());
                    }
                }
            } else {
                console.warn('⚠️ No locations found for this merchant.');
            }
        } catch (error) {
            console.error('Error fetching Reservanto availability for location:', error);

            // Fallback to specific resource if location fails or was explicitly requested
            if (context.resourceId) {
                const res = await client.getAvailableSlots(context.resourceId, context.serviceId, start, end);
                if (res.Starts) {
                    availableSlots = res.Starts.map(s => new Date(s * 1000).toISOString());
                }
            }
        }

        return {
            availableSlots: Array.from(new Set(availableSlots)).sort(),
        };
    },
});
