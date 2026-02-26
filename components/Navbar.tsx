'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { headerPageLinks, navItems } from '@/lib/site-data';
import { theme } from '@/lib/theme';
import BrandMark from './BrandMark';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 shadow-soft backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className={`${theme.layout.container} flex h-20 items-center justify-between gap-4`}>
        <Link href="/" aria-label="Go to homepage">
          <BrandMark compact />
        </Link>

        <nav aria-label="Main navigation" className="hidden gap-5 text-sm font-medium lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink/80 transition hover:text-coral">
              {item.label}
            </Link>
          ))}
          {headerPageLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink/80 transition hover:text-coral">
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/#book"
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
          aria-label="Jump to book a service section"
        >
          Book now
        </Link>
      </div>
    </header>
  );
}
