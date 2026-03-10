import CTASection from '@/components/CTASection';
import BirthdayBannerSection from '@/components/BirthdayBannerSection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import Navbar from '@/components/Navbar';
import ProviderSection from '@/components/ProviderSection';
import ReviewsSection from '@/components/ReviewsSection';
import ServicesSection from '@/components/ServicesSection';
import FloatingPawBackground from '@/components/FloatingPawBackground';
import Script from 'next/script';

export default function HomePage() {
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Dofurs',
    url: 'https://dofurs.in',
    areaServed: 'Electronic City, Bangalore',
    description: 'Dog and cat grooming at home in Electronic City, Bangalore.',
    serviceType: 'Pet Grooming',
  };

  const aggregateRatingSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Home Pet Grooming by Dofurs',
    provider: {
      '@type': 'LocalBusiness',
      name: 'Dofurs',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      ratingCount: '100',
    },
  };

  return (
    <>
      <Script id="local-business-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(localBusinessSchema)}
      </Script>
      <Script id="aggregate-rating-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(aggregateRatingSchema)}
      </Script>
      <Navbar />
      <main className="relative overflow-hidden">
        <FloatingPawBackground />
        <div className="relative z-[2]">
          <HeroSection />
          <ServicesSection />
          <HowItWorksSection />
          <BirthdayBannerSection />
          <CTASection />
          <ReviewsSection />
          <ProviderSection />
        </div>
      </main>
      <Footer />
    </>
  );
}
