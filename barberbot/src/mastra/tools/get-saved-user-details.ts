import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { normalizePhoneForUserDb } from '../../lib/phone';

export const getSavedUserDetailsTool = createTool({
  id: 'get-saved-user-details',
  description:
    'Look up saved contact details (name, email) for this WhatsApp user by phone. ' +
    'Details are stored per phone number for the whole platform — not per business. ' +
    'Call this at booking finalisation before asking for name/email. ' +
    'If details are found, offer to reuse them.',
  inputSchema: z.object({
    phoneNumber: z
      .string()
      .describe(
        'WhatsApp sender phone, e.g. +420123456789 or whatsapp:+420123456789.',
      ),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    const normalized = normalizePhoneForUserDb(context.phoneNumber);
    const legacy = context.phoneNumber.replace(/^whatsapp:/i, '').trim();

    const fetchRow = async (key: string) =>
      supabase.from('users').select('name, email').eq('phone_number', key).maybeSingle();

    let { data, error } = await fetchRow(normalized);

    if (!data && legacy !== normalized) {
      const second = await fetchRow(legacy);
      data = second.data;
      error = second.error;
    }

    if (error) {
      console.error('❌ getSavedUserDetails error:', error.message);
      return { found: false, name: null, email: null };
    }

    const name = data?.name ?? null;
    const email = data?.email ?? null;
    const found = !!(name || email);

    return { found, name, email };
  },
});
