import CTASection from '@/components/CTASection';
import BirthdayBannerSection from '@/components/BirthdayBannerSection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import Navbar from '@/components/Navbar';
import ProviderSection from '@/components/ProviderSection';
import ReviewsSection from '@/components/ReviewsSection';
import ServicesSection from '@/components/ServicesSection';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <BirthdayBannerSection />
        <CTASection />
        <ReviewsSection />
        <ProviderSection />
      </main>
      <Footer />
    </>
  );
}
