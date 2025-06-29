import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import MainContent from "@/components/layout/MainContent";
import { AuthGuard } from "@/components/auth/AuthGuard";

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