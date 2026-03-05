/**
 * DELETE /api/admin/services/packages/:id/services/:serviceId
 * Remove a service from a package
 */

import { NextResponse } from 'next/server';
import { removeServiceFromPackage } from "@/lib/service-catalog/utils";
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; serviceId: string }> }
) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const { serviceId } = await context.params;
    await removeServiceFromPackage(serviceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

