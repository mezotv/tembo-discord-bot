// /list-repositories command handler

import { InteractionRequest, InteractionResponse } from '../types/discord';
import { createTemboClient, listRepositories } from '../lib/tembo';
import { createRepositoryEmbed, createErrorResponse, createEmbedResponse } from '../utils/discord';
import { formatErrorForUser } from '../utils/errors';

export async function handleListRepositories(
  interaction: InteractionRequest,
  env: CloudflareBindings
): Promise<InteractionResponse> {
  try {
    // Initialize Tembo client
    const temboClient = createTemboClient(env.TEMBO_API_KEY);

    // List repositories
    const result = await listRepositories(temboClient);

    // Create embed response
    const embed = createRepositoryEmbed(result.codeRepositories || []);

    return createEmbedResponse(embed);
  } catch (error) {
    console.error('Error listing repositories:', error);
    const errorMessage = formatErrorForUser(error);
    return createErrorResponse(errorMessage);
  }
}

