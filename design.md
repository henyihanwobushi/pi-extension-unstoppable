# Unstoppable Extension Design

## Overview

This pi-extension provides two key features:
1. **Auto-continuation**: Automatically continues the LLM loop when the agent stops
2. **Rest Tool**: A new tool that allows the agent to pause execution for up to 10 minutes

## Motivation

When working on long-running tasks, the agent may stop prematurely due to:
- Token limits
- Model-side termination
- Reaching completion state

The unstoppable extension ensures the agent continues working until the task is truly complete, while providing a controlled way for the agent to take breaks when needed.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Unstoppable Extension                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Rest Tool     │    │    Auto-Continue Handler        │ │
│  │                 │    │                                 │ │
│  │ - Duration param│    │ - Listen to agent_end event    │ │
│  │ - Max 10 min    │    │ - Check continuation criteria  │ │
│  │ - AbortSignal   │    │ - Inject continuation message  │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    State Manager                         ││
│  │                                                          ││
│  │ - isResting: boolean                                     ││
│  │ - restEndTime: number | null                            ││
│  │ - continuationCount: number                              ││
│  │ - lastActivity: number                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Auto-Continuation

**Mechanism:**
- Subscribe to `agent_end` event
- When the agent stops, check if continuation is warranted:
  - The agent was not manually stopped by user
  - The agent is not in a "resting" state
  - A maximum continuation limit hasn't been reached (configurable, default: 10)
- If criteria met, inject a continuation message using `pi.sendUserMessage()`

**Continuation Message Strategy:**
The extension sends a message like:
```
[Auto-continuation] Continue working on the task. Progress so far: X continuations.
```

**Event Handler:**
```typescript
pi.on("agent_end", async (event, ctx) => {
  // Check if we should continue
  if (shouldContinue(ctx)) {
    state.continuationCount++;
    await pi.sendUserMessage(
      `[Auto-continuation ${state.continuationCount}/${config.maxContinuations}] ` +
      `Continue working on the task from where you left off.`,
      { silent: true }
    );
  }
});
```

### 2. Rest Tool

**Tool Definition:**
```typescript
pi.registerTool({
  name: "rest",
  label: "Rest",
  description: `Pause execution for a specified duration (up to 10 minutes).
Use this tool when you need to wait for external processes, rate limits,
or simply need a break. The agent will automatically resume after the
rest period unless the user interrupts.`,
  parameters: Type.Object({
    duration_seconds: Type.Number({
      description: "Duration to rest in seconds (max 600 = 10 minutes)",
      minimum: 1,
      maximum: 600
    }),
    reason: Type.Optional(Type.String({
      description: "Optional reason for resting (shown to user)"
    }))
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    const duration = Math.min(params.duration_seconds, 600);
    const endTime = Date.now() + duration * 1000;

    state.isResting = true;
    state.restEndTime = endTime;

    try {
      // Notify user
      ctx.ui.notify(
        `Resting for ${duration}s${params.reason ? `: ${params.reason}` : ''}`,
        "info"
      );

      // Wait for duration or abort
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const remaining = Math.ceil((endTime - Date.now()) / 1000);
          onUpdate?.({ status: `Resting... ${remaining}s remaining` });

          if (Date.now() >= endTime) {
            clearInterval(interval);
            resolve();
          }
        }, 1000);

        signal.addEventListener("abort", () => {
          clearInterval(interval);
          resolve();
        });
      });

      return {
        content: [{
          type: "text",
          text: `Rest completed. Resumed after ${duration} seconds.`
        }],
        details: { rested: true, duration }
      };
    } finally {
      state.isResting = false;
      state.restEndTime = null;
    }
  }
});
```

### 3. State Management

**Persistent State (via `pi.appendEntry`):**
```typescript
interface UnstoppableState {
  continuationCount: number;
  lastActivity: number;
  totalRestTime: number;
  restCount: number;
}
```

**Session Restoration:**
On `session_start`, restore state from previous entries:
```typescript
pi.on("session_start", async (event, ctx) => {
  const entries = ctx.sessionManager.getEntries();
  const stateEntries = entries.filter(e => e.type === "unstoppable-state");
  if (stateEntries.length > 0) {
    state = stateEntries[stateEntries.length - 1].data;
  }
});
```

## Configuration

The extension supports the following configuration options (stored in extension state or settings):

```typescript
interface UnstoppableConfig {
  // Maximum number of auto-continuations per session
  maxContinuations: number; // Default: 10

  // Whether to continue when agent stops with an error
  continueOnError: boolean; // Default: false

  // Minimum time between continuations (ms)
  minContinuationDelay: number; // Default: 1000

  // Cooldown period after rest before allowing continuation
  restCooldown: number; // Default: 5000

  // Custom continuation message template
  continuationMessage: string; // Default: "Continue working on the task..."
}
```

