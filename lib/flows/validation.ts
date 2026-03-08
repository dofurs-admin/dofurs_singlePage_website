import { z } from 'zod';

export const ownerProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/),
  address: z.string().trim().min(5).max(300),
  age: z.number().int().min(13).max(120),
  gender: z.enum(['male', 'female', 'other']),
});

const bookingBaseSchema = z.object({
  petId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  bookingMode: z.enum(['home_visit', 'clinic_visit', 'teleconsult']),
  locationAddress: z.string().trim().max(1000).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  providerNotes: z.string().trim().max(2000).nullable().optional(),
  bookingUserId: z.string().uuid().optional(),
  discountCode: z.string().trim().max(40).optional(),
  addOns: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive().max(20),
      }),
    )
    .optional(),
});

export const serviceBookingCreateSchema = bookingBaseSchema.extend({
  bookingType: z.literal('service').optional(),
  providerServiceId: z.string().uuid(),
});

export const bookingCreateSchema = serviceBookingCreateSchema;

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show']),
  providerNotes: z.string().trim().max(2000).optional(),
  cancellationReason: z.string().trim().max(2000).optional(),
});
