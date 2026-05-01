import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import twilio from 'twilio';
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse';
import { mastra } from '../src/mastra/index.js';
import { supabase } from '../src/lib/supabase.js';
import { enrichBusinesses } from '../src/scripts/enrich-businesses.js';
import { logger } from '../src/mastra/logger.js';
import { normalizePhoneForUserDb } from '../src/lib/phone.js';

dotenv.config();

const app = express();

// Middleware to parse Twilio's webhook data
app.use(express.urlencoded({ extended: false }));

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// User states for command triggers
const userStates = new Map<string, 'AWAITING_BROADCAST_CONFIRM' | 'AWAITING_TC_ACCEPTANCE'>();

// Detected language per user (persisted for the T&C gate before the AI is involved)
const userLanguages = new Map<string, 'cs' | 'en'>();

// WhatsApp message length limit (Twilio recommends staying under 1600)
const WHATSAPP_MESSAGE_LIMIT = 1600;

// Detect Czech vs English from a raw message.
// Uses Czech-specific diacritics and common Czech words/greetings as signal.
function detectLanguage(msg: string): 'cs' | 'en' {
  const lower = msg.toLowerCase().trim();
  const czechDiacritics = /[áčďéěíňóřšťúůýž]/;
  const czechWords = /\b(ahoj|cau|čau|nazdar|dobrý|dobry|den|zdravím|zdravim|jak|kde|chci|prosím|prosim|děkuji|dekuji|díky|diky|ano|ne|potřebuji|potrebuji|rezervace|objednat|objednání|služby|sluzby|hodina|hodiny|termín|termin)\b/;
  if (czechDiacritics.test(lower) || czechWords.test(lower)) return 'cs';
  return 'en';
}

// Terms & Conditions messages per language
const TC_MESSAGES: Record<'cs' | 'en', string> = {
  en:
    'Welcome! 👋\n\n' +
    'Before using this booking service, please read and accept our Terms & Conditions.\n\n' +
    'By continuing you agree to our terms of service and consent to receiving booking-related messages via WhatsApp.\n\n' +
    'Reply *Yes* to accept and get started.',
  cs:
    'Vítejte! 👋\n\n' +
    'Před použitím této rezervační služby si prosím přečtěte a přijměte naše Obchodní podmínky.\n\n' +
    'Pokračováním souhlasíte s našimi podmínkami služby a dáváte souhlas k přijímání zpráv souvisejících s rezervacemi přes WhatsApp.\n\n' +
    'Odpovězte *Ano* pro přijetí a začněte.',
};

const TC_ACCEPTED_MESSAGES: Record<'cs' | 'en', string> = {
  en: '✅ Thank you for accepting our Terms & Conditions! How can I help you today?',
  cs: '✅ Děkujeme za přijetí našich Obchodních podmínek! Jak vám mohu dnes pomoci?',
};

const TC_ACCEPTED_FALLBACK_MESSAGES: Record<'cs' | 'en', string> = {
  en: '✅ Thanks! How can I help you today?',
  cs: '✅ Děkujeme! Jak vám mohu dnes pomoci?',
};

// Host URL for serving images (defaults to ngrok/tunnel URL if available, else localhost)
// You should set BASE_URL in .env to your ngrok URL (e.g. https://xxxx.ngrok.io)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

app.use('/images', express.static(path.join(process.cwd(), 'public/images')));

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
    .replace(/~~(.+?)~~/g, '$1') // Remove strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, '') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code formatting
    // Clean up markdown headers
    .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
    // Fix bullet points
    .replace(/^[\-\+]\s+/gm, '• ') // Convert - or + to bullets
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove image tags [IMAGE: ...] as they are handled separately
    .replace(/\[IMAGE:.*?\]/g, '')
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

