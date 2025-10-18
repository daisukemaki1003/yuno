import {
  API_AUTH_BEARER,
  API_BASE_URL,
  API_DEFAULT_USER_ID,
  API_MEETING_BAAS_KEY,
  API_REQUEST_TIMEOUT_MS,
  USE_API_MOCKS,
} from "@/lib/config";
import { mockAddBotResponse } from "@/shared/mocks/bots";
import { ApiError } from "@/shared/api/client";
import type { AddBotRequestPayload, AddBotResponse } from "@/shared/types/api";

export async function createBot(payload: AddBotRequestPayload) {
  if (USE_API_MOCKS) {
    return {
      ...mockAddBotResponse,
      meetingId: payload.meetingUrl,
      botId: `${mockAddBotResponse.botId}-${Date.now()}`,
    } satisfies AddBotResponse;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (API_AUTH_BEARER) {
      headers.Authorization = `Bearer ${API_AUTH_BEARER}`;
    }

    if (API_MEETING_BAAS_KEY) {
      headers["x-meeting-baas-api-key"] = API_MEETING_BAAS_KEY;
    }

    const response = await fetch(`${API_BASE_URL}/v1/bots`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId: API_DEFAULT_USER_ID,
        meetingUrl: payload.meetingUrl,
        botName: payload.botName,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      throw new ApiError(
        (errorPayload as { error?: string; message?: string } | null)?.error ??
          (errorPayload as { message?: string } | null)?.message ??
          "ボットの追加に失敗しました",
        response.status,
        errorPayload
      );
    }

    return (await response.json()) as AddBotResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "ボットの追加に失敗しました",
      500,
      error
    );
  } finally {
    clearTimeout(timeout);
  }
}
