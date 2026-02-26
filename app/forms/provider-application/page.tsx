import ContentPageLayout from '@/components/ContentPageLayout';
import { formEmbeds } from '@/lib/site-data';
import { theme } from '@/lib/theme';

export default function ProviderApplicationFormPage() {
  const providerFormDirectUrl = formEmbeds.provider.replace('?embedded=true', '');

  return (
    <ContentPageLayout
      title="Provider Application Form"
      description="Apply to partner with Dofurs and join our verified pet care provider network."
    >
      <div className="rounded-2xl border border-[#f2dfcf] bg-peach/30 p-4 text-ink/80">
        If the embedded form asks you to sign in, open the direct form in a new tab.
        <a
          href={providerFormDirectUrl}
          target="_blank"
          rel="noreferrer"
          className={`ml-3 inline-flex rounded-full px-5 py-2 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
        >
          Open Form in New Tab
        </a>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#f2dfcf] bg-white shadow-soft">
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
