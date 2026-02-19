import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const createReservantoBookingTool = createTool({
    id: 'create-reservanto-booking',
    description: 'Create a new booking in Reservanto',
    inputSchema: z.object({
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
        const client = getReservantoClient();

        // 1. Find or create customer
        const customer = await client.findOrCreateCustomer({
            firstName: context.firstName,
            lastName: context.lastName,
            email: context.email,
            phone: context.phone,
        });

        const customerId = 'Id' in customer ? customer.Id : customer.Result.Id;

        // 2. Create booking
        const booking = await client.createBooking({
            bookingResourceId: context.resourceId,
            bookingServiceId: context.serviceId,
            customerId: customerId,
            bookingStart: new Date(context.startTime),
            customerNote: context.note,
            forceConfirmed: true,
        });

        return {
            bookingId: booking.AppointmentId,
            status: booking.Status,
            message: `Booking ${booking.Status} successfully`,
        };
    },
});
