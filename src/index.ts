import { Hono } from 'hono';
import { verifyDiscordRequest } from './utils/verify';
import {
  InteractionType,
  InteractionResponseType,
  InteractionRequest,
  InteractionResponse,
} from './types/discord';
import { handleCreateTask } from './commands/create-task';
import { handleListTasks } from './commands/list-tasks';
import { handleSearchTasks } from './commands/search-tasks';
import { handleListRepositories } from './commands/list-repositories';
import { handleWhoami } from './commands/whoami';
import { createErrorResponse } from './utils/discord';

// Create Hono app with Cloudflare bindings
const app = new Hono<{ Bindings: CloudflareBindings }>();

// Health check endpoint
app.get('/', (c) => {
  return c.text('Tembo Discord Bot is running! 🤖');
});

// Discord interactions endpoint
app.post('/interactions', async (c) => {
  const env = c.env;

  // Verify Discord request signature
  const isValid = await verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return c.text('Invalid request signature', 401);
  }

  // Parse the interaction request
  const interaction = await c.req.json<InteractionRequest>();

  // Handle PING (Discord verification)
  if (interaction.type === InteractionType.PING) {
    const response: InteractionResponse = {
      type: InteractionResponseType.PONG,
    };
    return c.json(response);
  }

  // Handle APPLICATION_COMMAND (slash commands)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data?.name;

    try {
      let response: InteractionResponse;

      switch (commandName) {
        case 'create-task':
          response = await handleCreateTask(interaction, env);
          break;

        case 'list-tasks':
          response = await handleListTasks(interaction, env);
          break;

        case 'search-tasks':
          response = await handleSearchTasks(interaction, env);
          break;

        case 'list-repositories':
          response = await handleListRepositories(interaction, env);
          break;

        case 'whoami':
          response = await handleWhoami(interaction, env);
          break;

        default:
          response = createErrorResponse(
            `Unknown command: ${commandName}. Please try again or contact support.`
          );
      }

      return c.json(response);
    } catch (error) {
      console.error('Error handling command:', error);
      const response = createErrorResponse(
        'An unexpected error occurred while processing your command. Please try again later.'
      );
      return c.json(response);
    }
  }

  // Unknown interaction type
  return c.json(
    createErrorResponse('Unsupported interaction type.'),
    400
  );
});

export default app;
