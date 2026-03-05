'use client';

import { getPetFallbackIcon } from '@/lib/pets/icon-helpers';

type Pet = { id: number; name: string };

interface PetSelectionStepProps {
  pets: Pet[];
  selectedPetId: number | null;
  onPetChange: (petId: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

export default function PetSelectionStep({
  pets,
  selectedPetId,
  onPetChange,
  onNext,
  onPrev,
}: PetSelectionStepProps) {
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-950">Step 2: Select Pet</h2>
        <p className="mt-2 text-sm text-neutral-600">Choose the pet for this booking</p>
      </div>

      {/* Pet selection cards */}
      <div>
        <label className="block text-sm font-semibold text-neutral-950 mb-3">Your Pets</label>
        {pets.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center">
            <p className="text-sm text-neutral-600">No pets found. Please add a pet to your profile first.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pets.map((pet) => {
              const fallbackIcon = getPetFallbackIcon(null);
              const isSelected = selectedPetId === pet.id;

              return (
                <button
                  key={pet.id}
                  onClick={() => onPetChange(pet.id)}
                  className={`relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected ? 'border-coral bg-orange-50' : 'border-neutral-200 bg-white hover:border-coral/30'
                  }`}
                >
                  {/* Pet icon placeholder */}
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-coral/10 to-orange-100">
                    <span className="text-lg">{fallbackIcon}</span>
                  </div>

                  {/* Pet info */}
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-950">{pet.name}</h3>
                    <p className="text-xs text-neutral-500">Ready for booking</p>
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-coral">
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between gap-3 pt-4">
        <button
          onClick={onPrev}
          className="rounded-full border-2 border-neutral-200 px-6 py-2.5 text-sm font-semibold text-neutral-950 transition-all hover:border-coral hover:text-coral"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!selectedPetId}
          className="rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#cf8448] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue → Date & Time
        </button>
      </div>
    </div>
  );
}
