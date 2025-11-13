# Tembo Discord Bot

A Discord bot built on Cloudflare Workers that integrates with [Tembo](https://tembo.io) to manage tasks directly from Discord using slash commands.

## Features

- 🤖 **Serverless**: Runs on Cloudflare Workers for infinite scalability
- ⚡ **Fast**: HTTP-based Discord interactions for minimal latency
- 🔒 **Secure**: Request signature verification for all Discord interactions
- 📦 **Task Management**: Create, list, and search Tembo tasks
- 🗂️ **Repository Management**: View available repositories
- 👤 **User Info**: Get your Tembo user information

## Commands

### `/create-task`
Create a new Tembo task.

**Options:**
- `prompt` (required): Description of the task to be performed
- `agent` (optional): The agent to use (e.g., `claudeCode:claude-4-5-sonnet`)
- `repositories` (optional): Comma-separated list of repository URLs
- `branch` (optional): Specific git branch to target

**Example:**
```
/create-task prompt:"Fix the authentication bug in the login component" agent:"claudeCode:claude-4-5-sonnet" repositories:"https://github.com/org/repo" branch:"dev"
```

### `/list-tasks`
List Tembo tasks with pagination.

**Options:**
- `page` (optional): Page number to retrieve (default: 1)
- `limit` (optional): Number of tasks per page (default: 10, max: 100)

**Example:**
```
/list-tasks page:1 limit:10
```

### `/search-tasks`
Search Tembo tasks by query.

**Options:**
- `query` (required): Search query
- `page` (optional): Page number to retrieve (default: 1)
- `limit` (optional): Number of results per page (default: 10, max: 100)

**Example:**
```
/search-tasks query:"authentication" page:1 limit:10
```

### `/list-repositories`
List available repositories from your Tembo account.

**Example:**
```
/list-repositories
```

### `/whoami`
Get your current Tembo user information.

**Example:**
```
/whoami
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Discord Application](https://discord.com/developers/applications) with bot created
- A [Tembo](https://tembo.io) account with API key
- [Cloudflare Workers](https://workers.cloudflare.com) account

### 1. Clone and Install Dependencies

```bash
bun install
```

### 2. Configure Environment Variables

Create a `.env` file or set environment variables for local development:

```bash
# Discord Configuration
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_APPLICATION_ID=your_discord_application_id_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here

# Tembo API Configuration
TEMBO_API_KEY=your_tembo_api_key_here
```

**Getting Discord credentials:**
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Copy the **Application ID** and **Public Key** from the General Information page
4. Go to the **Bot** tab and copy the **Bot Token**

**Getting Tembo API Key:**
1. Log in to your [Tembo Dashboard](https://tembo.io)
2. Navigate to API settings
3. Generate a new API key

### 3. Register Slash Commands

Run the command registration script:

```bash
bun run register-commands
```

This will register all slash commands with Discord. You should see output confirming the registration.

### 4. Local Development

Start the development server:

```bash
bun dev
```

The bot will be available at `http://localhost:8787`.

**Note**: For local testing with Discord, you'll need to use a tool like [ngrok](https://ngrok.com) to expose your local server to the internet:

```bash
ngrok http 8787
```

Then update your Discord application's **Interactions Endpoint URL** to the ngrok URL + `/interactions` (e.g., `https://abc123.ngrok.io/interactions`).

### 5. Deploy to Cloudflare Workers

#### Set Secrets

Before deploying, set your secrets in Cloudflare Workers:

```bash
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put TEMBO_API_KEY
```

You'll be prompted to enter each secret value.

#### Update `wrangler.jsonc`

Make sure the `DISCORD_APPLICATION_ID` is set in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "DISCORD_APPLICATION_ID": "your_application_id_here"
  }
}
```

#### Deploy

```bash
bun run deploy
```

After deployment, you'll get a URL like `https://tembo-discord-bot.your-subdomain.workers.dev`.

### 6. Configure Discord Interactions Endpoint

1. Go to your Discord application in the [Developer Portal](https://discord.com/developers/applications)
2. Navigate to **General Information**
3. Set the **Interactions Endpoint URL** to: `https://tembo-discord-bot.your-subdomain.workers.dev/interactions`
4. Click **Save Changes**

Discord will send a verification request to your endpoint. If everything is configured correctly, you'll see a success message.

### 7. Invite the Bot to Your Server

1. Go to the **OAuth2** > **URL Generator** tab in your Discord application
2. Select the following scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions (at minimum):
   - `Send Messages`
   - `Use Slash Commands`
4. Copy the generated URL and open it in your browser
5. Select a server and authorize the bot

## Project Structure

```
src/
├── index.ts                 # Main Hono app with /interactions endpoint
├── commands/
│   ├── create-task.ts      # Create task handler
│   ├── list-tasks.ts       # List tasks handler
│   ├── search-tasks.ts     # Search tasks handler
│   ├── list-repositories.ts # List repos handler
│   └── whoami.ts           # User info handler
├── lib/
│   └── tembo.ts            # Tembo SDK client wrapper
├── utils/
│   ├── discord.ts          # Discord helpers
│   ├── errors.ts           # Error handling
│   └── verify.ts           # Signature verification
├── types/
│   └── discord.ts          # Discord type definitions
└── scripts/
    └── register-commands.ts # Command registration script
```

## Development

### Running Locally

```bash
bun dev
```

### Type Checking

Generate Cloudflare Worker types:

```bash
bun cf-typegen
```

### Linting

The project uses TypeScript's built-in type checking. Run:

```bash
bun run build
```

## Troubleshooting

### "Invalid request signature" error

- Make sure `DISCORD_PUBLIC_KEY` is correctly set in your Cloudflare Workers secrets
- Verify that the public key matches the one in your Discord application

### Commands not appearing in Discord

- Make sure you've run `bun run register-commands`
- Wait a few minutes for Discord to propagate the commands
- Try re-inviting the bot to your server

### "Invalid Tembo API key" error

- Verify that `TEMBO_API_KEY` is correctly set in Cloudflare Workers secrets
- Make sure the API key is valid and hasn't expired
- Check that your Tembo account has access to the repositories you're trying to use

### 401 Unauthorized from Discord

- Check that `DISCORD_BOT_TOKEN` is correctly set
- Verify the bot token hasn't been regenerated in the Discord Developer Portal

## Architecture

This bot uses **HTTP-based Discord interactions** instead of the traditional WebSocket gateway. This makes it perfect for serverless environments like Cloudflare Workers:

1. Discord sends interaction requests to your `/interactions` endpoint
2. The bot verifies the request signature using the Discord public key
3. Based on the interaction type and command, the appropriate handler is called
4. The handler uses the Tembo SDK to interact with the Tembo API
5. A formatted response is sent back to Discord

**Benefits:**
- ✅ No need to maintain a persistent WebSocket connection
- ✅ Automatic scaling with Cloudflare Workers
- ✅ Lower latency (especially for global users)
- ✅ No server management required
- ✅ Pay only for what you use

## API Documentation

- [Tembo API Documentation](https://docs.tembo.io/api-reference/public-api/create-task)
- [Discord Interactions Documentation](https://discord.com/developers/docs/interactions/receiving-and-responding)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT

## Support

For issues or questions:
- Tembo: [https://tembo.io/support](https://tembo.io/support)
- Discord Bot Issues: [Create an issue](https://github.com/your-repo/issues)
