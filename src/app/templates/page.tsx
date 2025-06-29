"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Plus, FileText, Users, Calendar, Clock } from "lucide-react";

// 仮のデータ
const mockTemplates = [
  {
    id: "1",
    title: "週次ミーティング",
    description:
      "週次の進捗報告ミーティング用テンプレート。チームメンバー全員が参加し、前週の成果と今週の予定を共有します。課題や懸念事項も含めて、効率的な情報共有を実現します。",
    icon: <FileText className="h-6 w-6" />,
    category: "定例",
    agenda: [
      "前週の進捗報告",
      "今週の予定",
      "課題・懸念事項の共有",
      "次回のアクションアイテム確認",
    ],
  },
  {
    id: "2",
    title: "プロジェクトキックオフ",
    description: "新規プロジェクト開始時のキックオフミーティング用テンプレート",
    icon: <Users className="h-6 w-6" />,
    category: "プロジェクト",
    agenda: [
      "プロジェクト概要の説明",
      "チームメンバーの紹介",
      "スケジュールとマイルストーンの確認",
      "役割と責任の明確化",
      "リスクと課題の特定",
      "コミュニケーション方法の決定",
      "次回ミーティングの日程調整",
    ],
  },
  {
    id: "3",
    title: "1on1ミーティング",
    description: "1on1用",
    icon: <Users className="h-6 w-6" />,
    category: "人事",
    agenda: [
      "最近の状況確認",
      "目標の進捗確認",
      "課題や悩みの相談",
      "フィードバックの共有",
      "次回のアクションアイテム",
    ],
  },
  {
    id: "4",
    title: "月次報告会",
    description:
      "月次の成果報告と次月の計画を共有するミーティング用テンプレート。各部門の代表者が参加し、KPIの達成状況や課題を報告します。経営陣への報告も含めて、組織全体の状況を把握できる構成になっています。",
    icon: <Calendar className="h-6 w-6" />,
    category: "定例",
    agenda: [
      "今月の成果報告",
      "KPIの達成状況",
      "課題と対策の検討",
      "来月の計画と目標",
      "全体への共有事項",
    ],
  },
  {
    id: "5",
    title: "営業会議",
    description: "営業",
    icon: <Users className="h-6 w-6" />,
    category: "営業",
    agenda: ["売上報告", "商談状況", "新規案件", "競合情報"],
  },
  {
    id: "6",
    title: "技術検討会",
    description:
      "技術的な課題や新技術の導入について検討するミーティング用テンプレート。エンジニアチームが参加し、アーキテクチャの変更や新機能の実装方針を決定します。セキュリティやパフォーマンスの観点も含めて、包括的な技術検討を行います。",
    icon: <FileText className="h-6 w-6" />,
    category: "技術",
    agenda: [
      "技術課題の共有",
      "新技術の検討",
      "アーキテクチャの変更提案",
      "実装方針の決定",
      "リスク評価",
      "スケジュール調整",
      "次回の検討事項",
    ],
  },
];

export default function TemplatesPage() {
  return (
    <div className="px-8">
      <div className="mx-auto">
        {/* テンプレート一覧 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockTemplates.map((template) => (
            <div
              key={template.id}
              className="group relative overflow-hidden rounded-xl bg-white px-5 py-6 shadow-sm transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-blue-100"
            >
              {/* アイコンとタイトル */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  {template.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                    {template.title}
                  </h3>
                </div>
              </div>

              {/* 説明 */}
              <p className="display-webkit-box -webkit-line-clamp-2 -webkit-box-orient-vertical mb-4 overflow-hidden text-sm text-ellipsis text-gray-600">
                {template.description}
              </p>

              {/* 議題一覧 */}
              <div className="mb-4">
                <div className="space-y-1">
                  {template.agenda.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                        {index + 1}
                      </div>
                      <span className="line-clamp-1 text-xs text-gray-600">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/templates/${template.id}`}>詳細を見る</Link>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link href={`/record?template=${template.id}`}>使用する</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* 空の状態（テンプレートがない場合） */}
        {mockTemplates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              テンプレートがありません
            </h3>
            <p className="mb-6 text-center text-gray-600">
              最初のテンプレートを作成して、効率的にミーティングを始めましょう
            </p>
            <Button asChild>
              <Link href="/templates/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                テンプレートを作成
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
