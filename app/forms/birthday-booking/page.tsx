import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';

export default function BirthdayBookingFormPage() {
  return (
    <ContentPageLayout
      title="Birthday Booking Form"
      description="Plan your pet’s birthday celebration by submitting this quick booking form."
      heroImageSrc="/Birthday/pet-birthday.png"
      heroImageAlt="Pet birthday celebration booking"
      heroImageFirstOnMobile
    >
      <div className="overflow-hidden rounded-2xl border border-[#f2dfcf] bg-white shadow-soft">
        <iframe
          src={formEmbeds.birthdayBooking}
          title="Birthday Booking Form"
          className="h-[1450px] w-full"
          loading="lazy"
        />
      </div>
    </ContentPageLayout>
  );
}
