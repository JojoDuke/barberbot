import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { normalizePhoneForUserDb } from '../../lib/phone';

export const saveUserProfileTool = createTool({
  id: 'save-user-profile',
  description:
    'Progressively save or update the user\'s interest profile (categories browsed, services booked, ' +
    'services they are looking for, and estimated gender). Call this: ' +
    '(1) whenever the user browses a category — pass categoriesBrowsed; ' +
    '(2) whenever intent is clear — pass servicesLookingFor; ' +
    '(3) at booking confirmation — pass servicesBooked and genderEstimate. ' +
    'All array fields are merged with existing data (deduplicated). Never overwrite with empty arrays.',
  inputSchema: z.object({
    phoneNumber: z
      .string()
      .describe('WhatsApp sender phone, e.g. +420123456789 or whatsapp:+420123456789.'),
    categoriesBrowsed: z
      .array(z.string())
      .optional()
      .describe('Categories the user browsed this session, e.g. ["barbershop"].'),
    servicesBooked: z
      .array(z.string())
      .optional()
      .describe('Service names confirmed in a booking, e.g. ["Classic Haircut"].'),
    servicesLookingFor: z
      .array(z.string())
      .optional()
      .describe('Services the user expressed interest in before booking, e.g. ["massage"].'),
    genderEstimate: z
      .enum(['male', 'female', 'unknown'])
      .optional()
      .describe('Estimated gender based on name or service type. Only pass when reasonably confident.'),
    genderConfidence: z
      .enum(['high', 'low'])
      .optional()
      .describe('Confidence level for the gender estimate.'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const phone = normalizePhoneForUserDb(context.phoneNumber);
    if (!phone) return { success: false };

    // Fetch existing profile to merge arrays
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('categories_browsed, services_booked, services_looking_for, gender_estimate, gender_confidence')
      .eq('phone', phone)
      .maybeSingle();

    const merge = (prev: string[] = [], next: string[] = []): string[] =>
      Array.from(new Set([...prev, ...next]));

    const update: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    if (context.categoriesBrowsed?.length) {
      update.categories_browsed = merge(existing?.categories_browsed, context.categoriesBrowsed);
    }
    if (context.servicesBooked?.length) {
      update.services_booked = merge(existing?.services_booked, context.servicesBooked);
    }
    if (context.servicesLookingFor?.length) {
      update.services_looking_for = merge(existing?.services_looking_for, context.servicesLookingFor);
    }
    // Only update gender if not already set with high confidence
    if (context.genderEstimate && existing?.gender_confidence !== 'high') {
      update.gender_estimate = context.genderEstimate;
      update.gender_confidence = context.genderConfidence ?? 'low';
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert({ phone, ...update }, { onConflict: 'phone' });

    if (error) {
      console.error('❌ saveUserProfile error:', error.message);
      return { success: false };
    }

    return { success: true };
  },
});
