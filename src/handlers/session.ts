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
    const aim = stateManager.getAim();
    if (stats.continuationCount > 0 || stats.restCount > 0) {
      ctx.ui.notify(
        `Unstoppable loaded (${stats.continuationCount} continuations, ${stats.restCount} rests)`,
        "info"
      );
    } else {
      ctx.ui.notify("Unstoppable extension loaded", "info");
    }

    // Show current aim if set
    if (aim) {
      ctx.ui.notify(`Current aim: ${aim}`, "info");
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
      const currentMax = configManager.isInfinite() ? "∞" : configManager.getMaxContinuations();
      const maxLabel = `Set max continuations (current: ${currentMax})`;

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
          "Maximum continuations (1-100, or 0/inf for unlimited):",
          String(configManager.getMaxContinuations())
        );
        if (!input) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        // Check for "inf" or "infinity" input
        const lowerInput = input.toLowerCase().trim();
        if (lowerInput === "inf" || lowerInput === "infinity" || lowerInput === "unlimited") {
          configManager.setMaxContinuations(0);
          ctx.ui.notify("Max continuations set to unlimited (∞)", "info");
          return;
        }
        const max = parseInt(input, 10);
        if (!isNaN(max) && max >= 0 && max <= 100) {
          configManager.setMaxContinuations(max);
          const display = max === 0 ? "unlimited (∞)" : max;
          ctx.ui.notify(`Max continuations set to ${display}`, "info");
        } else {
          ctx.ui.notify("Invalid number (must be 0-100, or inf)", "error");
        }
      } else if (action === "View statistics") {
        const stats = stateManager.getStats();
        const maxDisplay = configManager.isInfinite() ? "∞" : configManager.getMaxContinuations();
        const aim = stateManager.getAim();
        const lines = [
          "Unstoppable Statistics:",
          `  Auto-continue: ${stats.autoContinueEnabled ? "enabled" : "disabled"}`,
          `  Continuations: ${stats.continuationCount}/${maxDisplay}`,
          `  Rest count: ${stats.restCount}`,
          `  Total rest time: ${stats.totalRestTime}s`,
          `  Avg rest duration: ${stats.avgRestDuration}s`,
          aim ? `  Current aim: ${aim}` : "  No aim set (use /aim)",
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
 * Register the /aim command to set the user's goal
 */
export function registerAimCommand(pi: ExtensionAPI): void {
  pi.registerCommand("aim", {
    description: "Set or manage the current goal/aim for the agent",
    async handler(args, ctx) {
      const currentAim = stateManager.getAim();

      // If args provided, set the aim directly
      if (args && args.trim()) {
        const aim = args.trim();
        stateManager.setAim(aim);
        ctx.ui.notify(`Aim set: ${aim}`, "info");
        return;
      }

      // Otherwise show interactive menu
      const aimLabel = currentAim ? `View current aim: ${currentAim.substring(0, 30)}${currentAim.length > 30 ? '...' : ''}` : "View current aim (none set)";
      const options = [
        aimLabel,
        currentAim ? "Set new aim" : "Set aim",
        currentAim ? "Clear aim" : null,
        "Cancel",
      ].filter(Boolean) as string[];

      const action = await ctx.ui.select("Aim Management:", options);

      if (!action || action === "Cancel") return;

      if (action.startsWith("View current aim")) {
        if (currentAim) {
          ctx.ui.notify(`Current aim: ${currentAim}`, "info");
        } else {
          ctx.ui.notify("No aim currently set. Use 'Set aim' to define one.", "info");
        }
      } else if (action === "Set new aim" || action === "Set aim") {
        const aim = await ctx.ui.input(
          "Enter the goal/aim for the agent:",
          currentAim || ""
        );
        if (aim === undefined || aim === null) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
        if (aim.trim()) {
          stateManager.setAim(aim.trim());
          ctx.ui.notify(`Aim set: ${aim.trim()}`, "info");
        } else {
          stateManager.clearAim();
          ctx.ui.notify("Aim cleared (empty input)", "info");
        }
      } else if (action === "Clear aim") {
        const confirmed = await ctx.ui.confirm(
          "Clear current aim?",
          `Current aim: ${currentAim}`
        );
        if (confirmed) {
          stateManager.clearAim();
          ctx.ui.notify("Aim cleared", "info");
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
