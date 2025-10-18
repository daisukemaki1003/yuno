import React from "react";
import ReactMarkdown from "react-markdown";
import "github-markdown-css";
import "@/styles/github-markdown-override.css";
import type { ActionItem, MinutesSectionUpdate } from "@/shared/types/meetings";

interface MeetingNoteProps {
  content?: string;
  sections?: MinutesSectionUpdate[];
  summaries?: string[];
  actions?: ActionItem[];
  statusMessage?: string;
}

const defaultContent = `
## 1. 課題

こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです

- こちらはダミーテキストです
  こちらはダミーテキストです
  - こちらはダミーテキストです
  - こちらはダミーテキストです
- こちらはダミーテキストです
  こちらはダミーテキストです
  こちらはダミーテキストです
  こちらはダミーテキストです

## 2. スケジュール

こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです
こちらはダミーテキストです、文字の大きさや書体のサンプルです

### 2-1. コーディング工数

こちらはダミーテキストです、文字の大きさや書体のサンプルです

こちらはダミーテキストです
こちらはダミーテキストです

こちらはダミーテキストです
こちらはダミーテキストです
こちらはダミーテキストです

### 2-2. 日程の調整

こちらはダミーテキストです、文字の大きさや書体のサンプルです

こちらはダミーテキストです
こちらはダミーテキストです
こちらはダミーテキストです

- こちらはダミーテキストです
  こちらはダミーテキストです
- こちらはダミーテキストです
  こちらはダミーテキストです
- こちらはダミーテキストです[リンク](https://example.com)こちらはダミーテキストです
`;

const statusLabelMap: Record<MinutesSectionUpdate["status"], string> = {
  active: "進行中",
  provisional: "未確定",
  closed: "完了",
};

const MeetingNote: React.FC<MeetingNoteProps> = ({
  content,
  sections,
  summaries,
  actions,
  statusMessage,
}) => {
  if (sections && sections.length > 0) {
    return (
      <div className="space-y-6">
        {statusMessage && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {statusMessage}
          </div>
        )}

        {summaries && summaries.length > 0 && (
          <section>
            <h2 className="mb-2 text-lg font-semibold text-gray-800">最新サマリー</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {summaries.map((summary, index) => (
                <li key={`summary-${index}`}>{summary}</li>
              ))}
            </ul>
          </section>
        )}

        {sections.map((section) => (
          <section key={section.id} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
              <span className="text-xs text-gray-400">
                {statusLabelMap[section.status] ?? section.status}
              </span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {section.bullets.map((line, index) => (
                <li key={`${section.id}-bullet-${index}`}>{line}</li>
              ))}
            </ul>
            {section.actions.length > 0 && (
              <div className="rounded-md bg-slate-50 p-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Actions
                </h4>
                <ul className="space-y-2 text-xs text-gray-700">
                  {section.actions.map((action, index) => (
                    <li key={`${section.id}-action-${index}`} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{action.task}</p>
                        {action.owner && (
                          <p className="text-[11px] text-gray-500">担当: {action.owner}</p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-gray-400">
                        {action.due && <div>期限: {action.due}</div>}
                        {typeof action.confidence === "number" && (
                          <div>信頼度: {(action.confidence * 100).toFixed(0)}%</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}

        {actions && actions.length > 0 && (
          <section>
            <h3 className="mb-2 text-base font-semibold text-gray-900">アクション</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              {actions.map((action, index) => (
                <li key={`global-action-${index}`} className="rounded-md border border-gray-200 p-3">
                  <div className="font-medium">{action.task}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                    {action.owner && <span>担当: {action.owner}</span>}
                    {action.due && <span>期限: {action.due}</span>}
                    {typeof action.confidence === "number" && (
                      <span>信頼度: {(action.confidence * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {statusMessage}
        </div>
      )}
      <div className="markdown-body">
        <ReactMarkdown>{content || defaultContent}</ReactMarkdown>
      </div>
    </div>
  );
};

export default MeetingNote;
