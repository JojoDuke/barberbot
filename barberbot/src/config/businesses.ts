export interface Business {
  id: string;
  name: string;
  category: 'barbershop' | 'physiotherapy';
  isDefault?: boolean;
  tokenEnvVar: string;
  googleRating?: number;
  imageUrl?: string;
}

export const businesses: Record<string, Business> = {
  ricoStudio: {
    id: 'ef525423-dabf-4750-bf11-dc5182d68695',
    name: 'Rico Studio',
    category: 'barbershop',
    isDefault: true,
    tokenEnvVar: 'RESERVIO_TOKEN_RICO_STUDIO',
    googleRating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80',
  },
  holicstvi21: {
    id: 'd709a085-8c00-4bea-af6c-438e5741521a',
    name: 'Holičství 21',
    category: 'barbershop',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_HOLICSTVI_21',
    googleRating: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b7f30a?auto=format&fit=crop&w=800&q=80',
  },
  anatomicFitness: {
    id: 'fc376586-8906-4c0a-8cd3-be382a3c4a89',
    name: 'Anatomic Fitness',
    category: 'physiotherapy',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_ANATOMIC_FITNESS',
    googleRating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1570172619643-c8fd5976536d?auto=format&fit=crop&w=800&q=80',
  },
};

export const getBusinessesByCategory = (category: 'barbershop' | 'physiotherapy'): Business[] => {
  return Object.values(businesses).filter(b => b.category === category);
};

export const getDefaultBusiness = (category: 'barbershop' | 'physiotherapy'): Business => {
  const categoryBusinesses = getBusinessesByCategory(category);
  return categoryBusinesses.find(b => b.isDefault) || categoryBusinesses[0];
};

export const getBusinessById = (id: string): Business | undefined => {
  return Object.values(businesses).find(b => b.id === id);
};

