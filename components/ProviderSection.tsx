import Image from 'next/image';
import FadeInSection from './FadeInSection';
import { imagery, links } from '@/lib/site-data';
import { theme } from '@/lib/theme';

export default function ProviderSection() {
  return (
    <section id="providers" className="scroll-mt-24">
      <div className="relative h-[320px] w-full overflow-hidden md:h-[420px]">
        <Image src={imagery.fullWidth.src} alt={imagery.fullWidth.alt} fill sizes="100vw" className="object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/15 to-transparent" aria-hidden="true" />
      </div>
      <div className={`${theme.layout.container} -mt-14 pb-16 md:-mt-20 md:pb-24`}>
        <FadeInSection>
          <div className="rounded-3xl bg-white p-8 shadow-soft md:p-12">
            <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">Partner With Dofurs</h2>
            <p className="mt-4 max-w-3xl text-ink/75">
              Grow your pet care business with quality leads, reliable tools, and a platform built around trust.
              Join our network of verified service providers and connect with pet parents who value excellence.
            </p>
            <a
              href={links.provider}
              target="_blank"
              rel="noreferrer"
              className={`mt-8 inline-flex rounded-full px-7 py-3 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
              aria-label="Apply as Service Provider in a new tab"
            >
              Apply as Service Provider
            </a>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
