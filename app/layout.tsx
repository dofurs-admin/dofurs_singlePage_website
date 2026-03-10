import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';

export const metadata: Metadata = {
  metadataBase: new URL('https://dofurs.in'),
  title: 'Dofurs | Dog & Cat Grooming at Home - Electronic City, Bangalore',
  description:
    "Tired of dragging your pet to a salon? Dofurs brings professional grooming home - trusted groomers, safe products, prices that don't sting.",
  keywords: ['dog grooming electronic city', 'dog grooming at home', 'cat grooming', 'pet grooming bangalore', 'Dofurs'],
  openGraph: {
    title: 'Dofurs | Dog & Cat Grooming at Home - Electronic City, Bangalore',
    description:
      "Tired of dragging your pet to a salon? Dofurs brings professional grooming home - trusted groomers, safe products, prices that don't sting.",
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/Birthday/book-a-service.png',
        width: 1200,
        height: 800,
        alt: 'Dog being groomed at home by a professional groomer in Electronic City, Bangalore',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dofurs | Dog & Cat Grooming at Home - Electronic City, Bangalore',
    description:
      "Tired of dragging your pet to a salon? Dofurs brings professional grooming home - trusted groomers, safe products, prices that don't sting.",
    images: ['/Birthday/book-a-service.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body suppressHydrationWarning>
        {children}
        <WhatsAppFloatingButton />
      </body>
    </html>
  );
}
