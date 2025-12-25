import dotenv from 'dotenv';
import express from 'express';
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';
import { mastra } from '../src/mastra/index.js';

dotenv.config();

const app = express();

// Middleware to parse Twilio's webhook data
app.use(express.urlencoded({ extended: false }));

// Function to send typing indicator
async function sendTypingIndicator(messageSid: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.warn('⚠️  Twilio credentials not set - skipping typing indicator');
    return;
  }

  try {
    const url = 'https://messaging.twilio.com/v2/Indicators/Typing.json';
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const body = new URLSearchParams();
    body.append('messageId', messageSid);
    body.append('channel', 'whatsapp');

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    console.log('💬 Typing indicator sent');
  } catch (error) {
    console.warn('⚠️  Failed to send typing indicator:', error);
    // Don't throw - typing indicator is not critical
  }
}

app.post('/whatsapp', async (req, res) => {
  const twiml = new MessagingResponse();

  try {
    // Extract incoming message and sender info
    const incomingMessage = req.body.Body || '';
    const senderNumber = req.body.From || '';
    const messageSid = req.body.MessageSid || '';

    console.log(`📱 Message from ${senderNumber}: ${incomingMessage}`);

    // Send typing indicator immediately (non-blocking)
    if (messageSid) {
      sendTypingIndicator(messageSid).catch(() => {
        // Silently fail - typing indicator is not critical
      });
    }

    // Get Bridget, the booking agent
    const agent = mastra.getAgent('bridgetAgent');

    if (!agent) {
      throw new Error('Bridget agent not found');
    }

    // Call the agent with memory context (using phone number as resourceId)
    console.log('🔄 Calling Bridget...');
    const response = await agent.stream(
      [
        {
          role: 'user',
          content: incomingMessage,
        },
      ],
      {
        resourceId: senderNumber, // This enables conversation memory per user
        threadId: 'booking-conversation', // Thread ID for booking conversations
      }
    );

    console.log('📡 Streaming response...');
    
    // Accumulate the streamed response
    let fullResponse = '';
    for await (const chunk of response.textStream) {
      console.log('📝 Chunk received:', chunk);
      fullResponse += chunk;
    }

    console.log(`🤖 Bot response (length: ${fullResponse.length}): ${fullResponse}`);

    // Check if response is empty
    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('Agent returned empty response. Check your OPENAI_API_KEY and logs above.');
    }

    // Send the response back via WhatsApp
    twiml.message(fullResponse);
  } catch (error) {
    console.error('Error processing message:', error);
    twiml.message('Sorry, I encountered an error. Please try again later.');
  }

  res.type('text/xml').send(twiml.toString());
});

app.listen(3000, () => {
  console.log('🚀 Express server listening on port 3000');
  console.log('📲 WhatsApp webhook ready at http://localhost:3000/whatsapp');
  console.log('🤖 Bridget AI Booking Bot is ready!');
  
  // Check if API keys are set
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  const hasRicoToken = !!process.env.RESERVIO_TOKEN_RICO_STUDIO;
  const hasHolicToken = !!process.env.RESERVIO_TOKEN_HOLICSTVI_21;
  const hasAnatomicToken = !!process.env.RESERVIO_TOKEN_ANATOMIC_FITNESS;
  const hasTwilioSid = !!process.env.TWILIO_ACCOUNT_SID;
  const hasTwilioToken = !!process.env.TWILIO_AUTH_TOKEN;
  
  console.log(`🔑 OpenAI API Key: ${hasOpenAiKey ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`🔑 Rico Studio Token: ${hasRicoToken ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`🔑 Holičství 21 Token: ${hasHolicToken ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`🔑 Anatomic Fitness Token: ${hasAnatomicToken ? '✅ Set' : '❌ NOT SET'}`);
  console.log(`🔑 Twilio Account SID: ${hasTwilioSid ? '✅ Set' : '⚠️  NOT SET (typing indicators disabled)'}`);
  console.log(`🔑 Twilio Auth Token: ${hasTwilioToken ? '✅ Set' : '⚠️  NOT SET (typing indicators disabled)'}`);
  
  if (!hasOpenAiKey || !hasRicoToken || !hasHolicToken || !hasAnatomicToken) {
    console.log('\n⚠️  WARNING: Missing required environment variables!');
    console.log('   Please add the following to your .env file:');
    if (!hasOpenAiKey) console.log('   - OPENAI_API_KEY=your-openai-key');
    if (!hasRicoToken) console.log('   - RESERVIO_TOKEN_RICO_STUDIO=your-token');
    if (!hasHolicToken) console.log('   - RESERVIO_TOKEN_HOLICSTVI_21=your-token');
    if (!hasAnatomicToken) console.log('   - RESERVIO_TOKEN_ANATOMIC_FITNESS=your-token');
  }
  
  if (!hasTwilioSid || !hasTwilioToken) {
    console.log('\n💡 OPTIONAL: Add Twilio credentials for typing indicators:');
    console.log('   - TWILIO_ACCOUNT_SID=your-account-sid');
    console.log('   - TWILIO_AUTH_TOKEN=your-auth-token');
  }
});