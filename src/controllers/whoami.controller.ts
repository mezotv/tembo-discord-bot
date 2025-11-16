// Whoami controller

import type {
  APIChatInputApplicationCommandInteraction,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import { BaseController } from './base.controller';
import { logger } from '../utils/logger';

/**
 * Controller for /whoami command
 */
export class WhoamiController extends BaseController {
  async handle(
    interaction: APIChatInputApplicationCommandInteraction
  ): Promise<APIInteractionResponse> {
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
    const startTime = Date.now();

    try {
      logger.info('Processing whoami command', { userId });

      // Fetch user info
      const userInfo = await this.temboService.getCurrentUser();

      const duration = Date.now() - startTime;
      logger.command('whoami', userId, true, duration);

      // Create embed response
      const embed = {
        title: '👤 Your Tembo Account Info',
        fields: [
          {
            name: 'User ID',
            value: userInfo.userId || 'N/A',
            inline: true,
          },
          {
            name: 'Organization ID',
            value: userInfo.orgId || 'N/A',
            inline: true,
          },
        ],
        color: 0x5865F2,
        timestamp: new Date().toISOString(),
      };

      if (userInfo.email) {
        embed.fields.push({
          name: 'Email',
          value: userInfo.email,
          inline: false,
        });
      }

      return this.createEmbedResponse([embed]);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.command('whoami', userId, false, duration);
      return this.handleError(error, 'whoami', userId);
    }
  }
}

