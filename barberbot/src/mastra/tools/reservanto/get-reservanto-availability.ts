import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './reservanto-client';

export const getReservantoAvailabilityTool = createTool({
    id: 'get-reservanto-availability',
    description: `Check available booking slots for a Reservanto service in a given time range.

CRITICAL RULES:
1. NEVER pass a locationId unless you explicitly received it from a prior getReservantoResources or getReservantoBusinessInfo tool call. Do NOT guess or invent a locationId. If unsure, omit it entirely.`,
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
        serviceId: z.number().describe('The Reservanto service ID'),
        segmentType: z.string().optional().describe('The type of segment (OneToOne, Classes, etc.)'),
        resourceId: z.number().nullish().describe('Optional specific employee/resource ID. Omit if unknown.'),
        locationId: z.number().nullish().describe('Optional location ID. ONLY provide this if you received it from a prior tool call. Do NOT invent or guess this value.'),
        startDate: z.string().describe('ISO date string for interval start'),
        endDate: z.string().describe('ISO date string for interval end'),
    }),
    outputSchema: z.object({
        availableSlots: z.array(z.object({
            startTime: z.string().describe('ISO date string of available start time'),
            resourceId: z.number().describe('The specific technical ID of the resource (court/employee) for this slot'),
            appointmentId: z.number().optional().describe('The ID of the fixed appointment/class, required for booking in "Classes" segmentType'),
        })),
    }),
    execute: async ({ context }) => {
        const client = await getReservantoClient(context.businessId);
        const start = new Date(context.startDate);
        const end = new Date(context.endDate);

        let slots: Array<{ startTime: string; resourceId: number; appointmentId?: number }> = [];

        // 1. Handle "Classes" segment type (fixed appointments)
        if (context.segmentType === 'Classes') {
            try {
                const locations = await client.getLocations();
                const locationId = context.locationId || locations.Items?.[0]?.Id;

                if (locationId) {
                    const res = await client.getAvailableAppointments({
                        locationId,
                        bookingServiceId: context.serviceId,
                        intervalStart: start,
                        intervalEnd: end
                    });

                    slots = (res.Items || [])
                        .filter(item => item.Capacity > item.ReservedCount) // Only show slots with remaining capacity
                        .map(item => ({
                            startTime: new Date(item.Start * 1000).toISOString(),
                            resourceId: item.BookingResourceId,
                            appointmentId: item.Id
                        }));
                }
                return { availableSlots: slots };
            } catch (error) {
                console.error('Error fetching Reservanto Class appointments:', error);
                return { availableSlots: [] };
            }
        }

        // 2. Handle "OneToOne" (and fallback) segment types (flexible starts)
        try {
            const locations = await client.getLocations();
            const locationItems = locations.Items || [];

            let locationId = locationItems[0]?.Id;
            if (context.locationId) {
                const exists = locationItems.find(l => l.Id === context.locationId);
                if (exists) {
                    locationId = context.locationId;
                }
            }

            if (locationId) {
                const res = await client.getAvailableSlotsForLocation(locationId, context.serviceId, start, end);

                if (res.Starts) {
                    if (Array.isArray(res.Starts)) {
                        // Standard list of slots { Start: number; BookingResourceId: number }
                        slots = res.Starts.map(s => ({
                            startTime: new Date(((s as any).Start || s) * 1000).toISOString(),
                            resourceId: (s as any).BookingResourceId || context.resourceId || 0
                        }));
                    } else if (typeof res.Starts === 'object') {
                        // Map of resourceId -> timestamps (Squash courts - sometimes they show as OneToOne with Location Starts)
                        Object.entries(res.Starts).forEach(([rId, timestamps]) => {
                            const resourceId = parseInt(rId);
                            (timestamps as number[]).forEach(t => {
                                slots.push({
                                    startTime: new Date(t * 1000).toISOString(),
                                    resourceId
                                });
                            });
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching Reservanto availability:', error);
            if (context.resourceId) {
                const res = await client.getAvailableSlots(context.resourceId!, context.serviceId, start, end);
                if (res.Starts) {
                    slots = res.Starts.map(s => ({
                        startTime: new Date(s * 1000).toISOString(),
                        resourceId: context.resourceId!
                    }));
                }
            }
        }

        // De-duplicate: Keep only one resource per time slot for the AI's simplicity
        const uniqueSlotsMap = new Map<string, { resourceId: number; appointmentId?: number }>();
        slots.forEach(s => {
            if (!uniqueSlotsMap.has(s.startTime)) {
                uniqueSlotsMap.set(s.startTime, { resourceId: s.resourceId, appointmentId: s.appointmentId });
            }
        });

        const finalSlots = Array.from(uniqueSlotsMap.entries())
            .map(([startTime, data]) => ({ startTime, resourceId: data.resourceId, appointmentId: data.appointmentId }))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        return {
            availableSlots: finalSlots,
        };
    },
});
