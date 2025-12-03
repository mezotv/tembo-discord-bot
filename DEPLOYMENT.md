# Multi-User Authentication Deployment Guide

This guide walks you through deploying the multi-user authentication system for the Tembo Discord Bot.

## Overview

The bot now supports per-user API keys with:
- ✅ AES-256-GCM encryption for API keys
- ✅ Cloudflare D1 database for storage
- ✅ Automatic onboarding via DM
- ✅ Three new commands: `/setup`, `/unregister`, `/status`

---

## Prerequisites

- Cloudflare account with Workers access
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged in to Wrangler (`wrangler login`)

---

## Step 1: Create Cloudflare D1 Database

```bash
# Create the database
wrangler d1 create tembo-bot-db
```

**Output will look like:**
```
✅ Successfully created DB 'tembo-bot-db' in region WEUR
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "DB"
database_name = "tembo-bot-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` from the output!**

---

## Step 2: Update wrangler.jsonc

Open `wrangler.jsonc` and replace the placeholder `database_id`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "tembo-bot-db",
    "database_id": "YOUR_DATABASE_ID_HERE"  // <- Paste the ID from Step 1
  }
]
```

---

## Step 3: Apply Database Migrations

### Local (for testing)

```bash
wrangler d1 execute tembo-bot-db --local --file=migrations/0001_create_auth_tables.sql
```

### Production

```bash
wrangler d1 execute tembo-bot-db --remote --file=migrations/0001_create_auth_tables.sql
```

**Expected output:**
```
🌀 Executing on remote database tembo-bot-db (xxxx):
🌀 To execute on your local development database, pass the --local flag to 'wrangler d1 execute'
🚣 Executed 6 commands in 0.234s
```

---

## Step 4: Generate Encryption Master Key

```bash
# Generate a secure 256-bit key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Example output:**
```
xK2jN8pL4mQ6rS9tV1wX3yZ5aC7dE0fG1hI2jK3lM4n=
```

**⚠️ IMPORTANT: Save this key securely! You'll need it for both local and production.**

---

## Step 5: Set Environment Variables

### For Local Development

Create or update `.dev.vars` file:

```bash
# .dev.vars (DO NOT commit this file!)
DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_BOT_TOKEN=your_discord_bot_token
TEMBO_API_KEY=your_global_tembo_api_key  # Optional fallback
ENCRYPTION_MASTER_KEY=your_generated_key_from_step_4
```

### For Production

```bash
# Set the encryption key as a Cloudflare secret
wrangler secret put ENCRYPTION_MASTER_KEY
# When prompted, paste the key from Step 4

# Set other secrets if not already set
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put TEMBO_API_KEY  # Optional
```

---

## Step 6: Test Locally

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

---

## Step 7: Register Discord Commands

```bash
# This will register the new commands (/setup, /unregister, /status)
bun run register-commands
```

**Expected output:**
```
✅ Successfully registered 6 slash command(s)!
Commands:
  - /task: Manage Tembo tasks
  - /repositories: Manage Tembo repositories
  - /whoami: Get your current Tembo user information
  - /setup: Register or update your Tembo API key
  - /unregister: Remove your registered Tembo API key from the bot
  - /status: Check your Tembo API key registration status
```

---

## Step 8: Deploy to Production

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

**Expected output:**
```
Total Upload: xx.xx KiB / gzip: xx.xx KiB
Uploaded tembo-discord-bot (x.xx sec)
Published tembo-discord-bot (x.xx sec)
  https://tembo-discord-bot.your-subdomain.workers.dev
```

---

## Step 9: Update Discord Bot Settings

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **General Information** → **Interactions Endpoint URL**
4. Update to: `https://tembo-discord-bot.your-subdomain.workers.dev/interactions`
5. Save changes

---

## Step 10: Test in Discord

### Test User Registration

1. Run `/setup key:YOUR_TEMBO_API_KEY` in Discord
2. Verify success message appears
3. Run `/status` to confirm registration

### Test Commands

1. Run `/task create prompt:"test task"`
2. Should work with your personal API key
3. Run `/repositories list`
4. Run `/whoami`

### Test Onboarding

1. Have a new user (without registered key) run `/task create`
2. Verify they receive onboarding DM
3. Verify they can register via `/setup`

---

## Verification Checklist

After deployment, verify:

- [ ] `/setup` - Registers API key successfully
- [ ] `/status` - Shows correct registration info
- [ ] `/unregister` - Removes API key
- [ ] `/task create` - Triggers onboarding for unregistered users
- [ ] `/task create` - Works for registered users
- [ ] API keys are encrypted (check D1 database - ciphertext should be base64)
- [ ] Multiple users can use bot with their own keys
- [ ] DM onboarding works (or shows fallback if DMs disabled)

---

## Database Inspection

### View registered users (locally)

```bash
wrangler d1 execute tembo-bot-db --local --command="SELECT discord_user_id, validation_status, registration_timestamp FROM user_api_keys;"
```

### View registered users (production)

```bash
wrangler d1 execute tembo-bot-db --remote --command="SELECT discord_user_id, validation_status, registration_timestamp FROM user_api_keys;"
```

### View auth events (audit log)

```bash
wrangler d1 execute tembo-bot-db --remote --command="SELECT * FROM auth_events ORDER BY timestamp DESC LIMIT 10;"
```

---

## Troubleshooting

### "DB is not defined" error

- Check `wrangler.jsonc` has correct `database_id`
- Ensure database was created: `wrangler d1 list`
- Verify binding name is "DB" (case-sensitive)

### "Encryption master key is required" error

- Verify `ENCRYPTION_MASTER_KEY` is set in `.dev.vars` (local)
- Or set as secret: `wrangler secret put ENCRYPTION_MASTER_KEY` (production)

### "Invalid API key" during setup

- Ensure user is providing correct Tembo API key
- Test key manually: `curl -H "Authorization: Bearer API_KEY" https://api.tembo.ai/v1/me`

### Users not receiving DMs

- User may have DMs disabled in Discord settings
- Bot provides fallback instructions in the channel message
- User can still run `/setup` manually

---

## Security Notes

🔒 **Encryption Master Key**
- Never commit to Git
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

## Rollback Plan

If you need to rollback to single-key mode:

1. Revert code changes: `git revert HEAD`
2. Re-deploy: `npm run deploy`
3. Re-register commands: `npm run register`
4. Database will remain but won't be used

---

## Next Steps

After successful deployment:

1. **Monitor logs**: `wrangler tail` to watch real-time logs
2. **Test with users**: Have beta users register and test commands
3. **Set up alerts**: Configure Cloudflare alerts for errors
4. **Document for users**: Create user-facing guide on how to register

---

## Support

- **Database issues**: Check [Cloudflare D1 docs](https://developers.cloudflare.com/d1/)
- **Workers issues**: Check [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- **Bot issues**: Check application logs with `wrangler tail`
