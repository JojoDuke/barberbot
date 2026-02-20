
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const LTT = process.env.RESERVANTO_LTT;
const BASE = 'https://api.reservanto.cz/v1';

async function post(endpoint, body, STT = null) {
    const h = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    if (STT) {
        h['Authorization'] = STT;
    }

    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ ...body, TimeStamp: Math.floor(Date.now() / 1000) })
    });

    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, raw: text };
    }
}

async function runTest() {
    console.log(`Using LTT: ${LTT}`);

    // 1. Get STT
    const authResp = await post('/Authorize/GetShortTimeToken', { LongTimeToken: LTT });
    const STT = authResp.data?.ShortTimeToken;

    if (!STT) {
        console.error('Failed to get STT:', authResp);
        return;
    }
    console.log('Got STT');

    const results = {};

    // 2. Try Customers
    console.log('Fetching customers...');
    const custResp = await post('/Customer/GetList', {}, STT);
    results.customers = custResp;

    // 3. Try Bookings
    console.log('Fetching bookings...');
    // Requesting for a range (e.g., last 30 days to next 30 days)
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const bookResp = await post('/Booking/GetBookingsForPeriod', {
        From: Math.floor(from.getTime() / 1000),
        To: Math.floor(to.getTime() / 1000)
    }, STT);
    results.bookings = bookResp;

    fs.writeFileSync('probe-results.json', JSON.stringify(results, null, 2));
    console.log('Done. Results saved to probe-results.json');
}

runTest();
