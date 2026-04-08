import type {
  UnstoppableState,
  RuntimeState,
  ExtensionAPI,
  ExtensionContext,
} from "./types";
import { DEFAULT_STATE, DEFAULT_RUNTIME_STATE } from "./types";

// Use "custom" entry type for persistence
const ENTRY_TYPE = "custom";

/**
 * State manager for the unstoppable extension
 * Handles both persistent state (survives restarts) and runtime state
 */
export class StateManager {
  private persistentState: UnstoppableState;
  private runtimeState: RuntimeState;
  private pi: ExtensionAPI | null = null;

  constructor() {
    this.persistentState = { ...DEFAULT_STATE };
    this.runtimeState = { ...DEFAULT_RUNTIME_STATE };
  }

  /**
   * Initialize with ExtensionAPI for persistence
   */
  init(pi: ExtensionAPI): void {
    this.pi = pi;
  }

  /**
   * Restore state from session entries
   */
  restoreFromSession(ctx: ExtensionContext): void {
    const entries = ctx.sessionManager.getEntries();
    // Find entries with our custom data
    for (const entry of entries) {
      if (entry.type === ENTRY_TYPE) {
        const data = entry as unknown as { unstoppable?: UnstoppableState };
        if (data.unstoppable) {
          this.persistentState = {
            ...DEFAULT_STATE,
            ...data.unstoppable,
          };
          break;
        }
      }
    }

    // Reset runtime state on session load
    this.runtimeState = { ...DEFAULT_RUNTIME_STATE };
  }

  /**
   * Persist current state to session
   */
  persist(): void {
    if (this.pi) {
      this.pi.appendEntry(ENTRY_TYPE, { unstoppable: this.persistentState });
    }
  }

  // ==================== Persistent State ====================

  /**
   * Get persistent state
   */
  getPersistentState(): UnstoppableState {
    return { ...this.persistentState };
  }

  /**
   * Increment continuation count
   */
  incrementContinuation(): number {
    this.persistentState.continuationCount++;
    this.persistentState.lastActivity = Date.now();
    this.runtimeState.lastContinuationTime = Date.now();
    this.runtimeState.lastMessageWasAutoContinue = true;
    this.persist();
    return this.persistentState.continuationCount;
  }

  /**
   * Mark that user sent a message (not auto-continue)
   */
  markUserMessage(): void {
    this.runtimeState.lastMessageWasAutoContinue = false;
  }

  /**
   * Check if last message was from auto-continue
   */
  wasLastMessageAutoContinue(): boolean {
    return this.runtimeState.lastMessageWasAutoContinue;
  }

  /**
   * Get continuation count
   */
  getContinuationCount(): number {
    return this.persistentState.continuationCount;
  }

  /**
   * Record a rest period
   */
  recordRest(durationSeconds: number): void {
    this.persistentState.totalRestTime += durationSeconds;
    this.persistentState.restCount++;
    this.persistentState.lastActivity = Date.now();
    this.persist();
  }

  /**
   * Reset all counters
   */
  resetCounters(): void {
    this.persistentState = { ...DEFAULT_STATE };
    this.runtimeState.lastContinuationTime = 0;
    this.persist();
  }

  // ==================== Runtime State ====================

  /**
   * Get runtime state
   */
  getRuntimeState(): RuntimeState {
    return { ...this.runtimeState };
  }

  /**
   * Check if currently resting
   */
  isResting(): boolean {
    return this.runtimeState.isResting;
  }

  /**
   * Set resting state
   */
  setResting(isResting: boolean, endTime: number | null = null): void {
    this.runtimeState.isResting = isResting;
    this.runtimeState.restEndTime = endTime;
  }

  /**
   * Get rest end time
   */
  getRestEndTime(): number | null {
    return this.runtimeState.restEndTime;
  }

  /**
   * Check if auto-continue is enabled
   */
  isAutoContinueEnabled(): boolean {
    return this.runtimeState.autoContinueEnabled;
  }

  /**
   * Toggle auto-continue
   */
  toggleAutoContinue(): boolean {
    this.runtimeState.autoContinueEnabled = !this.runtimeState.autoContinueEnabled;
    return this.runtimeState.autoContinueEnabled;
  }

  /**
   * Set auto-continue enabled state
   */
  setAutoContinue(enabled: boolean): void {
    this.runtimeState.autoContinueEnabled = enabled;
  }

  /**
   * Get last continuation time
   */
  getLastContinuationTime(): number {
    return this.runtimeState.lastContinuationTime;
  }

  /**
   * Set critical operation flag
   */
  setCriticalOperation(inProgress: boolean): void {
    this.runtimeState.criticalOperationInProgress = inProgress;
  }

  /**
   * Check if critical operation is in progress
   */
  isCriticalOperationInProgress(): boolean {
    return this.runtimeState.criticalOperationInProgress;
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.persistentState.lastActivity = Date.now();
  }

  /**
   * Get statistics summary
   */
  getStats(): {
    continuationCount: number;
    totalRestTime: number;
    restCount: number;
    avgRestDuration: number;
    isResting: boolean;
    autoContinueEnabled: boolean;
  } {
    return {
      continuationCount: this.persistentState.continuationCount,
      totalRestTime: this.persistentState.totalRestTime,
      restCount: this.persistentState.restCount,
      avgRestDuration:
        this.persistentState.restCount > 0
          ? Math.round(
              this.persistentState.totalRestTime / this.persistentState.restCount
            )
          : 0,
      isResting: this.runtimeState.isResting,
      autoContinueEnabled: this.runtimeState.autoContinueEnabled,
    };
  }
}

// Singleton instance
export const stateManager = new StateManager();
