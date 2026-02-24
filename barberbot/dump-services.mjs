
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const LTT = process.env.RESERVANTO_LTT;
const BASE = 'https://api.reservanto.cz/v1';

async function post(endpoint, body, STT = null) {
    const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (STT) h['Authorization'] = STT;
    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ ...body, TimeStamp: Math.floor(Date.now() / 1000) })
    });
    return res.json();
}

async function dump() {
    const auth = await post('/Authorize/GetShortTimeToken', { LongTimeToken: LTT });
    const STT = auth.ShortTimeToken;
    if (!STT) return console.error('Auth failed');

    const data = {
        merchant: await post('/Merchant/GetInfo', {}, STT),
        locations: await post('/Location/GetList', { OnlyPublic: false }, STT),
        resources: await post('/BookingResource/GetList', { OnlyPublic: false }, STT),
        services: await post('/BookingService/GetList', {}, STT)
    };

    fs.writeFileSync('reservanto-dump.json', JSON.stringify(data, null, 2));
    console.log('Results saved to reservanto-dump.json');

    if (data.services.Items) {
        console.log(`Found ${data.services.Items.length} services`);
        data.services.Items.forEach(s => console.log(`- ${s.Name} (${s.Price} ${s.Currency})`));
    } else {
        console.log('No services found in Items array');
    }
}

dump();
