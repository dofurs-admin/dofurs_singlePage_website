import { z } from 'zod';

export const calculatePriceSchema = z
  .object({
    bookingType: z.enum(['service', 'package']),
    serviceId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),
    providerId: z.union([z.string().min(1), z.number().int().positive()]),
    addOns: z
      .array(
        z.object({
          id: z.string().uuid(),
          quantity: z.number().int().positive().max(20),
        }),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.bookingType === 'service' && !value.serviceId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'serviceId is required for service bookings', path: ['serviceId'] });
    }

    if (value.bookingType === 'package' && !value.packageId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'packageId is required for package bookings', path: ['packageId'] });
    }
  });
