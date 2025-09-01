import Footer from "@/shared/components/layout/Footer";
import Sidebar from "@/shared/components/layout/Sidebar";
import MainContent from "@/shared/components/layout/MainContent";
import {AuthGuard} from "@/shared/components/layout/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <Sidebar />
      <MainContent>
        {children}
        <Footer />
      </MainContent>
    </AuthGuard>
  );
}
