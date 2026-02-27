import Navbar from './Navbar';
import Footer from './Footer';
import Image from 'next/image';
import { PawPrint } from 'lucide-react';
import FadeInSection from './FadeInSection';
import FloatingPawBackground from './FloatingPawBackground';

type ContentPageLayoutProps = {
  title: string;
  description: string;
  heroImageSrc?: string;
  heroImageAlt?: string;
  heroImageFirstOnMobile?: boolean;
  children: React.ReactNode;
};

export default function ContentPageLayout({
  title,
  description,
  heroImageSrc = '/Birthday/partners-with-dofurs.png',
  heroImageAlt = 'Dofurs pet care',
  heroImageFirstOnMobile = false,
  children,
}: ContentPageLayoutProps) {
  return (
    <>
      <Navbar />
      <main className="relative overflow-hidden bg-[linear-gradient(180deg,#fdf8f4_0%,#f8f5f2_28%,#ffffff_100%)] pt-24">
        <FloatingPawBackground />
        <section className="relative z-[2] overflow-hidden py-12 md:py-16 lg:py-20">
          <PawPrint className="absolute left-8 top-10 h-8 w-8 text-[#e9c7ad]/30" aria-hidden="true" />
          <PawPrint className="absolute right-10 bottom-8 h-7 w-7 -rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />
          <div className="absolute left-1/2 top-6 h-24 w-24 -translate-x-1/2 rounded-full bg-[#f3d8bf]/20 blur-2xl" aria-hidden="true" />

          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 rounded-[1.75rem] border border-[#f2dfcf] bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 shadow-[0_40px_80px_rgba(0,0,0,0.08)] md:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:p-10">
              <FadeInSection
                delay={0.05}
                className={heroImageFirstOnMobile ? 'order-2 text-center lg:order-1 lg:text-left' : 'order-1 text-center lg:text-left'}
              >
                <h1 className="text-[32px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-5xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-[15.5px] leading-7 text-[#5f5f5f] md:text-lg md:leading-8">{description}</p>
              </FadeInSection>

              <div
                className={`${heroImageFirstOnMobile ? 'order-1 lg:order-2' : 'order-2'} relative mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border border-[#f2dfcf] shadow-[0_22px_44px_rgba(0,0,0,0.10)]`}
              >
                <div className="relative aspect-[4/3]">
                  <Image
                    src={heroImageSrc}
                    alt={heroImageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 35vw"
                    className="object-cover object-[center_40%]"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-[#f6efe9]/60 via-[#f6efe9]/16 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#f6efe9]/22 via-transparent to-transparent" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 pb-12 md:pb-16 lg:pb-20">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-[1.75rem] border border-[#f2dfcf] bg-[linear-gradient(180deg,_#ffffff_0%,_#fdf8f4_34%,_#f8f3ed_100%)] p-6 shadow-[0_20px_46px_rgba(0,0,0,0.07)] md:p-10 lg:p-12">
              <div className="grid gap-6 text-ink/85 md:gap-8 [&_h2:first-of-type]:mt-0 [&_h2]:mt-8 [&_h2]:text-[1.75rem] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_p]:max-w-[76ch] [&_p]:text-[15.5px] [&_p]:leading-7 [&_ul]:max-w-[76ch] [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
