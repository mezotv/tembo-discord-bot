export interface TemboTask {
	id: string;
	title?: string;
	description?: string;
	prompt?: string;
	status?: string;
	createdAt: string;
	updatedAt: string;
	organizationId?: string;
	agent?: string;
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
}

export interface TemboTaskList {
	issues: TemboTask[];
	meta?: {
		totalCount: number;
		totalPages: number;
		currentPage: number;
		pageSize: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
}

export interface TemboTaskSearchResult extends TemboTaskList {
	query: string;
}

export interface TemboRepository {
	id: string;
	name: string;
	url: string;
	branch?: string;
	description?: string;
	enabledAt?: string;
	createdAt?: string;
	updatedAt?: string;
	organizationId?: string;
	integration?: {
		id: string;
		type: string;
		name: string;
		configuration?: Record<string, unknown>;
	};
}

export interface TemboRepositoryList {
	codeRepositories: TemboRepository[];
}

export interface TemboUserInfo {
	orgId: string;
	userId: string;
	email?: string;
}

export type CommandOptionValue = string | number | boolean;

export interface CreateTaskParams {
	prompt: string;
	agent?: string;
	repositories: string[]; // Required field
	branch?: string;
	queueRightAway?: boolean;
}

export interface ListTasksParams {
	page?: number;
	limit?: number;
}

export interface SearchTasksParams {
	query: string;
	page?: number;
	limit?: number;
}

export interface Env {
	DISCORD_APPLICATION_ID: string;
	DISCORD_PUBLIC_KEY: string;
	DISCORD_BOT_TOKEN: string;
	TEMBO_API_KEY: string;
	ENCRYPTION_MASTER_KEY: string;
	tembo_bot_db: D1Database;
}
