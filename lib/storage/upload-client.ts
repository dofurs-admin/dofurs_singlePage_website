'use client';

import { compressImageBeforeUpload } from './image-compression';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';

type BucketName = 'user-photos' | 'pet-photos' | 'service-images';

export async function uploadCompressedImage(file: File, bucket: BucketName) {
  const compressed = await compressImageBeforeUpload(file, bucket);
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authHeader = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

  const signedUploadResponse = await fetch('/api/storage/signed-upload-url', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify({ bucket, fileName: compressed.name }),
  });

  if (!signedUploadResponse.ok) {
    const errorPayload = (await signedUploadResponse.json().catch(() => null)) as
      | { error?: string; details?: string; message?: string }
      | null;

    const serverMessage = errorPayload?.error || errorPayload?.details || errorPayload?.message;
    throw new Error(serverMessage || 'Failed to get signed upload URL');
  }

  const signedData = (await signedUploadResponse.json()) as {
    path: string;
    token: string;
  };

  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(signedData.path, signedData.token, compressed);

  if (error) {
    throw new Error(error.message);
  }

  const readResponse = await fetch('/api/storage/signed-read-url', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
    },
    body: JSON.stringify({ bucket, path: signedData.path, expiresIn: 3600 }),
  });

  if (!readResponse.ok) {
    throw new Error('Failed to generate signed read URL');
  }

  const readData = (await readResponse.json()) as { signedUrl: string };

  return {
    path: signedData.path,
    signedUrl: readData.signedUrl,
  };
}
