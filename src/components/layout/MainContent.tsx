"use client";

import { useSidebarStore } from "@/app/lib/stores/sidebar-store";
import { cn } from "@/app/lib/utils";
import Header from "./Header";
import { usePathname } from "next/navigation";
import Footer from "./Footer";

interface MainContentProps {
  children: React.ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebarStore();

  return (
    <div
      className={cn(
        "min-h-screen bg-[#EFF0F5] transition-all duration-300 ease-in-out",
        isCollapsed ? "ml-16" : "ml-56"
      )}
    >
      <Header />
      {children}
    </div>
  );
}
