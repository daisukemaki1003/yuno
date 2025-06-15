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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">録音履歴</h1>
        <div className="space-y-4">
          {mockHistory.map((item) => (
            <Link
              key={item.id}
              href={`/minutes/${item.id}`}
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
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
          <Link href="/" className="text-blue-500 hover:text-blue-600 transition-colors">
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
