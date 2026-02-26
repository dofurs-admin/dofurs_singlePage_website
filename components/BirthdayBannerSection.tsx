import Image from 'next/image';
import FadeInSection from './FadeInSection';
import { theme } from '@/lib/theme';
import { links } from '@/lib/site-data';

export default function BirthdayBannerSection() {
  return (
    <section className="py-8 md:py-10">
      <div className={theme.layout.container}>
        <FadeInSection>
          <a
            href={links.birthdayBooking}
            target="_blank"
            rel="noreferrer"
            className="relative mx-auto block max-w-5xl overflow-hidden rounded-3xl shadow-soft"
            aria-label="Book pet birthday service in a new tab"
          >
            <Image
              src="/Birthday/book-a-birthday-banner-2.png"
              alt="Book a pet birthday celebration banner"
              width={2000}
              height={900}
              className="h-auto w-full object-cover brightness-95 saturate-90"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/10 to-black/25" aria-hidden="true" />
            <div className="absolute inset-0 flex items-end justify-center p-6 md:p-10">
              <span className={`inline-flex rounded-full px-7 py-3 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}>
                Book Birthday Celebration
              </span>
            </div>
          </a>
        </FadeInSection>
      </div>
    </section>
  );
}