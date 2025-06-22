"use client";

import Link from "next/link";

// 仮のデータ
const mockTemplates = [
  {
    id: "1",
    title: "週次ミーティング",
    description: "週次の進捗報告ミーティング用テンプレート",
  },
  {
    id: "2",
    title: "プロジェクトキックオフ",
    description: "新規プロジェクト開始時のキックオフミーティング用テンプレート",
  },
];

export default function TemplatesPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">テンプレート一覧</h1>
          <Link
            href="/templates/new"
            className="rounded-lg bg-blue-500 px-6 py-3 text-white transition-colors hover:bg-blue-600"
          >
            新規作成
          </Link>
        </div>
        <div className="space-y-4">
          {mockTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
            >
              <h2 className="mb-2 text-xl font-semibold">{template.title}</h2>
              <p className="text-gray-600">{template.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            href="/"
            className="text-blue-500 transition-colors hover:text-blue-600"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
