// Tembo API response types (actual vs documented)
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

// Command option value types
export type CommandOptionValue = string | number | boolean;

// Create task parameters
export interface CreateTaskParams {
  prompt: string;
  agent?: string;
  repositories?: string[];
  branch?: string;
  queueRightAway?: boolean;
}

// List tasks parameters
export interface ListTasksParams {
  page?: number;
  limit?: number;
}

// Search tasks parameters
export interface SearchTasksParams {
  query: string;
  page?: number;
  limit?: number;
}

