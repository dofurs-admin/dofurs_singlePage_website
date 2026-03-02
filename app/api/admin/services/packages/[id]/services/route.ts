/**
 * Admin Package Service Composition Endpoints
 * 
 * POST   /api/admin/services/packages/:id/services - Add service to package
 * DELETE /api/admin/services/packages/:id/services/:serviceId - Remove service
 * PATCH  /api/admin/services/packages/:id/services/reorder - Reorder services
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { PackageServiceInput } from "@/lib/service-catalog/types";
import { addServiceToPackage, reorderPackageServices } from "@/lib/service-catalog/utils";

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid token");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (userError || userData?.role !== "admin") {
    throw new Error("Admin access required");
  }

  return supabase;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await requireAdmin(request);
    const body: PackageServiceInput = await request.json();

    const result = await addServiceToPackage(
      id,
      body.provider_service_id,
      body.sequence_order,
      body.is_optional
    );

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Admin access required" ? 403 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await requireAdmin(request);
    const body: Array<{ id: string; sequence_order: number }> = await request.json();

    await reorderPackageServices(id, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Admin access required" ? 403 : 500 }
    );
  }
}

