
import fs from 'fs';

const LTT = '7fa41740-f383-415d-b8a1-42c6ee5e1de0';
const BASE = 'https://api.reservanto.cz/v1';

// Based on 403 vs 401 test - Authorization: STT is the RIGHT format
// 403 = authenticated but wrong permissions (vs 401 = not authenticated)
async function post(endpoint, body) {
    const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ ...body, TimeStamp: Math.floor(Date.now() / 1000) })
    });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch { return { status: res.status, raw: text.slice(0, 500) }; }
}

async function postAuth(endpoint, body, STT) {
    const h = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': STT  // This gave 403 (permission denied) not 401 (not authed)
    };
    const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ ...body, TimeStamp: Math.floor(Date.now() / 1000) })
    });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch { return { status: res.status, raw: text.slice(0, 500) }; }
}

// Get STT
const authResp = await post('/Authorize/GetShortTimeToken', { LongTimeToken: LTT });
const STT = authResp.data?.ShortTimeToken;

const out = {
    stt_obtained: !!STT,
    endpoints: {}
};

// Test all key endpoints with Authorization: STT
const endpoints = [
    ['/Merchant/GetInfo', {}],
    ['/Location/GetList', { OnlyPublic: false }],
    ['/BookingResource/GetList', { OnlyPublic: false }],
    ['/BookingService/GetList', {}],
    ['/WorkingHours/GetList', {}],
];

for (const [ep, body] of endpoints) {
    const r = await postAuth(ep, body, STT);
    out.endpoints[ep] = {
        status: r.status,
        isError: r.data?.IsError,
        errMsg: r.data?.ErrorMessage,
        itemsCount: r.data?.Items?.length,
        result: r.data?.Result,
        raw: r.raw
    };
}

fs.writeFileSync('reservanto-results.json', JSON.stringify(out, null, 2), 'utf8');
process.stdout.write('DONE\n');
