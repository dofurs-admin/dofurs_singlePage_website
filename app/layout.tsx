import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import WhatsAppFloatingButton from '@/components/WhatsAppFloatingButton';
import AppProviders from '@/components/ui/AppProviders';

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

const isDevelopment = process.env.NODE_ENV === 'development';

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
        {isDevelopment ? (
          <Script id="chunk-load-recovery" strategy="afterInteractive">
            {`
              (function() {
                var reloadKey = 'dofurs_chunk_reload_guard';
                var guardWindowMs = 30000;

                function isChunkLoadMessage(message) {
                  if (!message) {
                    return false;
                  }

                  var normalized = String(message).toLowerCase();
                  return (
                    normalized.indexOf('chunkloaderror') !== -1 ||
                    normalized.indexOf('loading chunk') !== -1 ||
                    normalized.indexOf('failed to fetch dynamically imported module') !== -1
                  );
                }

                function shouldReloadOnce() {
                  try {
                    var previous = Number(sessionStorage.getItem(reloadKey) || '0');
                    var now = Date.now();

                    if (previous && now - previous < guardWindowMs) {
                      return false;
                    }

                    sessionStorage.setItem(reloadKey, String(now));
                    return true;
                  } catch (_error) {
                    return true;
                  }
                }

                function attemptRecovery(message) {
                  if (!isChunkLoadMessage(message)) {
                    return;
                  }

                  if (!shouldReloadOnce()) {
                    return;
                  }

                  window.location.reload();
                }

                window.addEventListener('error', function(event) {
                  var nestedMessage = event && event.error && event.error.message;
                  attemptRecovery((event && event.message) || nestedMessage || '');
                });

                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event && event.reason;
                  var reasonMessage =
                    (reason && reason.message) ||
                    (typeof reason === 'string' ? reason : '');

                  attemptRecovery(reasonMessage);
                });
              })();
            `}
          </Script>
        ) : null}
      </head>
      <body suppressHydrationWarning>
        <AppProviders>
          {children}
          <WhatsAppFloatingButton />
        </AppProviders>
      </body>
    </html>
  );
}
