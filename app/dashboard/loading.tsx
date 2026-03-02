import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

export default function DashboardLoading() {
  return (
    <div className="rounded-3xl border border-[#f2dfcf] bg-white p-8 text-center shadow-soft-md">
      <LoadingSkeleton lines={4} />
    </div>
  );
}
