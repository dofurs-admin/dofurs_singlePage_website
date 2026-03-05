'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { apiRequest } from '@/lib/api/client';

type BucketName = 'user-photos' | 'pet-photos' | 'service-images';

type StorageBackedImageProps = {
  value: string;
  alt: string;
  bucket: BucketName;
  className?: string;
  sizes?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
};

const resolvedUrlCache = new Map<string, string>();

function extractSignedStorageTarget(urlValue: string): { bucket: BucketName; path: string } | null {
  try {
    const parsed = new URL(urlValue);
    const marker = '/storage/v1/object/sign/';
    const markerIndex = parsed.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const remainder = parsed.pathname.slice(markerIndex + marker.length);
    const [bucket, ...pathParts] = remainder.split('/');
    const path = decodeURIComponent(pathParts.join('/'));

    if ((bucket === 'user-photos' || bucket === 'pet-photos' || bucket === 'service-images') && path) {
      return { bucket, path };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizePath(value: string, bucket: BucketName) {
  const normalized = value.trim().replace(/^\/+/, '');
  if (normalized.startsWith(`${bucket}/`)) {
    return normalized.slice(bucket.length + 1);
  }
  return normalized;
}

export default function StorageBackedImage({
  value,
  alt,
  bucket,
  className,
  sizes,
  fill,
  width,
  height,
  priority,
}: StorageBackedImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState(value);

  const cacheKey = useMemo(() => `${bucket}::${value}`, [bucket, value]);

  useEffect(() => {
    let active = true;

    async function resolveUrl() {
      const raw = value.trim();

      if (!raw) {
        if (active) {
          setResolvedUrl('');
        }
        return;
      }

      const cached = resolvedUrlCache.get(cacheKey);
      if (cached) {
        if (active) {
          setResolvedUrl(cached);
        }
        return;
      }

      if (/^https?:\/\//i.test(raw)) {
        const signedTarget = extractSignedStorageTarget(raw);

        if (!signedTarget) {
          if (active) {
            setResolvedUrl(raw);
          }
          resolvedUrlCache.set(cacheKey, raw);
          return;
        }

        try {
          const payload = await apiRequest<{ signedUrl: string }>('/api/storage/signed-read-url', {
            method: 'POST',
            body: JSON.stringify({
              bucket: signedTarget.bucket,
              path: signedTarget.path,
              expiresIn: 3600,
            }),
          });

          if (active) {
            setResolvedUrl(payload.signedUrl);
          }

          resolvedUrlCache.set(cacheKey, payload.signedUrl);
          return;
        } catch {
          if (active) {
            setResolvedUrl(raw);
          }
          resolvedUrlCache.set(cacheKey, raw);
          return;
        }
      }

      const path = normalizePath(raw, bucket);

      try {
        const payload = await apiRequest<{ signedUrl: string }>('/api/storage/signed-read-url', {
          method: 'POST',
          body: JSON.stringify({
            bucket,
            path,
            expiresIn: 3600,
          }),
        });

        if (active) {
          setResolvedUrl(payload.signedUrl);
        }

        resolvedUrlCache.set(cacheKey, payload.signedUrl);
      } catch {
        if (active) {
          setResolvedUrl(raw);
        }
        resolvedUrlCache.set(cacheKey, raw);
      }
    }

    void resolveUrl();

    return () => {
      active = false;
    };
  }, [bucket, cacheKey, value]);

  if (!resolvedUrl) {
    return null;
  }

  return (
    <Image
      src={resolvedUrl}
      alt={alt}
      className={className}
      sizes={sizes}
      fill={fill}
      width={width}
      height={height}
      priority={priority}
      unoptimized
    />
  );
}
