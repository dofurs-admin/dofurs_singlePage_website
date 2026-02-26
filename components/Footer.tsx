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
    <footer className="border-t border-[#efe4d8] bg-white py-10">
      <div className={`${theme.layout.container} grid gap-8 md:grid-cols-2 lg:grid-cols-4`}>
        <div className="lg:col-span-1">
          <BrandMark compact />
          <p className="mt-2 text-xs text-ink/55">© {new Date().getFullYear()} Dofurs. All rights reserved.</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Explore</p>
          <div className="mt-3 grid gap-2">
            {footerInfoLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-ink/75 transition hover:text-coral">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Policies</p>
          <div className="mt-3 grid gap-2">
            {footerPolicyLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-ink/75 transition hover:text-coral">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink">Follow</p>
          <div className="mt-3 flex items-center gap-3">
          {socials.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand text-ink transition hover:bg-coral hover:text-white"
              >
                <Icon size={18} />
              </a>
            );
          })}
          </div>
        </div>
      </div>
    </footer>
  );
}
