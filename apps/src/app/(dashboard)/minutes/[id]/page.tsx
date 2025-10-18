"use client";

import {useMemo, useState} from "react";
import {Button} from "@/shared/components/atoms/Button";
import ReactMarkdown from "react-markdown";
import "github-markdown-css";
import "@/styles/github-markdown-override.css";
import {FileOutput, SquarePenIcon} from "lucide-react";
import {withAuth} from "@/shared/hooks/useAuth";
import {useMeetingDetail} from "@/features/meetings/hooks/useMeetingDetail";

interface MinutesDetailPageProps {
  params: {
    id: string;
  };
}

function MinutesDetailPage({params}: MinutesDetailPageProps) {
  const [tab, setTab] = useState<"minutes" | "transcript">("minutes");
  const {detail, loading, error} = useMeetingDetail(params.id);

  const meeting = useMemo(
    () =>
      detail || {
        id: params.id,
        title: "議事録を読み込み中...",
        date: "",
        category: "",
        templateName: "",
        minutesMarkdown: "",
        transcriptText: "",
      },
    [detail, params.id]
  );

  return (
    <main className="min-h-screen px-8">
      {/* ヘッダー部分 */}
      <div className="mx-auto mb-8 flex flex-col gap-4 rounded-2xl bg-white p-8 shadow">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold">{meeting.title}</h1>
            <div className="mb-1 text-sm text-gray-500">
              <span className="mr-4">
                {meeting.date ? `開催日時 ${meeting.date}` : "開催日時を取得しています..."}
              </span>
            </div>
            <div className="mb-1 text-sm text-gray-500">
              <span className="mr-4">
                {meeting.category ? `カテゴリ ${meeting.category}` : "カテゴリを取得しています..."}
              </span>
            </div>
            <div className="text-xs text-gray-400">
              この議事録は「
              <span className="cursor-pointer text-blue-600 underline">
                {meeting.templateName || "テンプレート情報読込中"}
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
          {loading && (
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && tab === "minutes" && (
            <div className="markdown-body">
              <ReactMarkdown>
                {meeting.minutesMarkdown || "議事録のデータがまだありません。"}
              </ReactMarkdown>
            </div>
          )}

          {!loading && !error && tab === "transcript" && (
            <pre className="whitespace-pre-wrap text-sm text-gray-800">
              {meeting.transcriptText || "文字起こしのデータがまだありません。"}
            </pre>
          )}
        </div>
      </div>
    </main>
  );
}

export default withAuth(MinutesDetailPage);
