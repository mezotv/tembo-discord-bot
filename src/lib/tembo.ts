// Tembo SDK client wrapper

import Tembo from '@tembo-io/sdk';
import { handleTemboApiError, TemboError } from '../utils/errors';

/**
 * Create and initialize Tembo client
 */
export function createTemboClient(apiKey: string): Tembo {
  if (!apiKey) {
    throw new TemboError('Tembo API key is required');
  }
  
  return new Tembo({ apiKey });
}

/**
 * Create a new task
 */
export async function createTask(
  client: Tembo,
  params: {
    prompt: string;
    agent?: string;
    repositories?: string[];
    branch?: string;
    queueRightAway?: boolean;
  }
) {
  try {
    const task = await client.task.create({
      prompt: params.prompt,
      agent: params.agent,
      repositories: params.repositories,
      branch: params.branch,
      queueRightAway: params.queueRightAway,
    });
    
    return task;
  } catch (error) {
    throw handleTemboApiError(error);
  }
}

/**
 * List tasks with pagination
 */
export async function listTasks(
  client: Tembo,
  params?: {
    page?: number;
    limit?: number;
  }
) {
  try {
    const result = await client.task.list({
      page: params?.page,
      limit: params?.limit,
    });
    
    return result;
  } catch (error) {
    throw handleTemboApiError(error);
  }
}

/**
 * Search tasks
 */
export async function searchTasks(
  client: Tembo,
  params: {
    query: string;
    page?: number;
    limit?: number;
  }
) {
  try {
    const result = await client.task.search({
      query: params.query,
      page: params.page,
      limit: params.limit,
    });
    
    return result;
  } catch (error) {
    throw handleTemboApiError(error);
  }
}

/**
 * List repositories
 */
export async function listRepositories(client: Tembo) {
  try {
    const result = await client.repository.list();
    return result;
  } catch (error) {
    throw handleTemboApiError(error);
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(client: Tembo) {
  try {
    const result = await client.me.retrieve();
    return result;
  } catch (error) {
    throw handleTemboApiError(error);
  }
}

