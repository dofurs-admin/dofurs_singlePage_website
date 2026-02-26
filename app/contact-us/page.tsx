import ContentPageLayout from '@/components/ContentPageLayout';
import { links } from '@/lib/site-data';

export default function ContactUsPage() {
  return (
    <ContentPageLayout
      title="Contact Us"
      description="Have a question, feedback, or partnership request? We are here to help."
    >
      <p>Email: hello@dofurs.com</p>
      <p>Support Hours: Monday to Saturday, 9:00 AM - 7:00 PM</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <a
          href={links.booking}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#cf8448]"
        >
          Customer Booking Form
        </a>
        <a
          href={links.provider}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#cf8448]"
        >
          Provider Application Form
        </a>
      </div>
    </ContentPageLayout>
  );
}
