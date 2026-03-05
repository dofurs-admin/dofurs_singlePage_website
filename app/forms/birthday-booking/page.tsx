import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';
import FadeInSection from '@/components/FadeInSection';

export default function BirthdayBookingFormPage() {
  return (
    <ContentPageLayout
      title="Birthday Booking Form"
      description="Plan your pet’s birthday celebration by submitting this quick booking form."
      heroImageSrc="/Birthday/pet-birthday.png"
      heroImageAlt="Pet birthday celebration booking"
      heroImageFirstOnMobile
    >
      <FadeInSection delay={0.08}>
        <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-neutral-950" aria-hidden="true" />
          <iframe
            src={formEmbeds.birthdayBooking}
            title="Birthday Booking Form"
            className="h-[1450px] w-full"
            loading="lazy"
          />
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
