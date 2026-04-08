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
   */
  canContinue(currentCount: number): boolean {
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
   * Get max continuations
   */
  getMaxContinuations(): number {
    return this.config.maxContinuations;
  }

  /**
   * Set max continuations
   */
  setMaxContinuations(max: number): void {
    this.config.maxContinuations = Math.max(1, Math.min(100, max));
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
  getContinuationMessage(count: number, max: number): string {
    return `[Auto-continuation ${count}/${max}] ${this.config.continuationMessage}`;
  }
}

// Singleton instance
export const configManager = new ConfigManager();
