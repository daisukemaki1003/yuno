import React from "react";
import { cn } from "@/lib/utils";

type TocItem = {
  id: string;
  title: string;
  status?: "未確定" | "完了";
  level: number;
  active?: boolean;
};

// 階層構造を持つデータ。アクティブな項目を複数設定できるように調整。
const tocData: TocItem[] = [
  { id: "1", title: "1. 課題", level: 1 },
  { id: "2", title: "2. スケジュール", level: 1, active: true },
  { id: "2-1", title: "コーディング工数", level: 2, status: "未確定", active: true },
  { id: "2-2", title: "日程調整", level: 2, status: "完了" },
  { id: "2-3", title: "次回MTGの日程", level: 2, status: "未確定" },
  { id: "3", title: "3. 見積もり", level: 1 },
  { id: "4", title: "4. 仕様", level: 1 },
  { id: "5", title: "5. サーバーについて", level: 1 },
  { id: "5-1", title: "ドメインの取得", level: 2, status: "未確定" },
];

const StatusBadge = ({ status }: { status: "未確定" | "完了" }) => {
  const isPending = status === "未確定";
  return (
    <span
      className={cn(
        "mr-2 rounded px-1.5 py-0.5 text-xs font-medium",
        isPending ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-500"
      )}
    >
      {status}
    </span>
  );
};

const TocMenu = () => {
  return (
    <nav className="w-full rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-4 px-2 text-base font-bold text-gray-800">目次</h2>
      <ul className="space-y-1">
        {tocData.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                "block w-full rounded-md py-1.5 text-sm transition-colors",
                // レベルに応じたスタイル
                item.level === 1
                  ? "px-2 font-semibold"
                  : "ml-2 border-l-2 border-gray-200 py-2 pl-4",
                // アクティブな場合のスタイル
                item.active ? "bg-gray-100 text-blue-600" : "text-gray-600 hover:bg-gray-50",
                item.active && item.level > 1 && "border-blue-600"
              )}
            >
              <div className="flex items-center">
                {item.status && <StatusBadge status={item.status} />}
                <span>
                  {item.level === 1 ? item.title : item.title.replace(/^\d+-?\d*\.?\s*/, "")}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TocMenu;
