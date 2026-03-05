'use client';

import Image from 'next/image';
import Modal from '@/components/ui/Modal';

type VaccinationRecord = {
  id: string;
  vaccine_name: string;
  brand_name: string | null;
  batch_number: string | null;
  dose_number: number | null;
  administered_date: string;
  next_due_date: string | null;
  veterinarian_name: string | null;
  clinic_name: string | null;
  certificate_url: string | null;
  reminder_enabled: boolean;
};

type MedicalRecord = {
  id: string;
  condition_name: string;
  diagnosis_date: string | null;
  ongoing: boolean;
  medications: string | null;
  special_care_instructions: string | null;
  vet_name: string | null;
  document_url: string | null;
};

export type PetPassportData = {
  pet: {
    id: number;
    name: string;
    breed: string | null;
    age: number | null;
    weight: number | null;
    gender: string | null;
    allergies: string | null;
    photo_url: string | null;
    date_of_birth?: string | null;
    microchip_number?: string | null;
    neutered_spayed?: boolean;
    color?: string | null;
    size_category?: string | null;
    energy_level?: string | null;
    aggression_level?: string | null;
    is_bite_history?: boolean;
    bite_incidents_count?: number;
    house_trained?: boolean;
    leash_trained?: boolean;
    crate_trained?: boolean;
    social_with_dogs?: string | null;
    social_with_cats?: string | null;
    social_with_children?: string | null;
    separation_anxiety?: boolean;
  };
  vaccinations: VaccinationRecord[];
  medicalRecords: MedicalRecord[];
  feedingInfo: {
    food_type: string | null;
    brand_name: string | null;
    feeding_schedule: string | null;
    food_allergies: string | null;
    special_diet_notes: string | null;
    treats_allowed: boolean;
  } | null;
  groomingInfo: {
    coat_type: string | null;
    matting_prone: boolean;
    grooming_frequency: string | null;
    last_grooming_date: string | null;
    nail_trim_frequency: string | null;
  } | null;
  emergencyInfo: {
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    preferred_vet_clinic: string | null;
    preferred_vet_phone: string | null;
  } | null;
};

type PetPassportViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  data: PetPassportData | null;
  photoUrl: string | null;
  isLoading?: boolean;
};

function InfoRow({ label, value, highlight = false }: { label: string; value: string | number | boolean | null | undefined; highlight?: boolean }) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

  return (
    <div className={`flex justify-between gap-4 py-2.5 border-b border-neutral-100 last:border-0 ${highlight ? 'bg-amber-50/30' : ''}`}>
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <span className="text-sm font-semibold text-neutral-900 text-right">{displayValue}</span>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-coral/20">
      <span className="text-2xl">{icon}</span>
      <h3 className="text-lg font-bold text-neutral-900">{children}</h3>
    </div>
  );
}

function PassportSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200/60 p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toTitleCase(str: string | null) {
  if (!str) return null;
  return str
    .replaceAll('_', ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getVaccinationStatus(nextDueDate: string | null) {
  if (!nextDueDate) return { label: 'Complete', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: '✓' };
  
  const today = new Date();
  const dueDate = new Date(nextDueDate);
  const diffInDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays < 0) return { label: 'Overdue', color: 'text-red-600', bgColor: 'bg-red-50', icon: '⚠' };
  if (diffInDays <= 14) return { label: 'Due Soon', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: '⏰' };
  return { label: 'Up to Date', color: 'text-emerald-600', bgColor: 'bg-emerald-50', icon: '✓' };
}

export default function PetPassportViewModal({ isOpen, onClose, data, photoUrl, isLoading }: PetPassportViewModalProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pet Passport" size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-coral border-t-transparent"></div>
            <p className="mt-4 text-sm text-neutral-600">Loading passport...</p>
          </div>
        </div>
      ) : !data || !data.pet ? (
        <div className="text-center py-12">
          <p className="text-neutral-600">No data available</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          {/* Passport Header with Photo */}
          <div className="relative bg-gradient-to-br from-coral/10 via-neutral-50 to-neutral-100 rounded-2xl overflow-hidden border border-coral/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-coral/5 rounded-full blur-3xl"></div>
            <div className="relative p-8">
              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                {/* Pet Photo */}
                <div className="flex-shrink-0">
                  <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={`${data.pet.name} photo`}
                        width={160}
                        height={160}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center text-5xl">
                        🐾
                      </div>
                    )}
                  </div>
                </div>

                {/* Pet Basic Info */}
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-3xl font-bold text-neutral-900 mb-2">{data.pet.name}</h2>
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start mb-4">
                    {data.pet.breed && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm font-semibold text-neutral-700 border border-neutral-200">
                        🐶 {data.pet.breed}
                      </span>
                    )}
                    {data.pet.age !== null && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm font-semibold text-neutral-700 border border-neutral-200">
                        🎂 {data.pet.age} years
                      </span>
                    )}
                    {data.pet.weight !== null && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm font-semibold text-neutral-700 border border-neutral-200">
                        ⚖️ {data.pet.weight} kg
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto md:mx-0">
                    {data.pet.gender && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-neutral-200/60">
                        <p className="text-xs text-neutral-600">Gender</p>
                        <p className="text-sm font-bold text-neutral-900">{toTitleCase(data.pet.gender)}</p>
                      </div>
                    )}
                    {data.pet.microchip_number && (
                      <div className="bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-neutral-200/60">
                        <p className="text-xs text-neutral-600">Microchip</p>
                        <p className="text-sm font-bold text-neutral-900">{data.pet.microchip_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid Layout for Sections */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <PassportSection>
              <SectionTitle icon="📋">Basic Information</SectionTitle>
              <div>
                <InfoRow label="Date of Birth" value={formatDate(data.pet.date_of_birth ?? null)} />
                <InfoRow label="Age" value={data.pet.age ? `${data.pet.age} years` : null} />
                <InfoRow label="Color" value={toTitleCase(data.pet.color ?? null)} />
                <InfoRow label="Size Category" value={toTitleCase(data.pet.size_category ?? null)} />
                <InfoRow label="Energy Level" value={toTitleCase(data.pet.energy_level ?? null)} />
                <InfoRow label="Neutered/Spayed" value={data.pet.neutered_spayed ?? false} />
                <InfoRow label="Allergies" value={data.pet.allergies} highlight={!!data.pet.allergies} />
              </div>
            </PassportSection>

            {/* Behavior & Temperament */}
            <PassportSection>
              <SectionTitle icon="🎭">Behavior & Temperament</SectionTitle>
              <div>
                <InfoRow label="Aggression Level" value={toTitleCase(data.pet.aggression_level ?? null)} />
                <InfoRow label="Bite History" value={data.pet.is_bite_history ?? false} highlight={data.pet.is_bite_history} />
                {data.pet.is_bite_history && (
                  <InfoRow label="Bite Incidents" value={data.pet.bite_incidents_count ?? 0} highlight />
                )}
                <InfoRow label="House Trained" value={data.pet.house_trained ?? false} />
                <InfoRow label="Leash Trained" value={data.pet.leash_trained ?? false} />
                <InfoRow label="Crate Trained" value={data.pet.crate_trained ?? false} />
                <InfoRow label="Separation Anxiety" value={data.pet.separation_anxiety ?? false} highlight={data.pet.separation_anxiety} />
              </div>
            </PassportSection>

            {/* Social Compatibility */}
            <PassportSection>
              <SectionTitle icon="🤝">Social Compatibility</SectionTitle>
              <div>
                <InfoRow label="Social with Dogs" value={toTitleCase(data.pet.social_with_dogs ?? null)} />
                <InfoRow label="Social with Cats" value={toTitleCase(data.pet.social_with_cats ?? null)} />
                <InfoRow label="Social with Children" value={toTitleCase(data.pet.social_with_children ?? null)} />
              </div>
            </PassportSection>

            {/* Emergency Contacts */}
            {data.emergencyInfo && (
              <PassportSection>
                <SectionTitle icon="🚨">Emergency Contacts</SectionTitle>
                <div>
                  <InfoRow label="Emergency Contact" value={data.emergencyInfo.emergency_contact_name} />
                  <InfoRow label="Emergency Phone" value={data.emergencyInfo.emergency_contact_phone} />
                  <InfoRow label="Preferred Vet Clinic" value={data.emergencyInfo.preferred_vet_clinic} />
                  <InfoRow label="Vet Phone" value={data.emergencyInfo.preferred_vet_phone} />
                </div>
              </PassportSection>
            )}
          </div>

          {/* Full Width Sections */}
          {/* Feeding Information */}
          {data.feedingInfo && (
            <PassportSection>
              <SectionTitle icon="🍽️">Feeding Information</SectionTitle>
              <div className="grid md:grid-cols-2 gap-x-6">
                <InfoRow label="Food Type" value={toTitleCase(data.feedingInfo.food_type)} />
                <InfoRow label="Brand Name" value={data.feedingInfo.brand_name} />
                <InfoRow label="Feeding Schedule" value={data.feedingInfo.feeding_schedule} />
                <InfoRow label="Treats Allowed" value={data.feedingInfo.treats_allowed} />
                <InfoRow label="Food Allergies" value={data.feedingInfo.food_allergies} highlight={!!data.feedingInfo.food_allergies} />
                <InfoRow label="Special Diet Notes" value={data.feedingInfo.special_diet_notes} />
              </div>
            </PassportSection>
          )}

          {/* Grooming Information */}
          {data.groomingInfo && (
            <PassportSection>
              <SectionTitle icon="✂️">Grooming Information</SectionTitle>
              <div className="grid md:grid-cols-2 gap-x-6">
                <InfoRow label="Coat Type" value={toTitleCase(data.groomingInfo.coat_type)} />
                <InfoRow label="Matting Prone" value={data.groomingInfo.matting_prone} />
                <InfoRow label="Grooming Frequency" value={data.groomingInfo.grooming_frequency} />
                <InfoRow label="Nail Trim Frequency" value={data.groomingInfo.nail_trim_frequency} />
                <InfoRow label="Last Grooming Date" value={formatDate(data.groomingInfo.last_grooming_date)} />
              </div>
            </PassportSection>
          )}

          {/* Vaccination History */}
          {data.vaccinations.length > 0 && (
            <PassportSection>
              <SectionTitle icon="💉">Vaccination History</SectionTitle>
              <div className="space-y-3">
                {data.vaccinations.map((vac) => {
                  const status = getVaccinationStatus(vac.next_due_date);
                  return (
                    <div key={vac.id} className="border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-bold text-neutral-900">{vac.vaccine_name}</h4>
                          {vac.brand_name && <p className="text-xs text-neutral-600 mt-0.5">{vac.brand_name}</p>}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.color} ${status.bgColor}`}>
                          {status.icon} {status.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {vac.administered_date && (
                          <div>
                            <span className="text-neutral-600">Administered: </span>
                            <span className="font-semibold text-neutral-900">{formatDate(vac.administered_date)}</span>
                          </div>
                        )}
                        {vac.next_due_date && (
                          <div>
                            <span className="text-neutral-600">Next Due: </span>
                            <span className="font-semibold text-neutral-900">{formatDate(vac.next_due_date)}</span>
                          </div>
                        )}
                        {vac.dose_number && (
                          <div>
                            <span className="text-neutral-600">Dose: </span>
                            <span className="font-semibold text-neutral-900">#{vac.dose_number}</span>
                          </div>
                        )}
                        {vac.veterinarian_name && (
                          <div>
                            <span className="text-neutral-600">Vet: </span>
                            <span className="font-semibold text-neutral-900">{vac.veterinarian_name}</span>
                          </div>
                        )}
                        {vac.clinic_name && (
                          <div className="col-span-2">
                            <span className="text-neutral-600">Clinic: </span>
                            <span className="font-semibold text-neutral-900">{vac.clinic_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PassportSection>
          )}

          {/* Medical Records */}
          {data.medicalRecords.length > 0 && (
            <PassportSection>
              <SectionTitle icon="🩺">Medical Records</SectionTitle>
              <div className="space-y-3">
                {data.medicalRecords.map((record) => (
                  <div key={record.id} className="border border-neutral-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-bold text-neutral-900">{record.condition_name}</h4>
                      {record.ongoing && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-amber-700 bg-amber-50">
                          ⏳ Ongoing
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {record.diagnosis_date && (
                        <div>
                          <span className="text-neutral-600">Diagnosed: </span>
                          <span className="font-semibold text-neutral-900">{formatDate(record.diagnosis_date)}</span>
                        </div>
                      )}
                      {record.medications && (
                        <div>
                          <span className="text-neutral-600">Medications: </span>
                          <span className="font-semibold text-neutral-900">{record.medications}</span>
                        </div>
                      )}
                      {record.special_care_instructions && (
                        <div>
                          <span className="text-neutral-600">Special Care: </span>
                          <span className="font-semibold text-neutral-900">{record.special_care_instructions}</span>
                        </div>
                      )}
                      {record.vet_name && (
                        <div>
                          <span className="text-neutral-600">Vet: </span>
                          <span className="font-semibold text-neutral-900">{record.vet_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </PassportSection>
          )}
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1a382;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cf8448;
        }
      `}</style>
    </Modal>
  );
}
