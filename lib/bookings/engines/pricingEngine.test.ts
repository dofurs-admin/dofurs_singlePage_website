import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateBookingPriceWithSupabase } from './pricingEngine';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
function createMockSupabase<T>(mockData: T, error: Error | null = null) {
  const eqChain = {
    eq: () => eqChain,
    single: async () => ({ data: mockData, error }),
    returns: async () => ({ data: mockData, error }),
    in: () => ({
      returns: async () => ({ data: mockData, error }),
    }),
  };

  return {
    from: () => ({
      select: () => ({
        eq: () => eqChain,
        in: () => ({
          returns: async () => ({ data: mockData, error }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('pricingEngine', () => {
  describe('calculateBookingPriceWithSupabase - Service Booking', () => {
    it('should calculate price for basic service without add-ons', async () => {
      const supabase = createMockSupabase({
        base_price: 500,
        service_type: 'grooming_session',
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(0);
      expect(result.discount_amount).toBe(0);
      expect(result.final_total).toBe(500);
      expect(result.breakdown).toContain('grooming_session: ₹500');
    });

    it('should calculate price with single add-on', async () => {
      const mockResponses = [
        { base_price: 500, service_type: 'grooming_session' },
        { name: 'Nail Trimming', price: 50 },
      ];

      let callIndex = 0;
      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              const eqChain = {
                eq: () => eqChain,
                single: async () => {
                  const response = mockResponses[callIndex++];
                  return { data: response, error: null };
                },
              };

              return eqChain;
            },
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [{ id: 'addon-1', quantity: 1 }],
      });

      expect(result.base_total).toBe(500);
      expect(result.addon_total).toBe(50);
      expect(result.final_total).toBe(550);
      expect(result.breakdown).toContain('Nail Trimming (x1): ₹50');
    });

    it('should calculate price with multiple add-ons and quantities', async () => {
      const mockResponses = [
        { base_price: 600, service_type: 'vet_consultation' },
        { name: 'Vaccination', price: 200 },
        { name: 'Health Certificate', price: 100 },
      ];

      let callIndex = 0;
      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              const eqChain = {
                eq: () => eqChain,
                single: async () => {
                  const response = mockResponses[callIndex++];
                  return { data: response, error: null };
                },
              };

              return eqChain;
            },
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-vet',
        addOns: [
          { id: 'addon-1', quantity: 2 },
          { id: 'addon-2', quantity: 1 },
        ],
      });

      expect(result.base_total).toBe(600);
      expect(result.addon_total).toBe(500); // (200 * 2) + (100 * 1)
      expect(result.final_total).toBe(1100);
    });

    it('should throw error if service not found', async () => {
      const supabase = createMockSupabase(null, new Error('Service not found'));

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'service',
          providerId: 123,
          serviceId: 'invalid-service',
          addOns: [],
        }),
      ).rejects.toThrow('Service not found');
    });

    it('should handle null/missing base_price gracefully', async () => {
      const supabase = createMockSupabase({
        base_price: null,
        service_type: 'grooming_session',
      });

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [],
      });

      expect(result.base_total).toBe(0);
      expect(result.final_total).toBe(0);
    });

    it('should handle zero-quantity add-ons', async () => {
      const mockResponses = [
        { base_price: 500, service_type: 'grooming_session' },
        { name: 'Extra Product', price: 50 },
      ];

      let callIndex = 0;
      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: () => {
              const eqChain = {
                eq: () => eqChain,
                single: async () => {
                  const response = mockResponses[callIndex++];
                  return { data: response, error: null };
                },
              };

              return eqChain;
            },
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'service',
        providerId: 123,
        serviceId: 'service-abc',
        addOns: [{ id: 'addon-1', quantity: 0 }],
      });

      // Quantity 0 should be treated as 1 (Math.max(1, qty))
      expect(result.addon_total).toBe(50);
      expect(result.final_total).toBe(550);
    });
  });

  describe('calculateBookingPriceWithSupabase - Package Booking', () => {
    it('should calculate price for package with percentage discount', async () => {
      const mockData = {
        packageServices: [
          { provider_service_id: 'service-1' },
          { provider_service_id: 'service-2' },
        ],
        services: [
          { id: 'service-1', base_price: 300 },
          { id: 'service-2', base_price: 200 },
        ],
        package: {
          discount_type: 'percentage',
          discount_value: 20,
        },
      };

      const supabase = {
        from: (table: string) => ({
          select: (columns?: string) => ({
            eq: (column: string, value: unknown) => {
              if (table === 'package_services') {
                return {
                  returns: async () => ({ data: mockData.packageServices, error: null }),
                };
              }
              if (table === 'service_packages') {
                return {
                  single: async () => ({ data: mockData.package, error: null }),
                };
              }
              return {
                in: () => ({
                  returns: async () => ({ data: mockData.services, error: null }),
                }),
              };
            },
            in: (column: string, values: string[]) => ({
              returns: async () => ({ data: mockData.services, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'package',
        providerId: 123,
        packageId: 'package-spa',
        addOns: [],
      });

      expect(result.base_total).toBe(500); // 300 + 200
      expect(result.discount_amount).toBe(100); // 20% of 500
      expect(result.final_total).toBe(400); // 500 - 100
      expect(result.breakdown).toContain('Package (2 services): ₹500');
      expect(result.breakdown).toContain('Package discount: -₹100.00');
    });

    it('should calculate price for package with fixed discount', async () => {
      const mockData = {
        packageServices: [{ provider_service_id: 'service-1' }],
        services: [{ id: 'service-1', base_price: 800 }],
        package: {
          discount_type: 'fixed',
          discount_value: 150,
        },
      };

      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (column: string, value: unknown) => {
              if (table === 'package_services') {
                return {
                  returns: async () => ({ data: mockData.packageServices, error: null }),
                };
              }
              if (table === 'service_packages') {
                return {
                  single: async () => ({ data: mockData.package, error: null }),
                };
              }
              return {
                in: () => ({
                  returns: async () => ({ data: mockData.services, error: null }),
                }),
              };
            },
            in: () => ({
              returns: async () => ({ data: mockData.services, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'package',
        providerId: 123,
        packageId: 'package-wellness',
        addOns: [],
      });

      expect(result.base_total).toBe(800);
      expect(result.discount_amount).toBe(150);
      expect(result.final_total).toBe(650);
    });

    it('should handle package with no discount', async () => {
      const mockData = {
        packageServices: [{ provider_service_id: 'service-1' }],
        services: [{ id: 'service-1', base_price: 500 }],
        package: {
          discount_type: null,
          discount_value: null,
        },
      };

      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (column: string, value: unknown) => {
              if (table === 'package_services') {
                return {
                  returns: async () => ({ data: mockData.packageServices, error: null }),
                };
              }
              if (table === 'service_packages') {
                return {
                  single: async () => ({ data: mockData.package, error: null }),
                };
              }
              return {
                in: () => ({
                  returns: async () => ({ data: mockData.services, error: null }),
                }),
              };
            },
            in: () => ({
              returns: async () => ({ data: mockData.services, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'package',
        providerId: 123,
        packageId: 'package-basic',
        addOns: [],
      });

      expect(result.base_total).toBe(500);
      expect(result.discount_amount).toBe(0);
      expect(result.final_total).toBe(500);
    });

    it('should throw error if package has no services', async () => {
      const supabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              returns: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'package',
          providerId: 123,
          packageId: 'package-empty',
          addOns: [],
        }),
      ).rejects.toThrow('Package has no services');
    });

    it('should throw error if provider has no package services', async () => {
      const mockData = {
        packageServices: [{ provider_service_id: 'service-1' }],
        services: [],
      };

      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (column: string, value: unknown) => {
              if (table === 'package_services') {
                return {
                  returns: async () => ({ data: mockData.packageServices, error: null }),
                };
              }
              return {
                in: () => ({
                  returns: async () => ({ data: mockData.services, error: null }),
                }),
              };
            },
            in: () => ({
              returns: async () => ({ data: mockData.services, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      await expect(
        calculateBookingPriceWithSupabase(supabase, {
          bookingType: 'package',
          providerId: 999,
          packageId: 'package-missing',
          addOns: [],
        }),
      ).rejects.toThrow('Provider has no services in this package');
    });
  });

  describe('Edge Cases & Security', () => {
    it('should floor final price at 0 (no negative prices)', async () => {
      // Scenario: Discount exceeds service price (shouldn't happen in prod but defensive)
      const mockData = {
        packageServices: [{ provider_service_id: 'service-1' }],
        services: [{ id: 'service-1', base_price: 100 }],
        package: {
          discount_type: 'fixed',
          discount_value: 200, // Discount > price
        },
      };

      const supabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (column: string, value: unknown) => {
              if (table === 'package_services') {
                return {
                  returns: async () => ({ data: mockData.packageServices, error: null }),
                };
              }
              if (table === 'service_packages') {
                return {
                  single: async () => ({ data: mockData.package, error: null }),
                };
              }
              return {
                in: () => ({
                  returns: async () => ({ data: mockData.services, error: null }),
                }),
              };
            },
            in: () => ({
              returns: async () => ({ data: mockData.services, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const result = await calculateBookingPriceWithSupabase(supabase, {
        bookingType: 'package',
        providerId: 123,
        packageId: 'package-overd',
        addOns: [],
      });

      expect(result.final_total).toBe(0); // Never negative
    });
  });
});
