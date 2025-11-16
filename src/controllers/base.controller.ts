// Base controller with shared functionality

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
  APIApplicationCommandInteractionDataOption,
} from 'discord-api-types/v10';
import { InteractionResponseType } from 'discord-api-types/v10';
import { TemboService } from '../services/tembo.service';
import { logger } from '../utils/logger';
import { formatErrorForUser } from '../utils/errors';

/**
 * Base controller with common functionality
 */
export abstract class BaseController {
  constructor(protected readonly temboService: TemboService) {}

  /**
   * Extract command options as a key-value map
   */
  protected getOptionsMap(
    options: APIApplicationCommandInteractionDataOption[] | undefined
  ): Record<string, unknown> {
    if (!options || !Array.isArray(options)) {
      return {};
    }

    const map: Record<string, unknown> = {};
    for (const option of options) {
      if ('value' in option) {
        map[option.name] = option.value;
      }
    }

    return map;
  }

  /**
   * Create a success response
   */
  protected createSuccessResponse(content: string): APIInteractionResponse {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content,
      },
    };
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(content: string): APIInteractionResponse {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content: `❌ ${content}`,
        flags: 64, // Ephemeral
      },
    };
  }

  /**
   * Create an embed response
   */
  protected createEmbedResponse(embeds: any[]): APIInteractionResponse {
    return {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        embeds,
      },
    };
  }

  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, commandName: string, userId: string): APIInteractionResponse {
    logger.error(`Error in ${commandName} command`, error, {
      command: commandName,
      userId,
    });

    const message = formatErrorForUser(error);
    return this.createErrorResponse(message);
  }

  /**
   * Abstract method each controller must implement
   */
  abstract handle(
    interaction: APIChatInputApplicationCommandInteraction,
    ctx?: ExecutionContext
  ): Promise<APIInteractionResponse>;
}

