import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext, RestToolParams, RestToolResult } from "../types";
import { stateManager } from "../state";

/**
 * Maximum rest duration in seconds (10 minutes)
 */
const MAX_REST_SECONDS = 600;

/**
 * Minimum rest duration in seconds
 */
const MIN_REST_SECONDS = 1;

/**
 * Register the rest tool
 */
export function registerRestTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "rest",
    label: "Rest",
    description: `Pause execution for a specified duration (up to 10 minutes).
Use this tool when you need to wait for external processes, rate limits,
or need time for background tasks to complete. The agent will automatically
resume after the rest period unless the user interrupts.

Examples of when to use:
- Waiting for a build or test to complete
- Allowing rate limits to reset
- Giving time for a server to restart
- Pausing between retry attempts

Parameters:
- duration_seconds: How long to rest (1-600 seconds)
- reason: Optional explanation for the rest (shown to user)`,
    parameters: Type.Object({
      duration_seconds: Type.Number({
        description: "Duration to rest in seconds (min 1, max 600)",
        minimum: MIN_REST_SECONDS,
        maximum: MAX_REST_SECONDS,
      }),
      reason: Type.Optional(
        Type.String({
          description:
            "Optional reason for resting, e.g., 'Waiting for build to complete'",
        })
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const typedParams = params as RestToolParams;

      // Validate and clamp duration
      const duration = Math.min(
        Math.max(typedParams.duration_seconds, MIN_REST_SECONDS),
        MAX_REST_SECONDS
      );

      const endTime = Date.now() + duration * 1000;
      const startTime = Date.now();

      // Set resting state
      stateManager.setResting(true, endTime);

      // Record rest event
      pi.appendEntry("custom", {
        unstoppable_rest: {
          startTime: new Date().toISOString(),
          duration,
          reason: typedParams.reason || null,
        },
      });

      try {
        // Notify user
        const reasonText = typedParams.reason ? `: ${typedParams.reason}` : "";
        ctx.ui.notify(`Resting for ${duration}s${reasonText}`, "info");

        // Wait for duration or abort
        let interrupted = false;

        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (Date.now() >= endTime) {
              clearInterval(interval);
              resolve();
            }
          }, 1000);

          if (signal) {
            signal.addEventListener("abort", () => {
              clearInterval(interval);
              interrupted = true;
              resolve();
            });
          }
        });

        // Calculate actual duration
        const actualDuration = Math.round((Date.now() - startTime) / 1000);

        // Record the rest
        stateManager.recordRest(actualDuration);

        // Build result
        const result: RestToolResult = {
          rested: true,
          duration: actualDuration,
          interrupted,
        };

        let message: string;
        if (interrupted) {
          message = `Rest interrupted after ${actualDuration} seconds.`;
          ctx.ui.notify("Rest interrupted by user", "warning");
        } else {
          message = `Rest completed. Resumed after ${actualDuration} seconds.`;
          ctx.ui.notify(`Rest completed (${actualDuration}s)`, "info");
        }

        return {
          content: [
            {
              type: "text",
              text: message,
            },
          ],
          details: result,
        };
      } finally {
        // Clear resting state
        stateManager.setResting(false, null);
      }
    },
  });
}
