
import { ReservantoClient } from './src/mastra/tools/reservanto/reservanto-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function probe() {
  const ltt = '372db91f-2712-491f-89ab-5870b6212e99';
  const client = new ReservantoClient(ltt);
  
  console.log('\n--- ALL LOCATIONS ---');
  const locs = await client.getLocations();
  console.log(JSON.stringify(locs.Items.map(l => ({ id: l.Id, name: l.Name })), null, 2));

  console.log('\n--- ALL SERVICES ---');
  const svcs = await client.getServices();
  const serviceList = svcs.Items || (svcs as any).BookingServices || [];
  console.log(JSON.stringify(serviceList.map(s => ({ id: s.Id || s.BookingServiceId, name: s.Name, resources: s.BookingResourceIds })), null, 2));

  console.log('\n--- ALL RESOURCES ---');
  const res = await client.getBookingResources();
  console.log(JSON.stringify(res.Items.map(r => ({ id: r.Id, name: r.Name, services: r.BookingServiceIds, loc: r.LocationId })), null, 2));
}

probe().catch(err => {
  console.error('Fatal probe error:', err.message);
  process.exit(1);
});
