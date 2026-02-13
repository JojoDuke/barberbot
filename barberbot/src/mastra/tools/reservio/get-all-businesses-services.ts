import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';
import { getBusinessesByCategory } from '../../../config/businesses';

export const getAllBusinessesServicesTool = createTool({
  id: 'get-all-businesses-services',
  description: 'Get all businesses in a category with their services. Use this when user asks about barbershops or physiotherapy in general.',
  inputSchema: z.object({
    category: z.enum(['barbershop', 'physiotherapy']).describe('The business category'),
    minRating: z.number().optional().describe('Minimum Google rating to filter businesses'),
  }),
  outputSchema: z.object({
    businesses: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        address: z.string().optional(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        googleRating: z.number().optional(),
        imageUrl: z.string().optional(),
        services: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            durationMinutes: z.number(),
            cost: z.number(),
          })
        ),
      })
    ),
  }),
  execute: async ({ context }) => {
    let categoryBusinesses = getBusinessesByCategory(context.category);

    if (context.minRating) {
      categoryBusinesses = categoryBusinesses.filter(
        (b) => (b.googleRating ?? 0) >= context.minRating!
      );
    }

    const businessesWithServices = await Promise.all(
      categoryBusinesses.map(async (business) => {
        try {
          const [servicesResponse, businessResponse]: [any, any] = await Promise.all([
            reservioClient.getServices(business.id),
            reservioClient.getBusiness(business.id),
          ]);

          const services = servicesResponse.data.map((service: any) => ({
            id: service.id,
            name: service.attributes.name,
            durationMinutes: Math.round(service.attributes.duration / 60),
            cost: service.attributes.cost,
          }));

          const address = businessResponse.data.attributes.street || '';

          return {
            id: business.id,
            name: business.name,
            address,
            website: business.website,
            instagram: business.instagram,
            googleRating: business.googleRating,
            imageUrl: business.imageUrl,
            services,
          };
        } catch (error) {
          console.error(`Error fetching data for ${business.name}:`, error);
          return {
            id: business.id,
            name: business.name,
            address: '',
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

