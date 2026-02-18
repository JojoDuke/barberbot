
// Test the LTT → STT exchange and then call Merchant/GetInfo
const LTT = '7fa41740-f383-415d-b8a1-42c6ee5e1de0';
const BASE = 'https://api.reservanto.cz/v1';

async function post(endpoint, body, stt = null) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (stt) headers['ShortTimeToken'] = stt;

    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, TimeStamp: Math.floor(Date.now() / 1000) })
    });

    const text = await res.text();
    console.log(`\n=== POST ${endpoint} [${res.status}] ===`);
    try {
        return JSON.parse(text);
    } catch {
        console.log(text.slice(0, 800));
        return null;
    }
}

// Step 1: Exchange LTT for STT
console.log('Step 1: Getting ShortTimeToken...');
const authResp = await post('/Authorize/GetShortTimeToken', { LongTimeToken: LTT });
console.log(JSON.stringify(authResp, null, 2));

if (authResp?.IsError || !authResp?.ShortTimeToken) {
    console.log('\n❌ Failed to get STT. Token may be invalid or expired.');
    process.exit(1);
}

const STT = authResp.ShortTimeToken;
console.log(`\n✅ Got STT: ${STT.slice(0, 20)}...`);

// Step 2: Get merchant info
console.log('\nStep 2: Getting Merchant Info...');
const merchantInfo = await post('/Merchant/GetInfo', {}, STT);
console.log(JSON.stringify(merchantInfo, null, 2));

// Step 3: Get booking resources (employees/barbers)
console.log('\nStep 3: Getting Booking Resources (employees/chairs)...');
const resources = await post('/BookingResource/GetList', {}, STT);
console.log(JSON.stringify(resources, null, 2).slice(0, 3000));

// Step 4: Get booking services
console.log('\nStep 4: Getting Booking Services...');
const services = await post('/BookingService/GetList', {}, STT);
console.log(JSON.stringify(services, null, 2).slice(0, 3000));

// Step 5: Get locations
console.log('\nStep 5: Getting Locations...');
const locations = await post('/Location/GetList', {}, STT);
console.log(JSON.stringify(locations, null, 2).slice(0, 3000));

console.log('\n✅ Done!');
