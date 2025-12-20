import Tembo from "@tembo-io/sdk";
import type {
	TemboTask,
	TemboTaskList,
	TemboTaskSearchResult,
	TemboRepositoryList,
	TemboRepository,
	TemboUserInfo,
	CreateTaskParams,
	ListTasksParams,
	SearchTasksParams,
} from "../types";
import { handleTemboApiError, TemboApiError } from "../utils/errors";
import { logger } from "../utils/logger";

/**
 * Tembo API response types (based on actual API behavior)
 * Note: These may differ from SDK types due to API inconsistencies
 */
interface TemboApiRepositoryListResponse {
	codeRepositories?: unknown[];
	repositories?: unknown[];
}

interface TemboApiUserInfoResponse {
	userId?: string;
	orgId?: string;
	organizationId?: string;
	email?: string;
}

interface TemboApiTaskResponse {
	id?: string;
	title?: string;
	description?: string;
	prompt?: string;
	status?: string;
	agent?: string;
	organizationId?: string;
	repositories?: string[];
	createdAt?: string;
	updatedAt?: string;
	hash?: string;
	metadata?: Record<string, unknown>;
	kind?: string;
	data?: Record<string, unknown>;
	targetBranch?: string | null;
	sourceBranch?: string | null;
	issueSourceId?: string;
	level?: number;
	levelReasoning?: string | null;
	lastSeenAt?: string;
	lastQueuedAt?: string | null;
	lastQueuedBy?: string | null;
	createdBy?: string;
	sandboxType?: string | null;
	mcpServers?: unknown[];
	solutionType?: string | null;
	workflowId?: string | null;
	[key: string]: unknown; // Allow additional undocumented fields
}

export class TemboService {
	constructor(private readonly client: Tembo) {
		if (!client) {
			throw new Error("Tembo client is required");
		}
	}

	async createTask(params: CreateTaskParams): Promise<TemboTask> {
		const startTime = Date.now();
		const endpoint = "/task/create";

		try {
			logger.info("Creating Tembo task", {
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
			logger.apiCall(endpoint, "POST", 200, duration);

			const task = this.mapToTemboTask(result as unknown as TemboApiTaskResponse);

			logger.info("Task created successfully", {
				taskId: task.id,
				duration,
			});

			return task;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error("Failed to create task", error, {
				endpoint,
				duration,
				prompt: params.prompt.substring(0, 100),
			});
			throw handleTemboApiError(error, endpoint);
		}
	}

	async listTasks(params: ListTasksParams = {}): Promise<TemboTaskList> {
		const startTime = Date.now();
		const endpoint = "/task/list";

		try {
			logger.info("Listing Tembo tasks", {
				page: params.page ?? 1,
				limit: params.limit ?? 10,
			});

			const result = await this.client.task.list({
				page: params.page,
				limit: params.limit,
			});

			const duration = Date.now() - startTime;
			logger.apiCall(endpoint, "GET", 200, duration);

			const taskList: TemboTaskList = {
				issues: Array.isArray(result.issues)
					? result.issues.map((t) => this.mapToTemboTask(t as unknown as TemboApiTaskResponse))
					: [],
				meta: result.meta,
			};

			logger.info("Tasks listed successfully", {
				count: taskList.issues.length,
				duration,
			});

			return taskList;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error("Failed to list tasks", error, {
				endpoint,
				duration,
			});
			throw handleTemboApiError(error, endpoint);
		}
	}

	async searchTasks(params: SearchTasksParams): Promise<TemboTaskSearchResult> {
		const startTime = Date.now();
		const endpoint = "/task/search";

		try {
			logger.info("Searching Tembo tasks", {
				query: params.query,
				page: params.page ?? 1,
				limit: params.limit ?? 10,
			});

			logger.info("DEBUG: About to call SDK search method", {
				q: params.query,
				page: params.page,
				limit: params.limit,
			});

			const result = await this.client.task.search({
				q: params.query,
				page: params.page,
				limit: params.limit,
			});

			logger.info("DEBUG: SDK search response received", {
				hasIssues: !!result.issues,
				issuesCount: Array.isArray(result.issues) ? result.issues.length : 0,
				hasMeta: !!result.meta,
				hasQuery: !!result.query,
				metaKeys: result.meta ? Object.keys(result.meta) : [],
				rawResultPreview: JSON.stringify(result).substring(0, 500),
			});

			const duration = Date.now() - startTime;
			logger.apiCall(endpoint, "GET", 200, duration);

			const searchResult: TemboTaskSearchResult = {
				issues: Array.isArray(result.issues)
					? result.issues.map((t) => this.mapToTemboTask(t as unknown as TemboApiTaskResponse))
					: [],
				meta: result.meta,
				query: params.query,
			};

			logger.info("Task search completed", {
				query: params.query,
				count: searchResult.issues.length,
				duration,
			});

			return searchResult;
		} catch (error) {
			const duration = Date.now() - startTime;

			// Enhanced error logging for debugging
			logger.error("DEBUG: Search failed with detailed error", {
				errorType: error instanceof Error ? error.constructor.name : typeof error,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
				errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error)),
				endpoint,
				duration,
				query: params.query,
				page: params.page,
				limit: params.limit,
			});

			logger.error("Failed to search tasks", error, {
				endpoint,
				duration,
				query: params.query,
			});
			throw handleTemboApiError(error, endpoint);
		}
	}

	async listRepositories(): Promise<TemboRepositoryList> {
		const startTime = Date.now();
		const endpoint = "/repository/list";

		try {
			logger.info("Listing repositories");

			const result = (await this.client.repository.list()) as TemboApiRepositoryListResponse;

			const duration = Date.now() - startTime;
			logger.apiCall(endpoint, "GET", 200, duration);

			const repos = result.codeRepositories ?? result.repositories ?? [];
			const repoList: TemboRepositoryList = {
				codeRepositories: Array.isArray(repos) ? repos as TemboRepository[] : [],
			};

			logger.info("Repositories listed successfully", {
				count: repoList.codeRepositories.length,
				duration,
			});

			return repoList;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error("Failed to list repositories", error, {
				endpoint,
				duration,
			});
			throw handleTemboApiError(error, endpoint);
		}
	}

	async getCurrentUser(): Promise<TemboUserInfo> {
		const startTime = Date.now();
		const endpoint = "/me";

		try {
			logger.info("Fetching current user info");

			const result = (await this.client.me.retrieve()) as TemboApiUserInfoResponse;

			const duration = Date.now() - startTime;
			logger.apiCall(endpoint, "GET", 200, duration);

			const userInfo: TemboUserInfo = {
				userId: result.userId ?? "",
				orgId: result.orgId ?? result.organizationId ?? "",
				email: result.email,
			};

			logger.info("User info retrieved successfully", {
				userId: userInfo.userId,
				duration,
			});

			return userInfo;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error("Failed to fetch user info", error, {
				endpoint,
				duration,
			});
			throw handleTemboApiError(error, endpoint);
		}
	}

	private mapToTemboTask(apiResponse: TemboApiTaskResponse): TemboTask {
		return {
			id: apiResponse.id ?? "",
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

export function createTemboService(apiKey: string): TemboService {
	if (!apiKey || apiKey.trim().length === 0) {
		throw new TemboApiError("Tembo API key is required", 401, "client_init");
	}

	const client = new Tembo({ apiKey: apiKey.trim() });
	return new TemboService(client);
}
