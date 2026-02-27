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

export default function HomePage() {
  return (
    <>
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
