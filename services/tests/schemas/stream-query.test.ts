import { describe, it, expect } from "@jest/globals";
import { StreamQuerySchema } from "../../src/schemas/http.v1.js";

// minutes イベント追加に伴う types パラメータの挙動を検証
describe("StreamQuerySchema", () => {
  it("should default to audio/transcript/event when types not provided", () => {
    const result = StreamQuerySchema.parse({
      userId: "user-1",
      mode: "raw",
    });

    expect(Array.from(result.types)).toEqual(["audio", "transcript", "event"]);
  });

  it("should accept minutes when explicitly requested", () => {
    const result = StreamQuerySchema.parse({
      userId: "user-1",
      mode: "raw",
      types: "minutes",
    });

    expect(result.types.has("minutes")).toBe(true);
    expect(result.types.size).toBe(1);
  });

  it("should ignore unknown types and fall back to defaults", () => {
    const result = StreamQuerySchema.parse({
      userId: "user-1",
      mode: "normalized",
      types: "unknown, minutes",
    });

    expect(result.types.has("minutes")).toBe(true);
    expect(result.types.has("unknown")).toBe(false);
  });
});
