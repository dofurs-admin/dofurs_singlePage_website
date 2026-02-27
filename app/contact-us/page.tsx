import Link from 'next/link';
import ContentPageLayout from '@/components/ContentPageLayout';
import { links } from '@/lib/site-data';

export default function ContactUsPage() {
  return (
    <ContentPageLayout
      title="Contact Us"
      description="Have a question, feedback, or partnership request? We are here to help."
      heroImageSrc="/Birthday/contact%20us_new.png"
      heroImageAlt="Contact Dofurs"
    >
      <div className="h-px w-full bg-[#efdecd]" aria-hidden="true" />
      <div className="grid gap-2 rounded-3xl border border-[#f2dfcf] bg-[#fffdfb] p-6 shadow-soft-sm md:p-7">
        <p className="text-[15.5px] leading-7 text-ink/80">Email: petcare@dofurs.in</p>
        <p className="text-[15.5px] leading-7 text-ink/80">Support Hours: Monday to Saturday, 9:00 AM - 7:00 PM</p>
      </div>
      <div className="mt-1 flex flex-wrap gap-4">
        <Link
          href={links.booking}
          className="inline-flex rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Customer Booking Form
        </Link>
        <Link
          href={links.provider}
          className="inline-flex rounded-full bg-coral px-7 py-3 text-sm font-semibold text-white shadow-soft-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_14px_28px_rgba(227,154,93,0.32)]"
        >
          Provider Application Form
        </Link>
      </div>
    </ContentPageLayout>
  );
}
