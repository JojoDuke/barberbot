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

        // Fetch services
        const servicesResponse = await client.getServices();
        let segmentsResponse: any = { Items: [] };

        // Attempt to fetch segments, some tokens (like Líčírna) lack this permission
        try {
            segmentsResponse = await client.getSegments();
        } catch (error: any) {
            console.warn(`⚠️ Could not fetch segments, defaulting to OneToOne. Error: ${error.message}`);
        }

        const serviceList = servicesResponse.Items || (servicesResponse as any).BookingServices || [];
        const segments = segmentsResponse.Items || [];

        // Create a map for quick lookup
        const segmentMap = new Map(segments.map((seg: any) => [seg.Id, seg.SegmentType]));

        const services = serviceList.map((s: any) => ({
            id: s.Id || s.BookingServiceId,
            name: s.Name,
            description: s.Description || '',
            duration: s.Duration,
            price: s.Price || 0,
            currency: s.Currency || 'CZK',
            segmentType: (segmentMap.get(s.SegmentId) as string) || 'OneToOne',
        }));

        console.log(`📡 [Reservanto] Returning ${services.length} services for business ${context.businessId}:`, services.map((s: any) => `${s.name} (ID: ${s.id})`).join(', '));

        return { services };
    },
});
