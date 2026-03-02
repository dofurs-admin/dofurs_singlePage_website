import type { ReactNode } from 'react';

type AsyncStateProps = {
  isLoading: boolean;
  isError?: boolean;
  errorMessage?: string | null;
  loadingFallback?: ReactNode;
  emptyFallback?: ReactNode;
  isEmpty?: boolean;
  children: ReactNode;
};

export default function AsyncState({
  isLoading,
  isError = false,
  errorMessage,
  loadingFallback,
  emptyFallback,
  isEmpty = false,
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return <>{loadingFallback ?? <div className="text-sm text-[#6b6b6b]">Loading…</div>}</>;
  }

  if (isError) {
    return <div className="rounded-xl border border-[#ffd9d2] bg-[#fff3f0] p-3 text-sm text-[#b74129]">{errorMessage ?? 'Something went wrong.'}</div>;
  }

  if (isEmpty) {
    return <>{emptyFallback ?? <div className="text-sm text-[#6b6b6b]">No data found.</div>}</>;
  }

  return <>{children}</>;
}
