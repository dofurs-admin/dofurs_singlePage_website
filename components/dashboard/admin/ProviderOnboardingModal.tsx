'use client';

import { useState, useTransition, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import ImageUploadField from '@/components/ui/ImageUploadField';
import { cn } from '@/lib/design-system';

type ProviderType = 'clinic' | 'veterinarian' | 'groomer' | 'other';

type ProviderOnboardingData = {
  // Basic Information
  name: string;
  email: string;
  phone: string;
  profile_photo_url: string;
  provider_type: ProviderType;
  custom_provider_type: string;
  
  // Business Information (for clinics/centers)
  business_name: string;
  business_registration_number: string;
  
  // Address & Location
  address: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  service_radius_km: string;
  
  // Professional Details
  specialization: string;
  years_of_experience: string;
  qualification: string;
  
  // Compensation Settings
  compensation_type: 'salary' | 'commission' | 'both';
  salary_amount: string;
  commission_percentage: string;
  
  // Service Areas (for home visit professionals)
  service_pincodes: string; // Comma-separated
};

type ProviderOnboardingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
};

const PROVIDER_TYPE_OPTIONS = [
  { value: 'clinic' as const, label: 'Clinic/Grooming Center', description: 'Physical location with facilities' },
  { value: 'veterinarian' as const, label: 'Home Visit Veterinarian', description: 'Mobile vet services' },
  { value: 'groomer' as const, label: 'Home Visit Groomer', description: 'Mobile grooming services' },
  { value: 'other' as const, label: 'Other', description: 'Pick another supported provider type' },
] as const;

const OTHER_PROVIDER_TYPE_OPTIONS = [
  { value: 'trainer', label: 'Trainer' },
  { value: 'walker', label: 'Walker' },
  { value: 'sitter', label: 'Sitter' },
  { value: 'boarding_center', label: 'Boarding Center' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'retailer', label: 'Retailer' },
] as const;

