/**
 * POST /api/services/calculate-price
 * Calculate booking price based on service/package and add-ons
 *
 * Body:
 * {
 *   bookingType: 'service' | 'package'
 *   serviceId?: string
 *   packageId?: string
 *   providerId: string
 *   addOns?: Array<{ id: string, quantity: number }>
 * }
 *
 * Response:
 * - success: boolean
 * - data: {
 *     basePrice: number
 *     addOnPrice: number
 *     discountAmount: number
 *     finalPrice: number
 *     breakdown: string[]
 *   }
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateBookingPrice } from '@/lib/service-catalog';
import { calculatePriceSchema } from '@/lib/service-catalog/validation';
import { toFriendlyApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = calculatePriceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid request payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const pricing = await calculateBookingPrice({
      bookingType: parsed.data.bookingType,
      serviceId: parsed.data.serviceId,
      packageId: parsed.data.packageId,
      providerId: parsed.data.providerId,
      addOns: parsed.data.addOns,
    });

    return NextResponse.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Unable to calculate price');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
