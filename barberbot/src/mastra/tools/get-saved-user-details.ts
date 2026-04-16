import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';

export const getSavedUserDetailsTool = createTool({
  id: 'get-saved-user-details',
  description:
    'Look up saved contact details (name, email) for the current user by their phone number. ' +
    'Call this tool right before asking the user for their name/email during the booking finalisation step. ' +
    'If details are found, present them to the user and ask if they want to reuse them.',
  inputSchema: z.object({
    phoneNumber: z
      .string()
      .describe(
        'The WhatsApp sender phone number, e.g. +420123456789 or whatsapp:+420123456789. ' +
          'Strip the "whatsapp:" prefix before passing.',
      ),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    name: z.string().nullable(),
    email: z.string().nullable(),
  }),
  execute: async ({ context }) => {
    const cleanPhone = context.phoneNumber.replace('whatsapp:', '').trim();

    const { data, error } = await supabase
      .from('users')
      .select('name, email')
      .eq('phone_number', cleanPhone)
      .maybeSingle();

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
