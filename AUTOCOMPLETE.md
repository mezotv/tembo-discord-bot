# Discord Autocomplete Guide

Complete guide for implementing autocomplete in the Tembo Discord Bot using HTTP Interactions on Cloudflare Workers.

**Sources:**
- [Discord.js Autocomplete Guide](https://discordjs.guide/legacy/slash-commands/autocomplete)
- [Discord API Documentation](https://discord.com/developers/docs/interactions/application-commands#autocomplete)
- discord-api-types/v10

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Implementation](#implementation)
4. [Testing](#testing)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Autocomplete?

Autocomplete provides dynamic suggestions to users as they type command options. Instead of remembering exact values, users see a dropdown menu with suggestions they can select.

### Why Add It?

**Before:**
```
User: /task create agent:"claudeCode:clau..."
❌ Typo → Command fails
```

**After:**
```
User: /task create agent:"clau..."
Bot: Shows dropdown with suggestions
User: Selects "Claude Code: Claude 4.5 Sonnet" ✅
```

### Key Constraints

⚠️ **Critical Rules:**
- Must respond within **3 seconds** (cannot defer)
- Maximum **25 choices** per response
- Suggestions are **NOT enforced** (users can still type freely)
- You **still need validation** in command handlers
- Only works for **STRING**, **INTEGER**, **NUMBER** option types

### Recommended Options

| Command Option | Priority | Complexity | Data Source |
|----------------|----------|------------|-------------|
| `/task create agent:` | ⭐⭐⭐ High | Easy | Static list |
| `/task create repositories:` | ⭐⭐ Medium | Medium | Tembo API + Cache |
| `/task create branch:` | ⭐ Low | Easy | Static list |
| `/task search query:` | ⭐ Low | Easy | Static keywords |

**Start with agent autocomplete for quick win!**

---

## How It Works

### Architecture Flow

```
User types in Discord
       ↓
Discord sends autocomplete interaction (type 4)
       ↓
Cloudflare Worker receives request
       ↓
AutocompleteController handles it
       ↓
Return filtered suggestions (< 3 seconds)
       ↓
Discord shows dropdown
       ↓
User selects or continues typing
       ↓
Final command submitted normally
```

### Discord API Types

```typescript
// Interaction type for autocomplete
InteractionType.ApplicationCommandAutocomplete = 4

// Response type
InteractionResponseType.ApplicationCommandAutocompleteResult = 8

// TypeScript types (from discord-api-types/v10)
APIApplicationCommandAutocompleteInteraction
APIApplicationCommandAutocompleteResponse
APICommandAutocompleteInteractionResponseCallbackData
```

### Response Structure

```typescript
{
  type: 8, // ApplicationCommandAutocompleteResult
  data: {
    choices: [
      { name: "Display Name", value: "actual_value" },
      { name: "Another Option", value: "value_2" },
      // ... up to 25 total
    ]
  }
}
```

---

## Implementation

### Phase 1: Create Helper Functions

Create `src/utils/autocomplete-helpers.ts`:

```typescript
import type { 
  APIApplicationCommandInteractionDataOption,
} from 'discord-api-types/v10';

/**
 * Get the currently focused option from autocomplete interaction
 */
export function getFocusedOption(
  options?: APIApplicationCommandInteractionDataOption[]
): { name: string; value: string } | null {
  if (!options) return null;

  for (const option of options) {
    // Check if this option is focused
    if ('focused' in option && option.focused) {
      return {
        name: option.name,
        value: String(option.value ?? ''),
      };
    }

    // Check subcommand options recursively
    if ('options' in option && option.options) {
      const focused = getFocusedOption(option.options);
      if (focused) return focused;
    }
  }

  return null;
}

/**
 * Get a specific option value (for accessing other values during autocomplete)
 */
export function getOptionValue(
  options: APIApplicationCommandInteractionDataOption[] | undefined,
  name: string
): string | number | boolean | null {
  if (!options) return null;

  for (const option of options) {
    if (option.name === name && 'value' in option) {
      return option.value ?? null;
    }

    if ('options' in option && option.options) {
      const value = getOptionValue(option.options, name);
      if (value !== null) return value;
    }
  }

  return null;
}
```

### Phase 2: Create Agent Autocomplete

Create `src/controllers/autocomplete/agents.autocomplete.ts`:

```typescript
export const AGENTS = [
  { 
    name: 'Claude Code: Claude 4.5 Sonnet (Recommended)', 
    value: 'claudeCode:claude-4-5-sonnet' 
  },
  { 
    name: 'Claude Code: Claude 3.5 Sonnet', 
    value: 'claudeCode:claude-3-5-sonnet' 
  },
  { 
    name: 'Claude Code: Claude 3 Opus', 
    value: 'claudeCode:claude-3-opus' 
  },
  { 
    name: 'Claude Code: GPT-4 Turbo', 
    value: 'claudeCode:gpt-4-turbo' 
  },
  { 
    name: 'Claude Code: GPT-4', 
    value: 'claudeCode:gpt-4' 
  },
  { 
    name: 'Claude Code: GPT-3.5 Turbo', 
    value: 'claudeCode:gpt-3.5-turbo' 
  },
];

/**
 * Filter agents based on user input
 */
export function filterAgents(
  input: string,
): Array<{ name: string; value: string }> {
  if (!input || input.trim().length === 0) {
    return AGENTS;
  }

  const lower = input.toLowerCase();
  
  return AGENTS.filter(agent =>
    agent.name.toLowerCase().includes(lower) ||
    agent.value.toLowerCase().includes(lower)
  ).slice(0, 25);
}
```

### Phase 3: Create Autocomplete Controller

Create `src/controllers/autocomplete/autocomplete.controller.ts`:

```typescript
import type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandAutocompleteResponse,
} from 'discord-api-types/v10';
import { InteractionResponseType } from 'discord-api-types/v10';
import { BaseController } from '../base.controller';
import { getFocusedOption } from '../../utils/autocomplete-helpers';
import { logger } from '../../utils/logger';
import { filterAgents } from './agents.autocomplete';

export class AutocompleteController extends BaseController {
  async handle(
    interaction: APIApplicationCommandAutocompleteInteraction,
  ): Promise<APIApplicationCommandAutocompleteResponse> {
    const startTime = Date.now();
    const commandName = interaction.data.name;
    const focusedOption = getFocusedOption(interaction.data.options);

    if (!focusedOption) {
      logger.warn('No focused option found in autocomplete', { commandName });
      return this.createEmptyResponse();
    }

    logger.info('Autocomplete request', {
      command: commandName,
      option: focusedOption.name,
      input: focusedOption.value.substring(0, 50),
    });

    try {
      let choices: Array<{ name: string; value: string }> = [];

      switch (commandName) {
        case 'task':
          choices = await this.handleTaskAutocomplete(focusedOption);
          break;
        default:
          logger.warn('Unknown command for autocomplete', { commandName });
      }

      const duration = Date.now() - startTime;
      logger.info('Autocomplete completed', {
        command: commandName,
        option: focusedOption.name,
        resultCount: choices.length,
        duration,
      });

      return {
        type: InteractionResponseType.ApplicationCommandAutocompleteResult,
        data: {
          choices: choices.slice(0, 25),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Autocomplete error', error, {
        command: commandName,
        option: focusedOption.name,
        duration,
      });
      
      // Never throw - return empty response
      return this.createEmptyResponse();
    }
  }

  private async handleTaskAutocomplete(
    focusedOption: { name: string; value: string },
  ): Promise<Array<{ name: string; value: string }>> {
    switch (focusedOption.name) {
      case 'agent':
        return filterAgents(focusedOption.value);
      
      case 'repositories':
        return await this.handleRepositoryAutocomplete(focusedOption.value);
      
      case 'branch':
        return this.handleBranchAutocomplete(focusedOption.value);
      
      default:
        return [];
    }
  }

  private async handleRepositoryAutocomplete(
    input: string,
  ): Promise<Array<{ name: string; value: string }>> {
    try {
      // Timeout protection
      const timeout = new Promise<[]>(resolve => 
        setTimeout(() => resolve([]), 2000)
      );

      const fetchRepos = this.temboService
        .listRepositories()
        .then(result => {
          const lower = input.toLowerCase();
          return result.codeRepositories
            .filter(repo =>
              repo.name.toLowerCase().includes(lower) ||
              repo.url.toLowerCase().includes(lower)
            )
            .map(repo => ({
              name: `${repo.name} (${repo.url.substring(0, 40)}...)`,
              value: repo.url,
            }));
        });

      return await Promise.race([fetchRepos, timeout]);
    } catch (error) {
      logger.error('Failed to fetch repositories for autocomplete', error);
      return [];
    }
  }

  private handleBranchAutocomplete(
    input: string,
  ): Array<{ name: string; value: string }> {
    const branches = [
      { name: 'main', value: 'main' },
      { name: 'master', value: 'master' },
      { name: 'develop', value: 'develop' },
      { name: 'staging', value: 'staging' },
      { name: 'production', value: 'production' },
    ];

    const lower = input.toLowerCase();
    return branches.filter(branch =>
      branch.name.toLowerCase().includes(lower)
    );
  }

  private createEmptyResponse(): APIApplicationCommandAutocompleteResponse {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: {
        choices: [],
      },
    };
  }
}
```

### Phase 4: Update Main Handler

Update `src/index.ts`:

```typescript
import type {
  APIApplicationCommandAutocompleteInteraction, // Add this
} from 'discord-api-types/v10';
import { AutocompleteController } from './controllers/autocomplete/autocomplete.controller'; // Add this

// In the POST /interactions handler, add this before ApplicationCommand check:

if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
  const autocompleteInteraction = 
    interaction as APIApplicationCommandAutocompleteInteraction;
  
  const userId = autocompleteInteraction.user?.id ?? 
                 autocompleteInteraction.member?.user?.id ?? 
                 'unknown';

  logger.info('Received autocomplete', {
    command: autocompleteInteraction.data.name,
    userId,
  });

  const temboService = createTemboService(env.TEMBO_API_KEY);
  const autocompleteController = new AutocompleteController(temboService);

  const response = await asyncHandler(
    () => autocompleteController.handle(autocompleteInteraction),
    'autocomplete',
    userId,
  );
  
  return c.json(response);
}
```

### Phase 5: Export Controller

Update `src/controllers/index.ts`:

```typescript
export { AutocompleteController } from './autocomplete/autocomplete.controller';
```

### Phase 6: Update Command Registration

Update `src/scripts/register-commands.ts`:

```typescript
{
  type: ApplicationCommandOptionType.Subcommand,
  name: 'create',
  description: 'Create a new Tembo task',
  options: [
    // ... existing prompt option ...
    {
      type: ApplicationCommandOptionType.String,
      name: 'agent',
      description: 'The agent to use for this task',
      required: false,
      autocomplete: true, // ← Add this
    },
    {
      type: ApplicationCommandOptionType.String,
      name: 'repositories',
      description: 'Repository URL or name',
      required: false,
      autocomplete: true, // ← Add this
    },
    {
      type: ApplicationCommandOptionType.String,
      name: 'branch',
      description: 'Specific git branch to target',
      required: false,
      autocomplete: true, // ← Add this
    },
    // ... other options ...
  ],
},
```

### Phase 7: Add TypeScript Types

Update `src/types/index.ts`:

```typescript
export type {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandAutocompleteResponse,
  APICommandAutocompleteInteractionResponseCallbackData,
} from 'discord-api-types/v10';
```

---

## Testing

### Unit Tests

Create `src/controllers/autocomplete/agents.autocomplete.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterAgents } from './agents.autocomplete';

describe('filterAgents', () => {
  it('should return all agents when input is empty', () => {
    const result = filterAgents('');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should filter agents by name', () => {
    const result = filterAgents('claude');
    expect(result.every(a => a.name.toLowerCase().includes('claude'))).toBe(true);
  });

  it('should filter agents by value', () => {
    const result = filterAgents('gpt-4');
    expect(result.some(a => a.value.includes('gpt-4'))).toBe(true);
  });

  it('should be case insensitive', () => {
    const lower = filterAgents('claude');
    const upper = filterAgents('CLAUDE');
    expect(lower).toEqual(upper);
  });

  it('should limit to 25 results max', () => {
    const result = filterAgents('');
    expect(result.length).toBeLessThanOrEqual(25);
  });
});
```

### Manual Testing Checklist

- [ ] Autocomplete dropdown appears when typing
- [ ] Suggestions update as you type
- [ ] Can select with mouse
- [ ] Can select with keyboard (arrows + Enter)
- [ ] Empty input shows default suggestions
- [ ] Typing filters suggestions correctly
- [ ] Case-insensitive filtering works
- [ ] No matches shows "No options match your search"
- [ ] Response is fast (< 1 second)
- [ ] Selected values work in final command
- [ ] Can still type free text (not forced to select)

---

## Deployment

### Step 1: Create Directory Structure

```bash
mkdir -p src/controllers/autocomplete
mkdir -p src/utils
```

### Step 2: Add Files

1. `src/utils/autocomplete-helpers.ts`
2. `src/controllers/autocomplete/agents.autocomplete.ts`
3. `src/controllers/autocomplete/autocomplete.controller.ts`
4. Update `src/index.ts`
5. Update `src/controllers/index.ts`
6. Update `src/scripts/register-commands.ts`
7. Update `src/types/index.ts`

### Step 3: Run Tests

```bash
bun test
```

### Step 4: Register Commands

```bash
bun run register-commands
```

Expected output:
```
✅ Successfully registered 3 slash command(s)!
Commands:
  - /task: Manage Tembo tasks
  - /repositories: Manage Tembo repositories
  - /whoami: Get your current Tembo user information
```

### Step 5: Deploy

```bash
bun run deploy
```

### Step 6: Test in Discord

Wait 5-10 minutes for Discord to update commands globally, then:

1. Type `/task create`
2. Start typing in the `agent` field
3. See autocomplete suggestions appear!

---

## Troubleshooting

### Issue: Autocomplete not appearing

**Causes:**
- Commands not re-registered with `autocomplete: true`
- Discord cache not updated

**Solutions:**
```bash
# Re-register commands
bun run register-commands

# Wait 5-10 minutes
# Try in a different server or DM
```

### Issue: "Application did not respond"

**Causes:**
- Response taking > 3 seconds
- Error being thrown without catch

**Solutions:**
```typescript
// Add timeout protection (already in implementation above)
const timeout = new Promise(resolve => setTimeout(() => resolve([]), 2000));
const result = await Promise.race([fetchData(), timeout]);
```

**Check logs:**
```bash
wrangler tail
```

### Issue: "No options match your search" always shows

**Causes:**
- Autocomplete handler not responding
- Response format incorrect
- Error being thrown

**Solutions:**
```bash
# Check Cloudflare logs
wrangler tail

# Verify response format in logs
logger.info('Autocomplete response', { choices });
```

### Issue: User input validation failing

**Reminder:** Autocomplete suggestions are NOT enforced!

**Solution:**
Always validate in your command handler:

```typescript
// In TaskController
const agent = options.get('agent');
if (agent && !isValidAgent(agent)) {
  return errorResponse('Invalid agent. Please select from suggestions.');
}
```

### Issue: Slow autocomplete responses

**Causes:**
- API calls taking too long
- No caching

**Solutions:**

Implement caching:

```typescript
// Simple in-memory cache
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item || Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCache(key: string, data: any, ttlMs: number) {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs,
  });
}
```

---

## Performance Tips

### 1. Cache Static Data

```typescript
// Agent list never changes - cache forever
const AGENTS = [...]; // Already static in implementation
```

### 2. Cache API Responses

```typescript
// Cache repository list for 1 hour
const REPO_CACHE_TTL = 60 * 60 * 1000;
```

### 3. Timeout Protection

```typescript
// Always use Promise.race with timeout
const TIMEOUT = 2000; // 2 seconds max
const result = await Promise.race([
  fetchData(),
  new Promise(resolve => setTimeout(() => resolve([]), TIMEOUT))
]);
```

### 4. Limit Results Early

```typescript
// Filter and slice in one operation
return items
  .filter(item => matches(item, input))
  .slice(0, 25); // Max 25 choices
```

---

## Summary

### Implementation Checklist

- [ ] Create `autocomplete-helpers.ts`
- [ ] Create `agents.autocomplete.ts`
- [ ] Create `autocomplete.controller.ts`
- [ ] Update `src/index.ts` with autocomplete route
- [ ] Update `src/controllers/index.ts` export
- [ ] Update `src/scripts/register-commands.ts` with `autocomplete: true`
- [ ] Update `src/types/index.ts` with types
- [ ] Write unit tests
- [ ] Run `bun run register-commands`
- [ ] Run `bun run deploy`
- [ ] Test in Discord

### Key Takeaways

1. ✅ Autocomplete is **UX enhancement**, not validation
2. ✅ Must respond within **3 seconds** (cannot defer)
3. ✅ Max **25 choices** per response
4. ✅ Users can **still type free text**
5. ✅ Must handle errors gracefully (return empty, don't throw)
6. ✅ Always add **timeout protection**
7. ✅ **Cache** frequently accessed data

### Estimated Time

- **Phase 1-3** (Infrastructure + Agent): 2-3 hours
- **Phase 4-5** (Repository + Branch): 1-2 hours
- **Testing & Deployment**: 1 hour

**Total: 4-6 hours for full implementation**

---

**Ready to implement!** Start with agent autocomplete for a quick win! 🚀

