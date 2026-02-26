import Link from 'next/link';
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
        <Link
          href={links.booking}
          className="inline-flex rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#cf8448]"
        >
          Customer Booking Form
        </Link>
        <Link
          href={links.provider}
          className="inline-flex rounded-full bg-coral px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#cf8448]"
        >
          Provider Application Form
        </Link>
      </div>
    </ContentPageLayout>
  );
}
