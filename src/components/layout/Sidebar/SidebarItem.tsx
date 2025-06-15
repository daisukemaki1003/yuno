"use client";

import Link from "next/link";
import IcoHistory from "@/components/icons/common/ico_history.svg";

interface SidebarItemProps {
  name: string;
  href: string;
  img: React.ReactNode;
  isActive: boolean;
}

export default function SidebarItem({ ...props }: SidebarItemProps) {
  const color = props.isActive ? "text-blue-600" : "text-gray-600";

  return (
    <Link href={props.href} className={`flex items-center gap-[12px] h-[46px] pl-[24px] ${color}`}>
      <div className={color}>{props.img}</div>
      <span>{props.name}</span>
    </Link>
  );
}
