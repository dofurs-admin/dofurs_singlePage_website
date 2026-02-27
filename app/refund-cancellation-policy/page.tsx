import ContentPageLayout from '@/components/ContentPageLayout';

export default function RefundCancellationPolicyPage() {
  return (
    <ContentPageLayout
      title="Refund & Cancellation Policy"
      description="Policy governing booking cancellation, refund eligibility, timelines, and quality-related disputes."
      heroImageSrc="/Birthday/book-a-service.png"
      heroImageAlt="Refund and cancellation policy"
    >
      <h2 className="mt-2 text-2xl font-semibold text-ink">6.1 Cancellation by User</h2>
      <p>Users may cancel a confirmed booking through the platform or by contacting support.</p>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>More than 1 hour before service:</strong> 100% refund to original payment method within 5–7 business
          days.
        </li>
        <li>
          <strong>Less than 1 hour before service:</strong> 50% cancellation fee; remaining 50% refunded within 5–7
          business days.
        </li>
        <li>
          <strong>No-show:</strong> No refund; booking amount is forfeited as no-show fee.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.2 Cancellation by Dofurs or Service Provider</h2>
      <p>
        If a booking is cancelled by Dofurs or a service provider due to unavailability, unforeseen circumstances, or force
        majeure, users receive either:
      </p>
      <ul className="list-disc space-y-2 pl-6">
        <li>Full refund within 5–7 business days, or</li>
        <li>Rescheduling at no additional charge (user choice).</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.3 Refund Processing</h2>
      <p>
        Refund completion depends on payment-gateway/bank timelines. Dofurs is not liable for delays caused by external
        processors. Convenience and platform fees are non-refundable unless cancellation is initiated by Dofurs or the
        service provider.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">6.4 Dispute Over Service Quality</h2>
      <p>
        If dissatisfied with a completed service, users must report to support@dofurs.com within 24 hours with details.
        After review, Dofurs may offer a partial refund, complimentary re-service, or platform credits at its sole
        discretion.
      </p>
    </ContentPageLayout>
  );
}
