"use client";

import MeetingNote from "./components/MeetingNote";
import TocMenu from "./components/TocMenu";
import { withAuth } from "@/shared/hooks/useAuth";
import { useMeetingStream } from "@/features/meetings/hooks/useMeetingStream";

const DEFAULT_MEETING_ID = "mock-meeting-001";

function RecordPage() {
  const { minutesEvent, transcriptText, connected, error } = useMeetingStream(DEFAULT_MEETING_ID);

  const sections = minutesEvent?.update.changed_sections ?? [];
  const summaries = minutesEvent?.delta.summaries ?? [];
  const actions = minutesEvent?.delta.actions ?? [];
  const statusMessage = error ?? (connected ? "リアルタイムで議事録を更新しています" : "接続を待機しています");

  return (
    <main className="relative flex w-full gap-4 px-8">
      {/* 議事録 */}
      <div className="w-full rounded-lg bg-white p-8">
        <MeetingNote
          sections={sections}
          summaries={summaries}
          actions={actions}
          statusMessage={statusMessage}
        />
        {transcriptText && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-slate-50 p-4 text-xs text-gray-700">
            <h3 className="mb-2 font-semibold text-gray-800">最新の文字起こし</h3>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap">
              {transcriptText}
            </pre>
          </div>
        )}
      </div>

      {/* 目次 */}
      <TocMenu sections={sections} connected={connected} />
    </main>
  );
}

export default withAuth(RecordPage);
