"use client";

import Link from "next/link";

// 仮のデータ
const mockHistory = [
  {
    id: "1",
    title: "週次ミーティング",
    date: "2024-03-20",
    duration: "45分",
  },
  {
    id: "2",
    title: "プロジェクト進捗報告",
    date: "2024-03-19",
    duration: "30分",
  },
];

export default function HistoryPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">録音履歴</h1>
        <div className="space-y-4">
          {mockHistory.map((item) => (
            <Link
              key={item.id}
              href={`/minutes/${item.id}`}
              className="block rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="text-gray-500">{item.date}</p>
                </div>
                <div className="text-gray-600">{item.duration}</div>
              </div>
            </Link>
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
