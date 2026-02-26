import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/HeroSection';
import HowItWorksSection from '@/components/HowItWorksSection';
import Navbar from '@/components/Navbar';
import ProviderSection from '@/components/ProviderSection';
import ServicesSection from '@/components/ServicesSection';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ServicesSection />
        <HowItWorksSection />
        <CTASection />
        <ProviderSection />
      </main>
      <Footer />
    </>
  );
}
