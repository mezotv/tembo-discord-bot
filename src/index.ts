// Main application entry point

import { Hono } from 'hono';
import {
  InteractionType,
  InteractionResponseType,
  type APIInteraction,
  type APIInteractionResponse,
  type APIChatInputApplicationCommandInteraction,
} from 'discord-api-types/v10';
import { verifyDiscordRequest } from './utils/verify';
import { createTemboService } from './services/tembo.service';
import {
  CreateTaskController,
  ListTasksController,
  SearchTasksController,
  ListRepositoriesController,
  WhoamiController,
} from './controllers';
import type { Env } from './types';
import { logger } from './utils/logger';
import { formatErrorForUser } from './utils/errors';

// Create Hono app with proper type bindings
const app = new Hono<{ Bindings: Env }>();

// Health check endpoint
app.get('/', (c) => {
  return c.text('Tembo Discord Bot is running! 🤖');
});

// Discord interactions endpoint
app.post('/interactions', async (c) => {
  const env = c.env;
  const ctx = c.executionCtx;

  // Verify Discord request signature
  const isValid = await verifyDiscordRequest(c.req.raw, env.DISCORD_PUBLIC_KEY);
  if (!isValid) {
    logger.warn('Invalid request signature');
    return c.text('Invalid request signature', 401);
  }

  // Parse the interaction request
  const interaction = await c.req.json<APIInteraction>();

  // Handle PING (Discord verification)
  if (interaction.type === InteractionType.Ping) {
    const response: APIInteractionResponse = {
      type: InteractionResponseType.Pong,
    };
    return c.json(response);
  }

  // Handle APPLICATION_COMMAND (slash commands)
  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    const commandName = commandInteraction.data.name;
    const userId = commandInteraction.member?.user?.id ?? commandInteraction.user?.id ?? 'unknown';

    logger.info('Received command', {
      command: commandName,
      userId,
    });

    try {
      // Initialize Tembo service
      const temboService = createTemboService(env.TEMBO_API_KEY);

      // Initialize controllers with dependency injection
      const controllers = {
        'create-task': new CreateTaskController(temboService),
        'list-tasks': new ListTasksController(temboService),
        'search-tasks': new SearchTasksController(temboService),
        'list-repositories': new ListRepositoriesController(temboService),
        'whoami': new WhoamiController(temboService),
      };

      // Route to appropriate controller
      const controller = controllers[commandName as keyof typeof controllers];
      
      if (!controller) {
        logger.warn('Unknown command', { command: commandName, userId });
        const response: APIInteractionResponse = {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `❌ Unknown command: ${commandName}. Please try again or contact support.`,
            flags: 64, // Ephemeral
          },
        };
        return c.json(response);
      }

      // Handle the command
      const response = await controller.handle(commandInteraction, ctx);
      return c.json(response);
    } catch (error) {
      logger.error('Error handling command', error, {
        command: commandName,
        userId,
      });

      const errorMessage = formatErrorForUser(error);
      const response: APIInteractionResponse = {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: `❌ ${errorMessage}`,
          flags: 64, // Ephemeral
        },
      };
      return c.json(response);
    }
  }

  // Unknown interaction type
  logger.warn('Unsupported interaction type', {
    type: interaction.type,
  });

  const response: APIInteractionResponse = {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: '❌ Unsupported interaction type.',
      flags: 64, // Ephemeral
    },
  };
  return c.json(response, 400);
});

export default app;
