/**
 * Admin Service Management Endpoints
 * 
 * POST   /api/admin/services/categories - Create category
 * PUT    /api/admin/services/categories/:id - Update category
 * DELETE /api/admin/services/categories/:id - Delete category
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { ServiceCategory, ServiceCategoryInput } from "@/lib/service-catalog/types";

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

  // Check if user is admin
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

// CREATE CATEGORY
export async function POST(request: NextRequest) {
  try {
    const supabase = await requireAdmin(request);
    const body: ServiceCategoryInput = await request.json();

    const { data, error } = await supabase
      .from("service_categories")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: data as ServiceCategory },
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

