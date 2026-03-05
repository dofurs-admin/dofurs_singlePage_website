import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import PremiumUserBookingFlow from '@/components/forms/PremiumUserBookingFlow';
import CustomerBookingFlow from '@/components/forms/CustomerBookingFlow';
import { getCurrentUserRole, requireAuthenticatedUser } from '@/lib/auth/session';

export default async function CustomerBookingFormPage() {
  await requireAuthenticatedUser('/auth/sign-in?next=/forms/customer-booking');
  const role = await getCurrentUserRole();
  const isStaffBooking = role === 'admin' || role === 'staff' || role === 'provider';

  return (
    <ContentPageLayout
      title="Book Premium Pet Care in Minutes"
      description="Certified groomers. Doorstep service. 100% hygiene-first protocols."
      heroImageSrc="/Birthday/book-a-service.png"
      heroImageAlt="Book pet care with Dofurs"
      heroImageFirstOnMobile
    >
      <div id="start-your-booking" className="rounded-2xl border border-neutral-200/60 bg-neutral-50 p-6 text-center shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-neutral-950 md:text-3xl">
          {isStaffBooking ? 'Staff Booking Portal' : 'Book Premium Pet Care in Minutes'}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-neutral-600">
          {isStaffBooking
            ? 'Book services for users directly. Select the user, pet, provider and slot to confirm instantly.'
            : 'Easy 4-step booking flow. Confirm in just 3-4 clicks!'}
        </p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <Link
            href="#booking-form"
            className="inline-flex w-full items-center justify-center rounded-full bg-coral px-9 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-2 sm:w-auto"
          >
            {isStaffBooking ? 'Book for a User' : 'Book Now'}
          </Link>
          <p className="text-sm text-neutral-500">⭐ Trusted by 1,000+ Pet Parents in Bangalore</p>
        </div>
      </div>

      <FadeInSection delay={0.08}>
        <div id="booking-form" className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm">
          <div className="p-4 md:p-6">
            {isStaffBooking ? (
              <CustomerBookingFlow allowBookForUsers={true} />
            ) : (
              <PremiumUserBookingFlow />
            )}
          </div>
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
