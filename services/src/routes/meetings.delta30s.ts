import { Hono } from "hono";

import type { LLMClient } from "@/clients/llm.client.js";
import { MockLLMClient } from "@/clients/llm.mock.js";
import { Delta30sBuilderService, InsufficientTranscriptError, Delta30sGenerationError } from "@/services/delta30s-builder.service.js";
import { SectionDiffService } from "@/services/section-diff.service.js";
import {
  DEFAULT_LANGUAGE,
  Delta30sRouteBodySchema,
  MeetingIdParamSchema,
} from "@/domain/minutes/index.js";
import type { Logger } from "@/utils/logger.js";

interface Delta30sRouterOptions {
  llmClient?: LLMClient;
}

type RouterBindings = {
  Variables: {
    logger: Logger;
  };
};

export function createDelta30sRouter(options: Delta30sRouterOptions = {}) {
  const llmClient = options.llmClient ?? new MockLLMClient();
  const builder = new Delta30sBuilderService(llmClient);
  const diffService = new SectionDiffService();

  const router = new Hono<RouterBindings>();

  router.post("/:id/delta30s", async (c) => {
    const logger = c.get("logger");

    const meetingIdResult = MeetingIdParamSchema.safeParse(c.req.param("id"));
    if (!meetingIdResult.success) {
      return c.json({ message: "Invalid meeting id", issues: meetingIdResult.error.format() }, 400);
    }
    const meetingId = meetingIdResult.data;

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ message: "Invalid JSON body" }, 400);
    }

    const bodyResult = Delta30sRouteBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return c.json({ message: "Invalid payload", issues: bodyResult.error.format() }, 422);
    }

    const body = bodyResult.data;
    const language = body.language ?? DEFAULT_LANGUAGE;
    const window = body.window;

    logger.info("Delta30s request received", {
      meeting_id: meetingId,
      window,
      language,
    });

    const currentSectionList = body.currentSectionList
      ? { ...body.currentSectionList, meeting_id: meetingId }
      : { meeting_id: meetingId, sections: [] };

    try {
      const delta = await builder.build({
        meetingId,
        window,
        transcript: body.transcript,
        language,
        logger,
      });

      const update = diffService.diff(meetingId, delta, currentSectionList);

      logger.info("Delta30s response ready", {
        meeting_id: meetingId,
        window,
        summaries: delta.summaries.length,
        actions: delta.actions.length,
        decisions: delta.decisions.length,
        questions: delta.questions.length,
        changed_sections: update.changed_sections.length,
      });

      return c.json({
        meeting_id: meetingId,
        window,
        delta30s: delta,
        section_update: update,
      });
    } catch (error) {
      if (error instanceof InsufficientTranscriptError) {
        logger.warn("Delta30s generation skipped - transcript too short", {
          meeting_id: meetingId,
          window,
          length: error.length,
        });
        return c.json({ message: error.message, length: error.length }, 422);
      }

      if (error instanceof Delta30sGenerationError) {
        logger.error("Delta30s generation failed", {
          meeting_id: meetingId,
          window,
          error: error.cause instanceof Error ? error.cause.message : error.message,
        });
        return c.json({ message: error.message }, 502);
      }

      logger.error("Unexpected error processing Delta30s request", {
        meeting_id: meetingId,
        window,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ message: "Internal Server Error" }, 500);
    }
  });

  return router;
}

const defaultRouter = createDelta30sRouter();
export default defaultRouter;
