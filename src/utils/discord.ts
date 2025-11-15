// Discord utility functions for formatting responses

import {
  InteractionResponse,
  InteractionResponseType,
  MessageFlags,
  Embed,
  EmbedField,
} from '../types/discord';

/**
 * Create a simple text response
 */
export function createResponse(content: string, ephemeral = false): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  };
}

/**
 * Create a response with an embed
 */
export function createEmbedResponse(
  embed: Embed,
  content?: string,
  ephemeral = false
): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds: [embed],
      flags: ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(message: string, ephemeral = true): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `❌ ${message}`,
      flags: ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  };
}

/**
 * Create a success response
 */
export function createSuccessResponse(message: string, ephemeral = false): InteractionResponse {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${message}`,
      flags: ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  };
}

/**
 * Create an embed for displaying task information
 */
export function createTaskEmbed(task: {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}): Embed {
  return {
    title: task.title || 'Task',
    description: task.description || 'No description provided',
    color: getStatusColor(task.status),
    fields: [
      {
        name: 'Task ID',
        value: task.id,
        inline: false,
      },
      {
        name: 'Status',
        value: task.status,
        inline: true,
      },
      {
        name: 'Created',
        value: formatDate(task.createdAt),
        inline: true,
      },
    ],
    timestamp: task.updatedAt,
  };
}

/**
 * Create an embed for displaying multiple tasks
 */
export function createTaskListEmbed(
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>,
  page: number,
  totalPages: number,
  totalCount: number
): Embed {
  const fields: EmbedField[] = tasks.map((task) => ({
    name: task.title || 'Untitled Task',
    value: `**ID:** \`${task.id}\`\n**Status:** ${task.status}\n**Created:** ${formatDate(task.createdAt)}`,
    inline: false,
  }));

  return {
    title: '📋 Tembo Tasks',
    description: `Showing page ${page} of ${totalPages} (${totalCount} total tasks)`,
    color: 0x5865f2, // Discord blurple
    fields: fields.length > 0 ? fields : [{ name: 'No tasks found', value: 'No tasks match your query.', inline: false }],
  };
}

/**
 * Create an embed for displaying repository information
 */
export function createRepositoryEmbed(repositories: Array<{
  id: string;
  name: string;
  url: string;
  provider: string;
}>): Embed {
  const fields: EmbedField[] = repositories.map((repo) => ({
    name: repo.name,
    value: `**Provider:** ${repo.provider}\n**URL:** ${repo.url}`,
    inline: false,
  }));

  return {
    title: '📦 Available Repositories',
    description: `You have access to ${repositories.length} repository(ies)`,
    color: 0x57f287, // Green
    fields: fields.length > 0 ? fields : [{ name: 'No repositories', value: 'No repositories found.', inline: false }],
  };
}

/**
 * Create an embed for displaying user information
 */
export function createUserInfoEmbed(userInfo: {
  userId: string;
  orgId: string;
  email?: string;
}): Embed {
  const fields: EmbedField[] = [
    {
      name: 'Organization ID',
      value: userInfo.orgId,
      inline: false,
    },
    {
      name: 'User ID',
      value: userInfo.userId,
      inline: false,
    },
  ];

  if (userInfo.email) {
    fields.push({
      name: 'Email',
      value: userInfo.email,
      inline: false,
    });
  }

  return {
    title: '👤 User Information',
    color: 0xfee75c, // Yellow
    fields,
  };
}

/**
 * Get color based on task status
 */
function getStatusColor(status: string): number {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('completed') || statusLower.includes('done')) {
    return 0x57f287; // Green
  }
  if (statusLower.includes('in_progress') || statusLower.includes('running') || statusLower.includes('active')) {
    return 0x5865f2; // Blurple
  }
  if (statusLower.includes('failed') || statusLower.includes('error')) {
    return 0xed4245; // Red
  }
  if (statusLower.includes('pending') || statusLower.includes('queued')) {
    return 0xfee75c; // Yellow
  }
  
  return 0x99aab5; // Gray (default)
}

/**
 * Format a date string to a more readable format
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

