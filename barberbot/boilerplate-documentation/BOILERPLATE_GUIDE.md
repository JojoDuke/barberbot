# WhatsApp AI Agent Blueprint: The "BarberBot" Boilerplate

This document outlines the architecture, logic, and implementation details of the WhatsApp AI Booking Agent. Use this as a guide to replicate the system for new clients ("WhatsApp AI Agent for X").

## 🏗️ Architecture Overview

The system is built on a modern, event-driven stack designed for high reliability and clean AI interactions.

1.  **Runtime**: Node.js with TypeScript (`tsx`).
2.  **AI Orchestration**: [Mastra](https://mastra.ai/) (Agents, Tools, Memory).
3.  **Communication**: [Twilio WhatsApp API](https://www.twilio.com/whatsapp).
4.  **Database & Auth**: [Supabase](https://supabase.com/) (Stores business data, user records).
5.  **Logic Layer**: Express.js (Webhook handling).

---

## 📱 The WhatsApp Layer (`whatsapp_layer/`)

WhatsApp is restrictive about message formatting. Our implementation handles these limitations through a robust "Sanitization & Delivery" pipeline.

### 1. Message Sanitization
WhatsApp via Twilio rejects messages with standard Markdown (like `**bold**`, `# Headers`, or `` `code` ``).
- **Solution**: A `sanitizeWhatsAppMessage` function in `sendWhatsappMessage.ts` converts Markdown to WhatsApp's specific format:
    - `**` -> `*` (Bold)
    - `__` -> `_` (Italics)
    - Removes Headers, Links, and Code Blocks to prevent delivery failure ($63005$).

### 2. Typing Indicators
To feel "human," the bot sends a typing indicator immediately upon receiving a message.
- **Implementation**: Uses a non-blocking `fetch` call to Twilio's `Typing.json` endpoint.

### 3. Sequencing & Split Messages
Standard TwiML responses can only send ONE message. For long "Welcome" flows with multiple images/texts, we use a "Split Message" system.
- **Logic**: The AI can emit `[SPLIT_MESSAGE]` tags.
- **Delivery**: The Express server detects these tags and switches from TwiML to the **Twilio REST API** to send a sequence of messages with intentional delays (1-4 seconds).

---

## 🧠 The AI Brain (`src/mastra/`)

The agent ("Bridget") is the core coordinator.

### 1. Multi-Platform Routing
The agent is designed to handle different backend booking systems (Reservio vs. Reservanto).
- **Rule**: Every business in the database is tagged with a `platform`.
- **Logic**: The agent's instructions (Prompt Engineering) strictly enforce that it *must* check the platform before picking which tool to use. It NEVER mixes "Reservio" tools with "Reservanto" data.

### 2. Tooling
Tools are modular TypeScript functions wrapped by Mastra.
- **Dynamic Discovery**: Instead of hardcoding services, the agent calls `listCategories` and `getAllBusinessesServices` at runtime. This allows adding new businesses to the database without updating the AI code.

### 3. Memory & Threading
- **Identities**: Each user's phone number is used as their `resourceId`.
- **Threading**: A unique `threadId` is generated per phone number (`booking-123456789`) to maintain conversation history across multiple WhatsApp messages.

---

## 🛡️ Reliability & The "Shield" Mechanism

WhatsApp bots can be buggy if the user triple-messages or if the AI tries to call the same tool twice.

1.  **Processing Lock**: `processingThreads` (a `Set`) prevents the server from processing two messages from the same user simultaneously.
2.  **History Deduplication**: Our "Shield" logic pre-cleans the Mastra message history before calling the agent. It removes any duplicate tool calls or interrupted streams to prevent "Duplicate tool ID" crashes.
3.  **Reset Command**: Users can type `!clear` or `!reset` to delete their conversation thread and start fresh.

---

## 📋 Boilerplate Setup Checklist (For New Projects)

When starting a new "WhatsApp AI for X" project, follow these steps:

1.  **Clone Structure**: Copy `whatsapp_layer`, `src/mastra`, and `package.json`.
2.  **Database**:
    - Setup Supabase with `businesses` and `users` tables.
    - Run `pnpm seed:businesses` to populate the initial data.
3.  **Twilio**:
    - Get a WhatsApp Sandbox or Production number.
    - Set the Webhook URL to `https://your-server.com/whatsapp`.
    - Set the Status Callback to `https://your-server.com/whatsapp/status`.
4.  **Environment Variables**:
    - `OPENAI_API_KEY`: For the brain.
    - `TWILIO_ACCOUNT_SID/AUTH_TOKEN`: For delivery/typing.
    - `BASE_URL`: Public URL of your server (used for serving images).
5.  **Agent Customization**:
    - Update the `instructions` in `bridget-agent.ts` to reflect the new client's brand voice and specific booking rules.

---

## 🏮 Key Files to Remember

- `whatsapp_layer/sendWhatsappMessage.ts`: The "Postman" (Messaging logic).
- `src/mastra/agents/bridget-agent.ts`: The "Brain" (AI rules).
- `src/mastra/tools/`: The "Hands" (API integrations).
- `src/lib/supabase.ts`: The "Library" (Business data).
