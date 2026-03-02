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
import { getPackageComposition } from "@/lib/service-catalog/utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> }
) {
  try {
    const { packageId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json(
        { success: false, error: "providerId query parameter is required" },
        { status: 400 }
      );
    }

    const composition = await getPackageComposition(
      packageId,
      providerId
    );

    return NextResponse.json({
      success: true,
      data: composition,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
