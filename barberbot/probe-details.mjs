
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

    // 2. Fetch Locations
    console.log('Fetching locations...');
    const locResp = await post('/Location/GetList', { OnlyPublic: false }, STT);
    console.log('Location status:', locResp.status);
    if (locResp.data && locResp.data.Items) {
        console.log('Locations:', JSON.stringify(locResp.data.Items, null, 2));
    }

    // 3. Try to fetch services (this failed with 403 before)
    console.log('Fetching services...');
    const servResp = await post('/BookingService/GetList', {}, STT);
    console.log('Service status:', servResp.status);
    if (servResp.status === 403) {
        console.log('Service access STILL DENIED');
    }

    // 4. Try to fetch resources (this failed with 403 before)
    console.log('Fetching resources...');
    const resResp = await post('/BookingResource/GetList', { OnlyPublic: false }, STT);
    console.log('Resource status:', resResp.status);

    process.stdout.write('DONE\n');
}

runTest();
