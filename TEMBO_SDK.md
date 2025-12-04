# Tembo SDK Documentation

This document describes the Tembo API endpoints and their responses based on the `@tembo-io/sdk` package (v0.1.2) as implemented in this Discord bot.

## Table of Contents

1. [Client Initialization](#client-initialization)
2. [Task Operations](#task-operations)
3. [Repository Operations](#repository-operations)
4. [User Operations](#user-operations)
5. [Error Handling](#error-handling)
6. [Response Schemas](#response-schemas)

---

## Client Initialization

### Creating a Tembo Client

```typescript
import Tembo from "@tembo-io/sdk";

const client = new Tembo({
  apiKey: "your-api-key-here"
});
```

**Requirements:**
- API key must be a non-empty string
- Get your API key from: https://app.tembo.io/<your_workspace>/settings/api-keys

---

## Task Operations

### 1. Create Task

Creates a new task for Tembo to work on in the background.

**Endpoint:** `POST /task/create`

**Method:**
```typescript
await client.task.create(params);
```

**Parameters:**
```typescript
interface TaskCreateParams {
  prompt?: string;                // Task description (required in practice)
  agent?: string;                 // Agent to use (e.g., "claudeCode:claude-4-5-sonnet")
  repositories?: string[];        // Array of repository URLs
  branch?: string | null;         // Git branch to target
  queueRightAway?: boolean | null; // Whether to queue immediately (default: true)
}
```

**Example Request:**
```typescript
const task = await client.task.create({
  prompt: "Fix the authentication bug in the login flow",
  agent: "claudeCode:claude-4-5-sonnet",
  repositories: ["https://github.com/org/repo"],
  branch: "main",
  queueRightAway: true
});
```

**Response Schema:**
```typescript
interface TaskCreateResponse {
  id: string;                    // Unique task ID
  title: string;                 // Task title
  description: string;           // Task description/prompt
  status: string;                // Current status
  organizationId: string;        // Organization ID
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
}
```

**Example Response:**
```json
{
  "id": "task_abc123xyz",
  "title": "Fix authentication bug",
  "description": "Fix the authentication bug in the login flow",
  "status": "pending",
  "organizationId": "org_123",
  "createdAt": "2025-12-03T10:30:00.000Z",
  "updatedAt": "2025-12-03T10:30:00.000Z"
}
```

**Task Statuses:**
- `pending` - Task is waiting to be processed
- `queued` - Task is in the processing queue
- `running` / `processing` - Task is currently being worked on
- `finished` / `complete` / `done` - Task completed successfully
- `failed` / `error` - Task failed with an error
- `cancelled` / `canceled` - Task was cancelled

---

### 2. List Tasks

Gets a paginated list of tasks for the organization.

**Endpoint:** `GET /task/list`

**Method:**
```typescript
await client.task.list(params);
```

**Parameters:**
```typescript
interface TaskListParams {
  page?: number;     // Page number (starts from 1, default: 1)
  limit?: number;    // Items per page (1-100, default: 10)
}
```

**Example Request:**
```typescript
const tasks = await client.task.list({
  page: 1,
  limit: 10
});
```

**Response Schema:**
```typescript
interface TaskListResponse {
  issues: Array<{
    id: string;
    title: string;
    description: string;
    prompt?: string;              // Original task prompt
    status: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    agent?: string;               // Agent used for this task
    metadata?: Record<string, unknown>;  // Additional task metadata
    data?: Record<string, unknown>;      // Additional task data
    targetBranch?: string | null;
    sourceBranch?: string | null;
    // ... additional fields
  }>;
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
```

**Example Response:**
```json
{
  "issues": [
    {
      "id": "task_abc123",
      "title": "Fix authentication bug",
      "description": "Fix the authentication bug in the login flow",
      "prompt": "Fix the authentication bug in the login flow",
      "status": "running",
      "organizationId": "org_123",
      "agent": "claudeCode:claude-4-5-sonnet",
      "createdAt": "2025-12-03T10:30:00.000Z",
      "updatedAt": "2025-12-03T10:35:00.000Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 47,
    "pageSize": 10,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

### 3. Search Tasks

Search for tasks by query string with pagination.

**Endpoint:** `GET /task/search`

**Method:**
```typescript
await client.task.search(params);
```

**Parameters:**
```typescript
interface TaskSearchParams {
  q: string;         // Search query (required)
  page?: number;     // Page number (starts from 1, default: 1)
  limit?: number;    // Items per page (1-100, default: 10)
}
```

**Example Request:**
```typescript
const results = await client.task.search({
  q: "authentication bug",
  page: 1,
  limit: 10
});
```

**Response Schema:**
```typescript
interface TaskSearchResponse {
  issues: Array<{
    // Same structure as TaskListResponse.issues
    id: string;
    title: string;
    description: string;
    status: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    // ... additional fields
  }>;
  meta: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  query: string;     // The search query used
}
```

**Example Response:**
```json
{
  "issues": [
    {
      "id": "task_xyz789",
      "title": "Fix authentication bug",
      "description": "Fix the authentication bug in the login flow",
      "status": "finished",
      "organizationId": "org_123",
      "createdAt": "2025-12-03T09:00:00.000Z",
      "updatedAt": "2025-12-03T09:45:00.000Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 1,
    "totalCount": 1,
    "pageSize": 10,
    "hasNext": false,
    "hasPrevious": false
  },
  "query": "authentication bug"
}
```

---

## Repository Operations

### List Repositories

Gets a list of enabled code repositories for the organization.

**Endpoint:** `GET /repository/list`

**Method:**
```typescript
await client.repository.list();
```

**Parameters:** None

**Example Request:**
```typescript
const repos = await client.repository.list();
```

**Response Schema:**
```typescript
interface RepositoryListResponse {
  codeRepositories: Array<{
    id: string;                   // Unique repository ID
    name: string;                 // Repository name
    url?: string;                 // Repository URL
    branch?: string;              // Default branch name
    description?: string;         // Repository description
    organizationId: string;       // Organization ID
    createdAt: string;           // ISO 8601 timestamp
    updatedAt: string;           // ISO 8601 timestamp
    enabledAt: string;           // When repository was enabled
    integration?: {
      id: string;
      name: string;
      type: string;              // e.g., "github", "gitlab"
      configuration: Record<string, unknown>;
    };
  }>;
}
```

**Example Response:**
```json
{
  "codeRepositories": [
    {
      "id": "repo_123",
      "name": "my-awesome-app",
      "url": "https://github.com/org/my-awesome-app",
      "branch": "main",
      "description": "Main application repository",
      "organizationId": "org_123",
      "createdAt": "2025-11-01T00:00:00.000Z",
      "updatedAt": "2025-12-01T00:00:00.000Z",
      "enabledAt": "2025-11-01T00:00:00.000Z",
      "integration": {
        "id": "int_456",
        "name": "GitHub",
        "type": "github",
        "configuration": {}
      }
    }
  ]
}
```

**Note:** The API may return either `codeRepositories` or `repositories` field. The implementation handles both cases.

---

## User Operations

### Get Current User

Get information about the currently authenticated user.

**Endpoint:** `GET /me`

**Method:**
```typescript
await client.me.retrieve();
```

**Parameters:** None

**Example Request:**
```typescript
const userInfo = await client.me.retrieve();
```

**Response Schema:**
```typescript
interface MeRetrieveResponse {
  userId: string | null;         // User ID
  orgId: string | null;          // Organization ID
  email?: string;                // User email (may not always be present)
}
```

**Example Response:**
```json
{
  "userId": "user_abc123",
  "orgId": "org_123",
  "email": "user@example.com"
}
```

**Alternative Field Names:**
The API may return `organizationId` instead of `orgId`. The implementation handles both cases.

---

## Error Handling

### Common Error Types

```typescript
// 401 Unauthorized - Invalid or expired API key
{
  statusCode: 401,
  message: "Invalid API credentials"
}

// 404 Not Found - Resource doesn't exist
{
  statusCode: 404,
  message: "Resource not found"
}

// 429 Rate Limit - Too many requests
{
  statusCode: 429,
  message: "Rate limit exceeded"
}

// 500/503 Service Error - API is down or experiencing issues
{
  statusCode: 503,
  message: "Service temporarily unavailable"
}
```

### Error Handling Example

```typescript
import { TemboApiError } from "./utils/errors";

try {
  const task = await client.task.create({
    prompt: "Fix the bug",
    repositories: ["https://github.com/org/repo"]
  });
} catch (error) {
  if (error instanceof TemboApiError) {
    console.error(`API Error (${error.statusCode}): ${error.message}`);
    console.error(`Endpoint: ${error.endpoint}`);
  }
}
```

---

## Response Schemas

### Complete Task Schema

The full task object returned by the API includes many additional fields beyond the basic response:

```typescript
interface TemboTask {
  // Core fields
  id: string;
  title?: string;
  description?: string;
  prompt?: string;
  status?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;

  // Configuration
  agent?: string;
  targetBranch?: string | null;
  sourceBranch?: string | null;

  // Metadata
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  hash?: string;
  kind?: string;

  // Tracking
  issueSourceId?: string;
  level?: string;
  levelReasoning?: string;
  lastSeenAt?: string;
  lastQueuedAt?: string;
  lastQueuedBy?: string;
  createdBy?: string;

  // Advanced
  sandboxType?: string;
  mcpServers?: unknown;
  solutionType?: string;
  workflowId?: string;
}
```

### Pagination Metadata

All list and search endpoints return pagination metadata:

```typescript
interface PaginationMeta {
  currentPage: number;      // Current page number (1-indexed)
  totalPages: number;       // Total number of pages
  totalCount: number;       // Total number of items
  pageSize: number;         // Items per page
  hasNext: boolean;         // Whether there is a next page
  hasPrevious: boolean;     // Whether there is a previous page
}
```

---

## Implementation Notes

### API Key Management

1. **Storage**: API keys are encrypted using AES-256-GCM encryption before storage
2. **Validation**: Keys are validated by calling the `/me` endpoint
3. **Refresh**: Keys are re-validated on each authentication attempt

### Rate Limiting

- The API implements rate limiting
- Handle 429 errors gracefully with exponential backoff
- Default recommendation: Wait 1-2 minutes before retrying

### Best Practices

1. **Always specify repositories**: While technically optional in the SDK, repositories are required for task creation in practice
2. **Use pagination**: Don't try to fetch all tasks at once; use reasonable page sizes (10-25 items)
3. **Handle errors**: Always wrap API calls in try-catch blocks
4. **Validate input**: Use the validation utilities before sending data to the API
5. **Check status**: Monitor task status through the list/search endpoints

### Available Agents

The following agents are commonly used:

**Claude Code:**
- `claudeCode:claude-4-5-sonnet` (Default, Balanced)
- `claudeCode:claude-4-5-haiku` (Fastest)
- `claudeCode:claude-4.1-opus` (Complex Tasks)
- `claudeCode:claude-4-sonnet` (Efficient)

**Codex:**
- `codex:gpt-5-medium` (Default, Balanced)
- `codex:gpt-5-minimal` (Fastest)
- `codex:gpt-5-low` (Quick)
- `codex:gpt-5-high` (Deep Reasoning)
- `codex:gpt-5-codex` (Code Generation)

**Opencode:**
- `opencode:claude-4-5-sonnet` (Default, Balanced)
- `opencode:claude-4-5-haiku` (Fastest)
- `opencode:claude-4.1-opus` (Complex Tasks)
- `opencode:claude-4-sonnet` (Efficient)

**Cursor:**
- `cursor:claude-4-5-sonnet` (Default, Balanced)
- `cursor:claude-4.1-opus` (Complex Tasks)
- `cursor:gpt-5.1`, `cursor:gpt-5.1-codex`, `cursor:gpt-5.1-codex-high`
- `cursor:gemini-3-pro`
- `cursor:composer-1`
- `cursor:grok`

**Amp:**
- `amp:claude-4-5-sonnet` (Smart Detection)

---

## Additional Resources

- **API Key Generation**: https://app.tembo.io/<your_workspace>/settings/api-keys
- **Tembo Dashboard**: https://app.tembo.io
- **Tembo Status**: https://status.tembo.io
- **SDK Package**: `@tembo-io/sdk` v0.1.2

---

## SDK Version

This documentation is based on:
- **Package**: `@tembo-io/sdk`
- **Version**: `^0.1.2`
- **Last Updated**: December 2025
