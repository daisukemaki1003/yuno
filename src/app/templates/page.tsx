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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">テンプレート一覧</h1>
          <Link
            href="/templates/new"
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            新規作成
          </Link>
        </div>
        <div className="space-y-4">
          {mockTemplates.map((template) => (
            <div
              key={template.id}
              className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{template.title}</h2>
              <p className="text-gray-600">{template.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/" className="text-blue-500 hover:text-blue-600 transition-colors">
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
