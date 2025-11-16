// Create task controller

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import { BaseController } from './base.controller';
import { validateCreateTaskParams } from '../validation/command-options';
import { logger } from '../utils/logger';

/**
 * Controller for /create-task command
 */
export class CreateTaskController extends BaseController {
  async handle(
    interaction: APIChatInputApplicationCommandInteraction,
    ctx?: ExecutionContext
  ): Promise<APIInteractionResponse> {
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
    const startTime = Date.now();

    try {
      // Extract and validate options
      const optionsMap = this.getOptionsMap(interaction.data.options);
      const params = validateCreateTaskParams(optionsMap);

      logger.info('Processing create-task command', {
        userId,
        promptLength: params.prompt.length,
        agent: params.agent,
        repositoryCount: params.repositories?.length ?? 0,
      });

      // Create task in background if context is available
      if (ctx) {
        const taskPromise = this.temboService.createTask(params)
          .catch(error => {
            logger.error('Background task creation failed', error, {
              userId,
              command: 'create-task',
            });
          });

        ctx.waitUntil(taskPromise);
      }

      const duration = Date.now() - startTime;
      logger.command('create-task', userId, true, duration);

      // Respond immediately
      return this.createSuccessResponse(
        `✅ Task submitted successfully!\n\n` +
        `**Task:** ${params.prompt.substring(0, 150)}${params.prompt.length > 150 ? '...' : ''}\n` +
        `${params.agent ? `**Agent:** ${params.agent}\n` : ''}` +
        `${params.repositories && params.repositories.length > 0 ? `**Repositories:** ${params.repositories.length}\n` : ''}` +
        `${params.branch ? `**Branch:** ${params.branch}\n` : ''}\n` +
        `⏳ The task is being created and will be processed by Tembo shortly.\n` +
        `Use \`/list-tasks\` to see your tasks.`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.command('create-task', userId, false, duration);
      return this.handleError(error, 'create-task', userId);
    }
  }
}

