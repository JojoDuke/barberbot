import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getReservantoClient } from './client';

export const getReservantoBusinessInfoTool = createTool({
    id: 'get-reservanto-business-info',
    description: 'Get information about a Reservanto business including name, contact info, and address',
    inputSchema: z.object({}),
    outputSchema: z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string(),
        website: z.string().optional(),
        address: z.object({
            street: z.string(),
            city: z.string(),
            zipCode: z.string(),
            country: z.string(),
        }),
    }),
    execute: async () => {
        const client = getReservantoClient();
        const response = await client.getMerchantInfo();
        const merchant = response.Result;

        return {
            name: merchant.Name,
            email: merchant.ContactEmail,
            phone: merchant.ContactPhone,
            website: merchant.Web,
            address: {
                street: merchant.MailingAddress.Street,
                city: merchant.MailingAddress.City,
                zipCode: merchant.MailingAddress.ZipCode,
                country: merchant.MailingAddress.Country,
            },
        };
    },
});
