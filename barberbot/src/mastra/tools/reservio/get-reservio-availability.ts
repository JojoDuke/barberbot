import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './reservio-client';

const PRAGUE_TZ = 'Europe/Prague';

// Returns the wall-clock hour in Europe/Prague for a given Date, regardless of server timezone.
function getPragueHour(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-GB', { timeZone: PRAGUE_TZ, hour: '2-digit', hour12: false }).format(date),
    10
  );
}

// Returns "HH:mm" in Europe/Prague wall-clock time.
function formatPragueTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PRAGUE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

// Returns the Prague timezone offset (e.g. "+02:00" in summer / "+01:00" in winter) for a given date.
function getPragueOffset(date: Date): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: PRAGUE_TZ, timeZoneName: 'shortOffset' });
  const offsetPart = fmt.formatToParts(date).find(p => p.type === 'timeZoneName')?.value || 'GMT+1';
  // shortOffset gives e.g. "GMT+2" — normalize to "+02:00"
  const m = offsetPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return '+01:00';
  const sign = m[1];
  const hours = m[2].padStart(2, '0');
  const minutes = (m[3] || '00').padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

export const getAvailabilityTool = createTool({
  id: 'get-reservio-availability',
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
        startTime: z.string(), // Friendly Prague-local format like "14:00"
        endTime: z.string(),
      })
    ),
    totalSlots: z.number(),
  }),
  execute: async ({ context }) => {
    // Build the day's range as 00:00 → 23:59:59 in Prague local time, with the
    // correct offset for that date (handles CET ↔ CEST DST automatically).
    const ymd = context.date.slice(0, 10);
    const dayStart = new Date(`${ymd}T00:00:00Z`);
    const offset = getPragueOffset(dayStart);
    const from = `${ymd}T00:00:00${offset}`;
    const to = `${ymd}T23:59:59${offset}`;

    const response: any = await reservioClient.getAvailability(
      context.businessId,
      context.serviceId,
      from,
      to
    );

    const filterByTimePreference = (slot: any) => {
      if (!context.timePreference || context.timePreference === 'any') return true;
      const hours = getPragueHour(new Date(slot.attributes.start));
      switch (context.timePreference) {
        case 'morning': return hours < 12;
        case 'afternoon': return hours >= 12 && hours < 17;
        case 'evening': return hours >= 17;
        default: return true;
      }
    };

    const now = new Date();
    const slots = response.data
      .filter((slot: any) => new Date(slot.attributes.start) > now)
      .filter(filterByTimePreference)
      .map((slot: any) => ({
        start: slot.attributes.start,
        end: slot.attributes.end,
        startTime: formatPragueTime(new Date(slot.attributes.start)),
        endTime: formatPragueTime(new Date(slot.attributes.end)),
      }));

    return {
      slots,
      totalSlots: slots.length,
    };
  },
});

