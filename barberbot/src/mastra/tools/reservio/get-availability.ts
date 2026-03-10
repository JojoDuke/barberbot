import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';

export const getAvailabilityTool = createTool({
  id: 'get-availability',
  description: 'Get available time slots for a service on a specific date. Returns slots in Europe/Prague timezone.',
  inputSchema: z.object({
    businessId: z.string().describe('The Reservio business ID'),
    serviceId: z.string().describe('The service ID to check availability for'),
    date: z.string().describe('Date in ISO format (YYYY-MM-DD) to check availability'),
    timePreference: z.enum(['morning', 'afternoon', 'evening', 'any']).optional()
      .describe('Time preference: morning (before 12pm), afternoon (12pm-5pm), evening (after 5pm), or any'),
  }),
  outputSchema: z.object({
    slots: z.array(
      z.object({
        start: z.string(),
        end: z.string(),
        startTime: z.string(), // Friendly format like "10:00 AM"
        endTime: z.string(),
      })
    ),
    totalSlots: z.number(),
  }),
  execute: async ({ context }) => {
    // Parse the date and create from/to timestamps in Europe/Prague timezone
    const date = new Date(context.date);
    const fromDate = new Date(date);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(date);
    toDate.setHours(23, 59, 59, 999);

    // Format as ISO 8601 with +01:00 timezone (Europe/Prague)
    const formatDateForReservio = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+01:00`;
    };

    const from = formatDateForReservio(fromDate);
    const to = formatDateForReservio(toDate);

    const response: any = await reservioClient.getAvailability(
      context.businessId,
      context.serviceId,
      from,
      to
    );

    // Format time helper
    const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    // Filter by time preference if specified
    const filterByTimePreference = (slot: any) => {
      if (!context.timePreference || context.timePreference === 'any') {
        return true;
      }

      const startDate = new Date(slot.attributes.start);
      const hours = startDate.getHours();

      switch (context.timePreference) {
        case 'morning':
          return hours < 12;
        case 'afternoon':
          return hours >= 12 && hours < 17;
        case 'evening':
          return hours >= 17;
        default:
          return true;
      }
    };

    // Filter out past slots and apply time preference
    const now = new Date();
    const slots = response.data
      .filter((slot: any) => new Date(slot.attributes.start) > now)
      .filter(filterByTimePreference)
      .map((slot: any) => ({
        start: slot.attributes.start,
        end: slot.attributes.end,
        startTime: formatTime(slot.attributes.start),
        endTime: formatTime(slot.attributes.end),
      }));

    return {
      slots,
      totalSlots: slots.length,
    };
  },
});

