'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { headerPageLinks, navItems } from '@/lib/site-data';
import { theme } from '@/lib/theme';
import BrandMark from './BrandMark';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        <Link href="/" aria-label="Go to homepage" className="pt-1.5">
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

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-[#f1e6da] bg-white/80 p-2 text-ink transition hover:bg-white lg:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <Link
          href="/#book"
          className={`hidden rounded-full px-5 py-2.5 text-sm font-semibold transition sm:inline-flex ${theme.colors.primary} ${theme.colors.primaryHover}`}
          aria-label="Jump to book a service section"
        >
          Book now
        </Link>
      </div>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="border-t border-[#f1e6da] bg-white/95 shadow-soft backdrop-blur-md lg:hidden"
        >
          <div className={`${theme.layout.container} grid gap-4 py-6 text-sm font-medium`}>
            {[...navItems, ...headerPageLinks].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-ink/80 transition hover:text-coral"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/#book"
              className={`inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`}
              aria-label="Jump to book a service section"
              onClick={() => setMenuOpen(false)}
            >
              Book now
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
