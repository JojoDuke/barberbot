import dotenv from 'dotenv';
import express from 'express';
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';
import { mastra } from '../src/mastra/index.js';

dotenv.config();

const app = express();

// Middleware to parse Twilio's webhook data
app.use(express.urlencoded({ extended: false }));

// WhatsApp message length limit (Twilio recommends staying under 1600)
const WHATSAPP_MESSAGE_LIMIT = 1600;

// Function to sanitize message for WhatsApp
function sanitizeWhatsAppMessage(message: string): string {
  if (!message || message.trim().length === 0) {
    return 'Sorry, I encountered an issue. Please try again.';
  }

  // Remove unsupported characters and fix formatting
  let sanitized = message
    // Remove control characters except newlines and tabs
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Replace em dash and en dash with regular dash
    .replace(/[\u2013\u2014]/g, '-') // Em dash (—) and en dash (–) to regular dash (-)
    // Convert markdown formatting to WhatsApp format
    .replace(/\*\*\*/g, '*') // Triple asterisks to single
    .replace(/\*\*/g, '*') // Double asterisks to single
    .replace(/_{2,}/g, '_') // Multiple underscores to single
    .replace(/~~(.+?)~~/g, '$1') // Remove strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
    // Clean up markdown headers
    .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
    // Fix bullet points
    .replace(/^[\-\+]\s+/gm, '• ') // Convert - or + to bullets
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove excess whitespace
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .replace(/[ \t]{2,}/g, ' ') // Multiple spaces to single
    .trim();

  // Ensure message isn't empty after sanitization
  if (sanitized.length === 0) {
    return 'Sorry, I encountered an issue with the response format. Please try again.';
  }

  // Limit message length (WhatsApp via Twilio has limits)
  if (sanitized.length > WHATSAPP_MESSAGE_LIMIT) {
    sanitized = sanitized.substring(0, WHATSAPP_MESSAGE_LIMIT - 100) + '\n\n... (message truncated)';
  }

  return sanitized;
}

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

    console.log(`📱 Incoming WhatsApp Message:`);
    console.log(`   From: ${senderNumber}`);
    console.log(`   SID: ${messageSid}`);
    console.log(`   Body: ${incomingMessage}`);

    // Validate incoming message
    if (!incomingMessage.trim()) {
      console.warn('⚠️  Empty message received');
      twiml.message('Hi! Please send a message to get started.');
      res.type('text/xml').send(twiml.toString());
      return;
    }

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
    // Use phone number as threadId to ensure each user has their own conversation thread
    const threadId = `booking-${senderNumber.replace(/[^0-9]/g, '')}`; // Remove non-numeric chars for clean thread ID
    console.log(`💬 Using thread ID: ${threadId} for resource: ${senderNumber}`);
    
    const response = await agent.stream(
      [
        {
          role: 'user',
          content: incomingMessage,
        },
      ],
      {
        resourceId: senderNumber, // This enables conversation memory per user
        threadId: threadId, // Unique thread ID per user (phone number)
      }
    );

    console.log('📡 Streaming response...');
    
    // Accumulate the streamed response
    let fullResponse = '';
    for await (const chunk of response.textStream) {
      console.log('📝 Chunk received:', chunk);
      fullResponse += chunk;
    }

    console.log(`🤖 Bot response (length: ${fullResponse.length}):`);
    console.log('───────────────────────────────────────');
    console.log(fullResponse);
    console.log('───────────────────────────────────────');

    // Check if response is empty
    if (!fullResponse || fullResponse.trim().length === 0) {
      throw new Error('Agent returned empty response. Check your OPENAI_API_KEY and logs above.');
    }

    // Sanitize the response for WhatsApp
    const sanitizedResponse = sanitizeWhatsAppMessage(fullResponse);
    console.log(`✨ Sanitized response (length: ${sanitizedResponse.length}):`);
    console.log('───────────────────────────────────────');
    console.log(sanitizedResponse);
    console.log('───────────────────────────────────────');

    // Validate before sending
    if (!sanitizedResponse || sanitizedResponse.trim().length === 0) {
      throw new Error('Sanitized response is empty');
    }

    // Send the response back via WhatsApp
    twiml.message(sanitizedResponse);
    
    console.log('✅ TwiML response prepared successfully');
  } catch (error) {
    console.error('❌ Error processing message:');
    console.error(error);
    
    const errorMessage = 'Sorry, I encountered an error. Please try again in a moment.';
    twiml.message(errorMessage);
  }

  // Set proper headers and send response
  res.type('text/xml');
  const twimlString = twiml.toString();
  console.log('📤 Sending TwiML response:');
  console.log(twimlString);
  res.send(twimlString);
});

// Status callback endpoint to track message delivery
app.post('/whatsapp/status', (req, res) => {
  console.log(`📊 Message Status Callback Received`);
  console.log('───────────────────────────────────────');
  console.log('Full callback data:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('───────────────────────────────────────');

  // Extract common Twilio status fields
  const messageSid = req.body.MessageSid || req.body.SmsSid;
  const messageStatus = req.body.MessageStatus || req.body.SmsStatus;
  const errorCode = req.body.ErrorCode;
  const errorMessage = req.body.ErrorMessage;
  const from = req.body.From;
  const to = req.body.To;
  const channelStatus = req.body.ChannelToStatus;

  console.log(`\n📊 Parsed Status:`);
  console.log(`   SID: ${messageSid}`);
  console.log(`   Status: ${messageStatus || channelStatus || 'unknown'}`);
  console.log(`   From: ${from}`);
  console.log(`   To: ${to}`);
  
  if (errorCode) {
    console.error(`   ❌ Error Code: ${errorCode}`);
    console.error(`   ❌ Error Message: ${errorMessage}`);
  } else {
    console.log(`   ✅ No errors`);
  }

  res.sendStatus(200);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Bridget WhatsApp Bot'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Bridget WhatsApp Bot',
    status: 'running',
    endpoints: {
      webhook: '/whatsapp',
      status: '/whatsapp/status',
      health: '/health'
    }
  });
});

app.listen(3000, () => {
  console.log('🚀 Express server listening on port 3000');
  console.log('📲 WhatsApp webhook ready at http://localhost:3000/whatsapp');
  console.log('📊 Status callback ready at http://localhost:3000/whatsapp/status');
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