import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';
import { getBusinessesByCategory } from '../../../config/businesses';

export const getAllBusinessesServicesTool = createTool({
  id: 'get-all-businesses-services',
  description: 'Get all businesses in a category with their services. Use this when user asks about barbershops or physiotherapy in general.',
  inputSchema: z.object({
    category: z.enum(['barbershop', 'physiotherapy']).describe('The business category'),
  }),
  outputSchema: z.object({
    businesses: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
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
    const categoryBusinesses = getBusinessesByCategory(context.category);
    
    const businessesWithServices = await Promise.all(
      categoryBusinesses.map(async (business) => {
        try {
          const response: any = await reservioClient.getServices(business.id);
          const services = response.data.map((service: any) => ({
            id: service.id,
            name: service.attributes.name,
            durationMinutes: Math.round(service.attributes.duration / 60),
            cost: service.attributes.cost,
          }));

          return {
            id: business.id,
            name: business.name,
            services,
          };
        } catch (error) {
          console.error(`Error fetching services for ${business.name}:`, error);
          return {
            id: business.id,
            name: business.name,
            services: [],
          };
        }
      })
    );

    return { businesses: businessesWithServices };
  },
});

