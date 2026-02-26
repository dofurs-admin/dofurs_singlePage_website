import ContentPageLayout from '@/components/ContentPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <ContentPageLayout
      title="Privacy Policy"
      description="How Dofurs collects, uses, and protects user data across bookings and platform usage."
    >
      <p>We collect only the information required to process bookings, provide support, and improve service quality.</p>
      <p>We do not sell personal data. Information is shared only with relevant service providers and operational partners.</p>
      <p>Users can request updates or deletion of personal details by contacting support.</p>
    </ContentPageLayout>
  );
}
