# Tembo Discord Bot

A production-ready Discord bot built on Cloudflare Workers that integrates with [Tembo](https://tembo.io) to manage tasks directly from Discord using slash commands.

Built with clean architecture, full type safety, comprehensive error handling, and structured logging.

## ✨ Features

- 🤖 **Serverless**: Runs on Cloudflare Workers for infinite scalability
- ⚡ **Fast**: HTTP-based Discord interactions with <100ms response times
- 🔒 **Secure**: Request signature verification for all Discord interactions
- 📦 **Task Management**: Create, list, and search Tembo tasks
- 🗂️ **Repository Management**: View connected repositories
- 👤 **User Info**: Get your Tembo account information
- ✅ **Type Safe**: Full TypeScript with strict mode and proper types
- 🧪 **Tested**: 57 unit tests with 100% pass rate
- 📝 **Structured Logging**: JSON logs for production observability
- 🎯 **Clean Architecture**: Layered design with dependency injection

## 📚 Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `/create-task` | Create a new Tembo task | `prompt` (required), `agent`, `repositories`, `branch` |
| `/list-tasks` | List your tasks | `page`, `limit` |
| `/search-tasks` | Search for tasks | `query` (required), `page`, `limit` |
| `/list-repositories` | List connected repositories | None |
| `/whoami` | Get your account info | None |

### Command Examples

```
/create-task prompt:"Fix authentication bug" agent:"claudeCode:claude-4-5-sonnet"

/list-tasks page:1 limit:10

/search-tasks query:"authentication" page:1

/list-repositories

/whoami
```

---

## 🚀 Setup & Installation

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Discord Application](https://discord.com/developers/applications) with bot created
- A [Tembo](https://tembo.io) account with API key
- [Cloudflare Workers](https://workers.cloudflare.com) account

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd tembo-discord-bot
bun install
```

### 2. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click **"New Application"**
3. Give it a name (e.g., "Tembo Bot")
4. Go to the **"Bot"** tab
5. Click **"Reset Token"** and copy the **Bot Token**
6. Copy the **Application ID** from "General Information"
7. Copy the **Public Key** from "General Information"

### 3. Get Tembo API Key

1. Go to https://tembo.io/dashboard
2. Navigate to API settings
3. Generate or copy your API key

### 4. Configure Environment Variables

#### For Local Development

Create a `.env` file:

```bash
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_APPLICATION_ID=your_discord_application_id_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here
TEMBO_API_KEY=your_tembo_api_key_here
```

#### For Cloudflare Workers (Production)

Set secrets:

```bash
# Authenticate with Cloudflare
wrangler login

# Set secrets
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put TEMBO_API_KEY
```

Update `wrangler.jsonc` with your Application ID:

```json
{
  "vars": {
    "DISCORD_APPLICATION_ID": "your_application_id_here"
  }
}
```

### 5. Register Discord Commands

```bash
bun run register-commands
```

You should see:
```
✅ Successfully registered 5 slash command(s)!
Commands:
  - /create-task: Create a new Tembo task
  - /list-tasks: List Tembo tasks with pagination
  - /search-tasks: Search Tembo tasks by query
  - /list-repositories: List available repositories
  - /whoami: Get your current Tembo user information
```

### 6. Deploy to Cloudflare Workers

```bash
bun run deploy
```

Copy the deployed URL (e.g., `https://your-bot.workers.dev`).

### 7. Configure Discord Interactions Endpoint

1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to **"General Information"**
4. Under **"Interactions Endpoint URL"**, enter:
   ```
   https://your-bot.workers.dev/interactions
   ```
5. Click **"Save Changes"**
6. Discord will verify the endpoint (you'll see a checkmark if successful)

### 8. Invite Bot to Your Server

1. In Discord Developer Portal, go to **"OAuth2"** → **"URL Generator"**
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions: `Send Messages`, `Use Slash Commands`
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

### 9. Test the Bot

In your Discord server, type:
```
/whoami
```

You should get a response with your Tembo user information! 🎉

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
├── index.ts                     # Main entry point with routing
├── types/
│   └── index.ts                # Type definitions and guards
├── validation/
│   ├── guards.ts               # Type guard utilities
│   └── command-options.ts      # Input validators
├── services/
│   └── tembo.service.ts        # Tembo API business logic
├── controllers/
│   ├── base.controller.ts      # Shared controller functionality
│   ├── create-task.controller.ts
│   ├── list-tasks.controller.ts
│   ├── search-tasks.controller.ts
│   ├── list-repositories.controller.ts
│   └── whoami.controller.ts
├── utils/
│   ├── errors.ts               # Structured error types
│   ├── logger.ts               # JSON logging
│   └── verify.ts               # Discord signature verification
└── scripts/
    └── register-commands.ts    # Command registration script
```

### Key Design Decisions

1. **Dependency Injection**: Controllers receive services via constructor for easy testing
2. **Type Safety**: Uses `discord-api-types/v10` with strict TypeScript (no hardcoded types)
3. **Validation Layer**: All inputs validated before processing with clear error messages
4. **Error Handling**: Structured error hierarchy with context and logging
5. **Structured Logging**: JSON logs for production observability
6. **Background Processing**: Long operations use `ctx.waitUntil()` to avoid Discord timeouts

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

- **57 unit tests** (100% passing)
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

**Solutions**:
1. Check Cloudflare logs: `wrangler tail`
2. Verify Tembo API is responding
3. Ensure long operations use `ctx.waitUntil()` (already implemented for task creation)

### "Invalid request signature"

**Cause**: Discord public key mismatch or endpoint not set.

**Solutions**:
1. Verify `DISCORD_PUBLIC_KEY` matches your Discord app:
   ```bash
   wrangler secret put DISCORD_PUBLIC_KEY
   ```
2. Check Discord Interactions Endpoint is set correctly
3. Redeploy: `bun run deploy`

### Commands not showing up

**Solutions**:
1. Re-register commands: `bun run register-commands`
2. Wait a few minutes (Discord can take time to update)
3. Try in a different server or DM with the bot
4. Check bot has `applications.commands` scope

### TypeScript Errors

**Solutions**:
1. Run `bun type-check` to see all errors
2. Check `tsconfig.json` settings
3. Ensure all dependencies are installed: `bun install`

### Bot not receiving interactions

**Checklist**:
- ✅ Bot is deployed: `bun run deploy`
- ✅ Secrets are set: `wrangler secret list`
- ✅ Interactions endpoint is configured in Discord
- ✅ Bot is in your server with proper permissions
- ✅ Commands are registered: `bun run register-commands`

---

## 🔒 Security

- ✅ Discord request signature verification on all interactions
- ✅ API keys stored as Cloudflare secrets (never in code)
- ✅ Input validation on all user inputs
- ✅ No sensitive data in error messages
- ✅ Strict TypeScript for compile-time safety

---

## 📦 Tech Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless edge platform
- **Framework**: [Hono](https://hono.dev/) - Lightweight web framework
- **Discord Types**: [discord-api-types](https://github.com/discordjs/discord-api-types) - Official Discord types
- **Tembo SDK**: [@tembo-io/sdk](https://docs.tembo.io/) - Tembo API client
- **Testing**: [Vitest](https://vitest.dev/) - Fast unit test framework
- **Language**: TypeScript with strict mode

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
- [Tembo SDK Feedback](./TEMBO_SDK_FEEDBACK.md) - Issues and suggestions for Tembo API

---

## 💡 Tips

- **Fast feedback**: Use `bun test:watch` during development
- **Debug logs**: Use `wrangler tail --format pretty` to see formatted logs
- **Local testing**: Use ngrok or cloudflare tunnel with `bun dev`
- **Type safety**: Always run `bun type-check` before deploying

---

**Note**: This bot uses HTTP-based Discord interactions (not WebSocket gateway), which is perfect for serverless environments like Cloudflare Workers.

Need help? Check the troubleshooting section above or open an issue!
