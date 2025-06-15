"use client";

import Link from "next/link";

interface HeaderProps {
  title?: React.ReactNode;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 border-b border-gray-200">
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between">
          <div className="flex items-center space-x-4">
            {title}
            <Link href="/templates/new" className="text-gray-600 hover:text-gray-900">
              テンプレート作成
            </Link>
            <button className="text-gray-600 hover:text-gray-900">設定</button>
          </div>
        </div>
      </div>
    </header>
  );
}