function normalizeProviderTypeInput(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export default function ProviderOnboardingModal({ isOpen, onClose, onSuccess }: ProviderOnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [customProviderTypes, setCustomProviderTypes] = useState<string[]>([]);

  // Load custom provider types from localStorage
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('customProviderTypes');
        if (saved) {
          setCustomProviderTypes(JSON.parse(saved));
        }
      } catch (e) {
        // Silently fail if localStorage read fails
      }
    }
  }, [isOpen]);
  
  const [formData, setFormData] = useState<ProviderOnboardingData>({
    name: '',
    email: '',
    phone: '',
    profile_photo_url: '',
    provider_type: 'clinic',
    custom_provider_type: '',
    business_name: '',
    business_registration_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    service_radius_km: '5',
    specialization: '',
    years_of_experience: '',
    qualification: '',
    compensation_type: 'commission',
    salary_amount: '',
    commission_percentage: '15',
    service_pincodes: '',
  });

  const isClinic = formData.provider_type === 'clinic';
  const isHomeVisit = formData.provider_type === 'veterinarian' || formData.provider_type === 'groomer';
  const isOtherProviderType = formData.provider_type === 'other';

  function updateField<K extends keyof ProviderOnboardingData>(field: K, value: ProviderOnboardingData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function validateStep(currentStep: number): boolean {
    setError(null);

    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError('Provider name is required');
        return false;
      }
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Valid email address is required');
        return false;
      }
      if (!formData.phone.trim() || !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
        setError('Valid 10-digit phone number is required');
        return false;
      }
      if (isOtherProviderType && !formData.custom_provider_type.trim()) {
        setError('Please specify provider type when selecting Others');
        return false;
      }
      if (isClinic && !formData.business_name.trim()) {
        setError('Business name is required for clinics/centers');
        return false;
      }
    }

    if (currentStep === 2) {
      if (!formData.address.trim()) {
        setError('Address is required');
        return false;
      }
      if (!formData.city.trim()) {
        setError('City is required');
        return false;
      }
      if (!formData.state.trim()) {
        setError('State is required');
        return false;
      }
      if (!formData.pincode.trim() || !/^\d{6}$/.test(formData.pincode)) {
        setError('Valid 6-digit pincode is required');
        return false;
      }
      if (isHomeVisit && !formData.service_pincodes.trim()) {
        setError('Service pincodes are required for home visit professionals');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!formData.qualification.trim()) {
        setError('Qualification is required');
        return false;
      }
      if (!formData.years_of_experience.trim() || isNaN(Number(formData.years_of_experience))) {
        setError('Valid years of experience is required');
        return false;
      }
      
      // Validate compensation based on type
      if (formData.compensation_type === 'salary' || formData.compensation_type === 'both') {
        const salary = Number(formData.salary_amount);
        if (!formData.salary_amount.trim() || isNaN(salary) || salary <= 0) {
          setError('Valid salary amount is required');
          return false;
        }
      }
      
      if (formData.compensation_type === 'commission' || formData.compensation_type === 'both') {
        const commission = Number(formData.commission_percentage);
        if (!formData.commission_percentage.trim() || isNaN(commission) || commission < 0 || commission > 100) {
          setError('Commission percentage must be between 0 and 100');
          return false;
        }
      }
    }

    return true;
  }

  function handleNext() {
    if (validateStep(step)) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3);
    }
  }

  function handleBack() {
    setStep((prev) => (prev - 1) as 1 | 2 | 3);
    setError(null);
  }

  function handleSubmit() {
    if (!validateStep(3)) return;

    startTransition(async () => {
      try {
        const payload = {
          ...formData,
          custom_provider_type: normalizeProviderTypeInput(formData.custom_provider_type),
        };

        const response = await fetch('/api/admin/providers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to onboard provider');
        }

        // Save custom provider type if "other" was used
        if (formData.provider_type === 'other' && formData.custom_provider_type.trim()) {
          const normalized = normalizeProviderTypeInput(formData.custom_provider_type);
          setCustomProviderTypes((prev) => {
            const updated = Array.from(new Set([...prev, normalized]));
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('customProviderTypes', JSON.stringify(updated));
              } catch (e) {
                // Silently fail if localStorage write fails
              }
            }
            return updated;
          });
        }

        // Reset form and close modal
        setFormData({
          name: '',
          email: '',
          phone: '',
          profile_photo_url: '',
          provider_type: 'clinic',
          custom_provider_type: '',
          business_name: '',
          business_registration_number: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          latitude: '',
          longitude: '',
          service_radius_km: '5',
          specialization: '',
          years_of_experience: '',
          qualification: '',
          compensation_type: 'commission',
          salary_amount: '',
          commission_percentage: '15',
          service_pincodes: '',
        });
        setStep(1);
        setError(null);
        const onboardedEmail =
          (typeof data?.provider?.email === 'string' && data.provider.email.trim()) || formData.email.trim().toLowerCase();

        onSuccess(onboardedEmail);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to onboard provider');
      }
    });
  }

  function handleClose() {
    if (!isPending) {
      setStep(1);
      setError(null);
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Onboard New Provider">
      <div className="flex max-h-[75dvh] flex-col">
        <div className="space-y-6 overflow-y-auto pr-1">
        {/* Progress Steps */}
        <div className="flex items-center justify-between gap-2 pb-6 border-b border-neutral-200">
          {[1, 2, 3].map((stepNum) => (
            <div key={stepNum} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                    step === stepNum
                      ? 'bg-green-500 text-white ring-2 ring-green-200'
                      : step > stepNum
                      ? 'bg-green-500 text-white'
                      : 'bg-neutral-200 text-neutral-500'
                  )}
                >
                  {stepNum}
                </div>
                <span className={cn(
                  'text-xs mt-1 font-medium transition-all',
                  step === stepNum ? 'text-green-600' : 'text-neutral-600'
                )}>
                  {stepNum === 1 ? 'Basic Info' : stepNum === 2 ? 'Location' : 'Professional'}
                </span>
              </div>
              {stepNum < 3 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 transition-all',
                    step > stepNum ? 'bg-green-500' : 'bg-neutral-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Basic Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900">Basic Information</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Provider Type *</label>
                <select
                  value={formData.provider_type === 'other' && formData.custom_provider_type ? formData.custom_provider_type : formData.provider_type}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (['clinic', 'veterinarian', 'groomer'].includes(value)) {
                      // Selected a predefined type
                      updateField('provider_type', value as ProviderType);
                      updateField('custom_provider_type', '');
                    } else if (value === 'other') {
                      // Selected "Others (specify manually)" - clear custom field for user input
                      updateField('provider_type', 'other');
                      updateField('custom_provider_type', '');
                    } else {
                      // Selected a previously-added custom type
                      updateField('provider_type', 'other');
                      updateField('custom_provider_type', value);
                    }
                  }}
                  disabled={isPending}
                  className="input-field w-full"
                >
                  <option value="">Select a provider type</option>
                  <option value="clinic">Clinic/Grooming Center</option>
                  <option value="veterinarian">Home Visit Veterinarian</option>
                  <option value="groomer">Home Visit Groomer</option>
                  {customProviderTypes.length > 0 && (
                    <optgroup label="Previously Added">
                      {customProviderTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="other">Others (specify manually)</option>
                </select>
              </div>

              {isOtherProviderType && (
                <div>
                  <Input
                    label="Custom Provider Type *"
                    value={formData.custom_provider_type}
                    onChange={(e) => updateField('custom_provider_type', e.target.value)}
                    placeholder="e.g., Online Vet, Pet Trainer, Mobile Groomer"
                    disabled={isPending}
                  />
                  <p className="mt-2 text-xs text-neutral-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                    ✨ <strong>Create any provider type you need.</strong> Enter a custom provider type name and it will be added to your system. This appears in your &quot;Previously Added&quot; list for future use.
                  </p>
                </div>
              )}

              <Input
                label="Provider Name *"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Dr. John Smith / Pet Paradise Clinic"
                disabled={isPending}
              />

              <Input
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="provider@example.com"
                disabled={isPending}
              />

              <Input
                label="Phone Number *"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="9876543210"
                disabled={isPending}
              />

              <ImageUploadField
                label="Provider Photo (Optional)"
                value={formData.profile_photo_url}
                onChange={(url) => updateField('profile_photo_url', url)}
                bucket="user-photos"
                placeholder="Upload provider profile photo"
                disabled={isPending}
              />

              {isClinic && (
                <>
                  <Input
                    label="Business Name *"
                    value={formData.business_name}
                    onChange={(e) => updateField('business_name', e.target.value)}
                    placeholder="Pet Paradise Veterinary Clinic"
                    disabled={isPending}
                  />

                  <Input
                    label="Business Registration Number"
                    value={formData.business_registration_number}
                    onChange={(e) => updateField('business_registration_number', e.target.value)}
                    placeholder="GST/Registration number"
                    disabled={isPending}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Location & Service Area */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900">
              {isClinic ? 'Clinic Location' : 'Base Location & Service Area'}
            </h3>
            
            <div className="space-y-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Full Address *
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Street address, building name, floor"
                  rows={2}
                  disabled={isPending}
                  className="input-field w-full"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="City *"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Bangalore"
                  disabled={isPending}
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    disabled={isPending}
                    className="input-field w-full"
                  >
                    <option value="">Select State</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Pincode *"
                  value={formData.pincode}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="560001"
                  disabled={isPending}
                  maxLength={6}
                />

                <Input
                  label={`Service Radius (km) ${isClinic ? '' : '- Optional'}`}
                  type="number"
                  value={formData.service_radius_km}
                  onChange={(e) => updateField('service_radius_km', e.target.value)}
                  placeholder="5"
                  disabled={isPending}
                  min="0"
                  step="0.5"
                />
              </div>

              {isHomeVisit && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Service Pincodes * (comma-separated)
                  </label>
                  <textarea
                    value={formData.service_pincodes}
                    onChange={(e) => updateField('service_pincodes', e.target.value)}
                    placeholder="560001, 560002, 560003, 560004"
                    rows={2}
                    disabled={isPending}
                    className="input-field w-full"
                  />
                  <p className="text-xs text-neutral-600 mt-1">
                    Enter all pincodes where {formData.provider_type === 'veterinarian' ? 'veterinary' : 'grooming'} services will be available
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Latitude (Optional)"
                  value={formData.latitude}
                  onChange={(e) => updateField('latitude', e.target.value)}
                  placeholder="12.9716"
                  disabled={isPending}
                />

                <Input
                  label="Longitude (Optional)"
                  value={formData.longitude}
                  onChange={(e) => updateField('longitude', e.target.value)}
                  placeholder="77.5946"
                  disabled={isPending}
                />
              </div>

              <p className="text-xs text-neutral-600 bg-neutral-50 rounded-lg p-2">
                💡 Coordinates help with accurate service radius calculations. You can find them using any online map.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Professional Details */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900">Professional Details</h3>
            
            <div className="space-y-3">
              <Input
                label="Qualification *"
                value={formData.qualification}
                onChange={(e) => updateField('qualification', e.target.value)}
                placeholder="BVSc, MVSc, Certified Groomer, etc."
                disabled={isPending}
              />

              <Input
                label="Specialization"
                value={formData.specialization}
                onChange={(e) => updateField('specialization', e.target.value)}
                placeholder="Small Animals, Surgery, Grooming, etc."
                disabled={isPending}
              />

              <Input
                label="Years of Experience *"
                type="number"
                value={formData.years_of_experience}
                onChange={(e) => updateField('years_of_experience', e.target.value)}
                placeholder="5"
                disabled={isPending}
                min="0"
                step="0.5"
              />

              <div>
                <label className="text-sm font-medium text-neutral-700 mb-1.5 block">
                  Compensation Type *
                </label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'salary')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'salary'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Salary
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'commission')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'commission'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Commission
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('compensation_type', 'both')}
                    disabled={isPending}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      formData.compensation_type === 'both'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    )}
                  >
                    Both
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(formData.compensation_type === 'salary' || formData.compensation_type === 'both') && (
                    <Input
                      label="Monthly Salary (₹) *"
                      type="number"
                      value={formData.salary_amount}
                      onChange={(e) => updateField('salary_amount', e.target.value)}
                      placeholder="30000"
                      disabled={isPending}
                      min="0"
                      step="1000"
                    />
                  )}
                  
                  {(formData.compensation_type === 'commission' || formData.compensation_type === 'both') && (
                    <Input
                      label="Commission (%) *"
                      type="number"
                      value={formData.commission_percentage}
                      onChange={(e) => updateField('commission_percentage', e.target.value)}
                      placeholder="15"
                      disabled={isPending}
                      min="0"
                      max="100"
                      step="0.5"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
                <h4 className="font-medium text-blue-900">📋 What happens next?</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Provider account will be created with email credentials</li>
                  <li>Provider role access will be granted automatically</li>
                  <li>Account status will be set to &apos;Pending Approval&apos;</li>
                  <li>Provider can login and complete their profile</li>
                  <li>You can review and approve from the moderation panel</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-neutral-200">
          <div>
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isPending}
              >
                Back
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            
            {step < 3 ? (
              <Button onClick={handleNext} disabled={isPending}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? 'Creating...' : 'Onboard Provider'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
