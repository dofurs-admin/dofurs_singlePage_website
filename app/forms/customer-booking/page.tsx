import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';

export default function CustomerBookingFormPage() {
  return (
    <ContentPageLayout
      title="Customer Booking Form"
      description="Fill this form to book a Dofurs pet care service directly from our website."
    >
      <div className="overflow-hidden rounded-2xl border border-[#f2dfcf] bg-white shadow-soft">
        <iframe
          src={formEmbeds.booking}
          title="Customer Booking Form"
          className="h-[1250px] w-full"
          loading="lazy"
        />
      </div>
    </ContentPageLayout>
  );
}
