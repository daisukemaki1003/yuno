"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {Button} from "@/shared/components/atoms/Button";
import {cn} from "@/lib/utils";
import {useSidebarStore} from "@/lib/stores/sidebar-store";
import {
  History,
  Video,
  FileText,
  ChevronFirst,
  ChevronLast,
  Code,
} from "lucide-react";
import {ROUTES} from "@/constants/routes";
import Image from "next/image";

const navigation = [
  {name: "会議", href: ROUTES.RECORD, img: <Video />, isActive: false},
  {name: "履歴", href: ROUTES.HISTORY, img: <History />, isActive: false},
  {
    name: "テンプレート",
    href: ROUTES.TEMPLATES,
    img: <FileText />,
    isActive: false,
  },
  {name: "API", href: ROUTES.API, img: <Code />, isActive: false},
];

export default function Sidebar() {
  const pathname = usePathname();
  const {isCollapsed, toggle} = useSidebarStore();

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-50 h-screen border-r border-gray-200 bg-white transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between p-4",
          isCollapsed && "justify-center"
        )}
      >
        <Link
          href={ROUTES.HOME}
          className={cn("transition-opacity", isCollapsed && "opacity-0")}
        >
          <Image
            src="/images/common/ico_logo.webp"
            alt="Yuno"
            width={100}
            height={100}
            className={cn("transition-all", isCollapsed && "h-0 w-0")}
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-8 w-8"
        >
          {isCollapsed ? (
            <ChevronLast className="h-4 w-4" />
          ) : (
            <ChevronFirst className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className={cn("mt-4 space-y-1", isCollapsed && "space-y-5")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <SidebarItem
              key={item.name}
              {...item}
              isActive={isActive}
              isCollapsed={isCollapsed}
            />
          );
        })}
      </nav>
    </div>
  );
}

// サイドバーのアイテム
interface SidebarItemProps {
  name: string;
  href: string;
  img: React.ReactNode;
  isActive: boolean;
  isCollapsed?: boolean;
}

function SidebarItem({...props}: SidebarItemProps) {
  const color = props.isActive ? "text-blue-600" : "text-gray-600";

  return (
    <Link
      href={props.href}
      className={cn(
        "flex h-[46px] items-center gap-3 px-4 transition-all duration-300",
        color,
        props.isActive
          ? "bg-[#4A6BFA]/10 hover:bg-[#4A6BFA]/20"
          : "bg-white hover:bg-gray-100",
        props.isCollapsed ? "flex-col justify-center gap-0 px-2" : "pl-6"
      )}
      title={props.isCollapsed ? props.name : undefined}
    >
      <div
        className={cn(
          "flex h-5 w-5 flex-shrink-0 items-center justify-center",
          props.isCollapsed ? "h-8 w-8" : "h-5 w-5",
          color
        )}
      >
        {props.img}
      </div>
      <span
        className={cn(
          "whitespace-nowrap transition-all duration-300",
          props.isCollapsed ? "text-[10px]" : "opacity-100"
        )}
      >
        {props.name}
      </span>
    </Link>
  );
}
