# Unstoppable - pi Extension

A [pi-coding-agent](https://github.com/badlogic/pi-mono) extension that provides auto-continuation and rest capabilities for long-running tasks.

## Features

### Auto-Continuation

Automatically continues the LLM loop when the agent stops. This is useful for:

- Long-running tasks that exceed token limits
- Complex multi-step operations
- Tasks that require multiple agent turns to complete

When the agent ends, the extension checks if continuation is warranted and automatically injects a continuation message to keep the work going.

### Rest Tool

A new tool called `rest` that allows the agent to pause execution for up to 10 minutes. Use cases include:

- Waiting for builds or tests to complete
- Allowing rate limits to reset
- Giving time for servers to restart
- Pausing between retry attempts

## Installation

### Option 1: Global Installation

Copy the `index.ts` file to the global extensions directory:

```bash
mkdir -p ~/.pi/agent/extensions
cp index.ts ~/.pi/agent/extensions/unstoppable.ts
```

### Option 2: Project-Local Installation

Copy the extension to your project:

```bash
mkdir -p .pi/extensions
cp index.ts .pi/extensions/unstoppable.ts
```

### Option 3: Settings Configuration

Add to your `settings.json`:

```json
{
  "extensions": ["/path/to/unstoppable/index.ts"]
}
```

### Option 4: As a Package

For extensions with dependencies, use the `package.json` approach:

```bash
cd /path/to/unstoppable
npm install
```

Then add to `settings.json`:

```json
{
  "extensions": ["/path/to/unstoppable/index.ts"]
}
```

## Usage

### Rest Tool (LLM-Callable)

The agent can use the `rest` tool during execution:

```
[Agent]: I've started the build process. Let me wait for it to complete.
[Tool: rest] duration_seconds: 120, reason: "Waiting for build"
[Status: Resting for 120s...]
... 2 minutes pass ...
[Agent]: Build completed. Checking results now.
```

### Auto-Continuation

When the agent stops, the extension automatically continues:

```
[Agent]: I've processed 5 out of 15 files...
[Agent ends]
[Auto-continuation 1/10] Continue working on the task from where you left off.
[Agent]: Continuing with files 6-10...
```

### Commands

#### `/unstoppable`

Configure the extension:

```
/unstoppable
```

Options:
- **Toggle Auto-continue** - Enable/disable auto-continuation
- **Set max continuations** - Configure the limit (1-100)
- **View statistics** - See continuation and rest stats
- **Reset counters** - Clear all counters

#### `/rest`

Manually trigger a rest period:

```
/rest 60
```

Or without arguments to be prompted for duration.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `maxContinuations` | 10 | Maximum auto-continuations per session |
| `continueOnError` | false | Continue even if agent ends with error |
| `minContinuationDelay` | 1000ms | Minimum time between continuations |
| `restCooldown` | 5000ms | Cooldown after rest before continuing |

Configuration is managed through the `/unstoppable` command.

## File Structure

```
unstopable/
├── index.ts                 # Single-file entry point
├── package.json             # Package configuration
├── design.md                # Detailed design document
├── README.md                # This file
└── src/
    ├── index.ts             # Main extension entry
    ├── types.ts             # TypeScript type definitions
    ├── config.ts            # Configuration management
    ├── state.ts             # State management
    ├── tools/
    │   └── rest.ts          # Rest tool implementation
    └── handlers/
        ├── agent-end.ts     # Auto-continuation logic
        └── session.ts       # Session and command handlers
```

## Safety Features

- **Maximum rest duration**: Hard limit of 10 minutes (600 seconds)
- **Maximum continuations**: Configurable limit prevents infinite loops
- **User interruptible**: Rest periods can be cancelled with Ctrl+C
- **State tracking**: All activity is logged and can be reviewed

## API

The extension exports these types for external use:

```typescript
import type { UnstoppableConfig, UnstoppableState, RuntimeState } from "./types";
```

## Development

Built for [pi-coding-agent](https://github.com/badlogic/pi-mono) using:

- `@mariozechner/pi-coding-agent` - Extension API types
- `@sinclair/typebox` - Schema definitions

Extensions run via [jiti](https://github.com/unjs/jiti), enabling TypeScript execution without pre-compilation.

## License

MIT
