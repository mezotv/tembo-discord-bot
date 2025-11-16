import { isString, isNumber, isNonEmptyString } from "./guards";
import { ValidationError } from "../utils/errors";
import type {
	CreateTaskParams,
	ListTasksParams,
	SearchTasksParams,
} from "../types";

export function validatePrompt(value: unknown): string {
	if (!isNonEmptyString(value)) {
		throw new ValidationError("Prompt must be a non-empty string", "prompt");
	}
	if (value.length > 2000) {
		throw new ValidationError(
			"Prompt must be less than 2000 characters",
			"prompt",
		);
	}
	return value.trim();
}

export function validateAgent(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (!isString(value)) {
		throw new ValidationError("Agent must be a string", "agent");
	}
	return value.trim() || undefined;
}

export function parseRepositories(value: unknown): string[] | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (!isString(value)) {
		throw new ValidationError(
			"Repositories must be a comma-separated string",
			"repositories",
		);
	}

	const repos = value
		.split(",")
		.map((r) => r.trim())
		.filter(Boolean);

	if (repos.length === 0) {
		return undefined;
	}

	for (const repo of repos) {
		if (!repo.startsWith("http://") && !repo.startsWith("https://")) {
			throw new ValidationError(
				`Invalid repository URL: ${repo}`,
				"repositories",
			);
		}
	}

	return repos;
}

export function validateBranch(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (!isString(value)) {
		throw new ValidationError("Branch must be a string", "branch");
	}
	return value.trim() || undefined;
}

export function validatePage(value: unknown): number {
	if (value === undefined || value === null) {
		return 1;
	}
	if (!isNumber(value)) {
		throw new ValidationError("Page must be a number", "page");
	}
	if (value < 1) {
		throw new ValidationError("Page must be at least 1", "page");
	}
	if (!Number.isInteger(value)) {
		throw new ValidationError("Page must be an integer", "page");
	}
	return value;
}

export function validateLimit(value: unknown): number {
	if (value === undefined || value === null) {
		return 10;
	}
	if (!isNumber(value)) {
		throw new ValidationError("Limit must be a number", "limit");
	}
	if (value < 1 || value > 100) {
		throw new ValidationError("Limit must be between 1 and 100", "limit");
	}
	if (!Number.isInteger(value)) {
		throw new ValidationError("Limit must be an integer", "limit");
	}
	return value;
}

export function validateQuery(value: unknown): string {
	if (!isNonEmptyString(value)) {
		throw new ValidationError("Query must be a non-empty string", "query");
	}
	return value.trim();
}

export function validateCreateTaskParams(
	options: Record<string, unknown>,
): CreateTaskParams {
	return {
		prompt: validatePrompt(options.prompt),
		agent: validateAgent(options.agent),
		repositories: parseRepositories(options.repositories),
		branch: validateBranch(options.branch),
		queueRightAway: true,
	};
}

export function validateListTasksParams(
	options: Record<string, unknown>,
): ListTasksParams {
	return {
		page: validatePage(options.page),
		limit: validateLimit(options.limit),
	};
}

export function validateSearchTasksParams(
	options: Record<string, unknown>,
): SearchTasksParams {
	return {
		query: validateQuery(options.query),
		page: validatePage(options.page),
		limit: validateLimit(options.limit),
	};
}
