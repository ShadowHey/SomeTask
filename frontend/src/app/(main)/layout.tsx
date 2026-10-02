import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingModal } from "@/components/OnboardingModal";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <TopBar />
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative h-full">
          <div className="mx-auto w-full p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <OnboardingModal />
    </div>
  );
}
