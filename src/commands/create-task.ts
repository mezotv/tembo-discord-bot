// /create-task command handler

import { InteractionRequest, InteractionResponse, InteractionResponseType } from '../types/discord';
import { createTemboClient, createTask } from '../lib/tembo';
import { createTaskEmbed, createErrorResponse, createEmbedResponse, createResponse } from '../utils/discord';
import { formatErrorForUser } from '../utils/errors';

export async function handleCreateTask(
  interaction: InteractionRequest,
  env: CloudflareBindings,
  ctx?: ExecutionContext
): Promise<InteractionResponse> {
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

  try {
    // Initialize Tembo client
    const temboClient = createTemboClient(env.TEMBO_API_KEY);

    // Parse repositories if provided (comma-separated)
    const repoArray = repositories
      ? repositories.split(',').map((r) => r.trim()).filter(Boolean)
      : undefined;

    // Create the task (this takes ~4 seconds, which will cause timeout)
    // But we'll respond immediately with a message about the task being queued
    const taskPromise = createTask(temboClient, {
      prompt,
      agent,
      repositories: repoArray,
      branch,
      queueRightAway: true,
    });

    // If context is provided, use waitUntil to let the task complete in background
    if (ctx) {
      ctx.waitUntil(taskPromise);
    }

    // Respond immediately (don't await the task creation)
    return createResponse(
      `✅ Task submitted successfully!\n\n` +
      `**Task:** ${prompt.substring(0, 150)}${prompt.length > 150 ? '...' : ''}\n` +
      `${agent ? `**Agent:** ${agent}\n` : ''}` +
      `${repoArray && repoArray.length > 0 ? `**Repositories:** ${repoArray.length}\n` : ''}` +
      `${branch ? `**Branch:** ${branch}\n` : ''}\n` +
      `⏳ The task is being created and will be processed by Tembo shortly.\n` +
      `Use \`/list-tasks\` to see your tasks.`,
      false
    );
  } catch (error) {
    console.error('Error submitting task:', error);
    const errorMessage = formatErrorForUser(error);
    return createErrorResponse(errorMessage);
  }
}

