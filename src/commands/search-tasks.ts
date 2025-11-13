// /search-tasks command handler

import { InteractionRequest, InteractionResponse } from '../types/discord';
import { createTemboClient, searchTasks } from '../lib/tembo';
import { createTaskListEmbed, createErrorResponse, createEmbedResponse } from '../utils/discord';
import { formatErrorForUser } from '../utils/errors';

export async function handleSearchTasks(
  interaction: InteractionRequest,
  env: CloudflareBindings
): Promise<InteractionResponse> {
  try {
    // Get command options
    const options = interaction.data?.options || [];
    const query = options.find((opt) => opt.name === 'query')?.value as string;
    const page = (options.find((opt) => opt.name === 'page')?.value as number) || 1;
    const limit = (options.find((opt) => opt.name === 'limit')?.value as number) || 10;

    // Validate required fields
    if (!query) {
      return createErrorResponse('Query is required to search tasks.');
    }

    // Validate page and limit
    if (page < 1) {
      return createErrorResponse('Page number must be at least 1.');
    }
    if (limit < 1 || limit > 100) {
      return createErrorResponse('Limit must be between 1 and 100.');
    }

    // Initialize Tembo client
    const temboClient = createTemboClient(env.TEMBO_API_KEY);

    // Search tasks
    const result = await searchTasks(temboClient, { query, page, limit });

    // Create embed response
    const embed = createTaskListEmbed(
      result.issues || [],
      result.meta?.currentPage || page,
      result.meta?.totalPages || 1,
      result.meta?.totalCount || 0
    );

    return createEmbedResponse(embed, `🔍 Search results for: "${query}"`);
  } catch (error) {
    console.error('Error searching tasks:', error);
    const errorMessage = formatErrorForUser(error);
    return createErrorResponse(errorMessage);
  }
}

