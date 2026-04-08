/**
 * Unstoppable Extension - Single File Entry Point
 *
 * Copy this file to:
 * - ~/.pi/agent/extensions/unstoppable.ts (global)
 * - .pi/extensions/unstoppable.ts (project-local)
 *
 * Or add to your settings.json:
 * { "extensions": ["/path/to/unstoppable/index.ts"] }
 */

// Re-export the main extension
export { default } from "./src/index.js";
