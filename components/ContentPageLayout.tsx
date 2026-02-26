import Navbar from './Navbar';
import Footer from './Footer';
import { theme } from '@/lib/theme';

type ContentPageLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export default function ContentPageLayout({ title, description, children }: ContentPageLayoutProps) {
  return (
    <>
      <Navbar />
      <main className="pt-24">
        <section className="bg-peach/30 py-12 md:py-16">
          <div className={theme.layout.container}>
            <h1 className="text-3xl font-semibold tracking-tight text-ink md:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-ink/75 md:text-lg">{description}</p>
          </div>
        </section>
        <section className="py-12 md:py-16">
          <div className={`${theme.layout.container} grid gap-4 text-ink/80`}>{children}</div>
        </section>
      </main>
      <Footer />
    </>
  );
}
