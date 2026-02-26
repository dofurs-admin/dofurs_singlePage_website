import ContentPageLayout from '@/components/ContentPageLayout';

const faqs = [
  {
    question: 'How do I book a service?',
    answer: 'Go to the booking section or Contact Us page, open the booking form, submit details, and our team will confirm availability.',
  },
  {
    question: 'How are providers verified?',
    answer: 'We review profile details, service information, and onboarding checks before providers are listed for bookings.',
  },
  {
    question: 'Can I cancel or reschedule?',
    answer: 'Yes, cancellation and rescheduling are supported under our refund and cancellation policy.',
  },
  {
    question: 'Do you support birthday event bookings?',
    answer: 'Yes, birthday celebration requests are available through our dedicated birthday booking form.',
  },
];

export default function FaqsPage() {
  return (
    <ContentPageLayout title="FAQs" description="Quick answers to common questions from pet parents and providers.">
      {faqs.map((item) => (
        <div key={item.question} className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold text-ink">{item.question}</h2>
          <p className="mt-2 text-ink/75">{item.answer}</p>
        </div>
      ))}
    </ContentPageLayout>
  );
}
