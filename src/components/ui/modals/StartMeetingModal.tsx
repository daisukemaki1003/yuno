"use client";

import { useState } from "react";
import Button from "../../Button";
import OutlineButton from "../../OutlineButton";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">ミーティングを開始</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              タイトル
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
              テンプレート（任意）
            </label>
            <select
              id="template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">テンプレートなし</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <OutlineButton onClick={onClose}>キャンセル</OutlineButton>
            <Button type="submit">開始</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
