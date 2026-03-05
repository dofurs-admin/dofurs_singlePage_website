/**
 * Card Component
 * 
 * Versatile card container with variants for different use cases.
 */

'use client';

import { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/design-system';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export default function Card({
  variant = 'default',
  padding = 'md',
  children,
  className,
  ...props
}: CardProps) {
  const variants = {
    default: 'rounded-2xl border border-neutral-200/60 bg-white shadow-sm',
    interactive:
      'rounded-2xl border border-neutral-200/60 bg-white shadow-sm transition-all duration-150 ease-out hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
    flat: 'rounded-2xl bg-white border border-neutral-200/60',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(variants[variant], paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Card Header
interface CardHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h3 className="text-card-title">{title}</h3>
        {description && (
          <p className="text-sm text-neutral-600">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Card Content
interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

// Card Footer
interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('flex items-center gap-3 border-t border-neutral-200/60 pt-4', className)}>
      {children}
    </div>
  );
}
