import FadeInSection from './FadeInSection';
import { theme } from '@/lib/theme';

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen scroll-mt-24 overflow-hidden pt-24" aria-label="Hero section">
      <video
        className="absolute inset-0 h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/Birthday/dofurs.cover.video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-hero-overlay" aria-hidden="true" />
      <div className={`relative ${theme.layout.container} flex min-h-[calc(100vh-6rem)] items-center`}>
        <FadeInSection className="max-w-2xl rounded-3xl bg-white/70 p-8 shadow-soft backdrop-blur-sm md:p-10">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-coral">Dofurs</p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-6xl">Premium Pet Services, Simplified</h1>
          <p className="mt-5 text-lg text-ink/80 md:text-xl">
            Connecting pet parents with trusted pet care professionals.
          </p>
          <a
            href="#book"
            className={`mt-8 inline-flex rounded-full px-7 py-3 text-sm font-semibold shadow-soft transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
            aria-label="Book a Service"
          >
            Book a Service
          </a>
        </FadeInSection>
      </div>
    </section>
  );
}
