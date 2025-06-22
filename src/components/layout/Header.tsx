"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-20 shrink-0 items-center justify-between px-8 transition-all transition-colors duration-200",
        isScrolled ? "h-14 bg-white shadow-sm" : "bg-[#EFF0F5]"
      )}
    >
      <h1
        className={cn(
          "text-2xl font-bold text-gray-800 transition-all duration-200",
          isScrolled ? "text-lg" : "text-2xl"
        )}
      >
        {title}
      </h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></div>
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
          </div>
          録音中 00:42:18
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full bg-gray-500 hover:bg-gray-800"
        >
          <User className="h-6 w-6 text-white" />
        </Button>
      </div>
    </header>
  );
}
