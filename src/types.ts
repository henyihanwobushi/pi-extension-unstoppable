import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Persistent state that survives session restarts
 */
export interface UnstoppableState {
  /** Number of auto-continuations in this session */
  continuationCount: number;

  /** Timestamp of last activity (ms since epoch) */
  lastActivity: number;

  /** Total time spent resting (seconds) */
  totalRestTime: number;

  /** Number of times rest tool was used */
  restCount: number;
}

/**
 * Runtime state (not persisted)
 */
export interface RuntimeState {
  /** Whether the agent is currently resting */
  isResting: boolean;

  /** When the current rest ends (timestamp, or null if not resting) */
  restEndTime: number | null;

  /** Whether a critical operation is in progress */
  criticalOperationInProgress: boolean;

  /** Whether auto-continue is enabled */
  autoContinueEnabled: boolean;

  /** Timestamp of last continuation */
  lastContinuationTime: number;

  /** Whether the last message was from auto-continuation (not user) */
  lastMessageWasAutoContinue: boolean;
}

/**
 * Configuration options for the unstoppable extension
 */
export interface UnstoppableConfig {
  /** Maximum number of auto-continuations per session */
  maxContinuations: number;

  /** Whether to continue when agent stops with an error */
  continueOnError: boolean;

  /** Minimum time between continuations (ms) */
  minContinuationDelay: number;

  /** Cooldown period after rest before allowing continuation (ms) */
  restCooldown: number;

  /** Custom continuation message template */
  continuationMessage: string;

  /** Whether the extension is enabled */
  enabled: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: UnstoppableConfig = {
  maxContinuations: 0, // 0 = infinite/unlimited
  continueOnError: false,
  minContinuationDelay: 1000,
  restCooldown: 5000,
  continuationMessage: "Continue working on the task from where you left off.",
  enabled: true,
};

/**
 * Default persistent state
 */
export const DEFAULT_STATE: UnstoppableState = {
  continuationCount: 0,
  lastActivity: Date.now(),
  totalRestTime: 0,
  restCount: 0,
};

/**
 * Default runtime state
 */
export const DEFAULT_RUNTIME_STATE: RuntimeState = {
  isResting: false,
  restEndTime: null,
  criticalOperationInProgress: false,
  autoContinueEnabled: true,
  lastContinuationTime: 0,
  lastMessageWasAutoContinue: false,
};

/**
 * Result from the rest tool
 */
export interface RestToolResult {
  /** Whether the rest completed successfully */
  rested: boolean;

  /** Duration of rest in seconds */
  duration: number;

  /** Whether the rest was interrupted */
  interrupted: boolean;
}

/**
 * Parameters for the rest tool
 */
export interface RestToolParams {
  /** Duration to rest in seconds (1-600) */
  duration_seconds: number;

  /** Optional reason for resting */
  reason?: string;
}

// Re-export types from pi-coding-agent
export type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
