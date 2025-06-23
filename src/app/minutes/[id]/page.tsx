"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import ReactMarkdown from "react-markdown";
import "github-markdown-css";
import "@/styles/github-markdown-override.css";
import {
  DownloadIcon,
  FileIcon,
  FileOutput,
  SaveIcon,
  SquarePenIcon,
} from "lucide-react";

export default function MinutesDetailPage() {
  // 仮のデータ
  const meeting = {
    title: "2025年6月 営業戦略ミーティング",
    date: "2025年6月5日（木） 14:00〜15:00",
    category: "製品開発, UI/UX",
    template: "営業会議テンプレート",
  };

  // 議事録・文字起こしのモックデータ
  const mockMinutes = `
## 議題
1. 前回の営業活動の振り返り\n2. 第2四半期の営業目標設定\n3. 新規顧客獲得戦略\n4. 営業チームの体制について

### 1. 前回の営業活動の振り返り
- 売上目標達成率: 95%（前年比+5%）
- 新規顧客獲得数: 12社（目標15社）
- 既存顧客からの追加受注: 8件（前年比+2件）
`;
  const mockTranscript = `
（14:00）
A: それでは営業戦略ミーティングを始めます。
B: よろしくお願いします。まずは前回の営業活動の振り返りから。
A: 売上目標達成率は95%でした。新規顧客は12社獲得できました。
B: 目標には少し届きませんでしたが、既存顧客からの追加受注が増えています。
（...省略...）
`;

  const [tab, setTab] = useState<"minutes" | "transcript">("minutes");

  return (
    <main className="min-h-screen px-8">
      {/* ヘッダー部分 */}
      <div className="mx-auto mb-8 flex flex-col gap-4 rounded-2xl bg-white p-8 shadow">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">{meeting.title}</h1>
            <div className="mb-1 text-sm text-gray-500">
              <span className="mr-4">開催日時 {meeting.date}</span>
            </div>
            <div className="mb-1 text-sm text-gray-500">
              <span className="mr-4">カテゴリ {meeting.category}</span>
            </div>
            <div className="text-xs text-gray-400">
              この議事録は「
              <span className="cursor-pointer text-blue-600 underline">
                {meeting.template}
              </span>
              」を元に作成されました
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileOutput className="mr-2 h-4 w-4" /> エクスポート
            </Button>
            <Button variant="outline">
              <SquarePenIcon className="mr-2 h-4 w-4" /> 編集
            </Button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="mx-auto w-full rounded-2xl bg-white">
        {/* タブ */}
        <div className="flex border-b">
          <button
            className={`w-full px-6 py-4 text-sm font-semibold transition-colors focus:outline-none ${tab === "minutes" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-blue-500"}`}
            onClick={() => setTab("minutes")}
          >
            議事録
          </button>
          <button
            className={`w-full px-6 py-2 text-sm font-semibold transition-colors focus:outline-none ${tab === "transcript" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-blue-500"}`}
            onClick={() => setTab("transcript")}
          >
            文字起こし
          </button>
        </div>
        <div className="p-8">
          {tab === "minutes" ? (
            <div className="markdown-body">
              <ReactMarkdown>{mockMinutes}</ReactMarkdown>
            </div>
          ) : (
            <pre className="text-sm whitespace-pre-wrap text-gray-800">
              {mockTranscript}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}
