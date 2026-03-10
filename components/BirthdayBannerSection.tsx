import Image from 'next/image';
import Link from 'next/link';
import FadeInSection from './FadeInSection';
import { theme } from '@/lib/theme';
import { links } from '@/lib/site-data';

export default function BirthdayBannerSection() {
  return (
    <section className="py-6 md:py-8">
      <div className={theme.layout.container}>
        <FadeInSection>
          <Link
            href={links.birthdayBooking}
            className="group relative block overflow-hidden rounded-3xl border border-[#ead9cb] bg-[linear-gradient(135deg,#fff9f3_0%,#f8efe7_60%,#f3e8de_100%)] shadow-[0_26px_46px_rgba(24,24,24,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_32px_56px_rgba(24,24,24,0.14)]"
            aria-label="Book pet birthday service"
          >
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(232,154,94,0.26)_0%,rgba(232,154,94,0.02)_70%,transparent_100%)]" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 right-[-60px] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(215,143,86,0.24)_0%,rgba(215,143,86,0.04)_68%,transparent_100%)]" aria-hidden="true" />

            <div className="relative z-10 grid items-center gap-5 p-5 sm:p-6 md:grid-cols-[0.9fr_1.1fr] md:gap-8 md:p-7 lg:p-8">
              <div className="md:pr-1">
                <p className="inline-flex rounded-full border border-coral/28 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-coral">
                  Birthday Experiences
                </p>
                <h3 className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[28px]">
                  Celebrate Their Day in Style
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/72 sm:text-[15px]">
                  Premium setup, pet-safe decor, and easy booking. Give your pet a memorable birthday without the planning stress.
                </p>
                <span className={`mt-5 inline-flex shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}>
                  Book Birthday Celebration
                </span>
              </div>

              <div className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#fff9f3_0%,#f8efe7_60%,#f3e8de_100%)] shadow-[0_8px_32px_rgba(232,154,94,0.10)]">
                <Image
                  src="/Birthday/birthday.pet.dofurs.png"
                  alt="Dofurs pet birthday booking banner"
                  fill
                  sizes="(max-width: 768px) 100vw, 58vw"
                  className="rounded-2xl object-cover opacity-95 saturate-[1.05] drop-shadow-[0_4px_24px_rgba(232,154,94,0.13)]"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#fff9f3] via-[#f8efe7] to-[#f3e8de] opacity-20" aria-hidden="true" />
              </div>
            </div>
          </Link>
        </FadeInSection>
      </div>
    </section>
  );
}