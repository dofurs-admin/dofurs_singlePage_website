import FadeInSection from './FadeInSection';
import { steps } from '@/lib/site-data';
import { theme } from '@/lib/theme';

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className={`${theme.layout.sectionSpacing} scroll-mt-24 bg-white`}>
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-ink md:text-4xl">How It Works</h2>
        </FadeInSection>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <FadeInSection key={step.title} delay={index * 0.1}>
                <article className="rounded-3xl bg-sand/60 p-7 shadow-soft">
                  <p className="text-sm font-semibold text-coral">Step {index + 1}</p>
                  <Icon className="mt-4 text-coral" size={28} aria-hidden="true" />
                  <h3 className="mt-4 text-2xl font-semibold text-ink">{step.title}</h3>
                  <p className="mt-3 text-ink/70">{step.description}</p>
                </article>
              </FadeInSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
