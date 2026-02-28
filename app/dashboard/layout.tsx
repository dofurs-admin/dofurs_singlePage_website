import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="bg-[#fffaf6] pt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <section>{children}</section>
        </div>
      </main>
      <Footer />
    </>
  );
}
