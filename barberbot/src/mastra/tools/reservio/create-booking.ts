import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';

export const createBookingTool = createTool({
  id: 'create-booking',
  description: 'Create a new booking/appointment in Reservio',
  inputSchema: z.object({
    businessId: z.string().describe('The Reservio business ID'),
    serviceId: z.string().describe('The service ID to book'),
    clientName: z.string().describe('Full name of the client'),
    clientEmail: z.string().describe('Email address of the client'),
    clientPhone: z.string().describe('Phone number of the client'),
    start: z.string().describe('Start time in ISO 8601 format with timezone'),
    end: z.string().describe('End time in ISO 8601 format with timezone'),
    note: z.string().optional().nullable().default('').describe('Optional note for the booking'),
  }),
  outputSchema: z.object({
    bookingId: z.string(),
    status: z.string(),
    cost: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const response: any = await reservioClient.createBooking(context.businessId, {
      clientName: context.clientName,
      clientEmail: context.clientEmail,
      clientPhone: context.clientPhone,
      serviceId: context.serviceId,
      start: context.start,
      end: context.end,
      note: context.note || '',
    });

    const booking = response.data;

    return {
      bookingId: booking.id,
      status: booking.attributes.state,
      cost: booking.attributes.cost,
      success: true,
      message: `Booking created successfully with ID ${booking.id}`,
    };
  },
});

