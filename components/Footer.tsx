import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import { footerInfoLinks, footerPolicyLinks } from '@/lib/site-data';
import { theme } from '@/lib/theme';

const socials = [
  { icon: Twitter, href: 'https://x.com/dofurs', label: 'Twitter' },
  { icon: Youtube, href: 'https://www.youtube.com/@dofurspetcare', label: 'YouTube' },
  { icon: Linkedin, href: 'https://www.linkedin.com/company/dofurs-petcare/', label: 'LinkedIn' },
  { icon: Instagram, href: 'https://www.instagram.com/dofurs.petcare/', label: 'Instagram' },
  { icon: Facebook, href: 'https://www.facebook.com/profile.php?id=61568180277956', label: 'Facebook' },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#eadbcd] bg-[#fdf8f4] py-16">
      <div className={`${theme.layout.container} grid gap-12 md:grid-cols-2 lg:grid-cols-4`}>
        <div className="lg:col-span-1">
          <BrandMark compact />
          <p className="mt-4 text-xs text-ink/60">© {new Date().getFullYear()} Dofurs. All rights reserved.</p>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Explore</p>
          <div className="mt-4 grid gap-2.5">
            {footerInfoLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-ink/75 transition-all duration-300 hover:translate-x-0.5 hover:text-coral">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Policies</p>
          <div className="mt-4 grid gap-2.5">
            {footerPolicyLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-ink/75 transition-all duration-300 hover:translate-x-0.5 hover:text-coral">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold tracking-wide text-ink/95">Follow</p>
          <div className="mt-4 flex items-center gap-3">
          {socials.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-coral hover:text-white hover:shadow-[0_10px_20px_rgba(227,154,93,0.35)]"
              >
                <Icon size={18} />
              </a>
            );
          })}
          </div>
        </div>
      </div>
      <div className={`${theme.layout.container} mt-12 border-t border-[#eadbcd] pt-7 text-center text-xs text-ink/55`}>
        Crafted with care for pet parents and professionals.
      </div>
    </footer>
  );
}
