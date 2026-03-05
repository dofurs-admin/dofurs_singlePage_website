/**
 * GET /api/services/addons/[serviceId]
 * Get all add-ons for a service
 *
 * Response:
 * - success: boolean
 * - data: ServiceAddon[]
 * - error: string (on failure)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import type { ServiceAddon } from "@/lib/service-catalog/types";
import { toFriendlyApiError } from '@/lib/api/errors';

const addOnsParamsSchema = z.object({
  serviceId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await context.params;
    const parsed = addOnsParamsSchema.safeParse({ serviceId });

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
      .from("service_addons")
      .select("*")
      .eq("provider_service_id", parsed.data.serviceId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to load service add-ons');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ServiceAddon[],
    });
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to load service add-ons');
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
    );
  }
}
