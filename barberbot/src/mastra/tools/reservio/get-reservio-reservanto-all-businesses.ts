import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './reservio-client';
import { getReservantoClient } from '../reservanto/reservanto-client';
import { getBusinessesByCategory } from '../../../config/businesses';

export const getAllBusinessesServicesTool = createTool({
  id: 'get-all-businesses-services',
  description: 'Get all businesses in a category with their services. Use this when user asks about barbershops, physiotherapy, or cosmetics in general.',
  inputSchema: z.object({
    category: z.string().describe('The business category (e.g. barbershop, massage, etc.)'),
    minRating: z.number().nullish().describe('Minimum Google rating to filter businesses'),
  }),
  outputSchema: z.object({
    businesses: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        platform: z.enum(['reservio', 'reservanto']).describe('CRITICAL: The booking platform this business uses. MUST use matching tools.'),
        address: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        googleRating: z.number().optional(),
        services: z.array(
          z.object({
            id: z.string().or(z.number()),
            name: z.string(),
            durationMinutes: z.number(),
            cost: z.number(),
          })
        ),
      })
    ),
  }),
  execute: async ({ context }) => {
    let categoryBusinesses = await getBusinessesByCategory(context.category as any);

    if (context.minRating) {
      categoryBusinesses = categoryBusinesses.filter(
        (b) => (b.googleRating ?? 0) >= context.minRating!
      );
    }

    const businessesWithServices = await Promise.all(
      categoryBusinesses.map(async (business) => {
        try {
          if (business.platform === 'reservanto') {
            const client = await getReservantoClient(business.id);
            const [servicesResponse, merchantResponse]: [any, any] = await Promise.all([
              client.getServices(),
              client.getMerchantInfo(),
            ]);

            const serviceList = servicesResponse.BookingServices || servicesResponse.Items || [];

            const services = serviceList.map((s: any) => ({
              id: s.Id || s.BookingServiceId,
              name: s.Name,
              durationMinutes: s.Duration,
              cost: s.Price || 0,
            }));

            // Prioritize address from our DB (enriched via Google Places)
            let address = business.address;

            // Fallback to Reservanto Merchant info if missing in our DB
            if (!address) {
              const merchant = merchantResponse.Result || {};
              address = merchant.MailingAddress
                ? `${merchant.MailingAddress.Street}, ${merchant.MailingAddress.City}`
                : undefined;
            }

            return {
              id: business.id,
              name: business.name,
              platform: 'reservanto' as const,
              address,
              website: business.website,
              instagram: business.instagram,
              googleRating: business.googleRating,
              services,
            };
          } else {
            // Reservio
            const [servicesResponse, businessResponse]: [any, any] = await Promise.all([
              reservioClient.getServices(business.id),
              reservioClient.getBusiness(business.id),
            ]);

            const services = (servicesResponse.data || []).map((service: any) => ({
              id: service.id,
              name: service.attributes.name,
              durationMinutes: Math.round(service.attributes.duration / 60),
              cost: service.attributes.cost,
            }));

            // Prioritize address from our DB (enriched via Google Places)
            let address = business.address;

            // Fallback to Reservio API if missing in our DB
            if (!address) {
              const street = businessResponse.data?.attributes?.street || '';
              const city = businessResponse.data?.attributes?.city || '';
              address = [street, city].filter(Boolean).join(', ');
            }

            return {
              id: business.id,
              name: business.name,
              platform: 'reservio' as const,
              address,
              website: business.website,
              instagram: business.instagram,
              googleRating: business.googleRating,
              services,
            };
          }
        } catch (error) {
          console.error(`Error fetching data for ${business.name}:`, error);
          return {
            id: business.id,
            name: business.name,
            platform: business.platform,
            address: business.address || '',
            website: business.website,
            instagram: business.instagram,
            googleRating: business.googleRating,
            services: [],
          };
        }
      })
    );

    return { businesses: businessesWithServices };
  },
});

