import { supabase } from '../lib/supabase.js';

export interface Business {
  id: string;
  name: string;
  category: string;
  isDefault?: boolean;
  tokenEnvVar: string;
  platform: 'reservio' | 'reservanto';
  googleRating?: number;
  website?: string;
  instagram?: string;
  address?: string;
  placeId?: string;
}

export const staticBusinesses: Record<string, Business> = {
  ricoStudio: {
    id: 'ef525423-dabf-4750-bf11-dc5182d68695',
    name: 'Rico Studio',
    category: 'barbershop',
    isDefault: true,
    platform: 'reservio',
    tokenEnvVar: 'RESERVIO_TOKEN_RICO_STUDIO',
    googleRating: 4.8,
    website: 'https://www.ricostudio.cz',
    instagram: 'ricostudio_prague',
  },
  holicstvi21: {
    id: 'd709a085-8c00-4bea-af6c-438e5741521a',
    name: 'Holičství 21',
    category: 'barbershop',
    isDefault: false,
    platform: 'reservio',
    tokenEnvVar: 'RESERVIO_TOKEN_HOLICSTVI_21',
    googleRating: 5.0,
    website: 'https://holicstvi21.cz',
    instagram: 'holicstvi21',
  },
  anatomicFitness: {
    id: 'fc376586-8906-4c0a-8cd3-be382a3c4a89',
    name: 'Anatomic Fitness',
    category: 'physiotherapy',
    isDefault: false,
    platform: 'reservio',
    tokenEnvVar: 'RESERVIO_TOKEN_ANATOMIC_FITNESS',
    googleRating: 4.7,
    website: 'https://www.anatomicfitness.cz',
    instagram: 'anatomicfitness',
  },
  licirnaOrganics: {
    id: 'e1c1ad9a-ba52-45eb-a8f8-757a9198c284',
    name: 'Líčírna Organics',
    category: 'cosmetics',
    isDefault: false,
    platform: 'reservanto',
    tokenEnvVar: 'RESERVANTO_LTT_LICIRNA',
    googleRating: 4.9,
    website: 'https://www.licirna.cz',
    instagram: 'licirna____organics',
  },
};

// Backwards compatibility
export const businesses = staticBusinesses;

export const getAllBusinesses = async (): Promise<Business[]> => {
  try {
    const { data, error } = await supabase.from('businesses').select('*');

    if (error || !data || data.length === 0) {
      console.warn('⚠️ Could not fetch businesses from Supabase, using static fallback');
      return Object.values(staticBusinesses);
    }

    return data.map(b => ({
      id: b.id,
      name: b.name,
      category: b.category,
      isDefault: b.is_default,
      platform: b.platform || 'reservio',
      tokenEnvVar: b.token_env_var,
      googleRating: b.google_rating,
      website: b.website,
      instagram: b.instagram,
      address: b.address,
      placeId: b.place_id,
    }));
  } catch (err) {
    return Object.values(staticBusinesses);
  }
};

export const getAllCategories = async (): Promise<string[]> => {
  const all = await getAllBusinesses();
  const categories = all.map(b => b.category);
  return Array.from(new Set(categories));
};

export const getBusinessesByCategory = async (category: string): Promise<Business[]> => {
  const all = await getAllBusinesses();
  return all.filter(b => b.category === category);
};

export const getDefaultBusiness = async (category: string): Promise<Business> => {
  const categoryBusinesses = await getBusinessesByCategory(category);
  return categoryBusinesses.find(b => b.isDefault) || categoryBusinesses[0];
};

export const getBusinessById = async (id: string): Promise<Business | undefined> => {
  const all = await getAllBusinesses();
  return all.find(b => b.id.trim() === id.trim());
};


