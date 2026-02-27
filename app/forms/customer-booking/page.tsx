import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';

export default function CustomerBookingFormPage() {
  return (
    <ContentPageLayout
      title="Book Premium Pet Care in Minutes"
      description="Certified groomers. Doorstep service. 100% hygiene-first protocols."
      heroImageSrc="/Birthday/book-a-service.png"
      heroImageAlt="Book pet care with Dofurs"
      heroImageFirstOnMobile
    >
      <div className="rounded-2xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 text-center shadow-soft md:p-8">
        <h2 className="text-2xl font-semibold text-ink md:text-3xl">Start Your Booking</h2>
        <p className="mx-auto mt-3 max-w-2xl text-[#6b6b6b]">
          Complete the booking form below and our team will help you schedule the best service for your pet.
        </p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <Link
            href="#booking-form"
            className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition duration-300 ease-out hover:scale-[1.03] hover:brightness-95 sm:w-auto"
          >
            Book Now
          </Link>
          <p className="text-sm text-[#7a7a7a]">⭐ Trusted by 1,000+ Pet Parents in Bangalore</p>
        </div>
      </div>

      <div id="booking-form" className="overflow-hidden rounded-2xl border border-[#f2dfcf] bg-white shadow-soft">
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
