import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import Footer from "@/components/layout/Footer/Footer";
import Sidebar from "@/components/layout/Sidebar/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Yuno - 議事録作成アシスタント",
  description: "AIを活用した議事録作成アシスタント",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <div className="flex">
          <Sidebar />
          <div className="flex-1 bg-[#EFF0F5]">
            {children}
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
