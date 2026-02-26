import Link from 'next/link';
import { links } from '@/lib/site-data';
import FadeInSection from './FadeInSection';
import { theme } from '@/lib/theme';

export default function CTASection() {
  return (
    <section id="book" className={`${theme.layout.sectionSpacing} scroll-mt-24 bg-peach/45`}>
      <div className={theme.layout.container}>
        <FadeInSection>
          <div className="rounded-3xl border border-[#f2dfcf] bg-white p-8 text-center shadow-soft md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Book a Service</h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink/70">
              Reserve trusted pet services in moments and get matched with verified professionals on Dofurs.
            </p>
            <Link
              href={links.booking}
              className={`mt-8 inline-flex rounded-full px-7 py-3 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
              aria-label="Start Booking"
            >
              Start Booking
            </Link>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
