import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';
import { BriefcaseBusiness, ShieldCheck, Users } from 'lucide-react';
import FadeInSection from '@/components/FadeInSection';

export default function ProviderApplicationFormPage() {
  const providerFormDirectUrl = formEmbeds.provider.replace('?embedded=true', '');

  return (
    <ContentPageLayout
      title="Partner With Dofurs"
      description="Grow your pet care business with quality leads, reliable tools, and a platform built around trust."
      heroImageSrc="/Birthday/partners-with-dofurs.png"
      heroImageAlt="Partner with Dofurs"
    >
      <div className="rounded-3xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 shadow-soft-md md:p-8">
        <h2 className="text-2xl font-semibold text-ink md:text-3xl">Build Your Practice With Confidence</h2>
        <p className="mt-3 max-w-3xl text-[#6b6b6b]">
          Join our growing network of verified professionals and reach more pet parents with a trusted brand and stronger
          visibility.
        </p>
        <a
          href="#provider-form"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-9 py-3.5 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_14px_30px_rgba(227,154,93,0.32)] sm:w-auto"
        >
          Apply as Service Provider
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <Users className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Quality Leads</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Connect with pet parents actively looking for trusted services.</p>
        </div>
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <BriefcaseBusiness className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Business Tools</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manage visibility, bookings, and growth from one platform.</p>
        </div>
        <div className="group rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-soft-lg">
          <ShieldCheck className="h-7 w-7 text-coral transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Trusted Brand</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Grow under a reliability-first brand loved by local pet parents.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-[#f2dfcf] bg-peach/35 p-5 text-ink/80 shadow-soft-sm">
        If the embedded form asks you to sign in, open the direct form in a new tab.
        <a
          href={providerFormDirectUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-3 mt-3 inline-flex rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-6 py-2.5 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[0_14px_30px_rgba(227,154,93,0.32)] md:mt-0"
        >
          Open Form in New Tab
        </a>
      </div>

      <FadeInSection delay={0.08}>
        <div id="provider-form" className="overflow-hidden rounded-3xl border border-[#f2dfcf] bg-white shadow-soft-md">
          <div className="h-1.5 w-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)]" aria-hidden="true" />
          <iframe
            src={formEmbeds.provider}
            title="Provider Application Form"
            className="h-[1450px] w-full"
            loading="lazy"
          />
        </div>
      </FadeInSection>
    </ContentPageLayout>
  );
}
