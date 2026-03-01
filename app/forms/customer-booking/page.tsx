import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import FadeInSection from '@/components/FadeInSection';
import CustomerBookingFlow from '@/components/forms/CustomerBookingFlow';
import { getCurrentUserRole, requireAuthenticatedUser } from '@/lib/auth/session';

export default async function CustomerBookingFormPage() {
  await requireAuthenticatedUser('/auth/sign-in?next=/forms/customer-booking');
  const role = await getCurrentUserRole();
  const isStaffBooking = role === 'admin' || role === 'provider';

  return (
    <ContentPageLayout
      title="Book Premium Pet Care in Minutes"
      description="Certified groomers. Doorstep service. 100% hygiene-first protocols."
      heroImageSrc="/Birthday/book-a-service.png"
      heroImageAlt="Book pet care with Dofurs"
      heroImageFirstOnMobile
    >
      <div id="start-your-booking" className="rounded-3xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 text-center shadow-soft-md md:p-8">
        <h2 className="text-2xl font-semibold text-ink md:text-3xl">Start Your Booking</h2>
        <p className="mx-auto mt-3 max-w-2xl text-[#6b6b6b]">
          {isStaffBooking
            ? 'Book services for users directly. Select the user, pet, provider and slot to confirm instantly.'
            : 'Complete the booking form below and our team will help you schedule the best service for your pet.'}
        </p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <Link
            href="#booking-form"
            className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-9 py-3.5 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_14px_30px_rgba(227,154,93,0.32)] sm:w-auto"
          >
            {isStaffBooking ? 'Book for a User' : 'Book Now'}
          </Link>
          <p className="text-sm text-[#7a7a7a]">⭐ Trusted by 1,000+ Pet Parents in Bangalore</p>
        </div>
      </div>

      <FadeInSection delay={0.08}>
        <div id="booking-form" className="overflow-hidden rounded-3xl border border-[#f2dfcf] bg-white shadow-soft-md">
          <div className="p-4 md:p-6">
            <CustomerBookingFlow allowBookForUsers={isStaffBooking} />
          </div>
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
