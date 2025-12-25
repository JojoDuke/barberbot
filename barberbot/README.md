# Bridget AI Booking Bot 🤖

Bridget is an AI-powered WhatsApp booking assistant that manages appointments for multiple businesses using Mastra AI framework and Reservio API.

## Features

- 📱 **WhatsApp Integration** - Book appointments via WhatsApp messaging
- 🌍 **Bilingual Support** - Automatically detects and responds in Czech or English
- 🏪 **Multi-Business** - Manages 2 barbershops and 1 physiotherapy clinic
- 🔄 **Cross-Shop Availability** - Suggests alternative locations when slots are unavailable
- 🧠 **Conversational AI** - Natural language date/time parsing and intent detection
- 💾 **Memory** - Remembers customer information and conversation context

## Supported Businesses

### Barbershops 💈
- **Rico Studio** (Default)
- **Holičství 21**

### Physiotherapy 💆
- **Anatomic Fitness**

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the `barberbot` directory:

```env
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Reservio API Tokens (Required)
RESERVIO_TOKEN_RICO_STUDIO=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjVmNWJlODc5MzkwYTI0ZjgxOTNhZGFmYmE5MTk2ZjNhMTM5Nzk3YTg3ODI5YWQ5ODI2NzJhZWJmNDU4YTliNDBlOThmMzE0OTZlOTZiMTExIn0...

RESERVIO_TOKEN_HOLICSTVI_21=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImIyYTYzMmM0YWE1ZDRkMzhjMjZhMjkwYTg1YjFlNjIxN2U4OTMwM2U5OTMwODNiMDI1MWJiMTlkMmQxNTQxOTNjZmFhNmM5NGUwZjgzM2Q5In0...

RESERVIO_TOKEN_ANATOMIC_FITNESS=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjUwNDA5ZGZiMjQ0MTA0YjAwZjIzZjFmNTFlZDJlMjhlNjFlNTA3NmZkZTg4MWVkNzc5MjE2ZTBmMjVlMTJkYTMzNzY4NGRjNzU0NDk4OTQ4In0...

# Twilio Credentials (Optional - for typing indicators)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

### 3. Start the Server

**Development (with auto-restart on file changes):**
```bash
pnpm whatsapp:watch
```

**Production:**
```bash
pnpm whatsapp
```

The server will start on port 3000 and display:
- ✅ Configuration status (API keys, tokens)
- 📲 Webhook URL

💡 **Tip:** Use `whatsapp:watch` during development - it automatically restarts when you change any code files!

### 4. Expose to Internet (for Twilio)

Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok-free.app`)

### 5. Configure Twilio WhatsApp Sandbox

1. Go to [Twilio WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Set the webhook URL: `https://your-ngrok-url/whatsapp`
3. Join the sandbox by sending the code to the Twilio WhatsApp number

## How Bridget Works

### Booking Flow

1. **Greeting** - Detects intent or presents category menu
2. **Category Selection** - Barbershop or Physiotherapy
3. **Service Selection** - Lists available services
4. **Date Selection** - Natural language date parsing
5. **Availability Check** - Shows available time slots
6. **Cross-Shop Check** - Suggests alternatives if needed
7. **Time Selection** - Customer picks a slot
8. **Contact Info** - Collects name, email, phone
9. **Confirmation** - Reviews and confirms booking
10. **Booking Creation** - Creates appointment in Reservio

### Smart Features

- **Intent Detection**: "I need a haircut" → automatically selects barbershop
- **Time Preferences**: "tomorrow afternoon" → filters slots for 12pm-5pm
- **Cross-Shop Availability**: No slots at Rico Studio? Check Holičství 21 automatically
- **Natural Language**: Understands "tomorrow", "next Monday", "7th December", etc.
- **WhatsApp Formatting**: Uses *bold* and emojis for mobile-friendly messages
- **Typing Indicators**: Shows "..." while Bridget is thinking (requires Twilio credentials)

## Architecture

```
WhatsApp → Twilio Webhook → Express Server → Bridget Agent
                                                    ↓
                              Mastra AI Framework (Memory + Tools)
                                                    ↓
                              Reservio API (3 businesses)
```

### Tools

- `get-business-info` - Fetch business details
- `get-services` - List available services
- `get-availability` - Check time slots
- `create-booking` - Create appointments

## Development

### Project Structure

```
barberbot/
├── src/
│   ├── config/
│   │   └── businesses.ts          # Business configuration
│   └── mastra/
│       ├── agents/
│       │   └── bridget-agent.ts   # Main booking agent
│       └── tools/
│           └── reservio/
│               ├── client.ts       # API client
│               ├── get-business.ts
│               ├── get-services.ts
│               ├── get-availability.ts
│               └── create-booking.ts
└── whatsapp_layer/
    └── sendWhatsappMessage.ts     # WhatsApp webhook handler
```

### Testing

Send messages to the WhatsApp number:
- "Hi" - Start conversation
- "I need a haircut" - Direct intent
- "Tomorrow at 2pm" - Natural language

Watch the console for detailed logs showing the conversation flow.

## Troubleshooting

### No Response from Bot
- Check ngrok is running and URL is correct in Twilio
- Verify all environment variables are set
- Check console logs for errors

### Empty Responses
- Ensure OPENAI_API_KEY is set correctly
- Check for API quota/rate limits

### Booking Fails
- Verify Reservio tokens are valid
- Check business IDs are correct
- Ensure time slot is still available

### API Errors
- Check Reservio API status
- Verify bearer token format in headers
- Review console logs for detailed error messages

## License

ISC

