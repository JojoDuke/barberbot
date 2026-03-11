import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './reservanto-client';

export const getReservantoServicesTool = createTool({
    id: 'get-reservanto-services',
    description: 'Get list of services offered by the Reservanto business',
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
    }),
    outputSchema: z.object({
        services: z.array(z.object({
            id: z.number(),
            name: z.string(),
            description: z.string(),
            duration: z.number().describe('Duration in minutes'),
            price: z.number(),
            currency: z.string(),
            segmentType: z.string().describe('The type of business segment (OneToOne, Classes, RentalLike, EmsLike)'),
        })),
    }),
    execute: async ({ context }) => {
        const client = await getReservantoClient(context.businessId);

        // Fetch services and segments in parallel
        const [servicesResponse, segmentsResponse] = await Promise.all([
            client.getServices(),
            client.getSegments()
        ]);

        const serviceList = servicesResponse.Items || [];
        const segments = segmentsResponse.Items || [];

        // Create a map for quick lookup
        const segmentMap = new Map(segments.map(seg => [seg.Id, seg.SegmentType]));

        return {
            services: serviceList.map((s: any) => ({
                id: s.Id || s.BookingServiceId,
                name: s.Name,
                description: s.Description || '',
                duration: s.Duration,
                price: s.Price || 0,
                currency: s.Currency || 'CZK',
                segmentType: segmentMap.get(s.SegmentId) || 'OneToOne',
            })),
        };
    },
});
