// Search tasks controller

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import { BaseController } from './base.controller';
import { validateSearchTasksParams } from '../validation/command-options';
import { logger } from '../utils/logger';

/**
 * Controller for /search-tasks command
 */
export class SearchTasksController extends BaseController {
  async handle(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<APIInteractionResponse> {
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
    const startTime = Date.now();

    try {
      // Extract and validate options
      const optionsMap = this.getOptionsMap(interaction.data.options);
      const params = validateSearchTasksParams(optionsMap);

      logger.info('Processing search-tasks command', {
        userId,
        query: params.query,
        page: params.page,
        limit: params.limit,
      });

      // Search tasks
      const result = await this.temboService.searchTasks(params);

      const duration = Date.now() - startTime;
      logger.command('search-tasks', userId, true, duration);

      // Create embed response
      if (!result.issues || result.issues.length === 0) {
        return this.createSuccessResponse(
          `🔍 No tasks found matching "${params.query}".\n\nTry a different search query or create a new task with \`/create-task\`.`
        );
      }

      const embed = {
        title: `🔍 Search Results: "${params.query}"`,
        description: `Found ${result.issues.length} matching task(s)`,
        fields: result.issues.slice(0, 10).map(task => ({
          name: task.title || task.prompt?.substring(0, 100) || 'Untitled Task',
          value: [
            `**ID:** \`${task.id}\``,
            task.status ? `**Status:** ${task.status}` : '',
            task.agent ? `**Agent:** ${task.agent}` : '',
            task.createdAt ? `**Created:** <t:${Math.floor(new Date(task.createdAt).getTime() / 1000)}:R>` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        })),
        color: 0x5865F2,
        footer: {
          text: result.meta 
            ? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total results`
            : `${result.issues.length} results`,
        },
      };

      return this.createEmbedResponse([embed]);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.command('search-tasks', userId, false, duration);
      return this.handleError(error, 'search-tasks', userId);
    }
  }
}

