import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './reservanto-client';
import { supabase } from '../../../lib/supabase';

export const createReservantoBookingTool = createTool({
    id: 'create-reservanto-booking',
    description: 'Create a new booking in Reservanto',
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        serviceId: z.number(),
        segmentType: z.string().optional().describe('The type of segment (OneToOne, Classes, RentalLike, EmsLike)'),
        locationId: z.number().optional().describe('Optional specific location ID'),
        resourceId: z.number().optional().describe('Technical ID of the court or employee'),
        appointmentId: z.number().optional().describe('Required for "Classes" segmentType. The ID of the specific appointment.'),
        startTime: z.string().describe('ISO date string for the booking start'),
        duration: z.number().optional().describe('Duration in minutes (required for RentalLike if not default)'),
        note: z.string().optional(),
    }),
    outputSchema: z.object({
        bookingId: z.number(),
        status: z.string(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        const client = await getReservantoClient(context.businessId);

        // 1. Find or create customer
        const customerId = await client.findOrCreateCustomer({
            firstName: context.firstName,
            lastName: context.lastName,
            email: context.email,
            phone: context.phone,
        });

        const bookingStart = new Date(context.startTime);
        let bookingId: number = 0;
        let status: string = 'Confirmed';

        // 2. Proactive Branching based on SegmentType
        if (context.segmentType === 'Classes') {
            if (!context.appointmentId && !context.startTime) {
                throw new Error('For "Classes" segmentType, either appointmentId or startTime is required.');
            }

            let appointmentId = context.appointmentId;

            // Auto-discovery if appointmentId is missing but startTime is present
            if (!appointmentId) {
                const locations = await client.getLocations();
                const locId = context.locationId || locations.Items?.[0]?.Id;
                if (locId) {
                    const apptsRes = await client.getAvailableAppointments({
                        locationId: locId,
                        bookingServiceId: context.serviceId,
                        intervalStart: new Date(bookingStart.getTime() - 60000),
                        intervalEnd: new Date(bookingStart.getTime() + 60000),
                    });
                    const targetUnix = Math.floor(bookingStart.getTime() / 1000);
                    appointmentId = apptsRes.Items?.find(i => i.Start === targetUnix)?.Id;
                }
            }

            if (!appointmentId) {
                throw new Error(`Could not find a valid appointment for ${context.startTime}.`);
            }

            const res: any = await client.createClassBooking({
                appointmentId,
                customerId,
                customerNote: context.note,
            });
            bookingId = res.AppointmentId || res.Id || appointmentId;
            status = res.Status || 'Confirmed';

        } else if (context.segmentType === 'RentalLike') {
            if (!context.resourceId) {
                // Try to auto-discover resource for rental
                const locations = await client.getLocations();
                const locId = locations.Items?.[0]?.Id;
                if (locId) {
                    const availability = await client.getAvailableSlotsForLocation(locId, context.serviceId, bookingStart, new Date(bookingStart.getTime() + 60000));
                    if (availability.Starts && typeof availability.Starts === 'object') {
                        context.resourceId = parseInt(Object.keys(availability.Starts)[0]);
                    }
                }
            }

            if (!context.resourceId) {
                throw new Error('For "RentalLike" segmentType, resourceId is required.');
            }

            const duration = context.duration || 60; // Default 60 mins
            const bookingEnd = new Date(bookingStart.getTime() + duration * 60000);

            const res: any = await client.createRentalLikeBooking({
                bookingResourceId: context.resourceId,
                customerId,
                bookingStart,
                bookingEnd,
                customerNote: context.note
            });
            bookingId = res.AppointmentId || res.Id;
            status = res.Status || 'Confirmed';

        } else if (context.segmentType === 'EmsLike') {
            if (!context.resourceId) throw new Error('For "EmsLike" segmentType, resourceId is required.');
            const res: any = await client.createEmsLikeBooking({
                bookingResourceId: context.resourceId,
                bookingServiceId: context.serviceId,
                customerId,
                bookingStart,
                customerNote: context.note
            });
            bookingId = res.AppointmentId || res.Id;
            status = res.Status || 'Confirmed';

        } else {
            // Default to "OneToOne"
            let resourceId = context.resourceId;
            if (!resourceId) {
                const locations = await client.getLocations();
                const locId = locations.Items?.[0]?.Id;
                if (locId) {
                    const availability = await client.getAvailableSlotsForLocation(locId, context.serviceId, bookingStart, new Date(bookingStart.getTime() + 60000));
                    if (availability.Starts) {
                        if (Array.isArray(availability.Starts)) {
                            resourceId = (availability.Starts[0] as any).BookingResourceId;
                        } else {
                            resourceId = parseInt(Object.keys(availability.Starts)[0]);
                        }
                    }
                }
            }

            if (!resourceId) {
                const resources = await client.getBookingResources();
                resourceId = resources.Items?.find(r => r.BookingServiceIds.includes(context.serviceId))?.Id;
            }

            if (!resourceId) throw new Error('Could not determine a valid ResourceId.');

            const res: any = await client.createBooking({
                bookingResourceId: resourceId,
                bookingServiceId: context.serviceId,
                customerId,
                bookingStart,
                customerNote: context.note,
                forceConfirmed: true
            });
            bookingId = res.AppointmentId || res.Id;
            status = res.Status || 'Confirmed';
        }

        // 3. Background: Update user info in Supabase
        if (context.phone) {
            try {
                const cleanPhone = context.phone.replace('whatsapp:', '');
                await supabase
                    .from('users')
                    .update({
                        full_name: `${context.firstName} ${context.lastName}`.trim(),
                        email: context.email || null,
                    })
                    .eq('phone_number', cleanPhone);
                console.log(`✅ Updated Supabase user info for ${cleanPhone}`);
            } catch (err) {
                console.error('❌ Failed to update Supabase user info:', err);
            }
        }

        return {
            bookingId,
            status,
            message: `Booking confirmed successfully! ${context.segmentType || 'OneToOne'} Appointment ID: ${bookingId}`,
        };
    },
});
