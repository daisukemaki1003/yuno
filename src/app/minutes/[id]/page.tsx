"use client";

import Link from "next/link";
import Header from "@/components/layout/Header/Header";
import { MeetingNote } from "@/app/record/components/MeetingNote";
import { TocMenu } from "@/app/record/components/TocMenu";

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
  // TODO: params.id を使ってAPIからデータを取得する
  const mockTitle = "議事録のタイトルが入ります";

  return (
    <div className="flex h-screen flex-col bg-[#F9F9F9]">
      <Header title={mockTitle} />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto flex max-w-[1200px] gap-8">
          <div className="min-w-0 flex-1">
            <MeetingNote />
          </div>
          <div className="sticky top-8 h-fit w-[300px] flex-shrink-0">
            <TocMenu />
          </div>
        </div>
      </main>
    </div>
  );
}
