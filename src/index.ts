/**
 * Unstoppable Extension for pi-coding-agent
 *
 * This extension provides:
 * 1. Auto-continuation: Automatically continues the LLM loop when the agent stops
 * 2. Rest Tool: Allows the agent to pause execution for up to 10 minutes
 *
 * Installation:
 * Copy this directory to one of:
 * - ~/.pi/agent/extensions/unstoppable.ts (global)
 * - .pi/extensions/unstoppable.ts (project-local)
 *
 * Or add to your settings.json:
 * { "extensions": ["/path/to/unstoppable/index.ts"] }
 */

import type { ExtensionAPI } from "./types";
import { stateManager } from "./state";
import { registerRestTool } from "./tools/rest";
import {
  registerAgentEndHandler,
  registerTurnHandlers,
  registerInputHandler,
} from "./handlers/agent-end";
import {
  registerSessionHandlers,
  registerUnstoppableCommand,
  registerRestCommand,
  registerAimCommand,
} from "./handlers/session";

/**
 * Extension entry point
 */
export default function unstoppableExtension(pi: ExtensionAPI) {
  // Initialize state manager with API reference
  stateManager.init(pi);

  // Register the rest tool
  registerRestTool(pi);

  // Register event handlers
  registerSessionHandlers(pi);
  registerAgentEndHandler(pi);
  registerTurnHandlers(pi);
  registerInputHandler(pi);

  // Register commands
  registerUnstoppableCommand(pi);
  registerRestCommand(pi);
  registerAimCommand(pi);

  // Log that extension is loaded
  console.debug("[unstoppable] Extension loaded");
}

// Re-export types for external use
export type { UnstoppableConfig, UnstoppableState, RuntimeState } from "./types";
