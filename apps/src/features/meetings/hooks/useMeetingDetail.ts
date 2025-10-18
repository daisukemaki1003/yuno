"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMeetingDetail } from "@/shared/api/meetings";
import type { MeetingDetail } from "@/shared/types/meetings";

export function useMeetingDetail(meetingId: string | undefined) {
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchMeetingDetail(meetingId);
      setDetail(result);
    } catch (err) {
      console.error("Failed to load meeting detail", err);
      setError(err instanceof Error ? err.message : "議事録の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    detail,
    loading,
    error,
    reload: load,
  };
}
