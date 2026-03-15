# Twilio WhatsApp Setup Guide

## Setting Up Status Callbacks

To receive delivery status updates and error notifications from Twilio, you need to configure the status callback URL.

### Step 1: Get Your Server URL

Your server must be publicly accessible. If testing locally, use ngrok:

```bash
ngrok http 3000
```

This will give you a URL like: `https://abc123.ngrok.io`

### Step 2: Configure Twilio Webhook

1. Go to [Twilio Console - WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. In the **Sandbox Configuration** section:
   - **When a message comes in**: Set to `https://your-domain.com/whatsapp` (POST)
   - **Status callback URL**: Set to `https://your-domain.com/whatsapp/status` (POST)

3. Click **Save**

### Step 3: Test the Setup

Send a message to your WhatsApp bot. You should see:
- Incoming message logs in your console
- Agent response logs
- Status updates for message delivery

### Webhook Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/whatsapp` | POST | Receives incoming WhatsApp messages |
| `/whatsapp/status` | POST | Receives message delivery status updates |
| `/health` | GET | Health check endpoint |
| `/` | GET | Service info endpoint |

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| 63005 | Message content not accepted by WhatsApp | Check message formatting (no markdown headers, code blocks, or unsupported characters) |
| 63007 | Invalid WhatsApp message format | Ensure message uses only WhatsApp-supported formatting (*bold*, _italic_) |
| 30008 | Unknown error | Check Twilio logs for details |
| 63016 | Message queue overflow | Rate limiting - slow down message sending |

### Debugging Tips

1. **Check server logs**: All incoming/outgoing messages are logged with separators
2. **View Twilio logs**: Go to [Twilio Console - Logs](https://console.twilio.com/us1/monitor/logs/errors)
3. **Test TwiML**: Use [Twilio TwiML Bins](https://www.twilio.com/console/runtime/twiml-bins) to test responses
4. **Verify formatting**: The sanitizer removes markdown headers, code blocks, and unsupported characters

### Message Formatting Rules for WhatsApp

✅ **Supported:**
- `*bold text*` - Bold
- `_italic text_` - Italic
- `~strikethrough~` - Strikethrough
- Emojis: 🌟 ✅ 📅
- Bullet points: •
- Plain text

❌ **Not Supported:**
- `**bold**` or `***bold***` - Markdown formatting
- `# Header` - Markdown headers
- `` `code` `` - Code formatting
- ` ```code block``` ` - Code blocks
- `[link](url)` - Markdown links
- Special unicode control characters

### Environment Variables

Required:
```env
OPENAI_API_KEY=your-openai-key
RESERVIO_TOKEN_RICO_STUDIO=your-token
RESERVIO_TOKEN_HOLICSTVI_21=your-token
RESERVIO_TOKEN_ANATOMIC_FITNESS=your-token
```

Optional (for typing indicators):
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
```

### Testing Locally

1. Start your server:
   ```bash
   pnpm whatsapp
   # or
   pnpm whatsapp:watch
   ```

2. Start ngrok:
   ```bash
   ngrok http 3000
   ```

3. Update Twilio webhook URLs with your ngrok URL

4. Send test messages to your WhatsApp bot

### Production Deployment

When deploying to production (Railway, Heroku, etc.):

1. Use your production domain in Twilio webhook settings
2. Ensure all environment variables are set
3. Enable HTTPS (required by Twilio)
4. Monitor the `/whatsapp/status` endpoint for delivery issues

### Support

If you encounter issues:
1. Check the server console logs for detailed error messages
2. Review Twilio's error logs
3. Verify your webhook URLs are publicly accessible
4. Test with simple messages first before complex formatting

