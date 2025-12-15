# Tembo Discord Bot

A production-ready Discord bot built on Cloudflare Workers that integrates with [Tembo](https://tembo.io) to manage tasks directly from Discord using slash commands.

**Made by** [Anurag Dhungana](anuragd.me) and [Dominik Koch](https://dominikkoch.dev/)

Link to add the bot: [Install](https://discord.com/oauth2/authorize?client_id=1438564757358645298)

---

## Table of Contents

- [Features](#-features)
- [Commands](#-commands)
- [Quick Start](#-quick-start)
- [Installation & Setup](#-installation--setup)
- [Inviting the Bot](#-inviting-the-bot)
- [Multi-User Authentication](#-multi-user-authentication)
- [Architecture](#️-architecture)
- [Development](#-development)
- [Testing](#-testing)
- [Monitoring & Logging](#-monitoring--logging)
- [Troubleshooting](#-troubleshooting)
- [Security](#-security)
- [Tech Stack](#-tech-stack)
- [Tembo SDK Feedback](#-tembo-sdk-feedback)
- [Contributing](#-contributing)
- [License](#-license)
- [Additional Resources](#-additional-resources)

---

## ✨ Features

- ✅ **Per-User API Keys**: Each Discord user can register their own Tembo API key
- ✅ **AES-256-GCM Encryption**: API keys are encrypted before storage
- ✅ **Cloudflare D1 Database**: Secure, serverless database for user data
- ✅ **Automatic Onboarding**: New users receive DM instructions when they try to use commands
- ✅ **Slash Commands**: Full Discord slash command support with autocomplete
- ✅ **Interactive Components**: Pagination buttons for task lists and search results
- ✅ **User & Server Installs**: Works in DMs and servers
- ✅ **Deferred Responses**: Handles long-running operations without timeouts
- ✅ **Structured Logging**: JSON logs for production observability

---

## 📚 Commands

The bot uses Discord's subcommand structure for better organization:

### Task Management

| Command | Subcommand | Description | Parameters |
|---------|------------|-------------|------------|
| `/task` | `create` | Create a new Tembo task | `prompt` (required), `agent` (autocomplete), `repositories` (autocomplete), `branch`, `ephemeral` |
| `/task` | `list` | List your tasks | `page`, `limit`, `ephemeral` |
| `/task` | `search` | Search for tasks | `query` (required), `page`, `limit`, `ephemeral` |

### Repository Management

| Command | Subcommand | Description | Parameters |
|---------|------------|-------------|------------|
| `/repositories` | `list` | List connected repositories | `ephemeral` |

### User Information

| Command | Description | Parameters |
|---------|-------------|------------|
| `/whoami` | Get your account info | `ephemeral` |

### Authentication

| Command | Description | Parameters |
|---------|-------------|------------|
| `/setup` | Register or update your Tembo API key | `key` (required) |
| `/status` | Check your Tembo API key registration status | - |
| `/unregister` | Remove your registered Tembo API key | `confirm` (optional) |

**Note**: The `list` and `search` commands support interactive pagination using Previous/Next buttons.

### Command Examples

```bash
/task create prompt:"Fix authentication bug" agent:"claudeCode:claude-4-5-sonnet"

/task list page:1 limit:10

/task search query:"authentication" page:1

/repositories list

/whoami ephemeral:true

/setup key:YOUR_TEMBO_API_KEY

/status
```

---

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone <your-repo>
   cd tembo-discord-bot
   bun install
   ```

2. **Set up Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Copy Application ID, Public Key, and Bot Token

3. **Configure environment variables** (see [Installation & Setup](#-installation--setup))

4. **Deploy to Cloudflare Workers**
   ```bash
   bun run deploy
   ```

5. **Register commands**
   ```bash
   bun run register-commands
   ```

6. **Invite the bot** (see [Inviting the Bot](#-inviting-the-bot))

---

## 📦 Installation & Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Discord Application](https://discord.com/developers/applications) with bot created
- A [Tembo](https://tembo.io) account with API key
- [Cloudflare Workers](https://workers.cloudflare.com) account
- Wrangler CLI installed (`npm install -g wrangler` or `bun add -g wrangler`)
- Logged in to Wrangler (`wrangler login`)

### Step 1: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Give it a name (e.g., "Tembo Bot")
4. Go to the **"Bot"** tab
5. Click **"Reset Token"** and copy the **Bot Token**
6. Copy the **Application ID** from "General Information"
7. Copy the **Public Key** from "General Information"

### Step 2: Get Tembo API Key

1. Go to https://tembo.io/dashboard
2. Navigate to API settings
3. Generate or copy your API key

### Step 3: Create Cloudflare D1 Database

```bash
# Create the database
wrangler d1 create tembo-bot-db
```

**Output will look like:**

```
✅ Successfully created DB 'tembo-bot-db' in region WEUR
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "tembo_bot_db"
database_name = "tembo-bot-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` from the output!**

### Step 4: Update wrangler.jsonc

Open `wrangler.jsonc` and update:

```jsonc
{
  "vars": {
    "DISCORD_APPLICATION_ID": "your_application_id_here"
  },
  "d1_databases": [
    {
      "binding": "tembo_bot_db",
      "database_name": "tembo-bot-db",
      "database_id": "YOUR_DATABASE_ID_HERE"  // <- Paste the ID from Step 3
    }
  ]
}
```

### Step 5: Apply Database Migrations

#### Local (for testing)
```bash
wrangler d1 execute tembo-bot-db --local --file=migrations/0001_create_auth_tables.sql
```

#### Production
```bash
wrangler d1 execute tembo-bot-db --remote --file=migrations/0001_create_auth_tables.sql
```

**Expected output:**

```
🌀 Executing on remote database tembo-bot-db (xxxx):
🚣 Executed 6 commands in 0.234s
```

### Step 6: Generate Encryption Master Key

```bash
# Generate a secure 256-bit key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example output:**

```
xK2jN8pL4mQ6rS9tV1wX3yZ5aC7dE0fG1hI2jK3lM4n=
```

**⚠️ IMPORTANT: Save this key securely! You'll need it for both local and production.**

### Step 7: Configure Environment Variables

#### For Local Development

Create or update `.dev.vars` file:

```bash

DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_APPLICATION_ID=your_discord_application_id
DISCORD_BOT_TOKEN=your_discord_bot_token
TEMBO_API_KEY=your_global_tembo_api_key  # Optional fallback
ENCRYPTION_MASTER_KEY=your_generated_key_from_step_6
```

#### For Production

```bash
# Set the encryption key as a Cloudflare secret
wrangler secret put ENCRYPTION_MASTER_KEY
# When prompted, paste the key from Step 6

# Set other secrets if not already set
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put TEMBO_API_KEY  # Optional
```

### Step 8: Test Locally

```bash
# Install dependencies (if not already done)
bun install

# Start local development server
bun run dev
```

The bot will run on `http://localhost:8787`

**Test checklist:**
- [ ] Database connection works
- [ ] Encryption/decryption works
- [ ] `/setup` command registers API key
- [ ] `/status` shows registration info
- [ ] `/task create` requires authentication
- [ ] `/unregister` removes API key

### Step 9: Register Discord Commands

```bash
# This will register all commands including /setup, /unregister, /status
bun run register-commands
```

**Expected output:**

```
✅ Successfully registered 7 slash command(s)!
Commands:
  - /task: Manage Tembo tasks
  - /repositories: Manage Tembo repositories
  - /whoami: Get your current Tembo user information
  - /setup: Register or update your Tembo API key
  - /unregister: Remove your registered Tembo API key from the bot
  - /status: Check your Tembo API key registration status
```

### Step 10: Deploy to Cloudflare Workers

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

**Expected output:**

```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded tembo-discord-bot (x.xx sec)
Deployed tembo-discord-bot triggers (x.xx sec)
  https://tembo-discord-bot.your-subdomain.workers.dev
```

### Step 11: Configure Discord Interactions Endpoint

1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to **"General Information"** → **Interactions Endpoint URL**
4. Update to: `https://your-bot.workers.dev/interactions`
5. Click **"Save Changes"**
6. Discord will verify the endpoint (you'll see a checkmark if successful)

### Step 12: Test in Discord

1. Invite the bot (see [Inviting the Bot](#-inviting-the-bot))
2. Run `/setup key:YOUR_TEMBO_API_KEY` in Discord
3. Verify success message appears
4. Run `/status` to confirm registration
5. Run `/task create prompt:"test task"` to test task creation

---

## 🤖 Inviting the Bot

### Method 1: Server Installation (Guild Install)

This allows the bot to be used in specific Discord servers.

#### Quick Invite URL

Replace `YOUR_APPLICATION_ID` with your Application ID (found in `wrangler.jsonc`):

```text
https://discord.com/api/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=2048&scope=bot%20applications.commands
```

**Permission Breakdown:**

- `2048` = Send Messages permission (minimal permissions)
- Full permissions example (Send Messages + Embed Links + Read History): `permissions=83968`

#### Step-by-Step via Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (Tembo Bot)
3. Navigate to **"OAuth2"** → **"URL Generator"**
4. Select scopes:
   - ✅ `bot` - Required for bot functionality
   - ✅ `applications.commands` - Required for slash commands
5. Select bot permissions:
   - ✅ `Send Messages` - Bot needs to send responses
   - ✅ `Use Slash Commands` - Required for slash commands
   - ✅ `Read Message History` - Optional, for context if needed
   - ✅ `Send Messages in Threads` - Optional, for thread support
   - ✅ `Embed Links` - Recommended, for rich embeds
6. Copy the generated URL and open it in your browser
7. Select your server and authorize
8. Complete any CAPTCHA if prompted

### Method 2: User Installation (Personal Use)

This allows users to install the bot for personal use in DMs and servers they're in.

#### Direct User Install Link

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **"OAuth2"** → **"URL Generator"**
4. Select scopes:
   - ✅ `applications.commands` (for user installs, you don't need `bot` scope)
5. Copy the generated URL
6. Share this URL with users or open it yourself
7. Users can install it to their account

#### Benefits of User Install

- ✅ Works in DMs (no server needed)
- ✅ Works in any server the user has access to
- ✅ No server admin permissions required
- ✅ Personal API keys (each user has their own)

### Verification Checklist

After inviting the bot:

1. Go to your Discord server
2. Check the member list - the bot should appear
3. Try a command: `/status` or `/whoami`
4. The bot should respond!

---

## 🔐 Multi-User Authentication

The bot supports per-user API keys with secure encryption and storage.

### How It Works

1. **User Registration**: Users run `/setup key:YOUR_API_KEY` to register their Tembo API key
2. **Key Validation**: The bot validates the API key by calling Tembo's `/me` endpoint
3. **Encryption**: API keys are encrypted using AES-256-GCM before storage
4. **Storage**: Encrypted keys are stored in Cloudflare D1 database
5. **Isolation**: Each Discord user has their own Tembo API key - no cross-user access

### User Flow

1. **New User**: Tries to use `/task create` without registering
   - Bot sends onboarding DM with instructions
   - Shows fallback message in channel if DMs are disabled
2. **Registration**: User runs `/setup key:YOUR_API_KEY`
   - Bot validates the key
   - Encrypts and stores it
   - Shows success message with account info
3. **Using Commands**: User can now use all commands with their personal API key
4. **Status Check**: User can run `/status` to see registration info
5. **Unregister**: User can run `/unregister` to remove their API key

### Database Inspection

#### View registered users (locally)
```bash
wrangler d1 execute tembo-bot-db --local --command="SELECT discord_user_id, validation_status, registration_timestamp FROM user_api_keys;"
```

#### View registered users (production)
```bash
wrangler d1 execute tembo-bot-db --remote --command="SELECT discord_user_id, validation_status, registration_timestamp FROM user_api_keys;"
```

#### View auth events (audit log)
```bash
wrangler d1 execute tembo-bot-db --remote --command="SELECT * FROM auth_events ORDER BY timestamp DESC LIMIT 10;"
```

### Security Features

🔒 **Encryption Master Key**

- Store securely (password manager, Cloudflare secrets)
- If lost, all existing encrypted keys become unrecoverable
- Users would need to re-register

🔒 **API Key Storage**

- Keys encrypted with AES-256-GCM
- Unique IV and salt per encryption
- Additional authenticated data (Discord user ID) prevents tampering

🔒 **User Isolation**

- Each Discord user has their own Tembo API key
- No cross-user data access
- Database uses Discord user ID as primary key

---

## 🏗️ Architecture

The bot uses a clean, layered architecture for maintainability and testability:

```
Discord → Entry Point → Controllers → Services → Tembo SDK
              ↓            ↓           ↓
          Routing    Validation   Logging
```

### Directory Structure

```
src/
├── index.ts                              # Main entry point with routing
├── types/
│   └── index.ts                         # Type definitions and guards
├── validation/
│   ├── guards.ts                        # Type guard utilities
│   └── command-options.ts               # Input validators
├── services/
│   ├── tembo.service.ts                 # Tembo API business logic
│   ├── auth.service.ts                  # Authentication orchestration
│   ├── database.service.ts              # D1 database operations
│   └── encryption.service.ts            # AES-256-GCM encryption
├── controllers/
│   ├── base.controller.ts               # Shared controller functionality
│   ├── index.ts                         # Controller exports
│   ├── task/
│   │   └── task.controller.ts          # Task subcommand handlers
│   ├── repository/
│   │   └── repositories.controller.ts  # Repository subcommand handlers
│   ├── user/
│   │   └── whoami.controller.ts        # User info command handler
│   └── auth/
│       ├── setup.controller.ts         # API key registration
│       ├── status.controller.ts        # Registration status
│       └── unregister.controller.ts   # API key removal
├── utils/
│   ├── errors.ts                        # Structured error types
│   ├── logger.ts                        # JSON logging
│   ├── verify.ts                        # Discord signature verification
│   ├── async-handler.ts                # Async error handling utility
│   └── discord.ts                      # Discord API helpers
└── scripts/
    └── register-commands.ts             # Command registration script
```

### Key Design Decisions

1. **Subcommand Architecture**: Uses Discord's native subcommand groups for better command organization
2. **Domain-Driven Structure**: Controllers organized by domain (task, repository, user, auth) for better maintainability
3. **Dependency Injection**: Controllers receive services via constructor for easy testing
4. **Type Safety**: Uses `discord-api-types/v10` with strict TypeScript (no hardcoded types)
5. **Validation Layer**: All inputs validated before processing with clear error messages
6. **Error Handling**: Structured error hierarchy with context and logging
7. **Structured Logging**: JSON logs for production observability
8. **Background Processing**: Long operations use `ctx.waitUntil()` to avoid Discord timeouts
9. **User Installable**: Supports both server installs and user installs for DM usage
10. **Interactive Components**: Deferred updates for smooth pagination and autocompletion support
11. **Per-User Authentication**: Each user has their own encrypted API key
12. **Secure Storage**: AES-256-GCM encryption with unique IV and salt per key

---

## 🚀 Development

### Local Development

```bash
# Start dev server
bun dev

# The bot will run at http://localhost:8787
# Use ngrok or cloudflare tunnel to test with Discord
```

### Scripts

```json
{
  "dev": "wrangler dev",                    // Local dev server
  "deploy": "wrangler deploy --minify",     // Deploy to production
  "register-commands": "...",               // Register Discord commands
  "test": "vitest",                         // Run tests
  "test:watch": "vitest --watch",           // Watch mode
  "test:coverage": "vitest --coverage",     // Coverage report
  "type-check": "tsc --noEmit",            // Type checking
  "lint": "tsc --noEmit"                   // Lint check
}
```

### Deployment Workflow

1. Make changes to code
2. Run `bun test` to ensure tests pass
3. Run `bun type-check` to verify types
4. Run `bun run deploy` to deploy to Cloudflare
5. If commands changed, run `bun run register-commands`

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
bun test

# Watch mode (auto-run on changes)
bun test:watch

# Coverage report
bun test:coverage

# Type checking
bun type-check
```

### Test Coverage

- **57+ unit tests**
- Covers: Type guards, input validation, error handling
- Critical paths tested for all commands

### Writing Tests

Tests are colocated with source files (e.g., `guards.test.ts` next to `guards.ts`).

Example test:

```typescript
import { describe, it, expect } from 'vitest';
import { validatePrompt } from './command-options';

describe('validatePrompt', () => {
  it('should accept valid prompts', () => {
    expect(validatePrompt('Fix the bug')).toBe('Fix the bug');
  });

  it('should reject empty prompts', () => {
    expect(() => validatePrompt('')).toThrow(ValidationError);
  });
});
```

---

## 📊 Monitoring & Logging

### View Logs

```bash
# Tail logs in real-time
wrangler tail

# View logs with pretty formatting
wrangler tail --format pretty
```

### Log Structure

All logs are JSON-structured for easy parsing:

```json
{
  "level": "info",
  "message": "Command executed",
  "context": {
    "command": "create-task",
    "userId": "123456789",
    "duration": 150
  },
  "timestamp": "2025-11-16T12:00:00.000Z"
}
```

### Monitoring Dashboards

View metrics in the Cloudflare Workers dashboard:
- Request count
- Error rate
- Response time
- Memory usage

---

## 🐛 Troubleshooting

### "Application did not respond"

**Cause**: Discord didn't receive a response within 3 seconds.

**Solutions:**

1. Check Cloudflare logs: `wrangler tail`
2. Verify Tembo API is responding
3. Ensure long operations use `ctx.waitUntil()` (already implemented)
4. Check if deferred responses are being used for long-running commands

### "Invalid request signature"

**Cause**: Discord public key mismatch or endpoint not set.

**Solutions:**

1. Verify `DISCORD_PUBLIC_KEY` matches your Discord app:

   ```bash
   wrangler secret put DISCORD_PUBLIC_KEY
   ```

2. Check Discord Interactions Endpoint is set correctly
3. Redeploy: `bun run deploy`

### Commands not showing up

**Solutions:**

1. Re-register commands: `bun run register-commands`
2. Wait a few minutes (Discord can take time to update)
3. Try in a different server or DM with the bot
4. Check bot has `applications.commands` scope

### "DB is not defined" or Database Errors

**Solutions:**

1. Check `wrangler.jsonc` has correct `database_id`
2. Ensure database was created: `wrangler d1 list`
3. Verify binding name matches code (should be `tembo_bot_db`)
4. Check migrations were applied:

   ```bash
   wrangler d1 execute tembo-bot-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"
   ```

### "Encryption master key is required"

**Solutions:**

1. Verify `ENCRYPTION_MASTER_KEY` is set in `.dev.vars` (local)
2. Or set as secret: `wrangler secret put ENCRYPTION_MASTER_KEY` (production)
3. Ensure the key is the same base64-encoded 32-byte key you generated

### "Invalid API key" during setup

**Solutions:**

1. Ensure user is providing correct Tembo API key
2. Test key manually:

   ```bash
   curl -H "Authorization: Bearer API_KEY" https://api.tembo.ai/v1/me
   ```

3. Check Tembo API is accessible from Cloudflare Workers

### Users not receiving DMs

**Solutions:**

1. User may have DMs disabled in Discord settings
2. Bot provides fallback instructions in the channel message
3. User can still run `/setup` manually

### Bot not receiving interactions

**Checklist**:
- ✅ Bot is deployed: `bun run deploy`
- ✅ Secrets are set: `wrangler secret list`
- ✅ Interactions endpoint is configured in Discord
- ✅ Bot is in your server with proper permissions
- ✅ Commands are registered: `bun run register-commands`
- ✅ Database is created and migrations applied
- ✅ Encryption key is set

### TypeScript Errors

**Solutions:**

1. Run `bun type-check` to see all errors
2. Check `tsconfig.json` settings
3. Ensure all dependencies are installed: `bun install`

---

## 🔒 Security

### Security Features

- ✅ **Discord Request Verification**: All requests verified using Discord's public key signature
- ✅ **Encrypted Storage**: API keys encrypted with AES-256-GCM before storage
- ✅ **Secure Secrets**: All sensitive data stored as Cloudflare secrets (never in code)
- ✅ **Input Validation**: All user inputs validated before processing
- ✅ **No Sensitive Data in Errors**: Error messages don't expose sensitive information
- ✅ **Type Safety**: Strict TypeScript for compile-time safety
- ✅ **User Isolation**: Each user's API key is isolated - no cross-user access
- ✅ **Ephemeral Messages**: Most responses are ephemeral (only visible to the user)
- ✅ **Minimal Permissions**: Bot only requests necessary Discord permissions

### Security Best Practices

1. **Never commit secrets**: Use `.gitignore` for `.dev.vars` and environment files
2. **Rotate keys regularly**: Generate new encryption master keys periodically
3. **Monitor access**: Review auth events in database regularly
4. **Keep dependencies updated**: Regularly update packages for security patches
5. **Use HTTPS**: All communications are over HTTPS (enforced by Cloudflare)

---

## 📦 Tech Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless edge platform
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **Discord Types**: [discord-api-types](https://github.com/discordjs/discord-api-types) - Official Discord types
- **Tembo SDK**: [@tembo-io/sdk](https://docs.tembo.io/) - Tembo API client
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQLite database
- **Encryption**: Node.js `crypto` module (AES-256-GCM)
- **Testing**: [Vitest](https://vitest.dev/) - Fast unit test framework
- **Linter**: [Biome](https://biomejs.dev/) - Fast all-in-one linter and formatter
- **Language**: TypeScript with strict mode

---

## 📝 Tembo SDK Feedback

### Issues We Encountered

#### 1. API Documentation Mismatch

**What the docs say for POST /task/create:**
```json
{
  "id": "...",
  "title": "...",
  "description": "...",    // ← Documented
  "status": "...",         // ← Documented
  "createdAt": "...",
  "updatedAt": "...",
  "organizationId": "..."  // ← Documented
}
```

**What the API ACTUALLY returns:**
```json
{
  "id": "...",
  "title": "...",
  "prompt": "...",         // ← NOT "description"!
  // NO "status" field at all!
  "organizationId": "...", // ← This one matches
  "agent": "...",
  "hash": "...",
  "metadata": {},
  // ... 20+ other undocumented fields
}
```

#### 2. Inconsistent Field Names

- `orgId` vs `organizationId`: GET /me returns `orgId`, but POST /task/create returns `organizationId`
- `repositories` vs `codeRepositories`: GET /repository/list returns `codeRepositories`, but POST /task/create accepts `repositories`

#### 3. Missing Fields in Documentation

**Missing from create response (but documented):**
- `status` field - Docs say it should be there, but it's not
- `description` field - Docs say it's there, but API returns `prompt` instead

**Present but undocumented:**
- `hash`, `metadata`, `kind`, `data`, `targetBranch`, `sourceBranch`
- `issueSourceId`, `level`, `levelReasoning`, `lastSeenAt`, `lastQueuedAt`
- `createdBy`, `sandboxType`, `mcpServers`, `solutionType`, `workflowId`

#### 4. Slow Task Creation

Discord (and most chat platforms) have a **3-second timeout** for interactions. Tembo's task creation endpoint takes **~3.7 seconds**, requiring us to use background processing with `waitUntil()`.

**Suggestion:**
- Make task creation async/webhook-based (return immediately with task ID, update via webhook)
- Or optimize the endpoint to respond in < 1 second
- Or add a "quick create" endpoint that just queues the task

#### 5. TypeScript Type Mismatches

The `@tembo-io/sdk` package has TypeScript support, but:
- Optional fields aren't marked as optional in types
- Some fields in the API response aren't in the TypeScript types
- Type definitions lag behind API changes

**Suggestion:**
- Auto-generate TypeScript types from your API schema (OpenAPI/Swagger)
- Make sure optional fields are marked with `?`

### Ideal Task Creation Flow

```typescript
// 1. Fast create (< 1 second)
const task = await client.task.create({
  prompt: "Build feature X",
  agent: "claudeCode:claude-4-5-sonnet",
  repositories: ["https://github.com/org/repo"],
  branch: "main"
});

// 2. Consistent response shape
console.log(task);
// {
//   id: "task-123",
//   title: "Build feature X",
//   description: "Build feature X",  // Same as prompt
//   status: "queued",                // Always present
//   agent: "claudeCode:claude-4-5-sonnet",
//   repositories: [...],             // Not codeRepositories
//   organizationId: "org-456",       // Not orgId
//   createdAt: "2025-11-15T...",
//   updatedAt: "2025-11-15T..."
// }

// 3. Poll or webhook for completion
client.task.onStatusChange(task.id, (updatedTask) => {
  console.log(`Task ${updatedTask.id} is now ${updatedTask.status}`);
});
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new features
4. Ensure all tests pass: `bun test`
5. Ensure type checking passes: `bun type-check`
6. Submit a pull request

---

## 📄 License

MIT

---

## 🔗 Additional Resources

- [Discord Developer Portal](https://discord.com/developers/docs)
- [Tembo Documentation](https://docs.tembo.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)

---

## 💡 Tips

- **Fast feedback**: Use `bun test:watch` during development
- **Debug logs**: Use `wrangler tail --format pretty` to see formatted logs
- **Local testing**: Use ngrok or cloudflare tunnel with `bun dev`
- **Type safety**: Always run `bun type-check` before deploying
- **Database inspection**: Use `wrangler d1 execute` to query the database directly

---

**Note**: This bot uses HTTP-based Discord interactions (not WebSocket gateway), which is perfect for serverless environments like Cloudflare Workers.

Need help? Check the troubleshooting section above or open an issue!