// Function to send a single typing indicator
async function sendTypingIndicator(messageSid: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !messageSid) {
    return;
  }

  try {
    // Using a raw string to ensure perfect x-www-form-urlencoded formatting
    const body = `messageId=${messageSid}&channel=whatsapp`;

    await axios.post(
      'https://messaging.twilio.com/v2/Indicators/Typing.json',
      body,
      {
        auth: {
          username: accountSid,
          password: authToken
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
  } catch (error: any) {
    if (error.response) {
      console.warn('⚠️ Failed to send typing indicator:', error.response.status, JSON.stringify(error.response.data));
    } else {
      console.warn('⚠️ Failed to send typing indicator:', error.message);
    }
  }
}

/**
 * Starts a recurring typing indicator that stays active while the bot is thinking.
 * Returns a function to stop the indicator.
 */
function startTypingIndicator(messageSid: string): () => void {
  if (!messageSid) return () => {};

  // Send immediately
  sendTypingIndicator(messageSid);

  // WhatsApp typing indicators usually last ~5-10 seconds.
  // We refresh every 4 seconds to be safe.
  const interval = setInterval(() => {
    sendTypingIndicator(messageSid);
  }, 4000);

  return () => {
    clearInterval(interval);
  };
}

// Helper to delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** OpenAI Responses API rejects the whole request if the same item id (e.g. fc_...) appears twice. */
function isDuplicateResponsesItemError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return (
    /Duplicate item found with id/i.test(msg) ||
    (msg.includes('Duplicate item') && msg.includes('Remove duplicate items'))
  );
}

// Helper to send WhatsApp message via REST API
async function sendWhatsAppMessageRest(to: string, from: string, body: string, mediaUrl?: string) {
  try {
    await client.messages.create({
      to,
      from,
      body,
      mediaUrl: mediaUrl ? [mediaUrl] : undefined,
    });
    console.log(`📤 Message sent via REST API to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send REST API message to ${to}:`, error);
  }
}

// Track active threads to prevent parallel processing for the same user
const processingThreads = new Set<string>();

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

    // Thread locking to prevent duplicate tool ID crashes.
    // IMPORTANT: acquire the lock immediately (before any awaits) to close the race window
    // where two concurrent webhook calls could both pass the check before either sets it.
    if (processingThreads.has(senderNumber)) {
      console.warn(`⚠️  Thread ${senderNumber} is already being processed. Ignoring overlapping message.`);
      res.type('text/xml').send(new MessagingResponse().toString());
      return;
    }
    processingThreads.add(senderNumber);

    const normalizedMsg = incomingMessage.trim().toLowerCase();

    // Synchronous: ensure user exists in Supabase and check T&C acceptance
    const canonical = normalizePhoneForUserDb(senderNumber);
    const legacy = senderNumber.replace(/^whatsapp:/i, '').trim();
    let hasAcceptedTC = true; // fail-open: proceed if DB check errors out

    try {
      let { data: userRow, error: userError } = await supabase
        .from('users')
        .select('phone_number, terms_accepted_at')
        .eq('phone_number', canonical)
        .maybeSingle();

      if (userError && (userError.code === '42703' || userError.message?.includes('terms_accepted_at'))) {
        // Column doesn't exist yet — skip gate until migration is applied
        console.warn('⚠️  terms_accepted_at column not found — skipping T&C gate. Run the migration to enable it.');
        hasAcceptedTC = true;
      } else {
        // Try legacy phone format if canonical not found
        if (!userRow && legacy !== canonical) {
          const second = await supabase
            .from('users')
            .select('phone_number, terms_accepted_at')
            .eq('phone_number', legacy)
            .maybeSingle();
          userRow = second.data;
        }

        if (!userRow) {
          // First ever message from this number — create the user row
          const { error: insertError } = await supabase.from('users').insert({ phone_number: canonical });
          if (insertError) {
            console.error('❌ Failed to register new user in Supabase:', insertError.message);
          } else {
            console.log(`🆕 Registered new user: ${canonical}`);
          }
          hasAcceptedTC = false; // brand-new user hasn't accepted yet
        } else {
          hasAcceptedTC = userRow.terms_accepted_at != null;
        }
      }
    } catch (err) {
      console.error('❌ Error during user sync / T&C check:', err);
      hasAcceptedTC = true; // fail-open on unexpected errors
    }

    // -1. Terms & Conditions gate — must be accepted before anything else
    const isAwaitingTC = userStates.get(senderNumber) === 'AWAITING_TC_ACCEPTANCE';

    if (!hasAcceptedTC || isAwaitingTC) {
      // Detect (or refresh) language from every message in the T&C flow
      const detectedLang = detectLanguage(incomingMessage);
      if (!userLanguages.has(senderNumber) || detectedLang !== 'en') {
        // Prefer any explicit signal over the default; only overwrite the
        // stored 'en' default when we get a clear Czech signal.
        userLanguages.set(senderNumber, detectedLang);
      }
      const lang = userLanguages.get(senderNumber) ?? 'en';

      const acceptanceWords = ['yes', 'ano', 'ok', 'accept', 'souhlasím', 'souhlasim', 'agree', '1'];
      const userAccepted = acceptanceWords.some(w => normalizedMsg === w || normalizedMsg.startsWith(w + ' '));

      if (isAwaitingTC && userAccepted) {
        try {
          await supabase
            .from('users')
            .update({ terms_accepted_at: new Date().toISOString() })
            .eq('phone_number', canonical);
          userStates.delete(senderNumber);
          userLanguages.delete(senderNumber);
          console.log(`✅ T&C accepted by ${canonical}`);
          twiml.message(TC_ACCEPTED_MESSAGES[lang]);
        } catch (err) {
          console.error('❌ Error saving T&C acceptance:', err);
          twiml.message(TC_ACCEPTED_FALLBACK_MESSAGES[lang]);
        }
      } else {
        userStates.set(senderNumber, 'AWAITING_TC_ACCEPTANCE');
        twiml.message(TC_MESSAGES[lang]);
      }

      processingThreads.delete(senderNumber);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // 0. Handle Thread Management (CRITICAL FIX)
    if (normalizedMsg === '!clear' || normalizedMsg === '!reset') {
      console.log(`🧹 Clearing thread for ${senderNumber}`);
      const threadId = `booking-${senderNumber.replace(/[^0-9]/g, '')}`;
      await (mastra.storage as any)?.deleteThread({ threadId });
      twiml.message('✅ Your conversation history has been cleared. You can start a new booking now.');
      processingThreads.delete(senderNumber);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // 1. Handle Broadcast Confirmation State
    if (userStates.get(senderNumber) === 'AWAITING_BROADCAST_CONFIRM') {
      if (normalizedMsg === 'yes' || normalizedMsg === '1') {
        userStates.delete(senderNumber);

        try {
          // Fetch all target numbers from Supabase 'users' table
          const { data: users, error } = await supabase
            .from('users')
            .select('phone_number');

          if (error || !users || users.length === 0) {
            console.error('❌ Failed to fetch users from table:', error);
            twiml.message('❌ Broadcast failed: No users found in database.');
            processingThreads.delete(senderNumber);
            res.type('text/xml').send(twiml.toString());
            return;
          }

          console.log(`📣 Starting broadcast to ${users.length} users...`);

          let successCount = 0;
          for (const user of users) {
            if (!user.phone_number) continue;

            const targetNumber = user.phone_number;
            const recipient = targetNumber.startsWith('whatsapp:')
              ? targetNumber
              : `whatsapp:${targetNumber.startsWith('+') ? targetNumber : '+' + targetNumber}`;

            try {
              await sendWhatsAppMessageRest(
                recipient,
                req.body.To,
                "📣 This is a test broadcast from BarberBot!"
              );
              successCount++;
              await sleep(100);
            } catch (sendErr) {
              console.error(`❌ Failed to send to ${targetNumber}:`, sendErr);
            }
          }

          twiml.message(`✅ Broadcast complete! Sent to ${successCount}/${users.length} users.`);
          processingThreads.delete(senderNumber);
          res.type('text/xml').send(twiml.toString());
          return;
        } catch (err) {
          console.error('❌ Broadcast failed:', err);
          twiml.message('❌ Failed to send broadcast message.');
          processingThreads.delete(senderNumber);
          res.type('text/xml').send(twiml.toString());
          return;
        }
      } else {
        // Any other word cancels the broadcast mode
        userStates.delete(senderNumber);
        twiml.message('⚠️ Broadcast cancelled.');
        processingThreads.delete(senderNumber);
        res.type('text/xml').send(twiml.toString());
        return;
      }
    }

    // 2. Command Trigger: !x74
    if (normalizedMsg === '!x74') {
      console.log('🎯 Command Triggered: !x74');
      userStates.set(senderNumber, 'AWAITING_BROADCAST_CONFIRM');
      twiml.message('Send Broadcast?\n\nReply *Yes* to confirm or *No* to cancel.');
      processingThreads.delete(senderNumber);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Validate incoming message
    if (!incomingMessage.trim()) {
      console.warn('⚠️  Empty message received');
      twiml.message('Hi! Please send a message to get started.');
      processingThreads.delete(senderNumber);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Start persistent typing indicator
    const stopTyping = startTypingIndicator(messageSid);

    // Acknowledge the webhook immediately so Twilio doesn't time out (15s limit) and retry.
    // The actual response is sent asynchronously via REST API below.
    res.type('text/xml').send(new MessagingResponse().toString());

    try {
      // Get Bridget, the booking agent
      const agent = mastra.getAgent('bridgetAgent');

      if (!agent) {
        throw new Error('Bridget agent not found');
      }

      const canonicalPhone = normalizePhoneForUserDb(senderNumber);
      const rawClean = senderNumber.replace(/^whatsapp:/i, '').trim();
      let profileRow: { name: string | null; email: string | null } | null = null;
      {
        let { data } = await supabase.from('users').select('name, email').eq('phone_number', canonicalPhone).maybeSingle();
        if (!data && rawClean !== canonicalPhone) {
          const second = await supabase.from('users').select('name, email').eq('phone_number', rawClean).maybeSingle();
          data = second.data;
        }
        profileRow = data;
      }

      const sessionIdentityContext = [
        '[Session — WhatsApp user identity]',
        `Canonical phone (database key; same for every business): ${canonicalPhone}`,
        profileRow?.name || profileRow?.email
          ? `Stored contact in Supabase (from any prior booking): name=${profileRow.name ?? ''}, email=${profileRow.email ?? ''}`
          : 'No name/email stored yet; they will be saved after a successful booking.',
        `Use this phone with getSavedUserDetails: ${canonicalPhone}`,
      ].join('\n');

      // Call the agent with memory context (using phone number as resourceId)
      console.log('🔄 Calling Bridget...');
      // Use phone number as threadId to ensure each user has their own conversation thread
      const threadId = `booking-${senderNumber.replace(/[^0-9]/g, '')}`; // Remove non-numeric chars for clean thread ID
      console.log(`💬 Using thread ID: ${threadId} for resource: ${senderNumber}`);

      // IMPORTANT: Pass only the *new* user message here.
      // Mastra's prepare-memory-step already loads persisted thread history from storage and does
      // messageList.add(memoryMessages, "memory").add(options.messages, "user").
      // If we also pre-fetch getMessages() and spread it into stream(), the same turns are sent
      // twice to OpenAI Responses → duplicate fc_* item ids → "Duplicate item found" API errors.

      const TIMEOUT_MS = 60000; // Increase to 60s for stability
      let fullResponse = '';

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Agent response timeout. The AI is taking too long.')), TIMEOUT_MS);
      });

      const userMessage = { role: 'user' as const, content: incomingMessage };
      let messagesForModel: any[] = [userMessage];

      // One retry if thread was already corrupted (e.g. before the fix above): clear + same message only
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const agentPromise = agent.stream(messagesForModel, {
            resourceId: senderNumber,
            threadId: threadId,
            context: [{ role: 'system', content: sessionIdentityContext }],
          });

          const response = await Promise.race([agentPromise, timeoutPromise]);

          console.log('📡 Streaming response...');

          for await (const chunk of response.textStream) {
            fullResponse += chunk;
          }
          break;
        } catch (streamErr) {
          if (attempt === 0 && isDuplicateResponsesItemError(streamErr)) {
            console.warn(
              `🛡️ Duplicate Responses item in thread ${threadId} — clearing thread and retrying once (same as !clear).`
            );
            await (mastra.storage as any)?.deleteThread({ threadId });
            messagesForModel = [userMessage];
            fullResponse = '';
            continue;
          }
          throw streamErr;
        }
      }

      console.log(`🤖 Bot response (${fullResponse.length} chars)`);

      // Check if response is empty
      if (!fullResponse || fullResponse.trim().length === 0) {
        console.error('⚠️  Agent returned empty response');
        throw new Error('Agent returned empty response. Please try sending your message again.');
      }

      // Sanitize the response for WhatsApp
      const sanitizedResponse = sanitizeWhatsAppMessage(fullResponse);

      // Validate before sending
      if (!sanitizedResponse || sanitizedResponse.trim().length === 0) {
        throw new Error('Sanitized response is empty');
      }

      // Check if response contains SPLIT_MESSAGE blocks
      const splitMessageRegex = /\[SPLIT_MESSAGE\]([\s\S]*?)\[\/SPLIT_MESSAGE\]/g;
      const splitMatches = Array.from(fullResponse.matchAll(splitMessageRegex));

      if (splitMatches.length > 0) {
        // Multiple messages mode - send each SPLIT_MESSAGE block as a separate message
        console.log(`📨 Detected ${splitMatches.length} split messages - switching to REST API for sequencing`);

        // First, send any content before the first SPLIT_MESSAGE block
        const firstSplitIndex = fullResponse.indexOf('[SPLIT_MESSAGE]');
        if (firstSplitIndex > 0) {
          const introText = fullResponse.substring(0, firstSplitIndex).trim();
          if (introText) {
            const sanitizedIntro = sanitizeWhatsAppMessage(introText);
            if (sanitizedIntro) {
              await sendWhatsAppMessageRest(senderNumber, req.body.To, sanitizedIntro);
              await sleep(1000); // 1 second delay
            }
          }
        }

        // Send each SPLIT_MESSAGE block as a separate message
        for (let i = 0; i < splitMatches.length; i++) {
          const match = splitMatches[i];
          const blockContent = match[1].trim();

          // Extract image URL from this block
          const imageMatch = blockContent.match(/\[IMAGE:\s*(.*?)\]/);
          const imageUrl = imageMatch ? imageMatch[1].trim() : null;

          // Remove IMAGE tag from text
          const textContent = blockContent.replace(/\[IMAGE:.*?\]/g, '').trim();

          if (textContent) {
            const sanitizedBlock = sanitizeWhatsAppMessage(textContent);

            let finalImageUrl: string | undefined = undefined;
            if (imageUrl) {
              finalImageUrl = imageUrl;
              if (imageUrl.startsWith('/')) {
                finalImageUrl = `${BASE_URL.replace(/\/$/, '')}/${imageUrl.replace(/^\//, '')}`;
              }
            }

            await sendWhatsAppMessageRest(senderNumber, req.body.To, sanitizedBlock, finalImageUrl);

            // Delay between messages
            // If it's the second to last message, add a longer delay for the final question
            if (i < splitMatches.length - 1) {
              const delay = i === splitMatches.length - 2 ? 4000 : 2500;
              await sleep(delay);
            }
          }
        }

        // We respond with empty TwiML since we sent everything via REST API
        console.log('✅ All split messages queued via REST API');
      } else {
        // Single message — send via REST API (webhook already acknowledged above)
        const imageMatch = fullResponse.match(/\[IMAGE:\s*(.*?)\]/);
        let imageUrl: string | undefined;
        if (imageMatch && imageMatch[1]) {
          imageUrl = imageMatch[1].trim();
          if (imageUrl.startsWith('/')) {
            imageUrl = `${BASE_URL.replace(/\/$/, '')}/${imageUrl.replace(/^\//, '')}`;
          }
          console.log(`🖼️  Attaching image: ${imageUrl}`);
        }
        await sendWhatsAppMessageRest(senderNumber, req.body.To, sanitizedResponse, imageUrl);
      }
    } catch (error) {
      console.error('❌ Error processing message:');
      console.error(error);
      await sendWhatsAppMessageRest(senderNumber, req.body.To, 'Sorry, I encountered an error. Please try again in a moment.');
    } finally {
      // ALWAYS stop the typing indicator and unlock the thread
      stopTyping();
      processingThreads.delete(senderNumber);
    }
  } catch (outerError: any) {
    logger.error('❌ WhatsApp Webhook CRASH:', {
      error: outerError.message,
      stack: outerError.stack,
      sender: req.body.From
    });
    // res may not have been sent yet if the crash happened before the early ack
    if (!res.headersSent) {
      res.type('text/xml').send(new MessagingResponse().toString());
    }
    await sendWhatsAppMessageRest(req.body.From, req.body.To, 'Sorry, something went wrong on our end.');
  }
});

