/**
 * GET /api/services/categories
 * Get all active service categories
 *
 * Query Params:
 * - featured: boolean (optional) - filter to featured only
 *
 * Response:
 * - success: boolean
 * - data: ServiceCategory[]
 * - error: string (on failure)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { ServiceCategory } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';

const categoriesQuerySchema = z.object({
  featured: z.enum(['true', 'false']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = categoriesQuerySchema.safeParse({
      featured: searchParams.get('featured') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const featured = parsed.data.featured === 'true';

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from("service_categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (featured) {
      query = query.eq("is_featured", true);
    }

    const { data, error } = await query;

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service categories');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ServiceCategory[],
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service categories');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
