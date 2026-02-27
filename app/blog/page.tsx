import ContentPageLayout from '@/components/ContentPageLayout';
import Link from 'next/link';
import { blogPosts } from '@/lib/blog-posts';

export default function BlogPage() {
  return (
    <ContentPageLayout
      title="Blog"
      description="Expert guides, care tips, and practical advice that help pet parents make confident care decisions."
      heroImageSrc="/Birthday/Blog_new.png"
      heroImageAlt="Dofurs blog"
    >
      {blogPosts.map((post) => (
        <article key={post.slug} className="rounded-3xl border border-[#f1e6da] bg-[#fffdfb] p-6 shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg md:p-7">
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink/70">
            <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-3 py-1 font-medium text-ink/80">{post.category}</span>
            <span>{post.readTime}</span>
            <span>•</span>
            <span>{post.publishedOn}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-ink">{post.title}</h2>
          <p className="mt-3 text-ink/75 md:text-[16px] md:leading-7">{post.excerpt}</p>
          <Link
            href={`/blog/${post.slug}`}
            className="mt-5 inline-flex rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#cf8448] hover:shadow-[0_10px_22px_rgba(227,154,93,0.35)]"
          >
            Read article
          </Link>
        </article>
      ))}
    </ContentPageLayout>
  );
}
