/**
 * GET /api/services/packages
 * Get all active service packages
 *
 * Query Params:
 * - categoryId: string (optional) - filter by category
 * - featured: boolean (optional) - filter to featured only
 *
 * Response:
 * - success: boolean
 * - data: ServicePackage[]
 * - error: string (on failure)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { ServicePackage } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from "@/lib/api/errors";

const packagesQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  featured: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = packagesQuerySchema.safeParse({
      categoryId: searchParams.get('categoryId') ?? undefined,
      featured: searchParams.get('featured') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const categoryId = parsed.data.categoryId;
    const featured = parsed.data.featured === 'true';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from("service_packages")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service packages');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ServicePackage[],
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service packages');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
