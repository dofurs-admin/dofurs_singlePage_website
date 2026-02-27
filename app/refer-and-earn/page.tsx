import ContentPageLayout from '@/components/ContentPageLayout';

export default function ReferAndEarnPage() {
  return (
    <ContentPageLayout
      title="Refer & Earn"
      description="Invite pet parents and providers to Dofurs and unlock rewards as our community grows."
      heroImageSrc="/Birthday/partners-with-dofurs.png"
      heroImageAlt="Refer and earn with Dofurs"
    >
      <div className="rounded-3xl border border-[#f1e6da] bg-white p-7 shadow-soft">
        <h2 className="text-2xl font-semibold text-ink">How it works</h2>
        <ul className="mt-4 grid gap-2 text-ink/80">
          <li>1. Share Dofurs with your network.</li>
          <li>2. Your referral signs up and completes their first successful booking.</li>
          <li>3. You receive a reward credit on your account.</li>
        </ul>
        <p className="mt-4 text-ink/75">Referral reward details are updated periodically and shared on this page.</p>
      </div>
    </ContentPageLayout>
  );
}