// Status callback endpoint to track message delivery
app.post('/whatsapp/status', (req, res) => {
  const messageSid = req.body.MessageSid || req.body.SmsSid;
  const messageStatus = req.body.MessageStatus || req.body.SmsStatus;
  const errorCode = req.body.ErrorCode;
  const errorMessage = req.body.ErrorMessage;
  const channelStatus = req.body.ChannelToStatus;

  if (errorCode) {
    console.error(`❌ Message ${messageSid} status error — ${errorCode}: ${errorMessage}`);
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
      health: '/health',
      enrich: '/webhook/enrich'
    }
  });
});

// Supabase webhook endpoint for instant enrichment
app.post('/webhook/enrich', express.json(), async (req, res) => {
  console.log(`⚡ Received Supabase webhook to enrich business data`);
  // Add a small delay so we know the database row is fully committed before we query it
  setTimeout(() => {
    enrichBusinesses().catch((err: any) => {
      console.error('❌ Webhook enrichment failed:', err);
    });
  }, 1000);

  res.json({ status: 'started' });
});

app.listen(3000, () => {
  console.log('🚀 Express server listening on port 3000');
  console.log('📲 WhatsApp webhook ready at http://localhost:3000/whatsapp');
  console.log('⚡ Webhook enrichment ready at http://localhost:3000/webhook/enrich');
  console.log('📊 Status callback ready at http://localhost:3000/whatsapp/status');
  console.log('🤖 Bridget AI Booking Bot is ready!');

  // Run business enrichment on startup (non-blocking)
  enrichBusinesses().catch((err: any) => {
    console.error('Failed to run startup enrichment:', err);
  });

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