## User Interface

### Status Display
The extension shows status in the TUI footer:
```typescript
ctx.ui.setStatus("unstoppable", `Auto-continue: ${state.continuationCount}/${config.maxContinuations}`);
```

### Rest Tool UI
When the rest tool is active, show a widget with countdown:
```typescript
ctx.ui.setWidget("rest-countdown", [
  `Resting for ${remainingSeconds}s...`,
  "Press Ctrl+C to interrupt"
]);
```

## Commands

### `/unstoppable` Command
Toggle or configure the extension:
```typescript
pi.registerCommand("unstoppable", {
  description: "Configure unstoppable extension",
  async handler(args, ctx) {
    const action = await ctx.ui.select("Unstoppable Settings:", [
      { label: "Toggle Auto-continue", value: "toggle" },
      { label: "Set max continuations", value: "max" },
      { label: "View statistics", value: "stats" },
      { label: "Reset counters", value: "reset" }
    ]);

    // Handle action...
  }
});
```

### `/rest` Command
Manual rest command for users:
```typescript
pi.registerCommand("rest", {
  description: "Manually trigger a rest period",
  async handler(args, ctx) {
    const duration = await ctx.ui.input(
      "Rest duration (seconds, max 600):",
      "60"
    );
    // Execute rest logic...
  }
});
```

## Events Integration

### Event Flow
```
session_start
    │
    ▼
before_agent_start ─────────────────┐
    │                               │
    ▼                               │
turn_start                          │
    │                               │
    ▼                               │
[Tool calls, including rest]        │
    │                               │
    ▼                               │
turn_end                            │
    │                               │
    ▼                               │
agent_end ──────► [Auto-continue?] ─┘
    │               │
    │               ▼
    │         sendUserMessage()
    │               │
    ▼               │
[Session continues]─┘
```

### Blocking Rest During Critical Operations
```typescript
pi.on("tool_call", async (event, ctx) => {
  // Prevent rest tool during file mutations
  if (event.toolName === "rest" && state.criticalOperationInProgress) {
    return {
      block: true,
      reason: "Cannot rest during critical file operations"
    };
  }
});
```

## Error Handling

1. **Rest interrupted**: Clean up state and notify agent
2. **Continuation fails**: Log error and don't retry infinitely
3. **State corruption**: Reset to defaults on load

## Security Considerations

1. **Rest tool abuse**: Maximum 10 minutes enforced in code
2. **Infinite loop prevention**: Max continuation limit
3. **User override**: Allow user to stop continuation with Ctrl+C

## File Structure

```
.pi/extensions/unstoppable/
├── index.ts           # Main extension entry point
├── tools/
│   └── rest.ts        # Rest tool implementation
├── handlers/
│   ├── agent-end.ts   # Auto-continuation handler
│   └── session.ts     # Session start/end handlers
├── state.ts           # State management
├── config.ts          # Configuration
└── types.ts           # TypeScript types
```

## Implementation Phases

### Phase 1: Core Functionality
- [ ] Basic extension structure
- [ ] Rest tool with duration parameter
- [ ] Agent end event handler
- [ ] Basic auto-continuation

### Phase 2: State & Configuration
- [ ] Persistent state management
- [ ] Configuration options
- [ ] Session restoration

### Phase 3: User Interface
- [ ] Status display
- [ ] Rest countdown widget
- [ ] Commands (/unstoppable, /rest)

### Phase 4: Polish
- [ ] Error handling
- [ ] Edge cases
- [ ] Testing

## Example Usage

### Agent using rest tool:
```
[Agent]: I've started a background build process. Let me rest while it completes.
[Tool: rest] duration_seconds: 120, reason: "Waiting for build to complete"
[Status: Resting for 120s...]
... 2 minutes pass ...
[Tool Result]: Rest completed. Resumed after 120 seconds.
[Agent]: The build should be done. Let me check the results.
```

### Auto-continuation in action:
```
[Agent]: I've completed 3 out of 10 files. This is taking longer than expected...
[Agent ends]
[Auto-continuation 1/10] Continue working on the task from where you left off.
[Agent]: Right, continuing with files 4-6...
...
[Agent ends]
[Auto-continuation 2/10] Continue working on the task from where you left off.
[Agent]: Continuing with remaining files...
```

## Testing Strategy

1. **Unit tests**: State management, config parsing
2. **Integration tests**: Event handlers, tool execution
3. **Manual testing**:
   - Start long task, verify continuation
   - Use rest tool, verify countdown
   - Interrupt rest with Ctrl+C
   - Hit max continuation limit
