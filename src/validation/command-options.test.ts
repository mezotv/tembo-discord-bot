// Tests for command option validation

import { describe, it, expect } from "vitest";
import {
	validatePrompt,
	validateAgent,
	parseRepositories,
	validateBranch,
	validatePage,
	validateLimit,
	validateQuery,
	validateCreateTaskParams,
	validateListTasksParams,
	validateSearchTasksParams,
} from "./command-options";
import { ValidationError } from "../utils/errors";

describe("Command Option Validators", () => {
	describe("validatePrompt", () => {
		it("should accept valid prompts", () => {
			expect(validatePrompt("Fix the bug")).toBe("Fix the bug");
			expect(validatePrompt("  Trim spaces  ")).toBe("Trim spaces");
		});

		it("should reject empty prompts", () => {
			expect(() => validatePrompt("")).toThrow(ValidationError);
			expect(() => validatePrompt("   ")).toThrow(ValidationError);
			expect(() => validatePrompt(null)).toThrow(ValidationError);
		});

		it("should reject prompts that are too long", () => {
			const longPrompt = "a".repeat(2001);
			expect(() => validatePrompt(longPrompt)).toThrow(ValidationError);
		});
	});

	describe("validateAgent", () => {
		it("should accept valid agents", () => {
			expect(validateAgent("claudeCode:claude-4-5-sonnet")).toBe(
				"claudeCode:claude-4-5-sonnet",
			);
		});

		it("should return undefined for empty values", () => {
			expect(validateAgent(undefined)).toBeUndefined();
			expect(validateAgent(null)).toBeUndefined();
			expect(validateAgent("")).toBeUndefined();
		});

		it("should reject non-string agents", () => {
			expect(() => validateAgent(123)).toThrow(ValidationError);
		});
	});

	describe("parseRepositories", () => {
		it("should parse comma-separated repository URLs", () => {
			const result = parseRepositories(
				"https://github.com/org/repo1, https://github.com/org/repo2",
			);
			expect(result).toEqual([
				"https://github.com/org/repo1",
				"https://github.com/org/repo2",
			]);
		});

		it("should handle single repository", () => {
			const result = parseRepositories("https://github.com/org/repo");
			expect(result).toEqual(["https://github.com/org/repo"]);
		});

		it("should return undefined for empty values", () => {
			expect(parseRepositories(undefined)).toBeUndefined();
			expect(parseRepositories("")).toBeUndefined();
		});

		it("should reject invalid URLs", () => {
			expect(() => parseRepositories("not-a-url")).toThrow(ValidationError);
			expect(() => parseRepositories("https://valid.com, invalid")).toThrow(
				ValidationError,
			);
		});
	});

	describe("validateBranch", () => {
		it("should accept valid branch names", () => {
			expect(validateBranch("main")).toBe("main");
			expect(validateBranch("feature/new-feature")).toBe("feature/new-feature");
		});

		it("should return undefined for empty values", () => {
			expect(validateBranch(undefined)).toBeUndefined();
			expect(validateBranch(null)).toBeUndefined();
		});
	});

	describe("validatePage", () => {
		it("should accept valid page numbers", () => {
			expect(validatePage(1)).toBe(1);
			expect(validatePage(10)).toBe(10);
		});

		it("should default to 1 for undefined", () => {
			expect(validatePage(undefined)).toBe(1);
		});

		it("should reject invalid page numbers", () => {
			expect(() => validatePage(0)).toThrow(ValidationError);
			expect(() => validatePage(-1)).toThrow(ValidationError);
			expect(() => validatePage(1.5)).toThrow(ValidationError);
		});
	});

	describe("validateLimit", () => {
		it("should accept valid limits", () => {
			expect(validateLimit(10)).toBe(10);
			expect(validateLimit(50)).toBe(50);
		});

		it("should default to 10 for undefined", () => {
			expect(validateLimit(undefined)).toBe(10);
		});

		it("should reject invalid limits", () => {
			expect(() => validateLimit(0)).toThrow(ValidationError);
			expect(() => validateLimit(101)).toThrow(ValidationError);
			expect(() => validateLimit(5.5)).toThrow(ValidationError);
		});
	});

	describe("validateQuery", () => {
		it("should accept valid queries", () => {
			expect(validateQuery("search term")).toBe("search term");
		});

		it("should reject empty queries", () => {
			expect(() => validateQuery("")).toThrow(ValidationError);
			expect(() => validateQuery("   ")).toThrow(ValidationError);
		});
	});

	describe("validateCreateTaskParams", () => {
		it("should validate all create task parameters", () => {
			const params = validateCreateTaskParams({
				prompt: "Fix the bug",
				agent: "claudeCode:claude-4-5-sonnet",
				repositories: "https://github.com/org/repo",
				branch: "main",
			});

			expect(params.prompt).toBe("Fix the bug");
			expect(params.agent).toBe("claudeCode:claude-4-5-sonnet");
			expect(params.repositories).toEqual(["https://github.com/org/repo"]);
			expect(params.branch).toBe("main");
			expect(params.queueRightAway).toBe(true);
		});

		it("should handle minimal parameters", () => {
			const params = validateCreateTaskParams({
				prompt: "Fix the bug",
			});

			expect(params.prompt).toBe("Fix the bug");
			expect(params.agent).toBeUndefined();
			expect(params.repositories).toBeUndefined();
			expect(params.branch).toBeUndefined();
		});

		it("should reject missing prompt", () => {
			expect(() => validateCreateTaskParams({})).toThrow(ValidationError);
		});
	});

	describe("validateListTasksParams", () => {
		it("should validate pagination parameters", () => {
			const params = validateListTasksParams({
				page: 2,
				limit: 20,
			});

			expect(params.page).toBe(2);
			expect(params.limit).toBe(20);
		});

		it("should use defaults for missing parameters", () => {
			const params = validateListTasksParams({});

			expect(params.page).toBe(1);
			expect(params.limit).toBe(10);
		});
	});

	describe("validateSearchTasksParams", () => {
		it("should validate search parameters", () => {
			const params = validateSearchTasksParams({
				query: "bug fix",
				page: 1,
				limit: 10,
			});

			expect(params.query).toBe("bug fix");
			expect(params.page).toBe(1);
			expect(params.limit).toBe(10);
		});

		it("should reject missing query", () => {
			expect(() => validateSearchTasksParams({})).toThrow(ValidationError);
		});
	});
});
