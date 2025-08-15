import Link from "next/link";
import { Button } from "@/components/ui/Button";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  FileText,
  Users,
  Calendar,
} from "lucide-react";
import { notFound } from "next/navigation";
import { ROUTES } from "@/constants/routes";

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
    createdAt: "2024-01-15",
    updatedAt: "2024-01-20",
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
    createdAt: "2024-01-10",
    updatedAt: "2024-01-18",
  },
];

interface TemplateDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TemplateDetailPage({
  params,
}: TemplateDetailPageProps) {
  const { id } = await params;
  const template = mockTemplates.find((t) => t.id === id);

  if (!template) {
    notFound();
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={ROUTES.TEMPLATES}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            テンプレート一覧に戻る
          </Link>
        </div>

        {/* テンプレート情報 */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {template.icon}
              </div>
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {template.title}
                  </h1>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {template.category}
                  </span>
                </div>
                <p className="text-gray-600">{template.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`${ROUTES.TEMPLATES}/${template.id}/edit`}>
                {/* <Button variant="outline" size="sm"> */}
                <Edit className="h-4 w-4" />
                {/* </Button> */}
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* メタ情報 */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                更新日: {template.updatedAt}
              </span>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-3">
            <Button asChild className="flex items-center gap-2">
              <Link href={`${ROUTES.RECORD}?template=${template.id}`}>
                <Play className="h-4 w-4" />
                このテンプレートで開始
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`${ROUTES.TEMPLATES}/${template.id}/edit`}>
                編集する
              </Link>
            </Button>
          </div>
        </div>

        {/* アジェンダ */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            アジェンダ
          </h2>
          <div className="space-y-3">
            {template.agenda.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                  {index + 1}
                </div>
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
