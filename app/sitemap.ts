import type { MetadataRoute } from 'next';
import { blogPosts } from '@/lib/blog-posts';

const SITE_URL = 'https://dofurs.in';

const staticRoutes = [
  '/',
  '/about',
  '/blog',
  '/contact-us',
  '/faqs',
  '/forms/birthday-booking',
  '/forms/customer-booking',
  '/forms/provider-application',
  '/privacy-policy',
  '/refer-and-earn',
  '/refund-cancellation-policy',
  '/terms-conditions',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.8,
  }));

  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticEntries, ...blogEntries];
}
