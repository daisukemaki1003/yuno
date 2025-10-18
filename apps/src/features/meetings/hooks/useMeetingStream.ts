"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeMeetingStream } from "@/shared/api/streams";
import type { MinutesSectionsEvent, TranscriptEvent } from "@/shared/types/meetings";

export function useMeetingStream(meetingId: string | undefined) {
  const [minutesEvent, setMinutesEvent] = useState<MinutesSectionsEvent | null>(null);
  const [transcriptEvents, setTranscriptEvents] = useState<TranscriptEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMinutesEvent(null);
    setTranscriptEvents([]);
    setConnected(false);
    setError(null);
  }, [meetingId]);

  useEffect(() => {
    if (!meetingId) {
      return;
    }

    let isActive = true;
    const unsubscribe = subscribeMeetingStream(
      meetingId,
      {
        onMinutes: (event) => {
          if (!isActive) {
            return;
          }
          setMinutesEvent(event);
        },
        onTranscript: (event) => {
          if (!isActive) {
            return;
          }
          setTranscriptEvents((prev) => [...prev.slice(-199), event]);
        },
        onError: (err) => {
          if (!isActive) {
            return;
          }
          setConnected(false);
          setError(err.message || "ストリーム接続でエラーが発生しました");
        },
        onOpen: () => {
          if (!isActive) {
            return;
          }
          setConnected(true);
          setError(null);
        },
      },
      { types: ["minutes", "transcript"] }
    );

    return () => {
      isActive = false;
      unsubscribe();
      setConnected(false);
    };
  }, [meetingId]);

  const transcriptText = useMemo(() => {
    if (transcriptEvents.length === 0) {
      return "";
    }
    return transcriptEvents
      .map((event) => event.data?.text)
      .filter(Boolean)
      .join("\n");
  }, [transcriptEvents]);

  return {
    minutesEvent,
    transcriptEvents,
    transcriptText,
    connected,
    error,
  };
}
