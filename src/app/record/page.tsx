"use client";

import MeetingNote from "./components/MeetingNote";
import TocMenu from "./components/TocMenu";

export default function RecordPage() {
  return (
    <main className="relative flex w-full gap-4 px-8">
      {/* 議事録 */}
      <MeetingNote />

      {/* 目次 */}
      <TocMenu />
    </main>
  );
}
