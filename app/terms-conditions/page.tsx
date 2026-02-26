import ContentPageLayout from '@/components/ContentPageLayout';

export default function TermsConditionsPage() {
  return (
    <ContentPageLayout
      title="Terms & Conditions"
      description="Terms governing access to the Dofurs platform, bookings, and provider participation."
    >
      <p>By using Dofurs, users agree to provide accurate information and follow platform guidelines.</p>
      <p>Service availability, timelines, and outcomes may vary by provider and region.</p>
      <p>Dofurs may update terms as features evolve. Continued use indicates acceptance of the updated terms.</p>
    </ContentPageLayout>
  );
}
