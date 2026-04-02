import { PageContent } from "@/components/PageContent";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <main className="h-screen flex flex-col p-4 sm:p-6 md:px-10 lg:px-16 max-w-4xl md:max-w-none lg:max-w-7xl mx-auto overflow-hidden min-h-[100dvh] pb-safe">
      <Header />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <PageContent />
      </div>
    </main>
  );
}
