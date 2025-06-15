"use client";

import Link from "next/link";

// 仮のデータ
const mockMinutes = {
  id: "1",
  title: "週次ミーティング",
  date: "2024-03-20",
  duration: "45分",
  content: `
# 週次ミーティング議事録

## 参加者
- 山田太郎
- 鈴木花子
- 佐藤次郎

## 議題
1. プロジェクト進捗報告
2. 次週の予定確認
3. 課題共有

## 決定事項
- 新機能の開発を来週から開始
- 週次レポートのフォーマットを更新
- 次回ミーティングは3月27日 14:00から

## アクションアイテム
- [ ] 山田：新機能の仕様書作成
- [ ] 鈴木：週次レポートのテンプレート更新
- [ ] 佐藤：次回ミーティングの議題案作成
  `,
};

export default function MinutesPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/history" className="text-blue-500 hover:text-blue-600 transition-colors">
            ← 履歴に戻る
          </Link>
        </div>
        <h1 className="text-4xl font-bold mb-4">{mockMinutes.title}</h1>
        <div className="text-gray-500 mb-8">
          {mockMinutes.date} | {mockMinutes.duration}
        </div>
        <div className="prose max-w-none">
          <pre className="whitespace-pre-wrap">{mockMinutes.content}</pre>
        </div>
      </div>
    </main>
  );
}
