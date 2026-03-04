import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';
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
        resourceId: z.number(),
        startTime: z.string().describe('ISO date string for the booking start'),
        note: z.string().optional(),
    }),
    outputSchema: z.object({
        bookingId: z.number(),
        status: z.string(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        const client = await getReservantoClient(context.businessId);

        // 1. Find or create customer — now returns a number (customerId) directly
        const customerId = await client.findOrCreateCustomer({
            firstName: context.firstName,
            lastName: context.lastName,
            email: context.email,
            phone: context.phone,
        });

        // 2. Create booking
        const booking: any = await client.createBooking({
            bookingResourceId: context.resourceId,
            bookingServiceId: context.serviceId,
            customerId: customerId,
            bookingStart: new Date(context.startTime),
            customerNote: context.note,
            forceConfirmed: true,
        });

        // Reservanto may return AppointmentId or Id
        const bookingId = booking.AppointmentId ?? booking.Id ?? booking.Result?.Id ?? 0;
        const status = booking.Status ?? booking.State ?? 'Confirmed';

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
            message: `Booking confirmed successfully! Appointment ID: ${bookingId}`,
        };
    },
});
