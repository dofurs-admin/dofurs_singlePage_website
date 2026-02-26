import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
