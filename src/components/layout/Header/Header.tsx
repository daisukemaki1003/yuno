"use client";

import { Button } from "@/components/ui/Button";
import IcoUser from "@/components/icons/common/ico_user.svg";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="z-10 flex h-[88px] shrink-0 items-center justify-between px-8">
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></div>
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
          </div>
          録音中 00:42:18
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-gray-100">
          <IcoUser className="h-6 w-6 text-gray-500" />
        </Button>
      </div>
    </header>
  );
}
