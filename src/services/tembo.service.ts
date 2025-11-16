// Tembo service with business logic and proper error handling

import Tembo from '@tembo-io/sdk';
import type {
  TemboTask,
  TemboTaskList,
  TemboTaskSearchResult,
  TemboRepositoryList,
  TemboUserInfo,
  CreateTaskParams,
  ListTasksParams,
  SearchTasksParams,
} from '../types';
import { handleTemboApiError, TemboApiError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Service for interacting with Tembo API
 */
export class TemboService {
  constructor(private readonly client: Tembo) {
    if (!client) {
      throw new Error('Tembo client is required');
    }
  }

  /**
   * Create a new task
   */
  async createTask(params: CreateTaskParams): Promise<TemboTask> {
    const startTime = Date.now();
    const endpoint = '/task/create';

    try {
      logger.info('Creating Tembo task', {
        prompt: params.prompt.substring(0, 100),
        agent: params.agent,
        repositoryCount: params.repositories?.length ?? 0,
      });

      const result = await this.client.task.create({
        prompt: params.prompt,
        agent: params.agent,
        repositories: params.repositories,
        branch: params.branch,
        queueRightAway: params.queueRightAway ?? true,
      });

      const duration = Date.now() - startTime;
      logger.apiCall(endpoint, 'POST', 200, duration);

      // Map API response to our internal type
      const task = this.mapToTemboTask(result);
      
      logger.info('Task created successfully', {
        taskId: task.id,
        duration,
      });

      return task;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create task', error, {
        endpoint,
        duration,
        prompt: params.prompt.substring(0, 100),
      });
      throw handleTemboApiError(error, endpoint);
    }
  }

  /**
   * List tasks with pagination
   */
  async listTasks(params: ListTasksParams = {}): Promise<TemboTaskList> {
    const startTime = Date.now();
    const endpoint = '/task/list';

    try {
      logger.info('Listing Tembo tasks', {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      });

      const result = await this.client.task.list({
        page: params.page,
        limit: params.limit,
      });

      const duration = Date.now() - startTime;
      logger.apiCall(endpoint, 'GET', 200, duration);

      // Type-safe mapping
      const taskList: TemboTaskList = {
        issues: Array.isArray(result.issues) ? result.issues.map(t => this.mapToTemboTask(t)) : [],
        meta: result.meta,
      };

      logger.info('Tasks listed successfully', {
        count: taskList.issues.length,
        duration,
      });

      return taskList;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to list tasks', error, {
        endpoint,
        duration,
      });
      throw handleTemboApiError(error, endpoint);
    }
  }

  /**
   * Search tasks
   */
  async searchTasks(params: SearchTasksParams): Promise<TemboTaskSearchResult> {
    const startTime = Date.now();
    const endpoint = '/task/search';

    try {
      logger.info('Searching Tembo tasks', {
        query: params.query,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      });

      const result = await this.client.task.search({
        q: params.query, // Tembo SDK uses 'q' not 'query'
        page: params.page,
        limit: params.limit,
      });

      const duration = Date.now() - startTime;
      logger.apiCall(endpoint, 'GET', 200, duration);

      // Type-safe mapping
      const searchResult: TemboTaskSearchResult = {
        issues: Array.isArray(result.issues) ? result.issues.map(t => this.mapToTemboTask(t)) : [],
        meta: result.meta,
        query: params.query,
      };

      logger.info('Task search completed', {
        query: params.query,
        count: searchResult.issues.length,
        duration,
      });

      return searchResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to search tasks', error, {
        endpoint,
        duration,
        query: params.query,
      });
      throw handleTemboApiError(error, endpoint);
    }
  }

  /**
   * List repositories
   */
  async listRepositories(): Promise<TemboRepositoryList> {
    const startTime = Date.now();
    const endpoint = '/repository/list';

    try {
      logger.info('Listing repositories');

      const result = await this.client.repository.list();

      const duration = Date.now() - startTime;
      logger.apiCall(endpoint, 'GET', 200, duration);

      // Type-safe mapping - handle both 'repositories' and 'codeRepositories'
      const repos = (result as any).codeRepositories ?? (result as any).repositories ?? [];
      const repoList: TemboRepositoryList = {
        codeRepositories: Array.isArray(repos) ? repos : [],
      };

      logger.info('Repositories listed successfully', {
        count: repoList.codeRepositories.length,
        duration,
      });

      return repoList;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to list repositories', error, {
        endpoint,
        duration,
      });
      throw handleTemboApiError(error, endpoint);
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<TemboUserInfo> {
    const startTime = Date.now();
    const endpoint = '/me';

    try {
      logger.info('Fetching current user info');

      const result = await this.client.me.retrieve();

      const duration = Date.now() - startTime;
      logger.apiCall(endpoint, 'GET', 200, duration);

      // Map to our type (handle both orgId and organizationId)
      const userInfo: TemboUserInfo = {
        userId: (result as any).userId ?? '',
        orgId: (result as any).orgId ?? (result as any).organizationId ?? '',
        email: (result as any).email,
      };

      logger.info('User info retrieved successfully', {
        userId: userInfo.userId,
        duration,
      });

      return userInfo;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to fetch user info', error, {
        endpoint,
        duration,
      });
      throw handleTemboApiError(error, endpoint);
    }
  }

  /**
   * Map API response to internal TemboTask type
   */
  private mapToTemboTask(apiResponse: any): TemboTask {
    return {
      id: apiResponse.id ?? '',
      title: apiResponse.title,
      description: apiResponse.description ?? apiResponse.prompt,
      prompt: apiResponse.prompt,
      status: apiResponse.status,
      createdAt: apiResponse.createdAt ?? new Date().toISOString(),
      updatedAt: apiResponse.updatedAt ?? new Date().toISOString(),
      organizationId: apiResponse.organizationId,
      agent: apiResponse.agent,
      hash: apiResponse.hash,
      metadata: apiResponse.metadata,
      kind: apiResponse.kind,
      data: apiResponse.data,
      targetBranch: apiResponse.targetBranch,
      sourceBranch: apiResponse.sourceBranch,
      issueSourceId: apiResponse.issueSourceId,
      level: apiResponse.level,
      levelReasoning: apiResponse.levelReasoning,
      lastSeenAt: apiResponse.lastSeenAt,
      lastQueuedAt: apiResponse.lastQueuedAt,
      lastQueuedBy: apiResponse.lastQueuedBy,
      createdBy: apiResponse.createdBy,
      sandboxType: apiResponse.sandboxType,
      mcpServers: apiResponse.mcpServers,
      solutionType: apiResponse.solutionType,
      workflowId: apiResponse.workflowId,
    };
  }
}

/**
 * Create TemboService instance
 */
export function createTemboService(apiKey: string): TemboService {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new TemboApiError('Tembo API key is required', 401, 'client_init');
  }

  const client = new Tembo({ apiKey: apiKey.trim() });
  return new TemboService(client);
}

