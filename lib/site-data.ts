import { Bath, Dog, HeartHandshake, Stethoscope, CalendarCheck2, PawPrint, Smile } from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
};

export const navItems: NavItem[] = [];

export const headerPageLinks: NavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Blog', href: '/blog' },
];

export const footerInfoLinks = [
  { label: 'About', href: '/about' },
  { label: 'Contact Us', href: '/contact-us' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Refer & Earn', href: '/refer-and-earn' },
  { label: 'Blog', href: '/blog' },
] as const;

export const footerPolicyLinks = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms & Conditions', href: '/terms-conditions' },
  { label: 'Refund & Cancellation', href: '/refund-cancellation-policy' },
] as const;

export const services = [
  {
    title: 'Dog & Cat Grooming at Home',
    description:
      'Full bath, blow-dry, nail trim and ear clean - done where your pet is most comfortable. We bring everything, including premium, breed-safe products.',
    icon: Bath,
  },
  {
    title: 'Vet Visits - Coming Soon',
    description: "We're bringing vet care to your doorstep next. Drop your details and we'll let you know the moment it goes live.",
    icon: Stethoscope,
  },
  {
    title: 'Pet Sitting - Coming Soon',
    description: 'Verified, caring pet sitters - coming soon to South Bangalore. Register your interest and be first in line.',
    icon: HeartHandshake,
  },
  {
    title: 'Pet Training - Coming Soon',
    description: 'Positive, reward-based training that actually works - and it will come to you. Get on the waitlist.',
    icon: Dog,
  },
] as const;

export const steps = [
  {
    title: 'Tell Us About Your Pet',
    description:
      "Share your pet's breed and size, pick a grooming package that fits, and see the price before you commit. No hidden costs.",
    icon: PawPrint,
  },
  {
    title: 'Pick a Time That Works',
    description: "Choose a slot, confirm your address, and you're done. We come to your home - no dropping off, no waiting in queues.",
    icon: CalendarCheck2,
  },
  {
    title: 'We Handle the Rest',
    description:
      "Your groomer arrives on time with everything they need. Watch your pet get pampered, or step away and trust us to handle it. Pay only once you're satisfied.",
    icon: Smile,
  },
] as const;

export const imagery = {
  hero: {
    src: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=2000&q=80',
    alt: 'Happy pet owner hugging a golden dog outdoors.',
  },
  fullWidth: {
    src: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=2000&q=80',
    alt: 'Smiling dog looking toward the camera in warm light.',
  },
};

export const links = {
  booking: '/forms/customer-booking',
  provider: '/forms/provider-application',
  birthdayBooking: '/forms/birthday-booking',
};

export const formEmbeds = {
  booking:
    'https://docs.google.com/forms/d/e/1FAIpQLScV2Ew_Bdo5ijIL-wYFeQn4Mf_em2U3UCX1QSWRAEh88bYcxA/viewform?embedded=true',
  provider:
    'https://docs.google.com/forms/d/e/1FAIpQLSenGg1wIlXDjsvRtFhStnMYTetVRXcB6zz-cz60Aa7nwSjXUw/viewform?embedded=true',
  birthdayBooking:
    'https://docs.google.com/forms/d/e/1FAIpQLSeeaIrVbHFHbqO8I_BvSyE6cA7_Nu7YYdzY2Xr70UlU8S_gPg/viewform?embedded=true',
} as const;

export const reviews = [
  {
    quote: 'Bruno came back looking fresh and smelling great. The groomer was so patient with him - he is usually a nightmare with strangers.',
    name: 'Riya M.',
    role: 'Golden Retriever parent, Electronic City',
  },
  {
    quote: 'Showed up exactly when they said they would. My dog was relaxed through the whole thing, which honestly surprised me.',
    name: 'Arjun K.',
    role: 'Dog parent, Phase 2',
  },
  {
    quote: 'My cat hates being touched by anyone outside the family. Somehow the groomer had her purring by the end of it. That is not easy to do.',
    name: 'Sneha P.',
    role: 'Cat parent, Neeladri Nagar',
  },
] as const;
