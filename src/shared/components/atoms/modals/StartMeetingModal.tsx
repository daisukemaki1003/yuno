"use client";

import { useState } from "react";
import { Button } from "../Button";

interface StartMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (title: string, templateId?: string) => void;
  templates: Array<{
    id: string;
    title: string;
  }>;
}

export default function StartMeetingModal({
  isOpen,
  onClose,
  onStart,
  templates,
}: StartMeetingModalProps) {
  const [title, setTitle] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(title, selectedTemplateId || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold">ミーティングを開始</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              タイトル
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="template"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              テンプレート（任意）
            </label>
            <select
              id="template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">テンプレートなし</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit">開始</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
