/**
 * Admin Package Management Endpoints
 * 
 * POST   /api/admin/services/packages - Create package
 * PUT    /api/admin/services/packages/:id - Update package
 * DELETE /api/admin/services/packages/:id - Delete package
 */

import { NextResponse } from 'next/server';
import type { ServicePackage, ServicePackageInput } from '@/lib/service-catalog/types';
import { toFriendlyApiError } from '@/lib/api/errors';
import { ADMIN_ROLES, requireApiRole } from '@/lib/auth/api-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin-client';

// CREATE PACKAGE
export async function POST(request: Request) {
  const auth = await requireApiRole(ADMIN_ROLES);

  if (auth.response) {
    return auth.response;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const body: ServicePackageInput = await request.json();

    const { data, error } = await supabase
      .from("service_packages")
      .insert(body)
      .select()
      .single();

    if (error) {
      const mapped = toFriendlyApiError(error, 'Failed to create service package');
      return NextResponse.json(
        { success: false, error: mapped.message },
        { status: mapped.status }
      );
    }

    return NextResponse.json(
      { success: true, data: data as ServicePackage },
      { status: 201 }
    );
  } catch (error) {
    const mapped = toFriendlyApiError(error, 'Failed to create service package');
    return NextResponse.json(
      { success: false, error: mapped.message },
      { status: mapped.status }
    );
  }
}

