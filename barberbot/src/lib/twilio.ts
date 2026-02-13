import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
    console.warn('⚠️ Twilio credentials not set!');
}

export const twilioClient = twilio(accountSid, authToken);

export const sendWhatsAppMessage = async (to: string, from: string, body: string, mediaUrl?: string) => {
    try {
        const message = await twilioClient.messages.create({
            to,
            from,
            body,
            mediaUrl: mediaUrl ? [mediaUrl] : undefined,
        });
        console.log(`📤 Message sent to ${to}: ${message.sid}`);
        return message;
    } catch (error) {
        console.error(`❌ Failed to send message to ${to}:`, error);
        throw error;
    }
};
