# Quick Setup Guide

Follow these steps to get your Tembo Discord Bot up and running.

## Step 1: Install Dependencies

```bash
bun install
```

## Step 2: Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application" and give it a name
3. Go to the "Bot" tab and click "Add Bot"
4. Under the bot settings:
   - Copy the **Bot Token** (you'll need this)
   - Enable "Message Content Intent" if needed
5. Go to "General Information" tab:
   - Copy the **Application ID**
   - Copy the **Public Key**

## Step 3: Get Tembo API Key

1. Log in to your Tembo account at https://tembo.io
2. Navigate to your account settings or API section
3. Generate a new API key and copy it

## Step 4: Set Environment Variables

Create a `.env` file in the project root (for local testing):

```bash
DISCORD_PUBLIC_KEY=your_discord_public_key_here
DISCORD_APPLICATION_ID=your_discord_application_id_here
DISCORD_BOT_TOKEN=your_discord_bot_token_here
TEMBO_API_KEY=your_tembo_api_key_here
```

Update `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "DISCORD_APPLICATION_ID": "your_application_id_here"
  }
}
```

## Step 5: Register Discord Commands

```bash
bun run register-commands
```

You should see output like:
```
✅ Successfully registered 5 slash command(s)!
Commands:
  - /create-task: Create a new Tembo task
  - /list-tasks: List Tembo tasks with pagination
  - /search-tasks: Search Tembo tasks by query
  - /list-repositories: List available repositories from your Tembo account
  - /whoami: Get your current Tembo user information
```

## Step 6: Deploy to Cloudflare Workers

First, set your secrets:

```bash
wrangler secret put DISCORD_PUBLIC_KEY
# Enter your Discord public key when prompted

wrangler secret put DISCORD_BOT_TOKEN
# Enter your Discord bot token when prompted

wrangler secret put TEMBO_API_KEY
# Enter your Tembo API key when prompted
```

Then deploy:

```bash
bun run deploy
```

You'll get a URL like: `https://tembo-discord-bot.your-subdomain.workers.dev`

## Step 7: Configure Discord Interactions Endpoint

1. Go back to your Discord application at https://discord.com/developers/applications
2. Select your application
3. Go to "General Information"
4. In the "Interactions Endpoint URL" field, enter:
   ```
   https://tembo-discord-bot.your-subdomain.workers.dev/interactions
   ```
5. Click "Save Changes"

Discord will verify the endpoint. If successful, you'll see a green checkmark.

## Step 8: Invite Bot to Your Server

1. In Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Select bot permissions:
   - ✅ `Send Messages`
   - ✅ `Embed Links`
   - ✅ `Use Slash Commands`
4. Copy the generated URL
5. Open the URL in your browser
6. Select your server and click "Authorize"

## Step 9: Test the Bot!

In your Discord server, type `/` and you should see the bot's commands:

- `/create-task` - Create a new Tembo task
- `/list-tasks` - List your tasks
- `/search-tasks` - Search tasks
- `/list-repositories` - View available repos
- `/whoami` - Get your Tembo user info

Try it out:
```
/create-task prompt:"Test task from Discord" agent:"claudeCode:claude-4-5-sonnet"
```

## Local Development (Optional)

For local testing:

1. Start the dev server:
   ```bash
   bun dev
   ```

2. Expose your local server using ngrok:
   ```bash
   ngrok http 8787
   ```

3. Update the Interactions Endpoint URL in Discord to your ngrok URL:
   ```
   https://your-random-id.ngrok.io/interactions
   ```

## Troubleshooting

### Commands not showing up?
- Wait a few minutes for Discord to propagate the commands
- Try leaving and rejoining the server
- Re-run `bun run register-commands`

### "Invalid request signature" error?
- Double-check your `DISCORD_PUBLIC_KEY` is correct
- Make sure secrets are set correctly in Cloudflare Workers

### Tembo API errors?
- Verify your `TEMBO_API_KEY` is valid
- Check that you have access to the repositories you're trying to use

## Done! 🎉

Your Tembo Discord Bot is now live and ready to manage tasks from Discord!

