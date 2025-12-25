export interface Business {
  id: string;
  name: string;
  category: 'barbershop' | 'physiotherapy';
  isDefault?: boolean;
  tokenEnvVar: string;
}

export const businesses: Record<string, Business> = {
  ricoStudio: {
    id: 'ef525423-dabf-4750-bf11-dc5182d68695',
    name: 'Rico Studio',
    category: 'barbershop',
    isDefault: true,
    tokenEnvVar: 'RESERVIO_TOKEN_RICO_STUDIO',
  },
  holicstvi21: {
    id: 'd709a085-8c00-4bea-af6c-438e5741521a',
    name: 'Holičství 21',
    category: 'barbershop',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_HOLICSTVI_21',
  },
  anatomicFitness: {
    id: 'fc376586-8906-4c0a-8cd3-be382a3c4a89',
    name: 'Anatomic Fitness',
    category: 'physiotherapy',
    isDefault: false,
    tokenEnvVar: 'RESERVIO_TOKEN_ANATOMIC_FITNESS',
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

