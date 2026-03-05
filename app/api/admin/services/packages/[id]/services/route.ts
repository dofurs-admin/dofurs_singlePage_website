/**
 * Admin Package Service Composition Endpoints
 * 
 * POST   /api/admin/services/packages/:id/services - Add service to package
 * DELETE /api/admin/services/packages/:id/services/:serviceId - Remove service
 * PATCH  /api/admin/services/packages/:id/services/reorder - Reorder services
 */

import { NextResponse } from 'next/server';
import type { PackageServiceInput } from "@/lib/service-catalog/types";
import { addServiceToPackage, reorderPackageServices } from "@/lib/service-catalog/utils";
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
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
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const body: Array<{ id: string; sequence_order: number }> = await request.json();

    await reorderPackageServices(id, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

