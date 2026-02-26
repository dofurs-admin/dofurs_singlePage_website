import FadeInSection from './FadeInSection';
import { reviews } from '@/lib/site-data';
import { theme } from '@/lib/theme';

export default function ReviewsSection() {
  return (
    <section className="bg-white py-14 md:py-18">
      <div className={theme.layout.container}>
        <FadeInSection>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">What Pet Parents Say</h2>
          <p className="mt-3 max-w-3xl text-ink/75">Real feedback from families who trust Dofurs for pet care.</p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {reviews.map((item) => (
              <article key={item.name} className="rounded-2xl border border-[#f1e6da] bg-peach/30 p-6 shadow-soft">
                <p className="text-ink/80">“{item.quote}”</p>
                <p className="mt-4 text-sm font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-ink/65">{item.role}</p>
              </article>
            ))}
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
