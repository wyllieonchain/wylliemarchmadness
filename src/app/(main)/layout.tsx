import TopNav from "@/components/TopNav";
import BottomTabs from "@/components/BottomTabs";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 px-4 py-8 pb-24 md:pb-8 max-w-3xl mx-auto w-full overflow-y-auto">
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
