import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';
import { getBusinessById } from '../../../config/businesses';

export const getBusinessInfoTool = createTool({
  id: 'get-business-info',
  description: 'Get information about a business including name, address, phone, and timezone',
  inputSchema: z.object({
    businessId: z.string().describe('The Reservio business ID'),
  }),
  outputSchema: z.object({
    name: z.string(),
    address: z.string(),
    city: z.string(),
    country: z.string(),
    phone: z.string(),
    timezone: z.string(),
    website: z.string().optional(),
    instagram: z.string().optional(),
    googleRating: z.number().optional(),
  }),
  execute: async ({ context }) => {
    const response: any = await reservioClient.getBusiness(context.businessId);
    const business = response.data;
    const configBusiness = await getBusinessById(context.businessId);

    return {
      name: business.attributes.name,
      address: business.attributes.street || '',
      city: business.attributes.city || '',
      country: business.attributes.country || '',
      phone: business.attributes.phone || '',
      timezone: business.attributes.settings.timezone,
      website: configBusiness?.website,
      instagram: configBusiness?.instagram,
      googleRating: configBusiness?.googleRating,
    };
  },
});

