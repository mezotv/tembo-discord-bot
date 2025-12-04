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
		return `❌ **Validation Error**\n${error.message}${error.field ? `\n\n**Field:** ${error.field}` : ""}`;
	}

	if (error instanceof AuthenticationError) {
		return (
			"❌ **Authentication Failed**\n\n" +
			"Your API key is invalid or expired.\n\n" +
			"**How to fix:**\n" +
			"1. Visit https://app.tembo.io/<your_workspace>/settings/api-keys\n" +
			"2. Generate a new API key\n" +
			"3. Run `/setup key:YOUR_NEW_KEY`"
		);
	}

	if (error instanceof NotFoundError) {
		return `❌ **Not Found**\n\n${error.message}\n\n**Tip:** Use \`/repositories list\` to see available resources.`;
	}

	if (error instanceof RateLimitError) {
		return (
			"⚠️ **Rate Limit Exceeded**\n\n" +
			"You've made too many requests.\n\n" +
			"**How to fix:**\n" +
			"1. Wait 1-2 minutes\n" +
			"2. Try your command again\n" +
			"3. Reduce request frequency if this persists"
		);
	}

	if (error instanceof ServiceUnavailableError) {
		return (
			"⚠️ **Service Temporarily Unavailable**\n\n" +
			"Tembo's API is experiencing issues.\n\n" +
			"**How to fix:**\n" +
			"1. Wait a few minutes\n" +
			"2. Check https://status.tembo.io for updates\n" +
			"3. Try your command again"
		);
	}

	if (error instanceof TemboApiError) {
		return `❌ **Tembo API Error**\n\n${error.message}\n\n**Need help?** Check your command parameters and try again.`;
	}

	if (error instanceof DiscordInteractionError) {
		return `❌ **Discord Error**\n\n${error.message}\n\n**Try:** Re-running the command or contact support.`;
	}

	if (error instanceof Error) {
		return `❌ **Error**\n\n${error.message}`;
	}

	return "❌ **Unexpected Error**\n\nSomething went wrong. Please try again later.";
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

// ===== Authentication & Encryption Errors =====

export class EncryptionError extends BaseError {
	constructor(message: string, originalError?: unknown) {
		super(message, 500, originalError);
		this.name = "EncryptionError";
	}
}

export class DecryptionError extends BaseError {
	constructor(message: string, originalError?: unknown) {
		super(message, 500, originalError);
		this.name = "DecryptionError";
	}
}

export class InvalidMasterKeyError extends BaseError {
	constructor(message: string) {
		super(message, 500);
		this.name = "InvalidMasterKeyError";
	}
}

export class DatabaseError extends BaseError {
	constructor(message: string, originalError?: unknown) {
		super(message, 500, originalError);
		this.name = "DatabaseError";
	}
}

export class UserNotFoundError extends BaseError {
	constructor(discordUserId: string) {
		super(`User ${discordUserId} not found in database.`, 404);
		this.name = "UserNotFoundError";
	}
}

export class UserNotAuthenticatedError extends BaseError {
	constructor(message: string = "User is not authenticated. Please register your API key using /setup.") {
		super(message, 401);
		this.name = "UserNotAuthenticatedError";
	}
}

export class DatabaseConnectionError extends DatabaseError {
	constructor(message: string = "Unable to connect to database.", originalError?: unknown) {
		super(message, originalError);
		this.name = "DatabaseConnectionError";
	}
}
