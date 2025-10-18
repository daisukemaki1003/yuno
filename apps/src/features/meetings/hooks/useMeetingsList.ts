"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMeetings } from "@/shared/api/meetings";
import type { MeetingListItem } from "@/shared/types/meetings";

export function useMeetingsList() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchMeetings();
      setMeetings(result);
    } catch (err) {
      console.error("Failed to load meetings", err);
      setError(err instanceof Error ? err.message : "会議一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    meetings,
    loading,
    error,
    reload: load,
  };
}
