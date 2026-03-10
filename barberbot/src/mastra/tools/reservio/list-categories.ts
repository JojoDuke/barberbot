import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getAllCategories } from '../../../config/businesses';

export const listCategoriesTool = createTool({
    id: 'listCategories',
    description: 'List all unique business categories available in the system (e.g., barbershop, cosmetics, massage)',
    inputSchema: z.object({}),
    outputSchema: z.object({
        categories: z.array(z.string()),
    }),
    execute: async () => {
        const categories = await getAllCategories();
        return { categories };
    },
});
