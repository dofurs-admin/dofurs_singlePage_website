import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://dofurs.in/sitemap.xml',
    host: 'https://dofurs.in',
  };
}
