export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const STREAM_BASE_URL =
  process.env.NEXT_PUBLIC_STREAM_BASE_URL ?? API_BASE_URL;

const rawUseMocks = process.env.NEXT_PUBLIC_USE_API_MOCKS;
export const USE_API_MOCKS =
  rawUseMocks === undefined
    ? true
    : rawUseMocks.toLowerCase() === "true";

export const API_REQUEST_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 10000
);

export const API_AUTH_BEARER = process.env.NEXT_PUBLIC_AUTH_BEARER ?? "";

export const API_MEETING_BAAS_KEY =
  process.env.NEXT_PUBLIC_MEETING_BAAS_API_KEY ?? "";

export const API_DEFAULT_USER_ID =
  process.env.NEXT_PUBLIC_USER_ID ?? "demo-user";
