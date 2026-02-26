import FadeInSection from './FadeInSection';
import { services } from '@/lib/site-data';
import { theme } from '@/lib/theme';

export default function ServicesSection() {
  return (
    <section id="services" className={`${theme.layout.sectionSpacing} scroll-mt-24 bg-petal`}>
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink md:text-4xl">Services for Every Stage of Pet Care</h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-ink/70">
            Discover top-rated care providers across grooming, health, companionship, and behavior support.
          </p>
        </FadeInSection>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <FadeInSection key={service.title} delay={index * 0.1}>
                <article className="group h-full rounded-3xl border border-[#f0e4d7] bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-coral/30">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-coral/12 text-coral transition group-hover:bg-coral group-hover:text-white">
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink/70">{service.description}</p>
                </article>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
