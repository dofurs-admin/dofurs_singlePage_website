'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Menu, X, UserRound, LayoutDashboard, PawPrint, LogOut, Settings } from 'lucide-react';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { headerPageLinks, navItems } from '@/lib/site-data';
import { theme } from '@/lib/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import BrandMark from './BrandMark';

export default function Navbar() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    let active = true;

    async function loadCurrentUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setAuthUser(session?.user ?? null);
      setIsAuthResolved(true);
    }

    loadCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setProfilePhotoUrl(null);
        setIsAuthResolved(true);
        return;
      }

      setAuthUser(session?.user ?? null);
      setIsAuthResolved(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfilePhoto() {
      if (!authUser) {
        setProfilePhotoUrl(null);
        return;
      }

      const response = await fetch('/api/user/profile', {
        method: 'GET',
      });

      if (!active || !response.ok) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { profile?: { photo_url?: string | null } } | null;
      const photoPath = payload?.profile?.photo_url;

      if (!photoPath) {
        setProfilePhotoUrl(null);
        return;
      }

      if (/^https?:\/\//i.test(photoPath)) {
        setProfilePhotoUrl(photoPath);
        return;
      }

      const signedResponse = await fetch('/api/storage/signed-read-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucket: 'user-photos',
          path: photoPath,
          expiresIn: 3600,
        }),
      });

      if (!active || !signedResponse.ok) {
        setProfilePhotoUrl(null);
        return;
      }

      const signedPayload = (await signedResponse.json().catch(() => null)) as { signedUrl?: string } | null;
      setProfilePhotoUrl(signedPayload?.signedUrl ?? null);
    }

    loadProfilePhoto();

    return () => {
      active = false;
    };
  }, [authUser]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setMenuOpen(false);
    setProfileMenuOpen(false);
    setAuthUser(null);
    router.replace('/auth/sign-in?mode=signin');
    router.refresh();
  }

  const initialsSource = (authUser?.user_metadata?.name as string | undefined)?.trim() || authUser?.email || 'U';
  const initials = initialsSource.slice(0, 1).toUpperCase();
  const displayName = (authUser?.user_metadata?.name as string | undefined)?.trim() || authUser?.email || 'User';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 shadow-soft backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <div className={`${theme.layout.container} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label="Go to homepage" className="pt-1">
          <BrandMark compact />
        </Link>

        <nav aria-label="Main navigation" className="hidden flex-1 items-center justify-center gap-6 text-sm font-medium lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="relative pb-1 text-ink/80 transition-all duration-300 hover:text-coral after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-coral after:transition-transform after:duration-300 hover:after:scale-x-100">
              {item.label}
            </Link>
          ))}
          {headerPageLinks.map((item) => (
            <Link key={item.href} href={item.href} className="relative pb-1 text-ink/80 transition-all duration-300 hover:text-coral after:absolute after:bottom-[-2px] after:left-0 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-coral after:transition-transform after:duration-300 hover:after:scale-x-100">
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

        <div className="hidden items-center gap-2 lg:flex" ref={profileMenuRef}>
          <Link
            href="/forms/customer-booking#start-your-booking"
            className={`inline-flex rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)] ${theme.colors.primary} ${theme.colors.primaryHover}`}
            aria-label="Go to customer booking page"
          >
            Book now
          </Link>

          {isAuthResolved && authUser ? (
            <>
              <Link
                href="/dashboard/user"
                className="inline-flex rounded-full border border-[#f1e6da] bg-white px-4 py-2 text-sm font-semibold text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#fff7f0]"
                aria-label="Open your dashboard"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f1e6da] bg-[#fff7f0] text-sm font-bold text-ink transition hover:bg-[#ffefe0]"
                aria-label="Open user profile menu"
              >
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="h-full w-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </button>

              {profileMenuOpen ? (
                <div className="absolute right-4 top-14 z-[60] w-64 rounded-2xl border border-[#f2dfcf] bg-white p-2 shadow-soft-md">
                  <div className="rounded-xl bg-[#fff7f0] px-3 py-2 text-sm font-semibold text-ink">{displayName}</div>
                  <Link
                    href="/dashboard/user/profile"
                    className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#fff7f0]"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <UserRound className="h-4 w-4" />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/user/pets"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#fff7f0]"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <PawPrint className="h-4 w-4" />
                    Pet Profiles
                  </Link>
                  <Link
                    href="/dashboard/user/settings"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#fff7f0]"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink transition hover:bg-[#fff7f0]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </>
          ) : isAuthResolved ? (
            <>
              <Link
                href="/auth/sign-in?mode=signin"
                className="inline-flex rounded-full border border-[#f1e6da] bg-white px-4 py-2 text-sm font-semibold text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#fff7f0]"
                aria-label="Log in to your account"
              >
                Log in
              </Link>

              <Link
                href="/auth/sign-in?mode=signup"
                className="inline-flex rounded-full border border-[#f1e6da] bg-[#fff7f0] px-4 py-2 text-sm font-semibold text-ink transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-[#ffefe0]"
                aria-label="Create an account"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-navigation" className="border-t border-[#f1e6da] bg-white/95 shadow-soft backdrop-blur-md lg:hidden">
          <div className={`${theme.layout.container} grid gap-4 py-6 text-sm font-medium`}>
            {[...navItems, ...headerPageLinks].map((item) => (
              <Link key={item.href} href={item.href} className="text-ink/80 transition hover:text-coral" onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            ))}

            <Link href="/forms/customer-booking#start-your-booking" className={`inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${theme.colors.primary} ${theme.colors.primaryHover}`} aria-label="Go to customer booking page" onClick={() => setMenuOpen(false)}>
              Book now
            </Link>

            {isAuthResolved && authUser ? (
              <>
                <Link href="/dashboard/user" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#fff7f0]" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/dashboard/user/profile" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-[#fff7f0] px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#ffefe0]" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <Link href="/dashboard/user/pets" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-[#fff7f0] px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#ffefe0]" onClick={() => setMenuOpen(false)}>
                  Pet Profiles
                </Link>
                <Link href="/dashboard/user/settings" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-[#fff7f0] px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#ffefe0]" onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>
                <button type="button" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#fff7f0]" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : isAuthResolved ? (
              <>
                <Link href="/auth/sign-in?mode=signin" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#fff7f0]" aria-label="Log in to your account" onClick={() => setMenuOpen(false)}>
                  Log in
                </Link>
                <Link href="/auth/sign-in?mode=signup" className="inline-flex w-full items-center justify-center rounded-full border border-[#f1e6da] bg-[#fff7f0] px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#ffefe0]" aria-label="Create an account" onClick={() => setMenuOpen(false)}>
                  Sign up
                </Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
