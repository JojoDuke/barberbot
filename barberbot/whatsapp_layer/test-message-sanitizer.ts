/**
 * Test utility for WhatsApp message sanitization
 * Run with: tsx whatsapp_layer/test-message-sanitizer.ts
 */

const WHATSAPP_MESSAGE_LIMIT = 1600;

function sanitizeWhatsAppMessage(message: string): string {
  if (!message || message.trim().length === 0) {
    return 'Sorry, I encountered an issue. Please try again.';
  }

  // Remove unsupported characters and fix formatting
  let sanitized = message
    // Remove control characters except newlines and tabs
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
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

// Test cases
const testMessages = [
  {
    name: 'Markdown headers',
    input: '## Hello\n### World\nNormal text',
    expected: 'Hello\nWorld\nNormal text'
  },
  {
    name: 'Code blocks',
    input: 'Here is some code:\n```typescript\nconst x = 1;\n```\nEnd',
    expected: 'Here is some code:\n\nEnd'
  },
  {
    name: 'Inline code',
    input: 'Use the `git commit` command',
    expected: 'Use the git commit command'
  },
  {
    name: 'Markdown links',
    input: 'Visit [our website](https://example.com) now',
    expected: 'Visit our website now'
  },
  {
    name: 'Double asterisks',
    input: 'This is **bold** text',
    expected: 'This is *bold* text'
  },
  {
    name: 'Triple asterisks',
    input: 'This is ***bold*** text',
    expected: 'This is *bold* text'
  },
  {
    name: 'Bullet points',
    input: '- Item 1\n- Item 2\n+ Item 3',
    expected: '• Item 1\n• Item 2\n• Item 3'
  },
  {
    name: 'WhatsApp formatting (should preserve)',
    input: 'This is *bold* and this is _italic_',
    expected: 'This is *bold* and this is _italic_'
  },
  {
    name: 'Emojis (should preserve)',
    input: 'Hello 👋 Welcome 🌟',
    expected: 'Hello 👋 Welcome 🌟'
  },
  {
    name: 'Complex booking message',
    input: `*Hi! I'm Bridget, your AI assistant. 👋*

*What type of service are you looking for?*

1️⃣ *Barbershop* - haircuts, styling, beard trims, grooming
2️⃣ *Physiotherapy* - massage, rehabilitation, therapy

Reply with the number or service name.`,
    expected: `*Hi! I'm Bridget, your AI assistant. 👋*

*What type of service are you looking for?*

1️⃣ *Barbershop* - haircuts, styling, beard trims, grooming
2️⃣ *Physiotherapy* - massage, rehabilitation, therapy

Reply with the number or service name.`
  }
];

console.log('🧪 Testing WhatsApp Message Sanitizer\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testMessages.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.name}`);
  console.log('-'.repeat(80));
  console.log('INPUT:');
  console.log(test.input);
  console.log('\nOUTPUT:');
  const output = sanitizeWhatsAppMessage(test.input);
  console.log(output);
  console.log('\nEXPECTED:');
  console.log(test.expected);
  
  const success = output === test.expected;
  if (success) {
    console.log('✅ PASS');
    passed++;
  } else {
    console.log('❌ FAIL');
    console.log('\nDIFF:');
    console.log('Expected length:', test.expected.length);
    console.log('Got length:', output.length);
    failed++;
  }
  console.log('='.repeat(80));
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testMessages.length} tests`);

// Test actual problematic message
console.log('\n\n🔍 Testing potentially problematic message:\n');
const problematicMessage = `Hi! I'm Bridget 👋

What type of service are you looking for?

1️⃣ Barbershop - haircuts, styling, beard trims
2️⃣ Physiotherapy - massage, therapy

Reply with the number.`;

console.log('INPUT:');
console.log(problematicMessage);
console.log('\nOUTPUT:');
const sanitized = sanitizeWhatsAppMessage(problematicMessage);
console.log(sanitized);
console.log('\nLength:', sanitized.length);
console.log('Has control characters:', /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/.test(sanitized));
console.log('Has markdown headers:', /^#{1,6}\s+/m.test(sanitized));
console.log('Has code blocks:', /```/.test(sanitized));

