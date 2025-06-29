"use client";

import { useSidebarStore } from "@/lib/stores/sidebar-store";
import { cn } from "@/lib/utils";
import Header from "./Header";

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
