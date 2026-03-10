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

        // 1. Find or create customer
        const customerId = await client.findOrCreateCustomer({
            firstName: context.firstName,
            lastName: context.lastName,
            email: context.email,
            phone: context.phone,
        });

        // 2. Create booking
        const bookingStart = new Date(context.startTime);
        let booking: any;
        let bookingId: number = 0;
        let status: string = 'Confirmed';

        try {
            booking = await client.createBooking({
                bookingResourceId: context.resourceId,
                bookingServiceId: context.serviceId,
                customerId: customerId,
                bookingStart,
                customerNote: context.note,
                forceConfirmed: true,
            });
            bookingId = booking.AppointmentId ?? booking.Id ?? booking.Result?.Id ?? 0;
            status = booking.Status ?? booking.State ?? 'Confirmed';
        } catch (err: any) {
            const errorMsg = err.message || '';
            console.log(`⚠️ Standard booking failed: ${errorMsg}`);

            // If it's a "PlaceRentalLike" or segment issue, try to find a class-style Appointment
            if (errorMsg.includes('PlaceRentalLike') || errorMsg.includes('segmentu')) {
                console.log('🔄 Attempting fallback to Class-style booking for rental...');

                // Get valid locations
                const locations = await client.getLocations();
                const locId = locations.Items?.[0]?.Id;

                if (locId) {
                    // Look for Appointments around the start time
                    const apptsRes = await client.getAvailableAppointments({
                        locationId: locId,
                        bookingServiceId: context.serviceId,
                        intervalStart: new Date(bookingStart.getTime() - 5 * 60 * 1000), // 5 min wiggle room
                        intervalEnd: new Date(bookingStart.getTime() + 5 * 60 * 1000),
                    });

                    // Search for an exact start match
                    const targetUnix = Math.floor(bookingStart.getTime() / 1000);
                    const matchedAppt = apptsRes.Items?.find(item =>
                        item.Start === targetUnix &&
                        (context.resourceId ? item.BookingResourceId === context.resourceId : true)
                    );

                    if (matchedAppt) {
                        console.log(`✅ Found matching Appointment ID: ${matchedAppt.Id}. Creating class booking...`);
                        const classRes: any = await client.createClassBooking({
                            appointmentId: matchedAppt.Id,
                            customerId,
                            customerNote: context.note,
                        });
                        bookingId = classRes.AppointmentId ?? classRes.Id ?? matchedAppt.Id;
                        status = classRes.Status || 'Confirmed';
                    } else {
                        throw new Error(`Could not find a valid booking slot (Appointment) for ${context.startTime}. Please check availability first.`);
                    }
                } else {
                    throw err; // Re-throw original if no location
                }
            } else {
                throw err; // Re-throw other errors
            }
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
            message: `Booking confirmed successfully! Appointment ID: ${bookingId}`,
        };
    },
});
