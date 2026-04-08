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

  // Don't continue if last message was already an auto-continue
  // This prevents infinite loops when user stops the agent
  if (stateManager.wasLastMessageAutoContinue()) {
    return {
      shouldContinue: false,
      reason: "Last message was auto-continue, waiting for user input",
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

    // Small delay to ensure the notification is shown before continuing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send continuation message - after agent_end we're not streaming,
    // so sendUserMessage should trigger a new turn immediately
    await pi.sendUserMessage(message);
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

/**
 * Register input handler to detect user messages
 * Only mark as user message if source is "interactive" (typed) or "rpc" (API)
 * Skip "extension" source which comes from sendUserMessage/sendMessage
 */
export function registerInputHandler(pi: ExtensionAPI): void {
  pi.on("input", async (event, ctx) => {
    // Only mark as user message if not from extension
    if (event.source === "interactive" || event.source === "rpc") {
      stateManager.markUserMessage();
    }
    // If source is "extension", it came from our auto-continue, so don't reset
  });
}
