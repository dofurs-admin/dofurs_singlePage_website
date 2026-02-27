import ContentPageLayout from '@/components/ContentPageLayout';
import { BadgeCheck, Home, ShieldCheck } from 'lucide-react';

export default function AboutPage() {
  return (
    <ContentPageLayout
      title="About Dofurs"
      description="Premium pet care, simplified for modern pet parents. Trusted, transparent, and built with a pet-first mindset."
      heroImageSrc="/Birthday/dofurs-about-us.webp"
      heroImageAlt="About Dofurs"
    >
      <p>Bengaluru, India • dofurs.in • support@dofurs.com</p>

      <h2 className="mt-6 text-center text-2xl font-semibold text-ink">Our Mission</h2>
      <p className="mx-auto max-w-3xl text-center text-[#6b6b6b]">
        We are building India’s most trusted pet care platform where every pet parent can discover verified professionals,
        book confidently, and receive dependable support.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <ShieldCheck className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Certified Groomers</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Verified professionals with quality and hygiene standards.</p>
        </div>
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <Home className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Doorstep Service</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Comfort-first care at home for stress-free pet experiences.</p>
        </div>
        <div className="rounded-2xl border border-[#f1e6da] bg-white p-5 shadow-soft">
          <BadgeCheck className="h-7 w-7 text-coral" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">Trusted Locally</h3>
          <p className="mt-2 text-sm text-[#6b6b6b]">Loved by pet parents across Bengaluru for consistent quality.</p>
        </div>
      </div>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Who We Are</h2>
      <p>
        Dofurs is a Bengaluru-based pet care services platform built on a simple belief: pets deserve better, and so do
        the people who love them. We are a team of pet lovers, technologists, and care professionals focused on making
        trusted pet care easier to find and book.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Our Story</h2>
      <p>
        Dofurs was born from a real pet-parent experience: urgent care needs, long waits, and unreliable options. We
        started in Bengaluru with a clear mission to build a platform where pet parents can book verified, premium pet
        care services without chaos or compromise.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">What We Do</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Grooming:</strong> Professional grooming at trusted studios or at home.
        </li>
        <li>
          <strong>Veterinary Services:</strong> Access to licensed vets for in-clinic and online consultations.
        </li>
        <li>
          <strong>Pet Home Visits:</strong> Groomers and care providers at your doorstep.
        </li>
        <li>
          <strong>Online Vet Consultations:</strong> Real-time veterinary guidance from home.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Our Values</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>
          <strong>Trust:</strong> Verified professionals and backed bookings.
        </li>
        <li>
          <strong>Convenience:</strong> One platform for complete pet care journeys.
        </li>
        <li>
          <strong>Pets Deserve Better:</strong> A pet-first lens behind every decision.
        </li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Why Dofurs</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Verified professionals through structured onboarding and credential checks.</li>
        <li>Transparent booking with no hidden charges at checkout.</li>
        <li>End-to-end support from booking to completion.</li>
        <li>Built for Indian pet parents and local care realities.</li>
      </ul>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Where We Are Headed</h2>
      <p>
        We launched in Bengaluru and are expanding across neighbourhoods before growing to other Indian cities. Our
        vision is to become India’s most trusted pet care platform.
      </p>

      <h2 className="mt-4 text-2xl font-semibold text-ink">Get in Touch</h2>
      <p>Email: support@dofurs.com</p>
      <p>WhatsApp: +91 7008365175</p>
      <p>Headquarters: Bengaluru, Karnataka, India</p>
    </ContentPageLayout>
  );
}
