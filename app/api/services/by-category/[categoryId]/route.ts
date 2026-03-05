/**
 * GET /api/services/by-category/[categoryId]
 * Get all active services in a category for a specific provider
 *
 * Query Params:
 * - providerId: string (required) - provider UUID or ID
 *
 * Response:
 * - success: boolean
 * - data: Service[]
 * - error: string (on failure)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { Service } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';

const byCategoryQuerySchema = z.object({
  categoryId: z.string().uuid(),
  providerId: z.union([z.string().min(1), z.number().int().positive()]),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ categoryId: string }> }
) {
  try {
    const { categoryId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const providerId = searchParams.get("providerId");

    const parsed = byCategoryQuerySchema.safeParse({
      categoryId,
      providerId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("provider_services")
      .select("*")
      .eq("category_id", parsed.data.categoryId)
      .eq("provider_id", parsed.data.providerId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load services by category');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as Service[],
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load services by category');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
