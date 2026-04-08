import type { ExtensionAPI, ExtensionContext } from "../types";
import { stateManager } from "../state";
import { configManager } from "../config";

/**
 * Register session event handlers
 */
export function registerSessionHandlers(pi: ExtensionAPI): void {
  // Handle session start - restore state
  pi.on("session_start", async (event, ctx) => {
    // Restore state from previous session entries
    stateManager.restoreFromSession(ctx);

    // Initialize state manager with pi for persistence
    stateManager.init(pi);

    // Show notification that extension is loaded
    const stats = stateManager.getStats();
    if (stats.continuationCount > 0 || stats.restCount > 0) {
      ctx.ui.notify(
        `Unstoppable loaded (${stats.continuationCount} continuations, ${stats.restCount} rests)`,
        "info"
      );
    } else {
      ctx.ui.notify("Unstoppable extension loaded", "info");
    }
  });

  // Handle session shutdown - persist final state
  pi.on("session_shutdown", async (event, ctx) => {
    stateManager.persist();
  });

  // Handle session switch - reset runtime state for new session
  pi.on("session_before_switch", async (event, ctx) => {
    // Persist current state before switching
    stateManager.persist();
  });
}

/**
 * Register the /unstoppable command
 */
export function registerUnstoppableCommand(pi: ExtensionAPI): void {
  pi.registerCommand("unstoppable", {
    description: "Configure the unstoppable extension (auto-continuation settings)",
    async handler(args, ctx) {
      const toggleLabel = stateManager.isAutoContinueEnabled()
        ? "Disable Auto-continue"
        : "Enable Auto-continue";
      const maxLabel = `Set max continuations (current: ${configManager.getMaxContinuations()})`;

      const action = await ctx.ui.select("Unstoppable Settings:", [
        toggleLabel,
        maxLabel,
        "View statistics",
        "Reset counters",
        "Cancel",
      ]);

      if (!action) return;

      if (action === toggleLabel) {
        const enabled = stateManager.toggleAutoContinue();
        ctx.ui.notify(
          `Auto-continue ${enabled ? "enabled" : "disabled"}`,
          "info"
        );
      } else if (action === maxLabel) {
        const input = await ctx.ui.input(
          "Maximum continuations (1-100):",
          String(configManager.getMaxContinuations())
        );
        if (!input) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        const max = parseInt(input, 10);
        if (!isNaN(max) && max >= 1 && max <= 100) {
          configManager.setMaxContinuations(max);
          ctx.ui.notify(`Max continuations set to ${max}`, "info");
        } else {
          ctx.ui.notify("Invalid number (must be 1-100)", "error");
        }
      } else if (action === "View statistics") {
        const stats = stateManager.getStats();
        const lines = [
          "Unstoppable Statistics:",
          `  Auto-continue: ${stats.autoContinueEnabled ? "enabled" : "disabled"}`,
          `  Continuations: ${stats.continuationCount}/${configManager.getMaxContinuations()}`,
          `  Rest count: ${stats.restCount}`,
          `  Total rest time: ${stats.totalRestTime}s`,
          `  Avg rest duration: ${stats.avgRestDuration}s`,
        ];
        ctx.ui.notify(lines.join("\n"), "info");
      } else if (action === "Reset counters") {
        const confirmed = await ctx.ui.confirm(
          "Reset all counters?",
          "This will reset continuation and rest counters to zero."
        );
        if (confirmed) {
          stateManager.resetCounters();
          ctx.ui.notify("Counters reset", "info");
        }
      }
    },
  });
}

/**
 * Register the /rest command for manual rest
 */
export function registerRestCommand(pi: ExtensionAPI): void {
  pi.registerCommand("rest", {
    description: "Manually trigger a rest period (pause agent execution)",
    async handler(args, ctx) {
      // Parse duration from args or prompt
      let duration: number;

      if (args && args.trim()) {
        const parsed = parseInt(args.trim(), 10);
        if (isNaN(parsed) || parsed < 1 || parsed > 600) {
          ctx.ui.notify(
            "Invalid duration. Must be 1-600 seconds.",
            "error"
          );
          return;
        }
        duration = parsed;
      } else {
        const input = await ctx.ui.input(
          "Rest duration (seconds, max 600):",
          "60"
        );
        if (!input) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        duration = parseInt(input, 10);
        if (isNaN(duration) || duration < 1 || duration > 600) {
          ctx.ui.notify(
            "Invalid duration. Must be 1-600 seconds.",
            "error"
          );
          return;
        }
      }

      // Check if already resting
      if (stateManager.isResting()) {
        ctx.ui.notify("Already resting. Wait for current rest to complete.", "warning");
        return;
      }

      // Execute rest
      ctx.ui.notify(`Starting ${duration}s rest...`, "info");

      try {
        stateManager.setResting(true, Date.now() + duration * 1000);

        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, duration * 1000);

          // Allow user to cancel with a notification
          ctx.ui.setStatus("rest", `Resting ${duration}s... (Ctrl+C to cancel)`);
        });

        stateManager.recordRest(duration);
        ctx.ui.notify(`Rest completed (${duration}s)`, "info");
      } finally {
        stateManager.setResting(false, null);
        ctx.ui.setStatus("rest", ""); // Clear status
      }
    },
  });
}
