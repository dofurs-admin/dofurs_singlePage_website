import { z } from 'zod';
import { PROVIDER_TYPES } from './types';

export const providerProfileUpdateSchema = z.object({
  bio: z.string().trim().max(5000).nullable().optional(),
  profile_photo_url: z.string().trim().max(500).nullable().optional(),
  years_of_experience: z.number().int().min(0).nullable().optional(),
  phone_number: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  service_radius_km: z.number().int().min(0).nullable().optional(),
});

export const createProviderSchema = z.object({
  provider_type: z.enum(PROVIDER_TYPES),
  is_individual: z.boolean(),
  business_name: z.string().trim().max(255).nullable().optional(),
  profile_photo_url: z.string().trim().max(500).nullable().optional(),
  bio: z.string().trim().max(5000).nullable().optional(),
  years_of_experience: z.number().int().min(0).nullable().optional(),
  phone_number: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  service_radius_km: z.number().int().min(0).nullable().optional(),
  professional_details: z
    .object({
      license_number: z.string().trim().max(120).nullable().optional(),
      specialization: z.string().trim().max(255).nullable().optional(),
      teleconsult_enabled: z.boolean().optional(),
      emergency_service_enabled: z.boolean().optional(),
      equipment_details: z.string().trim().max(5000).nullable().optional(),
      insurance_document_url: z.string().trim().max(500).nullable().optional(),
      license_verified: z.boolean().optional(),
    })
    .nullable()
    .optional(),
  clinic_details: z
    .object({
      registration_number: z.string().trim().max(120).nullable().optional(),
      gst_number: z.string().trim().max(120).nullable().optional(),
      address: z.string().trim().max(1000).nullable().optional(),
      city: z.string().trim().max(120).nullable().optional(),
      state: z.string().trim().max(120).nullable().optional(),
      pincode: z.string().trim().max(30).nullable().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
      operating_hours: z.record(z.string(), z.unknown()).nullable().optional(),
      number_of_doctors: z.number().int().min(0).nullable().optional(),
      hospitalization_available: z.boolean().optional(),
      emergency_services_available: z.boolean().optional(),
      registration_verified: z.boolean().optional(),
    })
    .nullable()
    .optional(),
});

export const providerAvailabilityItemSchema = z.object({
  id: z.string().uuid().optional(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  end_time: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  is_available: z.boolean().optional(),
  slot_duration_minutes: z.number().int().positive().optional(),
  buffer_time_minutes: z.number().int().min(0).optional(),
});

export const providerAvailabilitySchema = z.array(providerAvailabilityItemSchema).min(1);

export const providerReviewResponseSchema = z.object({
  responseText: z.string().trim().min(1).max(3000),
});

export const providerDocumentCreateSchema = z.object({
  document_type: z.string().trim().min(1).max(120),
  document_url: z.string().trim().url().max(500),
});

export const providerDocumentPatchSchema = z
  .object({
    document_type: z.string().trim().min(1).max(120).optional(),
    document_url: z.string().trim().url().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const providerDetailsUpdateSchema = z
  .object({
    professionalDetails: z
      .object({
        license_number: z.string().trim().max(120).nullable().optional(),
        specialization: z.string().trim().max(255).nullable().optional(),
        teleconsult_enabled: z.boolean().optional(),
        emergency_service_enabled: z.boolean().optional(),
        equipment_details: z.string().trim().max(5000).nullable().optional(),
        insurance_document_url: z.string().trim().url().max(500).nullable().optional(),
      })
      .optional(),
    clinicDetails: z
      .object({
        registration_number: z.string().trim().max(120).nullable().optional(),
        gst_number: z.string().trim().max(120).nullable().optional(),
        address: z.string().trim().max(1000).nullable().optional(),
        city: z.string().trim().max(120).nullable().optional(),
        state: z.string().trim().max(120).nullable().optional(),
        pincode: z.string().trim().max(30).nullable().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        operating_hours: z.record(z.string(), z.unknown()).nullable().optional(),
        number_of_doctors: z.number().int().min(0).nullable().optional(),
        hospitalization_available: z.boolean().optional(),
        emergency_services_available: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one details section is required.',
  });

export const providerReviewsQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
});

export const providerPricingItemSchema = z.object({
  id: z.string().uuid().optional(),
  service_type: z.string().trim().min(1).max(120),
  base_price: z.number().min(0),
  surge_price: z.number().min(0).nullable().optional(),
  commission_percentage: z.number().min(0).max(100).nullable().optional(),
  service_duration_minutes: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const providerPricingSchema = z.array(providerPricingItemSchema).min(1);

const indianPincodeSchema = z.string().trim().regex(/^[1-9]\d{5}$/);

export const adminProviderServiceRolloutItemSchema = providerPricingItemSchema.extend({
  service_pincodes: z.array(indianPincodeSchema).max(200).optional(),
});

export const adminProviderServiceRolloutSchema = z.array(adminProviderServiceRolloutItemSchema).min(1);

export const verifyDocumentSchema = z.object({
  verificationStatus: z.enum(['pending', 'approved', 'rejected']),
});
