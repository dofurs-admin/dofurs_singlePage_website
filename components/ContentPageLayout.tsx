import Navbar from './Navbar';
import Footer from './Footer';
import Image from 'next/image';
import { PawPrint } from 'lucide-react';
import { theme } from '@/lib/theme';

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
      <main className="bg-gradient-to-b from-[#fdf8f4] via-[#f8f5f2] to-white pt-24">
        <section className="relative overflow-hidden py-12 md:py-16">
          <PawPrint className="absolute left-8 top-10 h-8 w-8 text-[#e9c7ad]/30" aria-hidden="true" />
          <PawPrint className="absolute right-10 bottom-8 h-7 w-7 -rotate-12 text-[#e9c7ad]/20" aria-hidden="true" />
          <div className="absolute left-1/2 top-6 h-24 w-24 -translate-x-1/2 rounded-full bg-[#f3d8bf]/20 blur-2xl" aria-hidden="true" />

          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 rounded-3xl bg-[linear-gradient(135deg,_#fdf8f4_0%,_#f6efe9_100%)] p-6 shadow-soft md:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14 lg:p-10">
              <div className={heroImageFirstOnMobile ? 'order-2 text-center lg:order-1 lg:text-left' : 'order-1 text-center lg:text-left'}>
                <h1 className="text-[32px] font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-[#6b6b6b] md:text-lg">{description}</p>
              </div>

              <div
                className={`${heroImageFirstOnMobile ? 'order-1 lg:order-2' : 'order-2'} relative mx-auto w-full max-w-md overflow-hidden rounded-3xl shadow-soft`}
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
                  <div className="absolute inset-0 bg-gradient-to-l from-[#f6efe9]/55 via-transparent to-transparent" aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12 md:pb-16">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-[#f2dfcf] bg-white p-6 shadow-soft md:p-10">
              <div className="grid gap-4 text-ink/80 [&_h2]:mt-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
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
