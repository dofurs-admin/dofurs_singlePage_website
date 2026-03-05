/**
 * GET /api/services/package/[packageId]
 * Get package composition with all services and pricing
 *
 * Query Params:
 * - providerId: string (required) - provider UUID or ID for pricing lookup
 *
 * Response:
 * - success: boolean
 * - data: PackageComposition
 * - error: string (on failure)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import { getPackageComposition } from "@/lib/service-catalog/utils";
import { toFriendlyApiError } from '@/lib/api/errors';

const packageCompositionQuerySchema = z.object({
  packageId: z.string().uuid(),
  providerId: z.union([z.string().min(1), z.number().int().positive()]),
});

function mapPackageCompositionError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('package not found')) {
    return { status: 404, message: 'Package not found' };
  }

  if (normalized.includes('package has no services')) {
    return { status: 422, message: 'Package composition is incomplete' };
  }

  if (normalized.includes('provider has no services in this package')) {
    return { status: 404, message: 'No package services found for this provider' };
  }

  if (normalized.includes('package composition error')) {
    return { status: 422, message: 'Unable to load package composition for this provider' };
  }

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    const parsed = packageCompositionQuerySchema.safeParse({
      packageId,
      providerId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request parameters',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const composition = await getPackageComposition(
      parsed.data.packageId,
      parsed.data.providerId
    );

    return NextResponse.json({
      success: true,
      data: composition,
    });
  } catch (error) {
    if (error instanceof Error) {
      const mappedDomainError = mapPackageCompositionError(error.message);

      if (mappedDomainError) {
        return NextResponse.json(
          {
            success: false,
            error: mappedDomainError.message,
          },
          { status: mappedDomainError.status }
        );
      }
    }

    const mapped = toFriendlyApiError(error, 'Unable to load package composition');

    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
