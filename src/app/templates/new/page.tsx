"use client";

import { useState } from "react";
import Link from "next/link";

export default function NewTemplatePage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: テンプレート保存処理の実装
    console.log({ title, description, content });
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/templates"
            className="text-blue-500 transition-colors hover:text-blue-600"
          >
            ← テンプレート一覧に戻る
          </Link>
        </div>
        <h1 className="mb-8 text-4xl font-bold">テンプレート作成</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              タイトル
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="content"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              テンプレート内容
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-blue-500 px-6 py-3 text-white transition-colors hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
