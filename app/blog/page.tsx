import ContentPageLayout from '@/components/ContentPageLayout';

const posts = [
  {
    title: 'How to Choose the Right Grooming Service for Your Pet',
    excerpt: 'A practical checklist to compare groomers, hygiene standards, and post-care guidance.',
  },
  {
    title: 'Pet Sitting Guide: Questions Every Pet Parent Should Ask',
    excerpt: 'The key questions that help you pick dependable sitters for stress-free travel.',
  },
  {
    title: 'Routine Vet Visits: Preventive Care That Matters',
    excerpt: 'What to include in wellness checkups and how regular visits reduce long-term health risks.',
  },
];

export default function BlogPage() {
  return (
    <ContentPageLayout
      title="Blog"
      description="Expert guides, care tips, and practical advice for healthier, happier pets."
      heroImageSrc="/Birthday/faq-page.webp"
      heroImageAlt="Dofurs blog"
    >
      {posts.map((post) => (
        <article key={post.title} className="rounded-2xl border border-[#f1e6da] bg-white p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-ink">{post.title}</h2>
          <p className="mt-3 text-ink/75">{post.excerpt}</p>
        </article>
      ))}
    </ContentPageLayout>
  );
}
