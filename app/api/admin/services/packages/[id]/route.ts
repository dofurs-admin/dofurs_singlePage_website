/**
 * PUT    /api/admin/services/packages/[id] - Update package
 * DELETE /api/admin/services/packages/[id] - Delete package
 * POST   /api/admin/services/packages/[id]/services - Add service to package
 */

import { NextResponse } from 'next/server';
import type { ServicePackage, ServicePackageInput } from '@/lib/service-catalog/types';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

// UPDATE PACKAGE
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    const body: Partial<ServicePackageInput> = await request.json();

    const { data, error } = await supabase
      .from("service_packages")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as ServicePackage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "Admin access required" ? 403 : 500 }
    );
  }
}

// DELETE PACKAGE
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("service_packages")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

