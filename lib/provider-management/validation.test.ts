import { describe, expect, it } from 'vitest';
import {
  adminServiceGlobalRolloutSchema,
  providerDetailsUpdateSchema,
  providerDocumentCreateSchema,
  providerDocumentPatchSchema,
  providerReviewsQuerySchema,
} from './validation';

describe('provider management validation', () => {
  it('validates details update payload', () => {
    const parsed = providerDetailsUpdateSchema.safeParse({
      professionalDetails: {
        license_number: 'LIC-123',
        teleconsult_enabled: true,
      },
      clinicDetails: {
        city: 'Bengaluru',
        number_of_doctors: 4,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty details payload', () => {
    const parsed = providerDetailsUpdateSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it('validates document create and patch payloads', () => {
    expect(
      providerDocumentCreateSchema.safeParse({
        document_type: 'license',
        document_url: 'https://example.com/file.pdf',
      }).success,
    ).toBe(true);

    expect(
      providerDocumentPatchSchema.safeParse({
        document_url: 'https://example.com/new-file.pdf',
      }).success,
    ).toBe(true);
  });

  it('validates review query params', () => {
    const parsed = providerReviewsQuerySchema.safeParse({
      page: 2,
      pageSize: 10,
      rating: 4,
    });

    expect(parsed.success).toBe(true);
  });

  it('validates global rollout payload with provider_types', () => {
    const parsed = adminServiceGlobalRolloutSchema.safeParse({
      service_type: 'grooming_session',
      base_price: 599,
      is_active: true,
      provider_types: ['groomer', 'clinic'],
      overwrite_existing: false,
    });

    expect(parsed.success).toBe(true);
  });

  it('remains backward-compatible when provider_ids is included', () => {
    const parsed = adminServiceGlobalRolloutSchema.safeParse({
      service_type: 'grooming_session',
      base_price: 599,
      is_active: true,
      provider_types: ['groomer'],
      provider_ids: [101, 202],
      overwrite_existing: true,
    });

    expect(parsed.success).toBe(true);
  });
});
