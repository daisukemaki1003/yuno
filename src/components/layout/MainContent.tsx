"use client";

import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils";
import Header from "./Header";
import { usePathname } from "next/navigation";
import Footer from "./Footer";

interface MainContentProps {
  children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebarStore();
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname.startsWith("/history")) {
      return "議事録一覧";
    }
    if (pathname.startsWith("/record")) {
      return "文字起こし";
    }
    // 他のページもここに追加
    return "Yuno"; // デフォルトタイトル
  };

  const title = getTitle();

  return (
    <div
      className={cn(
        "min-h-screen bg-[#EFF0F5] transition-all duration-300 ease-in-out",
        isCollapsed ? "ml-16" : "ml-56"
      )}
    >
      <Header title={title} />
      {children}
    </div>
  );
}
