import { supabase } from '../lib/supabase';

export interface Business {
  id: string;
  name: string;
  category: 'barbershop' | 'physiotherapy';
  isDefault?: boolean;
  tokenEnvVar: string;
  googleRating?: number;
  imageUrl?: string;
  website?: string;
  instagram?: string;
}

export const staticBusinesses: Record<string, Business> = {
  ricoStudio: {
    id: 'ef525423-dabf-4750-bf11-dc5182d68695',
    name: 'Rico Studio',
    category: 'barbershop',
    isDefault: true,
    tokenEnvVar: 'RESERVIO_TOKEN_RICO_STUDIO',
    googleRating: 4.8,
    imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTIt5gY7jZ8vDC0e9L7fsi09lZ-e7zM3U9_yA&s',
    website: 'https://www.ricostudio.cz',
    instagram: 'https://www.instagram.com/ricostudio_prague',
  },
  holicstvi21: {
    id: 'd709a085-8c00-4bea-af6c-438e5741521a',
    name: 'Holičství 21',
    category: 'barbershop',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_HOLICSTVI_21',
    googleRating: 5.0,
    imageUrl: 'https://holicstvi21.cz/wp-content/uploads/2025/07/Holicstvi21_09_DSC_0096U.jpg',
    website: 'https://holicstvi21.cz',
    instagram: 'https://www.instagram.com/holicstvi21',
  },
  anatomicFitness: {
    id: 'fc376586-8906-4c0a-8cd3-be382a3c4a89',
    name: 'Anatomic Fitness',
    category: 'physiotherapy',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_ANATOMIC_FITNESS',
    googleRating: 4.7,
    imageUrl: 'https://63ab8af83a.clvaw-cdnwnd.com/64e0954f1266dd28e76feb9b8f497be4/200000100-c3853c3855/prostory-12-7.jpeg?ph=63ab8af83a',
    website: 'https://www.anatomicfitness.cz',
    instagram: 'https://www.instagram.com/anatomicfitness',
  },
};

// Backwards compatibility for object access
export const businesses = staticBusinesses;

export const getAllBusinesses = async (): Promise<Business[]> => {
  try {
    const { data, error } = await supabase.from('businesses').select('*');

    if (error || !data || data.length === 0) {
      if (error && error.code !== 'PGRST116') { // PGRST116 is just "no rows" usually
        console.warn('⚠️ Could not fetch businesses from Supabase, using static fallback:', error.message);
      }
      return Object.values(staticBusinesses);
    }

    return data.map((b: any) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      isDefault: b.is_default,
      tokenEnvVar: b.token_env_var,
      googleRating: b.google_rating,
      imageUrl: b.image_url,
      website: b.website,
      instagram: b.instagram,
    }));
  } catch (err) {
    return Object.values(staticBusinesses);
  }
};

export const getBusinessesByCategory = async (category: 'barbershop' | 'physiotherapy'): Promise<Business[]> => {
  const all = await getAllBusinesses();
  return all.filter(b => b.category === category);
};

export const getDefaultBusiness = async (category: 'barbershop' | 'physiotherapy'): Promise<Business> => {
  const categoryBusinesses = await getBusinessesByCategory(category);
  return categoryBusinesses.find(b => b.isDefault) || categoryBusinesses[0];
};

export const getBusinessById = async (id: string): Promise<Business | undefined> => {
  const all = await getAllBusinesses();
  return all.find(b => b.id === id);
};


