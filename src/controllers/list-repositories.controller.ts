// List repositories controller

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import { BaseController } from './base.controller';
import { logger } from '../utils/logger';

/**
 * Controller for /list-repositories command
 */
export class ListRepositoriesController extends BaseController {
  async handle(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<APIInteractionResponse> {
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
    const startTime = Date.now();

    try {
      logger.info('Processing list-repositories command', { userId });

      // Fetch repositories
      const result = await this.temboService.listRepositories();

      const duration = Date.now() - startTime;
      logger.command('list-repositories', userId, true, duration);

      // Create embed response
      if (!result.codeRepositories || result.codeRepositories.length === 0) {
        return this.createSuccessResponse(
          '📦 No repositories found.\n\nConnect your repositories in the Tembo dashboard.'
        );
      }

      const embed = {
        title: '📦 Your Connected Repositories',
        description: `${result.codeRepositories.length} repository(ies) connected`,
        fields: result.codeRepositories.slice(0, 10).map(repo => ({
          name: repo.name || 'Unnamed Repository',
          value: [
            `**URL:** ${repo.url}`,
            repo.branch ? `**Branch:** ${repo.branch}` : '',
            repo.integration?.type ? `**Provider:** ${repo.integration.type}` : '',
            repo.description ? `**Description:** ${repo.description.substring(0, 100)}` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        })),
        color: 0x5865F2,
        footer: {
          text: `${result.codeRepositories.length} total repositories`,
        },
      };

      return this.createEmbedResponse([embed]);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.command('list-repositories', userId, false, duration);
      return this.handleError(error, 'list-repositories', userId);
    }
  }
}

