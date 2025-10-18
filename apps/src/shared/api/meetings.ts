import {
  API_AUTH_BEARER,
  API_BASE_URL,
  API_DEFAULT_USER_ID,
  API_MEETING_BAAS_KEY,
  API_REQUEST_TIMEOUT_MS,
  USE_API_MOCKS,
} from "@/lib/config";
import { ApiError } from "@/shared/api/client";
import { mockMeetingDetail, mockMeetings } from "@/shared/mocks/meetings";
import type { MeetingDetail, MeetingListItem } from "@/shared/types/meetings";

const sanitizedApiBase = API_BASE_URL.replace(/\/$/, "");

function buildHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (API_AUTH_BEARER) {
    headers.Authorization = `Bearer ${API_AUTH_BEARER}`;
  }

  if (API_MEETING_BAAS_KEY) {
    headers["x-meeting-baas-api-key"] = API_MEETING_BAAS_KEY;
  }

  return headers;
}

export async function fetchMeetings() {
  if (USE_API_MOCKS) {
    return mockMeetings;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(
      `${sanitizedApiBase}/v1/meetings?userId=${encodeURIComponent(API_DEFAULT_USER_ID)}`
    );

    const response = await fetch(url.toString(), {
      headers: buildHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new ApiError(
        (errorPayload as { error?: string; message?: string } | null)?.error ??
          (errorPayload as { message?: string } | null)?.message ??
          "会議一覧の取得に失敗しました",
        response.status,
        errorPayload
      );
    }

    const data = (await response.json()) as MeetingListItem[];
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "会議一覧の取得に失敗しました",
      500,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMeetingDetail(meetingId: string) {
  if (USE_API_MOCKS) {
    return {
      ...mockMeetingDetail,
      id: meetingId,
    } satisfies MeetingDetail;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const url = new URL(
      `${sanitizedApiBase}/v1/meetings/${encodeURIComponent(
        meetingId
      )}?userId=${encodeURIComponent(API_DEFAULT_USER_ID)}`
    );

    const response = await fetch(url.toString(), {
      headers: buildHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new ApiError(
        (errorPayload as { error?: string; message?: string } | null)?.error ??
          (errorPayload as { message?: string } | null)?.message ??
          "議事録の取得に失敗しました",
        response.status,
        errorPayload
      );
    }

    const data = (await response.json()) as MeetingDetail;
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "議事録の取得に失敗しました",
      500,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
}
