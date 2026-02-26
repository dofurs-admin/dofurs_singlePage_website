import { Instagram, Linkedin, Twitter } from 'lucide-react';
import BrandMark from './BrandMark';
import { theme } from '@/lib/theme';

const socials = [
  { icon: Instagram, href: '#', label: 'Instagram placeholder' },
  { icon: Twitter, href: '#', label: 'Twitter placeholder' },
  { icon: Linkedin, href: '#', label: 'LinkedIn placeholder' },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#efe4d8] bg-white py-10">
      <div className={`${theme.layout.container} flex flex-col items-start justify-between gap-6 md:flex-row md:items-center`}>
        <div>
          <BrandMark compact />
          <p className="mt-3 text-sm text-ink/70">{theme.brandLine}</p>
          <p className="mt-1 text-xs text-ink/55">© {new Date().getFullYear()} Dofurs. All rights reserved.</p>
        </div>
        <div className="flex items-center gap-3">
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
    </footer>
  );
}
