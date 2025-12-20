// Tests for TemboService

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TemboService, createTemboService } from "./tembo.service";
import { TemboApiError, AuthenticationError } from "../utils/errors";
import type {
	TemboTask,
	TemboTaskList,
	TemboTaskSearchResult,
	TemboRepositoryList,
	TemboUserInfo,
} from "../types";

// Note: Logger is not mocked - it will output to console during tests
// This is acceptable as it doesn't affect test functionality

describe("TemboService", () => {
	describe("Constructor", () => {
		it("should create service with valid client", () => {
			const mockClient = {} as any;
			const service = new TemboService(mockClient);
			expect(service).toBeInstanceOf(TemboService);
		});

		it("should throw error for null client", () => {
			expect(() => new TemboService(null as any)).toThrow(
				"Tembo client is required",
			);
		});

		it("should throw error for undefined client", () => {
			expect(() => new TemboService(undefined as any)).toThrow(
				"Tembo client is required",
			);
		});
	});

	describe("createTask", () => {
		let service: TemboService;
		let mockClient: any;

		beforeEach(() => {
			mockClient = {
				task: {
					create: vi.fn(),
				},
			};
			service = new TemboService(mockClient);
			vi.spyOn(Date, "now").mockReturnValue(1000);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should create task successfully", async () => {
			const mockApiResponse = {
				id: "task-123",
				title: "Test Task",
				prompt: "Create a test",
				description: "Create a test",
				status: "queued",
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
				organizationId: "org-123",
				agent: "claudeCode:claude-4-5-sonnet",
			};

			mockClient.task.create.mockResolvedValue(mockApiResponse);

			const params = {
				prompt: "Create a test",
				agent: "claudeCode:claude-4-5-sonnet",
			repositories: ["https://github.com/org/repo"],
			};

			const result = await service.createTask(params);

			expect(result.id).toBe("task-123");
			expect(result.prompt).toBe("Create a test");
			expect(mockClient.task.create).toHaveBeenCalledWith({
				prompt: "Create a test",
				agent: "claudeCode:claude-4-5-sonnet",
				repositories: undefined,
				branch: undefined,
				queueRightAway: true,
			});
		});

		it("should create task with all parameters", async () => {
			const mockApiResponse = {
				id: "task-456",
				title: "Full Task",
				prompt: "Full task creation",
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T00:00:00Z",
			};

			mockClient.task.create.mockResolvedValue(mockApiResponse);

			const params = {
				prompt: "Full task creation",
				agent: "claudeCode:claude-4-5-sonnet",
				repositories: ["https://github.com/org/repo"],
				branch: "main",
				queueRightAway: false,
			};

			await service.createTask(params);

			expect(mockClient.task.create).toHaveBeenCalledWith({
				prompt: "Full task creation",
				agent: "claudeCode:claude-4-5-sonnet",
				repositories: ["https://github.com/org/repo"],
				branch: "main",
				queueRightAway: false,
			});
		});

		it("should handle API errors", async () => {
			mockClient.task.create.mockRejectedValue(
				new Error("401 Unauthorized"),
			);

			const params = { prompt: "Test", repositories: ["https://github.com/org/repo"] };

			await expect(service.createTask(params)).rejects.toThrow();
		});

		it("should map API response correctly", async () => {
			const mockApiResponse = {
				id: "task-789",
				title: "Mapped Task",
				prompt: "Test mapping",
				description: "Test description",
				status: "in_progress",
				createdAt: "2025-01-01T00:00:00Z",
				updatedAt: "2025-01-01T01:00:00Z",
				organizationId: "org-789",
				agent: "claudeCode:claude-4-5-sonnet",
				hash: "hash123",
				metadata: { key: "value" },
				kind: "user-supplied",
				data: { dataKey: "dataValue" },
				targetBranch: "main",
				sourceBranch: "develop",
				issueSourceId: "issue-123",
				level: 1,
				levelReasoning: "Reason",
				lastSeenAt: "2025-01-01T02:00:00Z",
				lastQueuedAt: "2025-01-01T03:00:00Z",
				lastQueuedBy: "user123",
				createdBy: "user456",
				sandboxType: "docker",
				mcpServers: [],
				solutionType: "code",
				workflowId: "workflow-123",
			};

			mockClient.task.create.mockResolvedValue(mockApiResponse);

			const result = await service.createTask({ prompt: "Test", repositories: ["https://github.com/org/repo"] });

			expect(result.id).toBe("task-789");
			expect(result.title).toBe("Mapped Task");
			expect(result.prompt).toBe("Test mapping");
			expect(result.description).toBe("Test description");
			expect(result.status).toBe("in_progress");
			expect(result.organizationId).toBe("org-789");
			expect(result.agent).toBe("claudeCode:claude-4-5-sonnet");
			expect(result.hash).toBe("hash123");
			expect(result.metadata).toEqual({ key: "value" });
		});
	});

	describe("listTasks", () => {
		let service: TemboService;
		let mockClient: any;

		beforeEach(() => {
			mockClient = {
				task: {
					list: vi.fn(),
				},
			};
			service = new TemboService(mockClient);
			vi.spyOn(Date, "now").mockReturnValue(1000);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should list tasks successfully", async () => {
			const mockApiResponse = {
				issues: [
					{
						id: "task-1",
						title: "Task 1",
						prompt: "Task 1 prompt",
						createdAt: "2025-01-01T00:00:00Z",
						updatedAt: "2025-01-01T00:00:00Z",
					},
					{
						id: "task-2",
						title: "Task 2",
						prompt: "Task 2 prompt",
						createdAt: "2025-01-01T01:00:00Z",
						updatedAt: "2025-01-01T01:00:00Z",
					},
				],
				meta: {
					totalCount: 2,
					totalPages: 1,
					currentPage: 1,
					pageSize: 10,
					hasNext: false,
					hasPrevious: false,
				},
			};

			mockClient.task.list.mockResolvedValue(mockApiResponse);

			const result = await service.listTasks();

			expect(result.issues).toHaveLength(2);
			expect(result.meta).toEqual(mockApiResponse.meta);
			expect(mockClient.task.list).toHaveBeenCalledWith({
				page: undefined,
				limit: undefined,
			});
		});

		it("should list tasks with pagination", async () => {
			const mockApiResponse = {
				issues: [],
				meta: {
					totalCount: 0,
					currentPage: 2,
				},
			};

			mockClient.task.list.mockResolvedValue(mockApiResponse);

			const params = { page: 2, limit: 20 };
			await service.listTasks(params);

			expect(mockClient.task.list).toHaveBeenCalledWith({
				page: 2,
				limit: 20,
			});
		});

		it("should handle empty issues array", async () => {
			const mockApiResponse = {
				issues: [],
				meta: {},
			};

			mockClient.task.list.mockResolvedValue(mockApiResponse);

			const result = await service.listTasks();

			expect(result.issues).toEqual([]);
		});

		it("should handle non-array issues", async () => {
			const mockApiResponse = {
				issues: null,
				meta: {},
			};

			mockClient.task.list.mockResolvedValue(mockApiResponse);

			const result = await service.listTasks();

			expect(result.issues).toEqual([]);
		});

		it("should handle API errors", async () => {
			mockClient.task.list.mockRejectedValue(new Error("API error"));

			await expect(service.listTasks()).rejects.toThrow();
		});
	});

	describe("searchTasks", () => {
		let service: TemboService;
		let mockClient: any;

		beforeEach(() => {
			mockClient = {
				task: {
					search: vi.fn(),
				},
			};
			service = new TemboService(mockClient);
			vi.spyOn(Date, "now").mockReturnValue(1000);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should search tasks successfully", async () => {
			const mockApiResponse = {
				issues: [
					{
						id: "task-1",
						title: "Search Result",
						prompt: "Search query match",
						createdAt: "2025-01-01T00:00:00Z",
						updatedAt: "2025-01-01T00:00:00Z",
					},
				],
				meta: {
					totalCount: 1,
					currentPage: 1,
				},
			};

			mockClient.task.search.mockResolvedValue(mockApiResponse);

			const params = { query: "search term" };
			const result = await service.searchTasks(params);

			expect(result.query).toBe("search term");
			expect(result.issues).toHaveLength(1);
			expect(mockClient.task.search).toHaveBeenCalledWith({
				q: "search term",
				page: undefined,
				limit: undefined,
			});
		});

		it("should search with pagination", async () => {
			const mockApiResponse = {
				issues: [],
				meta: {},
			};

			mockClient.task.search.mockResolvedValue(mockApiResponse);

			const params = { query: "test", page: 2, limit: 50 };
			await service.searchTasks(params);

			expect(mockClient.task.search).toHaveBeenCalledWith({
				q: "test",
				page: 2,
				limit: 50,
			});
		});

		it("should handle API errors", async () => {
			mockClient.task.search.mockRejectedValue(new Error("API error"));

			await expect(
				service.searchTasks({ query: "test" }),
			).rejects.toThrow();
		});
	});

	describe("listRepositories", () => {
		let service: TemboService;
		let mockClient: any;

		beforeEach(() => {
			mockClient = {
				repository: {
					list: vi.fn(),
				},
			};
			service = new TemboService(mockClient);
			vi.spyOn(Date, "now").mockReturnValue(1000);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should list repositories successfully with codeRepositories", async () => {
			const mockApiResponse = {
				codeRepositories: [
					{
						id: "repo-1",
						name: "Repository 1",
						url: "https://github.com/org/repo1",
					},
					{
						id: "repo-2",
						name: "Repository 2",
						url: "https://github.com/org/repo2",
					},
				],
			};

			mockClient.repository.list.mockResolvedValue(mockApiResponse);

			const result = await service.listRepositories();

			expect(result.codeRepositories).toHaveLength(2);
			expect(result.codeRepositories[0]!.id).toBe("repo-1");
		});

		it("should handle repositories field (fallback)", async () => {
			const mockApiResponse = {
				repositories: [
					{
						id: "repo-1",
						name: "Repository 1",
						url: "https://github.com/org/repo1",
					},
				],
			};

			mockClient.repository.list.mockResolvedValue(mockApiResponse);

			const result = await service.listRepositories();

			expect(result.codeRepositories).toHaveLength(1);
		});

		it("should handle empty repositories", async () => {
			const mockApiResponse = {
				codeRepositories: [],
			};

			mockClient.repository.list.mockResolvedValue(mockApiResponse);

			const result = await service.listRepositories();

			expect(result.codeRepositories).toEqual([]);
		});

		it("should handle non-array repositories", async () => {
			const mockApiResponse = {
				codeRepositories: null,
			};

			mockClient.repository.list.mockResolvedValue(mockApiResponse);

			const result = await service.listRepositories();

			expect(result.codeRepositories).toEqual([]);
		});

		it("should handle API errors", async () => {
			mockClient.repository.list.mockRejectedValue(new Error("API error"));

			await expect(service.listRepositories()).rejects.toThrow();
		});
	});

	describe("getCurrentUser", () => {
		let service: TemboService;
		let mockClient: any;

		beforeEach(() => {
			mockClient = {
				me: {
					retrieve: vi.fn(),
				},
			};
			service = new TemboService(mockClient);
			vi.spyOn(Date, "now").mockReturnValue(1000);
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it("should get current user successfully with userId and orgId", async () => {
			const mockApiResponse = {
				userId: "user-123",
				orgId: "org-456",
				email: "user@example.com",
			};

			mockClient.me.retrieve.mockResolvedValue(mockApiResponse);

			const result = await service.getCurrentUser();

			expect(result.userId).toBe("user-123");
			expect(result.orgId).toBe("org-456");
			expect(result.email).toBe("user@example.com");
		});

		it("should handle organizationId field (fallback)", async () => {
			const mockApiResponse = {
				userId: "user-123",
				organizationId: "org-456",
			};

			mockClient.me.retrieve.mockResolvedValue(mockApiResponse);

			const result = await service.getCurrentUser();

			expect(result.userId).toBe("user-123");
			expect(result.orgId).toBe("org-456");
		});

		it("should handle missing userId", async () => {
			const mockApiResponse = {
				orgId: "org-456",
			};

			mockClient.me.retrieve.mockResolvedValue(mockApiResponse);

			const result = await service.getCurrentUser();

			expect(result.userId).toBe("");
			expect(result.orgId).toBe("org-456");
		});

		it("should handle missing orgId", async () => {
			const mockApiResponse = {
				userId: "user-123",
			};

			mockClient.me.retrieve.mockResolvedValue(mockApiResponse);

			const result = await service.getCurrentUser();

			expect(result.userId).toBe("user-123");
			expect(result.orgId).toBe("");
		});

		it("should handle missing email", async () => {
			const mockApiResponse = {
				userId: "user-123",
				orgId: "org-456",
			};

			mockClient.me.retrieve.mockResolvedValue(mockApiResponse);

			const result = await service.getCurrentUser();

			expect(result.email).toBeUndefined();
		});

		it("should handle API errors", async () => {
			mockClient.me.retrieve.mockRejectedValue(
				new AuthenticationError("/me"),
			);

			await expect(service.getCurrentUser()).rejects.toThrow();
		});
	});

	describe("createTemboService", () => {
		it("should throw error for empty API key", () => {
			expect(() => createTemboService("")).toThrow(TemboApiError);
			expect(() => createTemboService("")).toThrow("Tembo API key is required");
		});

		it("should throw error for whitespace-only API key", () => {
			expect(() => createTemboService("   ")).toThrow(TemboApiError);
		});

		it("should throw error for null API key", () => {
			expect(() => createTemboService(null as any)).toThrow(TemboApiError);
		});

		it("should throw error for undefined API key", () => {
			expect(() => createTemboService(undefined as any)).toThrow(TemboApiError);
		});

		it("should create service with valid API key", () => {
			// This test uses the actual Tembo SDK
			// The validation logic is tested above
			const service = createTemboService("valid-api-key-12345");
			expect(service).toBeInstanceOf(TemboService);
		});
	});
});

