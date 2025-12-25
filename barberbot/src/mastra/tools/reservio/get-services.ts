import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { reservioClient } from './client';

export const getServicesTool = createTool({
  id: 'get-services',
  description: 'Get list of available services for a business with name, description, duration, and price',
  inputSchema: z.object({
    businessId: z.string().describe('The Reservio business ID'),
  }),
  outputSchema: z.object({
    services: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        durationMinutes: z.number(),
        cost: z.number(),
      })
    ),
  }),
  execute: async ({ context }) => {
    const response: any = await reservioClient.getServices(context.businessId);
    
    const services = response.data.map((service: any) => ({
      id: service.id,
      name: service.attributes.name,
      description: service.attributes.description || undefined,
      durationMinutes: Math.round(service.attributes.duration / 60), // Convert seconds to minutes
      cost: service.attributes.cost,
    }));

    return { services };
  },
});

