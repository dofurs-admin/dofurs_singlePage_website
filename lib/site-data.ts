import { Bath, Dog, HeartHandshake, Stethoscope, CalendarCheck2, PawPrint, Smile } from 'lucide-react';

export const navItems = [
] as const;

export const headerPageLinks = [
  { label: 'About', href: '/about' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Blog', href: '/blog' },
] as const;

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
    title: 'Grooming',
    description: 'Professional grooming sessions that keep coats healthy, clean, and camera-ready.',
    icon: Bath,
  },
  {
    title: 'Vet Visits',
    description: 'Trusted veterinary support for preventive checkups, wellness plans, and urgent needs.',
    icon: Stethoscope,
  },
  {
    title: 'Pet Sitting',
    description: 'Reliable sitters who give your pet personalized care while you are away.',
    icon: HeartHandshake,
  },
  {
    title: 'Training',
    description: 'Positive reinforcement training to improve behavior and strengthen your bond.',
    icon: Dog,
  },
] as const;

export const steps = [
  {
    title: 'Choose Service',
    description: 'Compare verified providers and pick the right care for your pet.',
    icon: PawPrint,
  },
  {
    title: 'Book Instantly',
    description: 'Book in minutes using a smooth booking workflow and transparent details.',
    icon: CalendarCheck2,
  },
  {
    title: 'Relax & Enjoy',
    description: 'Get updates and peace of mind while your pet receives excellent care.',
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
  booking:
    'https://docs.google.com/forms/d/e/1FAIpQLScV2Ew_Bdo5ijIL-wYFeQn4Mf_em2U3UCX1QSWRAEh88bYcxA/viewform',
  provider:
    'https://docs.google.com/forms/d/e/1FAIpQLSenGg1wIlXDjsvRtFhStnMYTetVRXcB6zz-cz60Aa7nwSjXUw/viewform',
  birthdayBooking: 'https://forms.gle/MFcqF4cgKFe5uwqS7',
};

export const reviews = [
  {
    quote: 'Booked grooming and sitting in one flow. Clear updates and a calm, happy pup at pickup.',
    name: 'Riya M.',
    role: 'Pet Parent',
  },
  {
    quote: 'The provider was punctual, gentle, and professional. The booking experience felt truly seamless.',
    name: 'Arjun K.',
    role: 'Dog Owner',
  },
  {
    quote: 'Fast confirmation, transparent details, and excellent care quality. Dofurs made life easier.',
    name: 'Sneha P.',
    role: 'Cat Parent',
  },
] as const;
