'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/design-system';

interface PetCardProps {
  id: number;
  name: string;
  breed?: string;
  age?: number;
  photo?: string;
  className?: string;
}

export default function PetCard({ id, name, breed, age, photo, className }: PetCardProps) {
  return (
    <div className={cn('card-interactive overflow-hidden group', className)}>
      {/* Photo */}
      {photo ? (
        <div className="relative h-40 w-full overflow-hidden bg-neutral-100">
          <Image
            src={photo}
            alt={`${name} photo`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-neutral-100 to-neutral-50 flex items-center justify-center text-4xl">
          🐾
        </div>
      )}

      {/* Info */}
      <div className="p-5 space-y-4">
        {/* Name */}
        <h3 className="text-lg font-bold text-neutral-950">{name}</h3>

        {/* Breed and Age */}
        {(breed || age !== undefined) && (
          <div className="flex flex-col gap-1.5 text-sm text-neutral-600">
            {breed && <span>{breed}</span>}
            {age !== undefined && age !== null && <span>{age} {age === 1 ? 'year' : 'years'} old</span>}
          </div>
        )}

        {/* View Passport Button */}
        <Link
          href={`/dashboard/user/pets?pet=${id}`}
          className="block text-center rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-all duration-150 ease-out hover:bg-neutral-50 hover:shadow-sm"
        >
          View Passport
        </Link>
      </div>
    </div>
  );
}
