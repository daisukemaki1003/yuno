"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ROUTES } from "@/constants/routes";
import {
  ArrowLeft,
  Plus,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AgendaItem {
  id: string;
  title: string;
  detail: string;
}

export default function NewTemplatePage() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    agenda: [{ id: "1", title: "", detail: "" }] as AgendaItem[],
  });
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const handleAgendaChange = (
    id: string,
    field: keyof AgendaItem,
    value: string
  ) => {
    const newAgenda = formData.agenda.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setFormData({ ...formData, agenda: newAgenda });
  };

  const addAgendaItem = () => {
    const newId = String(Date.now());
    setFormData({
      ...formData,
      agenda: [...formData.agenda, { id: newId, title: "", detail: "" }],
    });
  };

  const removeAgendaItem = (id: string) => {
    const newAgenda = formData.agenda.filter((item) => item.id !== id);
    setFormData({ ...formData, agenda: newAgenda });
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = formData.agenda.findIndex(
        (item) => item.id === active.id
      );
      const newIndex = formData.agenda.findIndex((item) => item.id === over.id);

      setFormData({
        ...formData,
        agenda: arrayMove(formData.agenda, oldIndex, newIndex),
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
            href={ROUTES.TEMPLATES}
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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={3}
                />
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

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={formData.agenda.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {formData.agenda.map((item, index) => (
                      <SortableAgendaItem
                        key={item.id}
                        item={item}
                        index={index}
                        isExpanded={expandedItems.includes(item.id)}
                        onToggle={() => toggleExpanded(item.id)}
                        onChange={handleAgendaChange}
                        onRemove={removeAgendaItem}
                        canRemove={formData.agenda.length > 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* アクションボタン */}
            <div className="flex gap-3 pt-6">
              <Button type="submit" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                テンプレートを作成
              </Button>
              <Button variant="outline" asChild>
                <Link href={ROUTES.TEMPLATES}>キャンセル</Link>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface SortableAgendaItemProps {
  item: AgendaItem;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (id: string, field: keyof AgendaItem, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

function SortableAgendaItem({
  item,
  index,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
  canRemove,
}: SortableAgendaItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          className="cursor-grab touch-none text-gray-400 hover:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
          {index + 1}
        </div>

        <Input
          type="text"
          value={item.title}
          onChange={(e) => onChange(item.id, "title", e.target.value)}
          placeholder="アジェンダタイトルを入力"
          className="flex-1"
        />

        <button
          type="button"
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          {isExpanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>

        {canRemove && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRemove(item.id)}
            className="text-red-600 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            詳細
          </label>
          <textarea
            value={item.detail}
            onChange={(e) => onChange(item.id, "detail", e.target.value)}
            placeholder="アジェンダの詳細を入力してください"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
