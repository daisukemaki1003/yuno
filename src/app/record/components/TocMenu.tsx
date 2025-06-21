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
  // 階層構造に変換する関数
  const buildHierarchy = (items: TocItem[]) => {
    const result: (TocItem & { children?: TocItem[] })[] = [];
    const level1Items = items.filter((item) => item.level === 1);

    level1Items.forEach((level1Item) => {
      const children = items.filter(
        (item) => item.level === 2 && item.id.startsWith(level1Item.id + "-")
      );

      result.push({
        ...level1Item,
        children: children.length > 0 ? children : undefined,
      });
    });

    return result;
  };

  const hierarchicalData = buildHierarchy(tocData);

  return (
    <nav className="w-2/5 rounded-lg p-4">
      <h2 className="mb-4 px-2 text-base font-bold text-gray-800">目次</h2>
      <ul className="space-y-2">
        {hierarchicalData.map((item) => (
          <li key={item.id} className="bg-white rounded-md">
            <a
              href={`#${item.id}`}
              className={cn(
                "block w-full text-sm transition-colors hover:bg-gray-100",
                "font-semibold px-3",
                item.children ? "pt-3 pb-2" : "py-3"
              )}
            >
              <div className="flex items-center">
                {item.status && <StatusBadge status={item.status} />}
                <span>{item.title}</span>
              </div>
            </a>
            {item.children && (
              <ul className="space-y-1">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a
                      href={`#${child.id}`}
                      className={cn(
                        "block w-full py-2 text-xs transition-colors hover:bg-gray-100",
                        "px-2 font-semibold pl-4"
                      )}
                    >
                      <div className="flex items-center">
                        {child.status && <StatusBadge status={child.status} />}
                        <span>{child.title.replace(/^\d+-?\d*\.?\s*/, "")}</span>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default TocMenu;
