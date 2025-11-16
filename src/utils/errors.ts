export abstract class BaseError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly originalError?: unknown,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ValidationError extends BaseError {
	constructor(
		message: string,
		public readonly field?: string,
	) {
		super(message, 400);
		this.name = "ValidationError";
	}
}

export class TemboApiError extends BaseError {
	constructor(
		message: string,
		public readonly statusCode: number,
		public readonly endpoint: string,
		originalError?: unknown,
	) {
		super(message, statusCode, originalError);
		this.name = "TemboApiError";
	}
}

export class DiscordInteractionError extends BaseError {
	constructor(
		message: string,
		public readonly interactionId?: string,
	) {
		super(message, 500);
		this.name = "DiscordInteractionError";
	}
}

export class AuthenticationError extends TemboApiError {
	constructor(endpoint: string, originalError?: unknown) {
		super(
			"Invalid API credentials. Please check your API key.",
			401,
			endpoint,
			originalError,
		);
		this.name = "AuthenticationError";
	}
}

export class NotFoundError extends TemboApiError {
	constructor(resource: string, endpoint: string, originalError?: unknown) {
		super(`${resource} not found.`, 404, endpoint, originalError);
		this.name = "NotFoundError";
	}
}

export class RateLimitError extends TemboApiError {
	constructor(endpoint: string, originalError?: unknown) {
		super(
			"Rate limit exceeded. Please try again later.",
			429,
			endpoint,
			originalError,
		);
		this.name = "RateLimitError";
	}
}

export class ServiceUnavailableError extends TemboApiError {
	constructor(endpoint: string, originalError?: unknown) {
		super(
			"Service is temporarily unavailable. Please try again later.",
			503,
			endpoint,
			originalError,
		);
		this.name = "ServiceUnavailableError";
	}
}

export function formatErrorForUser(error: unknown): string {
	if (error instanceof ValidationError) {
		return `Validation Error: ${error.message}${error.field ? ` (field: ${error.field})` : ""}`;
	}

	if (error instanceof AuthenticationError) {
		return "Authentication failed. Please check your Tembo API key.";
	}

	if (error instanceof NotFoundError) {
		return error.message;
	}

	if (error instanceof RateLimitError) {
		return "Rate limit exceeded. Please try again in a few moments.";
	}

	if (error instanceof ServiceUnavailableError) {
		return "Tembo service is temporarily unavailable. Please try again later.";
	}

	if (error instanceof TemboApiError) {
		return `Tembo API Error: ${error.message}`;
	}

	if (error instanceof DiscordInteractionError) {
		return `Discord Error: ${error.message}`;
	}

	if (error instanceof Error) {
		return `Error: ${error.message}`;
	}

	return "An unexpected error occurred. Please try again later.";
}

export function handleTemboApiError(
	error: unknown,
	endpoint: string,
): TemboApiError {
	if (error instanceof TemboApiError) {
		return error;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		if (message.includes("401") || message.includes("unauthorized")) {
			return new AuthenticationError(endpoint, error);
		}

		if (message.includes("404") || message.includes("not found")) {
			return new NotFoundError("Resource", endpoint, error);
		}

		if (message.includes("429") || message.includes("rate limit")) {
			return new RateLimitError(endpoint, error);
		}

		if (
			message.includes("500") ||
			message.includes("502") ||
			message.includes("503") ||
			message.includes("unavailable")
		) {
			return new ServiceUnavailableError(endpoint, error);
		}

		return new TemboApiError(error.message, 500, endpoint, error);
	}

	return new TemboApiError(
		"An unexpected error occurred with the Tembo API.",
		500,
		endpoint,
		error,
	);
}

export function isAuthError(error: unknown): error is AuthenticationError {
	return error instanceof AuthenticationError;
}

export function isValidationError(error: unknown): error is ValidationError {
	return error instanceof ValidationError;
}

export function isTemboApiError(error: unknown): error is TemboApiError {
	return error instanceof TemboApiError;
}
