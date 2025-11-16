// List tasks controller

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import { BaseController } from './base.controller';
import { validateListTasksParams } from '../validation/command-options';
import { logger } from '../utils/logger';

/**
 * Controller for /list-tasks command
 */
export class ListTasksController extends BaseController {
  async handle(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<APIInteractionResponse> {
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
    const startTime = Date.now();

    try {
      // Extract and validate options
      const optionsMap = this.getOptionsMap(interaction.data.options);
      const params = validateListTasksParams(optionsMap);

      logger.info('Processing list-tasks command', {
        userId,
        page: params.page,
        limit: params.limit,
      });

      // Fetch tasks
      const result = await this.temboService.listTasks(params);

      const duration = Date.now() - startTime;
      logger.command('list-tasks', userId, true, duration);

      // Create embed response
      if (!result.issues || result.issues.length === 0) {
        return this.createSuccessResponse(
          '📝 No tasks found.\n\nCreate a new task with `/create-task`.'
        );
      }

      const embed = {
        title: '📝 Your Tembo Tasks',
        description: `Showing ${result.issues.length} task(s)`,
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
            ? `Page ${result.meta.currentPage} of ${result.meta.totalPages} • ${result.meta.totalCount} total tasks`
            : `${result.issues.length} tasks`,
        },
      };

      return this.createEmbedResponse([embed]);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.command('list-tasks', userId, false, duration);
      return this.handleError(error, 'list-tasks', userId);
    }
  }
}

