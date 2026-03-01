import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminProviderModerationItem,
  CreateProviderDocumentInput,
  CreateProviderInput,
  DocumentVerificationStatus,
  ProviderDetailsUpdateInput,
  Provider,
  AdminProviderServiceRolloutInput,
  ProviderDashboard,
  ProviderReviewsPage,
  ProviderReviewsQuery,
  ProviderReview,
  SetAvailabilityInput,
  UpdateProviderDocumentInput,
  UpdateProviderProfessionalDetailsInput,
  UpdateProviderClinicDetailsInput,
  UpdateProviderPricingInput,
  UpdateProviderProfileInput,
} from './types';

function ensureProviderFound<T>(value: T | null, message = 'Provider not found'): T {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

async function getProviderByUserId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProvider(supabase: SupabaseClient, userId: string, input: CreateProviderInput) {
  const { professional_details, clinic_details, ...providerInput } = input;

  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .insert({
      user_id: userId,
      ...providerInput,
    })
    .select('*')
    .single<Provider>();

  if (providerError) {
    throw providerError;
  }

  if (professional_details) {
    const { error } = await supabase.from('provider_professional_details').upsert(
      {
        provider_id: provider.id,
        ...professional_details,
      },
      { onConflict: 'provider_id' },
    );

    if (error) {
      throw error;
    }
  }

  if (clinic_details) {
    const { error } = await supabase.from('provider_clinic_details').upsert(
      {
        provider_id: provider.id,
        ...clinic_details,
      },
      { onConflict: 'provider_id' },
    );

    if (error) {
      throw error;
    }
  }

  return provider;
}

export async function getProviderDashboard(supabase: SupabaseClient, userId: string): Promise<ProviderDashboard | null> {
  const provider = await getProviderByUserId(supabase, userId);

  if (!provider) {
    return null;
  }

  const [professionalDetails, clinicDetails, availability, documents, reviews, services] = await Promise.all([
    supabase
      .from('provider_professional_details')
      .select('*')
      .eq('provider_id', provider.id)
      .maybeSingle(),
    supabase
      .from('provider_clinic_details')
      .select('*')
      .eq('provider_id', provider.id)
      .maybeSingle(),
    supabase
      .from('provider_availability')
      .select('*')
      .eq('provider_id', provider.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('provider_documents')
      .select('*')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('provider_reviews')
      .select('*')
      .eq('provider_id', provider.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('provider_services')
      .select('*')
      .eq('provider_id', provider.id)
      .order('service_type', { ascending: true }),
  ]);

  if (professionalDetails.error) {
    throw professionalDetails.error;
  }

  if (clinicDetails.error) {
    throw clinicDetails.error;
  }

  if (availability.error) {
    throw availability.error;
  }

  if (documents.error) {
    throw documents.error;
  }

  if (reviews.error) {
    throw reviews.error;
  }

  if (services.error) {
    throw services.error;
  }

  return {
    provider,
    professionalDetails: professionalDetails.data,
    clinicDetails: clinicDetails.data,
    availability: availability.data ?? [],
    documents: documents.data ?? [],
    reviews: reviews.data ?? [],
    services: services.data ?? [],
  };
}

export async function updateProviderProfile(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderProfileInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('providers')
    .update(input)
    .eq('id', provider.id)
    .select('*')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderProfessionalDetails(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderProfessionalDetailsInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('provider_professional_details')
    .upsert(
      {
        provider_id: provider.id,
        ...input,
      },
      { onConflict: 'provider_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderClinicDetails(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateProviderClinicDetailsInput,
) {
  const provider = ensureProviderFound(await getProviderByUserId(supabase, userId));

  const { data, error } = await supabase
    .from('provider_clinic_details')
    .upsert(
      {
        provider_id: provider.id,
        ...input,
      },
      { onConflict: 'provider_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderDetails(
  supabase: SupabaseClient,
  userId: string,
  input: ProviderDetailsUpdateInput,
) {
  const updates: {
    professionalDetails?: Awaited<ReturnType<typeof updateProviderProfessionalDetails>>;
    clinicDetails?: Awaited<ReturnType<typeof updateProviderClinicDetails>>;
  } = {};

  if (input.professionalDetails && Object.keys(input.professionalDetails).length > 0) {
    updates.professionalDetails = await updateProviderProfessionalDetails(supabase, userId, input.professionalDetails);
  }

  if (input.clinicDetails && Object.keys(input.clinicDetails).length > 0) {
    updates.clinicDetails = await updateProviderClinicDetails(supabase, userId, input.clinicDetails);
  }

  return updates;
}

export async function getProviderPublicProfile(supabase: SupabaseClient, providerId: number) {
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select(
      `
      id,
      provider_type,
      is_individual,
      business_name,
      profile_photo_url,
      bio,
      years_of_experience,
      service_radius_km,
      average_rating,
      total_bookings,
      ranking_score,
      verification_status,
      admin_approval_status,
      account_status
    `,
    )
    .eq('id', providerId)
    .eq('admin_approval_status', 'approved')
    .eq('account_status', 'active')
    .single();

  if (providerError) {
    throw providerError;
  }

  const [services, reviews] = await Promise.all([
    supabase
      .from('provider_services')
      .select('service_type, base_price, surge_price, service_duration_minutes, is_active')
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .order('service_type', { ascending: true }),
    supabase
      .from('provider_reviews')
      .select('rating, review_text, provider_response, created_at')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (services.error) {
    throw services.error;
  }

  if (reviews.error) {
    throw reviews.error;
  }

  return {
    provider,
    services: services.data ?? [],
    reviews: reviews.data ?? [],
  };
}

export async function approveProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({
      is_verified: true,
      verification_status: 'approved',
      admin_approval_status: 'approved',
      account_status: 'active',
      background_verified: true,
    })
    .eq('id', providerId)
    .select('*')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function rejectProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({
      is_verified: false,
      verification_status: 'rejected',
      admin_approval_status: 'rejected',
      account_status: 'suspended',
    })
    .eq('id', providerId)
    .select('*')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function suspendProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({ account_status: 'suspended' })
    .eq('id', providerId)
    .select('*')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function enableProvider(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('providers')
    .update({ account_status: 'active' })
    .eq('id', providerId)
    .select('*')
    .single<Provider>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderPricing(
  supabase: SupabaseClient,
  providerId: number,
  pricingRows: UpdateProviderPricingInput,
) {
  const { error } = await supabase
    .from('provider_services')
    .upsert(
      pricingRows.map((row) => ({
        ...row,
        provider_id: providerId,
      })),
      { onConflict: 'id' },
    );

  if (error) {
    throw error;
  }

  const { data, error: selectError } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .order('service_type', { ascending: true });

  if (selectError) {
    throw selectError;
  }

  return data ?? [];
}

function sanitizePincodeValues(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return Array.from(new Set(values.map((item) => item.trim()).filter((item) => /^[1-9]\d{5}$/.test(item))));
}

export async function getProviderServicesWithPincodes(supabase: SupabaseClient, providerId: number) {
  const [servicesResult, pincodesResult] = await Promise.all([
    supabase
      .from('provider_services')
      .select('*')
      .eq('provider_id', providerId)
      .order('service_type', { ascending: true }),
    supabase
      .from('provider_service_pincodes')
      .select('provider_service_id, pincode, is_enabled')
      .limit(5000),
  ]);

  if (servicesResult.error) {
    throw servicesResult.error;
  }

  if (pincodesResult.error && pincodesResult.error.code !== '42P01') {
    throw pincodesResult.error;
  }

  const serviceIdSet = new Set((servicesResult.data ?? []).map((item) => item.id));
  const pincodeMap = new Map<string, string[]>();

  for (const row of pincodesResult.data ?? []) {
    if (!serviceIdSet.has(row.provider_service_id) || row.is_enabled === false) {
      continue;
    }

    const list = pincodeMap.get(row.provider_service_id) ?? [];
    list.push(row.pincode);
    pincodeMap.set(row.provider_service_id, list);
  }

  return (servicesResult.data ?? []).map((service) => ({
    ...service,
    service_pincodes: pincodeMap.get(service.id) ?? [],
  }));
}

export async function updateProviderServiceRollout(
  supabase: SupabaseClient,
  providerId: number,
  rolloutRows: AdminProviderServiceRolloutInput,
) {
  const rows = rolloutRows.map((row) => ({
    id: row.id,
    provider_id: providerId,
    service_type: row.service_type,
    base_price: row.base_price,
    surge_price: row.surge_price ?? null,
    commission_percentage: row.commission_percentage ?? null,
    service_duration_minutes: row.service_duration_minutes ?? null,
    is_active: row.is_active ?? true,
  }));

  const { error: upsertError } = await supabase.from('provider_services').upsert(rows, { onConflict: 'id' });

  if (upsertError) {
    throw upsertError;
  }

  const { data: services, error: servicesError } = await supabase
    .from('provider_services')
    .select('*')
    .eq('provider_id', providerId)
    .order('service_type', { ascending: true });

  if (servicesError) {
    throw servicesError;
  }

  const serviceByType = new Map<string, (typeof services)[number]>();

  for (const service of services ?? []) {
    serviceByType.set(service.service_type.toLowerCase(), service);
  }

  const coverageRows: { provider_service_id: string; pincode: string; is_enabled: boolean }[] = [];
  const touchedServiceIds = new Set<string>();

  for (const row of rolloutRows) {
    const service = row.id ? (services ?? []).find((item) => item.id === row.id) : serviceByType.get(row.service_type.toLowerCase());

    if (!service) {
      continue;
    }

    touchedServiceIds.add(service.id);

    for (const pincode of sanitizePincodeValues(row.service_pincodes)) {
      coverageRows.push({
        provider_service_id: service.id,
        pincode,
        is_enabled: true,
      });
    }
  }

  if (touchedServiceIds.size > 0) {
    const { error: deleteCoverageError } = await supabase
      .from('provider_service_pincodes')
      .delete()
      .in('provider_service_id', Array.from(touchedServiceIds));

    if (deleteCoverageError && deleteCoverageError.code !== '42P01') {
      throw deleteCoverageError;
    }

    if (coverageRows.length > 0) {
      const { error: insertCoverageError } = await supabase.from('provider_service_pincodes').upsert(coverageRows, {
        onConflict: 'provider_service_id,pincode',
      });

      if (insertCoverageError && insertCoverageError.code !== '42P01') {
        throw insertCoverageError;
      }
    }
  }

  return getProviderServicesWithPincodes(supabase, providerId);
}

export async function verifyDocument(
  supabase: SupabaseClient,
  documentId: string,
  verificationStatus: DocumentVerificationStatus,
) {
  const verifiedAt = verificationStatus === 'approved' ? new Date().toISOString() : null;

  const { data, error } = await supabase
    .from('provider_documents')
    .update({
      verification_status: verificationStatus,
      verified_at: verifiedAt,
    })
    .eq('id', documentId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function setAvailability(
  supabase: SupabaseClient,
  providerId: number,
  availabilityRows: SetAvailabilityInput,
) {
  const { error } = await supabase
    .from('provider_availability')
    .upsert(
      availabilityRows.map((row) => ({
        ...row,
        provider_id: providerId,
      })),
      { onConflict: 'id' },
    );

  if (error) {
    throw error;
  }

  return getAvailability(supabase, providerId);
}

export async function getAvailability(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('provider_availability')
    .select('*')
    .eq('provider_id', providerId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAvailabilitySlot(
  supabase: SupabaseClient,
  providerId: number,
  availabilityId: string,
  input: SetAvailabilityInput[number],
) {
  const { data, error } = await supabase
    .from('provider_availability')
    .update({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      is_available: input.is_available,
    })
    .eq('id', availabilityId)
    .eq('provider_id', providerId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteAvailabilitySlot(supabase: SupabaseClient, providerId: number, availabilityId: string) {
  const { error } = await supabase
    .from('provider_availability')
    .delete()
    .eq('id', availabilityId)
    .eq('provider_id', providerId);

  if (error) {
    throw error;
  }
}

export async function getProviderReviews(supabase: SupabaseClient, providerId: number) {
  const page = await getProviderReviewsPage(supabase, providerId, { page: 1, pageSize: 200 });
  return page.reviews;
}

export async function getProviderReviewsPage(
  supabase: SupabaseClient,
  providerId: number,
  query: ProviderReviewsQuery,
): Promise<ProviderReviewsPage> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 10));
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  let countQuery = supabase
    .from('provider_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('provider_id', providerId);

  let dataQuery = supabase
    .from('provider_reviews')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .range(start, end);

  if (query.rating) {
    countQuery = countQuery.eq('rating', query.rating);
    dataQuery = dataQuery.eq('rating', query.rating);
  }

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countQuery, dataQuery]);

  if (countError) {
    throw countError;
  }

  if (dataError) {
    throw dataError;
  }

  const total = count ?? 0;

  return {
    reviews: (data ?? []) as ProviderReview[],
    page,
    pageSize,
    total,
    hasMore: start + pageSize < total,
  };
}

export async function getProviderDocuments(supabase: SupabaseClient, providerId: number) {
  const { data, error } = await supabase
    .from('provider_documents')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createProviderDocument(
  supabase: SupabaseClient,
  providerId: number,
  input: CreateProviderDocumentInput,
) {
  const { data, error } = await supabase
    .from('provider_documents')
    .insert({
      provider_id: providerId,
      document_type: input.document_type,
      document_url: input.document_url,
      verification_status: 'pending',
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateProviderDocument(
  supabase: SupabaseClient,
  providerId: number,
  documentId: string,
  input: UpdateProviderDocumentInput,
) {
  const { data, error } = await supabase
    .from('provider_documents')
    .update(input)
    .eq('id', documentId)
    .eq('provider_id', providerId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteProviderDocument(supabase: SupabaseClient, providerId: number, documentId: string) {
  const { error } = await supabase
    .from('provider_documents')
    .delete()
    .eq('id', documentId)
    .eq('provider_id', providerId);

  if (error) {
    throw error;
  }
}

export async function respondToReview(
  supabase: SupabaseClient,
  providerId: number,
  reviewId: string,
  responseText: string,
) {
  const currentReview = await supabase
    .from('provider_reviews')
    .select('provider_response')
    .eq('id', reviewId)
    .eq('provider_id', providerId)
    .maybeSingle<{ provider_response: string | null }>();

  if (currentReview.error) {
    throw currentReview.error;
  }

  const { data, error } = await supabase
    .from('provider_reviews')
    .update({ provider_response: responseText })
    .eq('id', reviewId)
    .eq('provider_id', providerId)
    .select('*')
    .single<ProviderReview>();

  if (error) {
    throw error;
  }

  const historyInsert = await supabase.from('provider_review_response_history').insert({
    review_id: reviewId,
    provider_id: providerId,
    previous_response: currentReview.data?.provider_response ?? null,
    new_response: responseText,
  });

  if (historyInsert.error && historyInsert.error.code !== '42P01') {
    throw historyInsert.error;
  }

  return data;
}

export async function getProviderReviewResponseHistory(supabase: SupabaseClient, providerId: number, reviewId: string) {
  const { data, error } = await supabase
    .from('provider_review_response_history')
    .select('*')
    .eq('provider_id', providerId)
    .eq('review_id', reviewId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === '42P01') {
      return [];
    }
    throw error;
  }

  return data ?? [];
}

export async function listAdminProviderModerationItems(supabase: SupabaseClient): Promise<AdminProviderModerationItem[]> {
  const [providersResult, documentsResult] = await Promise.all([
    supabase
      .from('providers')
      .select(
        'id, name, provider_type, business_name, admin_approval_status, verification_status, account_status, average_rating, total_bookings, created_at, updated_at',
      )
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('provider_documents').select('provider_id, verification_status').limit(5000),
  ]);

  if (providersResult.error) {
    throw providersResult.error;
  }

  if (documentsResult.error) {
    throw documentsResult.error;
  }

  const docsByProvider = new Map<number, { pending: number; approved: number; rejected: number }>();

  for (const row of documentsResult.data ?? []) {
    const current = docsByProvider.get(row.provider_id) ?? { pending: 0, approved: 0, rejected: 0 };

    if (row.verification_status === 'approved') {
      current.approved += 1;
    } else if (row.verification_status === 'rejected') {
      current.rejected += 1;
    } else {
      current.pending += 1;
    }

    docsByProvider.set(row.provider_id, current);
  }

  return (providersResult.data ?? []).map((item) => ({
    ...item,
    provider_type: item.provider_type,
    documentCounts: docsByProvider.get(item.id) ?? { pending: 0, approved: 0, rejected: 0 },
  })) as AdminProviderModerationItem[];
}

export async function logProviderAdminAuditEvent(
  supabase: SupabaseClient,
  adminUserId: string,
  providerId: number,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from('provider_admin_audit_events').insert({
    provider_id: providerId,
    actor_id: adminUserId,
    action,
    metadata,
  });

  if (error && error.code !== '42P01') {
    throw error;
  }
}
