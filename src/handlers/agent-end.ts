import type { ExtensionAPI, ExtensionContext } from "../types";
import { stateManager } from "../state";
import { configManager } from "../config";

/**
 * Result of checking if we should continue
 */
interface ContinueCheck {
  shouldContinue: boolean;
  reason: string;
}

/**
 * Check if we should auto-continue
 */
function shouldAutoContinue(ctx: ExtensionContext): ContinueCheck {
  // Check if extension is enabled
  if (!configManager.isEnabled()) {
    return { shouldContinue: false, reason: "Extension is disabled" };
  }

  // Check if auto-continue is enabled
  if (!stateManager.isAutoContinueEnabled()) {
    return { shouldContinue: false, reason: "Auto-continue is disabled" };
  }

  // Don't continue while resting
  if (stateManager.isResting()) {
    return { shouldContinue: false, reason: "Agent is currently resting" };
  }

  // Don't continue during critical operations
  if (stateManager.isCriticalOperationInProgress()) {
    return { shouldContinue: false, reason: "Critical operation in progress" };
  }

  // Check continuation count
  const currentCount = stateManager.getContinuationCount();
  if (!configManager.canContinue(currentCount)) {
    return {
      shouldContinue: false,
      reason: `Maximum continuations reached (${configManager.getMaxContinuations()})`,
    };
  }

  // Check minimum delay between continuations
  const lastContinuationTime = stateManager.getLastContinuationTime();
  if (!configManager.canContinueAfterDelay(lastContinuationTime)) {
    return {
      shouldContinue: false,
      reason: "Minimum delay between continuations not met",
    };
  }

  // Check cooldown after rest
  const restEndTime = stateManager.getRestEndTime();
  if (!configManager.canContinueAfterRest(restEndTime)) {
    return {
      shouldContinue: false,
      reason: "Rest cooldown period not elapsed",
    };
  }

  return { shouldContinue: true, reason: "Ready to continue" };
}

/**
 * Register the agent_end event handler for auto-continuation
 */
export function registerAgentEndHandler(pi: ExtensionAPI): void {
  pi.on("agent_end", async (event, ctx) => {
    const check = shouldAutoContinue(ctx);

    if (!check.shouldContinue) {
      // Log why we're not continuing (for debugging)
      console.debug(`[unstoppable] Not continuing: ${check.reason}`);
      return;
    }

    // Increment continuation count
    const count = stateManager.incrementContinuation();
    const maxContinuations = configManager.getMaxContinuations();

    // Get the continuation message
    const message = configManager.getContinuationMessage(count, maxContinuations);

    // Notify user
    ctx.ui.notify(`Auto-continuing (${count}/${maxContinuations})`, "info");

    // Send continuation message and trigger a new turn
    // Use sendMessage with triggerTurn to make the agent continue working
    await pi.sendMessage(
      { role: "user", content: message },
      { triggerTurn: true }
    );
  });
}

/**
 * Register the turn handlers for activity tracking
 */
export function registerTurnHandlers(pi: ExtensionAPI): void {
  // Track activity on each turn
  pi.on("turn_start", async (event, ctx) => {
    stateManager.updateActivity();
  });

  pi.on("turn_end", async (event, ctx) => {
    stateManager.updateActivity();
  });
}
