import { z } from 'zod';

export const basicProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  profile_photo_url: z.string().trim().max(500).nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
  gender: z.string().trim().max(40).nullable().optional(),
});

export const householdProfileUpdateSchema = z.object({
  total_pets: z.number().int().min(0).optional(),
  first_pet_owner: z.boolean().optional(),
  years_of_pet_experience: z.number().int().min(0).nullable().optional(),
  lives_in: z.string().trim().max(120).nullable().optional(),
  has_other_pets: z.boolean().optional(),
  number_of_people_in_house: z.number().int().min(1).nullable().optional(),
  has_children: z.boolean().optional(),
});

export const userAddressSchema = z.object({
  label: z.enum(['Home', 'Office', 'Other']).nullable().optional(),
  address_line_1: z.string().trim().min(3).max(250),
  address_line_2: z.string().trim().max(250).nullable().optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  pincode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(120),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  is_default: z.boolean().optional(),
});

export const userAddressPatchSchema = userAddressSchema.partial();

export const userEmergencyContactSchema = z.object({
  contact_name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().max(80).nullable().optional(),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  is_primary: z.boolean().optional(),
});

export const userEmergencyContactPatchSchema = userEmergencyContactSchema.partial();

export const userPreferencesSchema = z.object({
  preferred_service_time: z.string().trim().max(80).nullable().optional(),
  preferred_groomer_gender: z.string().trim().max(40).nullable().optional(),
  communication_preference: z.enum(['call', 'whatsapp', 'app']).nullable().optional(),
  special_instructions: z.string().trim().max(2000).nullable().optional(),
});

export const adminVerificationUpdateSchema = z.object({
  is_phone_verified: z.boolean().optional(),
  is_email_verified: z.boolean().optional(),
  kyc_status: z.enum(['not_submitted', 'pending', 'verified', 'rejected']).optional(),
  government_id_type: z.string().trim().max(80).nullable().optional(),
  id_document_url: z.string().trim().max(500).nullable().optional(),
});

export const adminReputationUpdateSchema = z.object({
  cancellation_rate: z.number().min(0).optional(),
  late_cancellation_count: z.number().int().min(0).optional(),
  no_show_count: z.number().int().min(0).optional(),
  average_rating: z.number().min(0).optional(),
  total_bookings: z.number().int().min(0).optional(),
  flagged_count: z.number().int().min(0).optional(),
  is_suspended: z.boolean().optional(),
  account_status: z.enum(['active', 'flagged', 'banned']).optional(),
  risk_score: z.number().min(0).optional(),
});
