
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

async function runCheck() {
    console.log(`Checking LTT: ${LTT}`);
    const authResp = await post('/Authorize/GetShortTimeToken', { LongTimeToken: LTT });
    const STT = authResp.data?.ShortTimeToken;

    if (!STT) {
        console.error('Auth failed');
        return;
    }

    const check = async (name, ep, body = {}) => {
        const r = await post(ep, body, STT);
        console.log(`[${name}] Status: ${r.status}`);
        return { status: r.status, isError: r.data?.IsError, errMsg: r.data?.ErrorMessage, count: r.data?.Items?.length || (r.data?.Result ? 1 : 0) };
    };

    const results = {
        merchant: await check('Merchant', '/Merchant/GetInfo'),
        locations: await check('Locations', '/Location/GetList', { OnlyPublic: false }),
        services: await check('Services', '/BookingService/GetList'),
        resources: await check('Resources', '/BookingResource/GetList', { OnlyPublic: false }),
        customers: await check('Customers', '/Customer/GetList'),
        bookings: await check('Bookings', '/Booking/GetBookingsForPeriod', {
            From: Math.floor(Date.now() / 1000) - 86400,
            To: Math.floor(Date.now() / 1000) + 86400
        }),
        availability: await check('Availability', '/OneToOne/GetAvailableStarts', {
            BookingResourceId: 0, // Just a probe, specific ID doesn't matter for 403 check
            BookingServiceId: 0,
            IntervalStart: Math.floor(Date.now() / 1000),
            IntervalEnd: Math.floor(Date.now() / 1000) + 3600
        })
    };

    fs.writeFileSync('current-status.json', JSON.stringify(results, null, 2));
    console.log('\nFinal Status:');
    console.table(results);
}

runCheck();
