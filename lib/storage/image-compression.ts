'use client';

import imageCompression from 'browser-image-compression';

export type ImageCompressionTarget = 'user-photos' | 'pet-photos';

const compressionConfig: Record<
  ImageCompressionTarget,
  {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    initialQuality: number;
  }
> = {
  'user-photos': {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 720,
    initialQuality: 0.68,
  },
  'pet-photos': {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 960,
    initialQuality: 0.72,
  },
};

export async function compressImageBeforeUpload(file: File, target: ImageCompressionTarget) {
  const config = compressionConfig[target];

  return imageCompression(file, {
    maxSizeMB: config.maxSizeMB,
    maxWidthOrHeight: config.maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: config.initialQuality,
  });
}
