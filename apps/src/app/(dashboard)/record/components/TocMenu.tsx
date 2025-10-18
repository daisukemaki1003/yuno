import React, {useMemo} from "react";
import {cn} from "@/lib/utils";
import type { MinutesSectionUpdate } from "@/shared/types/meetings";

const statusLabelMap: Record<MinutesSectionUpdate["status"], string> = {
  active: "進行中",
  provisional: "未確定",
  closed: "完了",
};

const StatusBadge = ({status}: {status: string}) => {
  const isPending = status === "未確定";
  const isClosed = status === "完了";
  return (
    <span
      className={cn(
        "mr-2 rounded px-1.5 py-0.5 text-xs font-medium",
        isPending && "bg-orange-100 text-orange-700",
        isClosed && "bg-gray-200 text-gray-500",
        !isPending && !isClosed && "bg-blue-100 text-blue-700"
      )}
    >
      {status}
    </span>
  );
};

interface TocMenuProps {
  sections?: MinutesSectionUpdate[];
  connected?: boolean;
}

const TocMenu: React.FC<TocMenuProps> = ({sections, connected}) => {
  const items = useMemo(() => {
    if (!sections || sections.length === 0) {
      return [];
    }

    return sections.map((section, index) => ({
      id: section.id,
      title: `${index + 1}. ${section.title}`,
      status: statusLabelMap[section.status],
    }));
  }, [sections]);

  return (
    <nav className="sticky top-24 h-fit w-2/5 rounded-lg">
      <div className="mb-4 flex items-center justify-between px-2">
        <h2 className="text-base font-bold text-gray-800">目次</h2>
        <span className={cn("text-xs", connected ? "text-emerald-600" : "text-gray-400")}
        >
          {connected ? "接続中" : "未接続"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-4 text-xs text-gray-500">
          新しい議題が追加されるとここに表示されます。
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-white">
              <a
                href={`#${item.id}`}
                className={cn(
                  "block w-full py-3 text-sm transition-colors hover:bg-gray-100",
                  "px-3 font-semibold"
                )}
              >
                <div className="flex items-center">
                  <StatusBadge status={item.status} />
                  <span>{item.title}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
};

export default TocMenu;
