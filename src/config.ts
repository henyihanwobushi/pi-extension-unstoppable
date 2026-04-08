import type { UnstoppableConfig } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Configuration manager for the unstoppable extension
 */
export class ConfigManager {
  private config: UnstoppableConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get the current configuration
   */
  get(): UnstoppableConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with partial values
   */
  update(partial: Partial<UnstoppableConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Check if auto-continue is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Toggle extension enabled state
   */
  toggle(): boolean {
    this.config.enabled = !this.config.enabled;
    return this.config.enabled;
  }

  /**
   * Check if we can continue (under max limit)
   * Returns true always if maxContinuations is 0 (infinite)
   */
  canContinue(currentCount: number): boolean {
    // 0 means infinite/unlimited
    if (this.config.maxContinuations === 0) return true;
    return currentCount < this.config.maxContinuations;
  }

  /**
   * Check if enough time has passed since last continuation
   */
  canContinueAfterDelay(lastContinuationTime: number): boolean {
    return Date.now() - lastContinuationTime >= this.config.minContinuationDelay;
  }

  /**
   * Check if we can continue after a rest
   */
  canContinueAfterRest(restEndTime: number | null): boolean {
    if (restEndTime === null) return true;
    return Date.now() - restEndTime >= this.config.restCooldown;
  }

  /**
   * Get max continuations (0 means infinite)
   */
  getMaxContinuations(): number {
    return this.config.maxContinuations;
  }

  /**
   * Set max continuations (0 for infinite, 1-100 for limited)
   */
  setMaxContinuations(max: number): void {
    // Allow 0 for infinite, otherwise clamp to 1-100
    if (max === 0) {
      this.config.maxContinuations = 0;
    } else {
      this.config.maxContinuations = Math.max(1, Math.min(100, max));
    }
  }

  /**
   * Check if max continuations is infinite (0)
   */
  isInfinite(): boolean {
    return this.config.maxContinuations === 0;
  }

  /**
   * Check if should continue on error
   */
  shouldContinueOnError(): boolean {
    return this.config.continueOnError;
  }

  /**
   * Get the continuation message
   */
  getContinuationMessage(count: number, max: number, aim: string | null): string {
    const maxDisplay = max === 0 ? "∞" : max;
    if (aim) {
      return `[Auto-continuation ${count}/${maxDisplay}] Continue working toward the goal: ${aim}`;
    }
    return `[Auto-continuation ${count}/${maxDisplay}] ${this.config.continuationMessage}`;
  }
}

// Singleton instance
export const configManager = new ConfigManager();
