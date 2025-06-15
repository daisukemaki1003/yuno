"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header/Header";
import MeetingNote from "./components/MeetingNote";
import TocMenu from "./components/TocMenu";

export default function RecordPage() {
  return (
    <div className="p-[40px]">
      <Header title="録音中" />
      <main className="flex max-w-[1200px] mx-auto">
        {/* 議事録 */}
        <MeetingNote
          markdown={
            "# 議事録\n\n## 議事録の内容\n\n- 議事録の内容1\n- 議事録の内容2\n- 議事録の内容3"
          }
        />

        {/* 目次 */}
        <TocMenu />
      </main>
    </div>
  );
}
