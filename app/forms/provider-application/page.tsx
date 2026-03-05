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
      <div className="rounded-2xl border border-neutral-200/60 bg-neutral-50 p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-semibold text-neutral-950 md:text-3xl">Build Your Practice With Confidence</h2>
        <p className="mt-3 max-w-3xl text-neutral-600">
          Join our growing network of verified professionals and reach more pet parents with a trusted brand and stronger
          visibility.
        </p>
        <a
          href="#provider-form"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-coral px-9 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-2 sm:w-auto"
        >
          Apply as Service Provider
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="group rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
          <Users className="h-7 w-7 text-neutral-800 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">Quality Leads</h3>
          <p className="mt-2 text-sm text-neutral-600">Connect with pet parents actively looking for trusted services.</p>
        </div>
        <div className="group rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
          <BriefcaseBusiness className="h-7 w-7 text-neutral-800 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">Business Tools</h3>
          <p className="mt-2 text-sm text-neutral-600">Manage visibility, bookings, and growth from one platform.</p>
        </div>
        <div className="group rounded-2xl border border-neutral-200/60 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
          <ShieldCheck className="h-7 w-7 text-neutral-800 transition-transform duration-300 group-hover:scale-105" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-neutral-950">Trusted Brand</h3>
          <p className="mt-2 text-sm text-neutral-600">Grow under a reliability-first brand loved by local pet parents.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200/60 bg-neutral-50 p-5 text-neutral-700 shadow-sm">
        If the embedded form asks you to sign in, open the direct form in a new tab.
        <a
          href={providerFormDirectUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-3 mt-3 inline-flex rounded-full bg-coral px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#cf8448] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 focus-visible:ring-offset-2 md:mt-0"
        >
          Open Form in New Tab
        </a>
      </div>

      <FadeInSection delay={0.08}>
        <div id="provider-form" className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white shadow-sm">
          <div className="h-1.5 w-full bg-neutral-950" aria-hidden="true" />
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
