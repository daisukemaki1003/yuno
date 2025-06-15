import { title } from "process";
import React from "react";

type TocItem = {
  title: string;
  status?: "未確定" | "完了";
  children?: TocItem[];
  disabled?: boolean;
};

const tocData: TocItem[] = [
  { title: "1. 課題" },
  {
    title: "2. スケジュール",
    children: [
      { title: "コーディング工数", status: "未確定" },
      { title: "日程調整", status: "完了", disabled: true },
      { title: "次回MTGの日程", status: "未確定" },
    ],
  },
  { title: "3. 見積もり" },
  { title: "4. 仕様" },
  {
    title: "5. サーバーについて",
    children: [{ title: "ドメインの取得", status: "未確定" }],
  },
];

const StatusBadge = ({ status }: { status: "未確定" | "完了" }) => (
  <span
    className={
      status === "未確定"
        ? "bg-red-100 text-red-700 text-xs font-semibold rounded px-2 py-0.5 mr-2"
        : "bg-gray-200 text-gray-500 text-xs font-semibold rounded px-2 py-0.5 mr-2"
    }
  >
    {status}
  </span>
);

const TocList: React.FC<{ items: TocItem[]; level?: number }> = ({ items, level = 0 }) => (
  <ul
    className={
      level === 0
        ? "flex flex-col gap-4"
        : "ml-6 border-l-2 border-gray-200 pl-4 flex flex-col gap-2"
    }
  >
    {items.map((item, idx) => (
      <li key={item.title + idx}>
        <div className="flex items-center">
          {item.status && <StatusBadge status={item.status} />}
          <span className={`text-base ${item.disabled ? "text-gray-400" : "text-gray-800"}`}>
            {item.title}
          </span>
        </div>
        {item.children && <TocList items={item.children} level={level + 1} />}
      </li>
    ))}
  </ul>
);

const TocMenu: React.FC = () => (
  <nav className="bg-gray-100 rounded-xl p-6 w-[340px]">
    <div className="text-lg font-bold mb-4">目次</div>
    <div className="flex flex-col gap-4">
      <TocList items={tocData} />
    </div>
  </nav>
);

export default TocMenu;
