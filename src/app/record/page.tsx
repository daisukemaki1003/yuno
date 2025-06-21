"use client";

import Header from "@/components/layout/Header/Header";
import MeetingNote from "./components/MeetingNote";
import TocMenu from "./components/TocMenu";

export default function RecordPage() {
  return (
    <div className="">
      <Header title="XXX会社 メンバーMTG" />
      <main className="flex max-w-[1200px] mx-auto px-8">
        {/* 議事録 */}
        <MeetingNote />

        {/* 目次 */}
        <TocMenu />
      </main>
    </div>
  );
}
