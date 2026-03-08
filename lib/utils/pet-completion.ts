type LightweightPetInput = {
  name: string;
  breed: string | null;
  age: number | null;
  weight: number | null;
  gender: string | null;
  allergies: string | null;
  photo_url: string | null;
};

function isExplicitNoAllergies(value: string) {
  const normalized = value.trim().toLowerCase();
  return [
    'none',
    'no allergy',
    'no allergies',
    'no known allergy',
    'no known allergies',
    'n/a',
    'na',
  ].includes(normalized);
}

export function calculateLightweightPetCompletion(pet: LightweightPetInput) {
  const allergies = pet.allergies?.trim() ?? '';

  const score =
    (pet.name.trim().length > 0 ? 30 : 0) +
    (Boolean(pet.breed?.trim()) ? 20 : 0) +
    (pet.age !== null ? 15 : 0) +
    (pet.weight !== null ? 10 : 0) +
    (Boolean(pet.gender?.trim()) ? 10 : 0) +
    (allergies.length > 0 ? 8 : 0) +
    (isExplicitNoAllergies(allergies) ? 2 : 0) +
    (Boolean(pet.photo_url) ? 5 : 0);

  return Math.max(0, Math.min(100, score));
}