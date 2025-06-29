"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Plus,
  X,
  FileText,
} from "lucide-react";

export default function NewTemplatePage() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    agenda: [""],
  });

  const handleAgendaChange = (index: number, value: string) => {
    const newAgenda = [...formData.agenda];
    newAgenda[index] = value;
    setFormData({ ...formData, agenda: newAgenda });
  };

  const addAgendaItem = () => {
    setFormData({ ...formData, agenda: [...formData.agenda, ""] });
  };

  const removeAgendaItem = (index: number) => {
    const newAgenda = formData.agenda.filter((_, i) => i !== index);
    setFormData({ ...formData, agenda: newAgenda });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ここでテンプレート保存処理を実装
    console.log("Template data:", formData);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/templates"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            テンプレート一覧に戻る
          </Link>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h1 className="mb-6 text-2xl font-bold text-gray-900">
            新規テンプレート作成
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">基本情報</h2>

              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  テンプレート名 *
                </label>
                <Input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="例: 週次ミーティング"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  説明
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="テンプレートの説明を入力してください"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-1">
                <div>
                  <label
                    htmlFor="category"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    カテゴリー
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">選択してください</option>
                    <option value="定例">定例</option>
                    <option value="プロジェクト">プロジェクト</option>
                    <option value="人事">人事</option>
                    <option value="営業">営業</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
              </div>
            </div>

            {/* アジェンダ */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  アジェンダ
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAgendaItem}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  項目を追加
                </Button>
              </div>

              <div className="space-y-3">
                {formData.agenda.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                      {index + 1}
                    </div>
                    <Input
                      type="text"
                      value={item}
                      onChange={(e) =>
                        handleAgendaChange(index, e.target.value)
                      }
                      placeholder="アジェンダ項目を入力"
                      className="flex-1"
                    />
                    {formData.agenda.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAgendaItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3 pt-6">
              <Button type="submit" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                テンプレートを作成
              </Button>
              <Button variant="outline" asChild>
                <Link href="/templates">キャンセル</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
