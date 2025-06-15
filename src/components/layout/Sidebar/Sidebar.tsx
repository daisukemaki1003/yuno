"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SidebarItem from "./SidebarItem";
import IcoHistory from "@/components/icons/common/ico_history.svg";
import IcoMeeting from "@/components/icons/common/ico_meeting.svg";
import IcoTemplate from "@/components/icons/common/ico_template.svg";
import IcoUser from "@/components/icons/common/ico_user.svg";
import IcoSetting from "@/components/icons/common/ico_setting.svg";
import IconCloseSidebar from "@/components/icons/components/Sidebar/icon_close_sidebar.svg";

const navigation = [
  { name: "会議", href: "/", img: <IcoMeeting />, isActive: false },
  { name: "履歴", href: "/history", img: <IcoHistory />, isActive: false },
  {
    name: "テンプレート",
    href: "/templates",
    img: <IcoTemplate />,
    isActive: false,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-white border-r border-gray-200">
      <div className="flex items-center justify-between pl-[24px] pr-[16px] mt-[20px]">
        <Link href="/">
          <img src="/images/common/ico_logo.webp" alt="Yuno" width={100} height={100} />
        </Link>
        <Link href="/">
          <IconCloseSidebar />
        </Link>
      </div>

      <nav className="mt-[24px]">
        {/* <p className="text-sm font-bold text-gray-600 pl-[24px] mb-[12px]">メイン</p> */}
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return <SidebarItem key={item.name} {...item} isActive={isActive} />;
        })}
      </nav>
    </div>
  );
}
