import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';
import { businesses, getBusinessById } from '../../../config/businesses';

export const getReservantoBusinessInfoTool = createTool({
    id: 'get-reservanto-business-info',
    description: 'Get information about a Reservanto business including name, contact info, and address',
    inputSchema: z.object({
        businessId: z.string().describe('The Reservanto business ID'),
    }),
    outputSchema: z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        website: z.string().optional(),
        instagram: z.string().optional(),
        address: z.string().optional(),
        googleRating: z.number().optional(),
    }),
    execute: async ({ context }) => {
        const client = await getReservantoClient(context.businessId);
        const response: any = await client.getMerchantInfo();
        const merchant = response.Result || {};
        const configBusiness = await getBusinessById(context.businessId);

        return {
            name: merchant.Name || configBusiness?.name || 'Podrazil Cosmetics',
            email: merchant.ContactEmail || '',
            phone: merchant.ContactPhone || '',
            website: merchant.Web || configBusiness?.website,
            instagram: configBusiness?.instagram,
            address: configBusiness?.address,
            googleRating: configBusiness?.googleRating,
        };
    },
});
