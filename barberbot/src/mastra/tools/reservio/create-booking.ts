import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';
import { supabase } from '../../../lib/supabase';

export const createBookingTool = createTool({
  id: 'reservio_create_booking',
  description: 'Create a new booking/appointment in Reservio',
  inputSchema: z.object({
    businessId: z.coerce.string().describe('The Reservio business ID'),
    serviceId: z.coerce.string().describe('The service ID to book'),
    start: z.string().describe('The start time of the booking in ISO format'),
    firstName: z.string().describe('The first name of the person booking'),
    lastName: z.string().describe('The last name of the person booking'),
    email: z.string().email().describe('The email of the person booking'),
    phone: z.string().describe('The phone number of the person booking'),
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
      clientName: `${context.firstName} ${context.lastName}`.trim(),
      clientEmail: context.email,
      clientPhone: context.phone,
      serviceId: context.serviceId,
      start: context.start,
      note: context.note || '',
    });

    const booking = response.data;

    // Background: Update user info in Supabase
    try {
      const cleanPhone = context.phone.replace('whatsapp:', '');
      await supabase
        .from('users')
        .update({
          full_name: `${context.firstName} ${context.lastName}`.trim(),
          email: context.email,
        })
        .eq('phone_number', cleanPhone);
      console.log(`✅ Updated Supabase user info for ${cleanPhone}`);
    } catch (err) {
      console.error('❌ Failed to update Supabase user info:', err);
    }

    return {
      bookingId: booking.id,
      status: booking.attributes.state,
      cost: booking.attributes.cost,
      success: true,
      message: `Booking created successfully with ID ${booking.id}`,
    };
  },
});

