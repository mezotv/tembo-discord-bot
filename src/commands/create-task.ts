// /create-task command handler

import { InteractionRequest, InteractionResponse } from '../types/discord';
import { createTemboClient, createTask } from '../lib/tembo';
import { createTaskEmbed, createErrorResponse, createEmbedResponse } from '../utils/discord';
import { formatErrorForUser } from '../utils/errors';

export async function handleCreateTask(
  interaction: InteractionRequest,
  env: CloudflareBindings
): Promise<InteractionResponse> {
  try {
    // Get command options
    const options = interaction.data?.options || [];
    const prompt = options.find((opt) => opt.name === 'prompt')?.value as string;
    const agent = options.find((opt) => opt.name === 'agent')?.value as string | undefined;
    const repositories = options.find((opt) => opt.name === 'repositories')?.value as string | undefined;
    const branch = options.find((opt) => opt.name === 'branch')?.value as string | undefined;

    // Validate required fields
    if (!prompt) {
      return createErrorResponse('Prompt is required to create a task.');
    }

    // Initialize Tembo client
    const temboClient = createTemboClient(env.TEMBO_API_KEY);

    // Parse repositories if provided (comma-separated)
    const repoArray = repositories
      ? repositories.split(',').map((r) => r.trim()).filter(Boolean)
      : undefined;

    // Create the task
    const task = await createTask(temboClient, {
      prompt,
      agent,
      repositories: repoArray,
      branch,
      queueRightAway: true,
    });

    // Create embed response
    const embed = createTaskEmbed(task);
    return createEmbedResponse(
      embed,
      `✅ Task created successfully! Task ID: \`${task.id}\``
    );
  } catch (error) {
    console.error('Error creating task:', error);
    const errorMessage = formatErrorForUser(error);
    return createErrorResponse(errorMessage);
  }
}

