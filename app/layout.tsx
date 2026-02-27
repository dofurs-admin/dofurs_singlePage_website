import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';

export const metadata: Metadata = {
  title: 'Dofurs | Premium Pet Services, Simplified',
  description: 'Dofurs connects pet owners with verified pet care professionals for seamless bookings and trusted service.',
  keywords: ['pet services', 'pet sitting', 'vet visits', 'pet grooming', 'Dofurs'],
  openGraph: {
    title: 'Dofurs | Premium Pet Services, Simplified',
    description: 'Connecting pet parents with trusted pet care professionals.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dofurs | Premium Pet Services, Simplified',
    description: 'Connecting pet parents with trusted pet care professionals.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-7QBYYFJYHH" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-7QBYYFJYHH');
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "vnhku4n897");
          `}
        </Script>
      </head>
      <body>
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
