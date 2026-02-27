import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';
import { BriefcaseBusiness, ShieldCheck, Users } from 'lucide-react';

export default function ProviderApplicationFormPage() {
  const providerFormDirectUrl = formEmbeds.provider.replace('?embedded=true', '');

  return (
    <ContentPageLayout
      title="Partner With Dofurs"
      description="Grow your pet care business with quality leads, reliable tools, and a platform built around trust."
      heroImageSrc="/Birthday/partners-with-dofurs.png"
      heroImageAlt="Partner with Dofurs"
    >
      <div className="rounded-2xl border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 shadow-soft md:p-8">
        <h2 className="text-2xl font-semibold text-ink md:text-3xl">Build Your Practice With Confidence</h2>
        <p className="mt-3 max-w-3xl text-[#6b6b6b]">
          Join our growing network of verified professionals and reach more pet parents with a trusted brand and stronger
          visibility.
        </p>
        <a
          href="#provider-form"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition duration-300 ease-out hover:scale-[1.03] hover:brightness-95 sm:w-auto"
        >
          Apply as Service Provider
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <Users className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Quality Leads</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Connect with pet parents actively looking for trusted services.</p>
        </div>
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <BriefcaseBusiness className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Business Tools</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Manage visibility, bookings, and growth from one platform.</p>
        </div>
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <ShieldCheck className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Trusted Brand</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Grow under a reliability-first brand loved by local pet parents.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#f2dfcf] bg-peach/30 p-4 text-ink/80">
        If the embedded form asks you to sign in, open the direct form in a new tab.
        <a
          href={providerFormDirectUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-3 inline-flex rounded-full bg-[linear-gradient(90deg,_#f4a261_0%,_#e76f51_100%)] px-5 py-2 text-sm font-semibold text-white transition duration-300 ease-out hover:scale-[1.03] hover:brightness-95"
        >
          Open Form in New Tab
        </a>
      </div>

      <div id="provider-form" className="overflow-hidden rounded-2xl border border-[#f2dfcf] bg-white shadow-soft">
        <iframe
          src={formEmbeds.provider}
          title="Provider Application Form"
          className="h-[1450px] w-full"
          loading="lazy"
        />
      </div>
    </ContentPageLayout>
  );
}
