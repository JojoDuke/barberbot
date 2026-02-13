import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase.js';
import { sendWhatsAppMessage } from '../../../lib/twilio.js';
import dotenv from 'dotenv';

dotenv.config();

export const sendBroadcastTool = createTool({
    id: 'send-broadcast',
    description: 'Send a broadcast message to all users in the database. Use this command with caution.',
    inputSchema: z.object({
        message: z.string().describe('The broadcast message to send to all users'),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        recipientCount: z.number(),
        failedCount: z.number(),
        message: z.string(),
    }),
    execute: async ({ context }) => {
        console.log(`🚀 Starting broadcast: "${context.message}"`);

        const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!twilioFrom) {
            return {
                success: false,
                recipientCount: 0,
                failedCount: 0,
                message: 'TWILIO_WHATSAPP_NUMBER is not set in environment.',
            };
        }

        // 1. Fetch all users
        const { data: users, error } = await supabase
            .from('users')
            .select('phone_number');

        if (error) {
            return {
                success: false,
                recipientCount: 0,
                failedCount: 0,
                message: `Database error: ${error.message}`,
            };
        }

        if (!users || users.length === 0) {
            return {
                success: true,
                recipientCount: 0,
                failedCount: 0,
                message: 'No users found to broadcast to.',
            };
        }

        // 2. Send messages
        let successCount = 0;
        let failedCount = 0;

        for (const user of users) {
            try {
                await sendWhatsAppMessage(user.phone_number, twilioFrom, context.message);
                successCount++;
            } catch (err) {
                console.error(`Failed to send broadcast to ${user.phone_number}:`, err);
                failedCount++;
            }
        }

        return {
            success: true,
            recipientCount: successCount,
            failedCount: failedCount,
            message: `Broadcast complete. Sent to ${successCount} users, ${failedCount} failures.`,
        };
    },
});
