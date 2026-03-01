import type { SupabaseClient } from '@supabase/supabase-js';
import type { OwnerProfileDatabase } from '@/lib/supabase/owner-profile.database.types';

type OwnerProfileSupabaseClient = SupabaseClient<OwnerProfileDatabase>;

export async function logOwnerProfileAudit(
  supabase: OwnerProfileSupabaseClient,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc('log_owner_profile_audit_event', {
    p_user_id: userId,
    p_action: action,
    p_metadata: metadata,
  });

  if (error) {
    throw error;
  }
}
