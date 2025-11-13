// /whoami command handler

import { InteractionRequest, InteractionResponse } from '../types/discord';
import { createTemboClient, getCurrentUser } from '../lib/tembo';
import { createUserInfoEmbed, createErrorResponse, createEmbedResponse } from '../utils/discord';
import { formatErrorForUser } from '../utils/errors';

export async function handleWhoami(
  interaction: InteractionRequest,
  env: CloudflareBindings
): Promise<InteractionResponse> {
  try {
    // Initialize Tembo client
    const temboClient = createTemboClient(env.TEMBO_API_KEY);

    // Get current user info
    const userInfo = await getCurrentUser(temboClient);

    // Create embed response
    const embed = createUserInfoEmbed(userInfo);

    return createEmbedResponse(embed);
  } catch (error) {
    console.error('Error getting user info:', error);
    const errorMessage = formatErrorForUser(error);
    return createErrorResponse(errorMessage);
  }
}

