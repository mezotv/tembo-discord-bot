// Tests for error handling

import { describe, it, expect } from "vitest";
import {
	ValidationError,
	TemboApiError,
	DiscordInteractionError,
	AuthenticationError,
	NotFoundError,
	RateLimitError,
	ServiceUnavailableError,
	formatErrorForUser,
	handleTemboApiError,
	isAuthError,
	isValidationError,
	isTemboApiError,
} from "./errors";

describe("Error Classes", () => {
	describe("ValidationError", () => {
		it("should create validation error with field", () => {
			const error = new ValidationError("Invalid input", "prompt");
			expect(error.message).toBe("Invalid input");
			expect(error.field).toBe("prompt");
			expect(error.statusCode).toBe(400);
			expect(error.name).toBe("ValidationError");
		});
	});

	describe("TemboApiError", () => {
		it("should create API error with endpoint", () => {
			const error = new TemboApiError("API failed", 500, "/task/create");
			expect(error.message).toBe("API failed");
			expect(error.statusCode).toBe(500);
			expect(error.endpoint).toBe("/task/create");
			expect(error.name).toBe("TemboApiError");
		});
	});

	describe("AuthenticationError", () => {
		it("should create auth error", () => {
			const error = new AuthenticationError("/me");
			expect(error.statusCode).toBe(401);
			expect(error.endpoint).toBe("/me");
			expect(error.message).toContain("Invalid API credentials");
		});
	});

	describe("NotFoundError", () => {
		it("should create not found error", () => {
			const error = new NotFoundError("Task", "/task/123");
			expect(error.statusCode).toBe(404);
			expect(error.message).toContain("Task not found");
		});
	});
});

describe("formatErrorForUser", () => {
	it("should format validation errors", () => {
		const error = new ValidationError("Invalid input", "prompt");
		const formatted = formatErrorForUser(error);
		expect(formatted).toContain("Validation Error");
		expect(formatted).toContain("prompt");
	});

	it("should format auth errors", () => {
		const error = new AuthenticationError("/me");
		const formatted = formatErrorForUser(error);
		expect(formatted).toContain("Authentication failed");
	});

	it("should format generic errors", () => {
		const error = new Error("Something went wrong");
		const formatted = formatErrorForUser(error);
		expect(formatted).toContain("Something went wrong");
	});

	it("should handle unknown errors", () => {
		const formatted = formatErrorForUser("string error");
		expect(formatted).toContain("unexpected error");
	});
});

describe("handleTemboApiError", () => {
	it("should return TemboApiError as-is", () => {
		const error = new TemboApiError("API error", 500, "/task");
		const handled = handleTemboApiError(error, "/task");
		expect(handled).toBe(error);
	});

	it("should convert 401 errors to AuthenticationError", () => {
		const error = new Error("401 Unauthorized");
		const handled = handleTemboApiError(error, "/task");
		expect(handled).toBeInstanceOf(AuthenticationError);
	});

	it("should convert 404 errors to NotFoundError", () => {
		const error = new Error("404 Not Found");
		const handled = handleTemboApiError(error, "/task");
		expect(handled).toBeInstanceOf(NotFoundError);
	});

	it("should convert 429 errors to RateLimitError", () => {
		const error = new Error("429 Rate limit exceeded");
		const handled = handleTemboApiError(error, "/task");
		expect(handled).toBeInstanceOf(RateLimitError);
	});

	it("should convert 503 errors to ServiceUnavailableError", () => {
		const error = new Error("503 Service Unavailable");
		const handled = handleTemboApiError(error, "/task");
		expect(handled).toBeInstanceOf(ServiceUnavailableError);
	});

	it("should handle unknown errors", () => {
		const handled = handleTemboApiError("unknown", "/task");
		expect(handled).toBeInstanceOf(TemboApiError);
		expect(handled.statusCode).toBe(500);
	});
});

describe("Type Guards", () => {
	it("should identify auth errors", () => {
		const error = new AuthenticationError("/me");
		expect(isAuthError(error)).toBe(true);
		expect(isAuthError(new Error("test"))).toBe(false);
	});

	it("should identify validation errors", () => {
		const error = new ValidationError("Invalid", "field");
		expect(isValidationError(error)).toBe(true);
		expect(isValidationError(new Error("test"))).toBe(false);
	});

	it("should identify Tembo API errors", () => {
		const error = new TemboApiError("API error", 500, "/task");
		expect(isTemboApiError(error)).toBe(true);
		expect(isTemboApiError(new Error("test"))).toBe(false);
	});
});
