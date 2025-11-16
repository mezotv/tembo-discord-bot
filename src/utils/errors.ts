// Structured error types

/**
 * Base error class for all custom errors
 */
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for invalid user input
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

/**
 * Tembo API errors
 */
export class TemboApiError extends BaseError {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    originalError?: unknown
  ) {
    super(message, statusCode, originalError);
    this.name = 'TemboApiError';
  }
}

/**
 * Discord interaction errors
 */
export class DiscordInteractionError extends BaseError {
  constructor(
    message: string,
    public readonly interactionId?: string
  ) {
    super(message, 500);
    this.name = 'DiscordInteractionError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends TemboApiError {
  constructor(endpoint: string, originalError?: unknown) {
    super('Invalid API credentials. Please check your API key.', 401, endpoint, originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends TemboApiError {
  constructor(resource: string, endpoint: string, originalError?: unknown) {
    super(`${resource} not found.`, 404, endpoint, originalError);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends TemboApiError {
  constructor(endpoint: string, originalError?: unknown) {
    super('Rate limit exceeded. Please try again later.', 429, endpoint, originalError);
    this.name = 'RateLimitError';
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends TemboApiError {
  constructor(endpoint: string, originalError?: unknown) {
    super('Service is temporarily unavailable. Please try again later.', 503, endpoint, originalError);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Format error for user-facing messages
 */
export function formatErrorForUser(error: unknown): string {
  if (error instanceof ValidationError) {
    return `Validation Error: ${error.message}${error.field ? ` (field: ${error.field})` : ''}`;
  }

  if (error instanceof AuthenticationError) {
    return 'Authentication failed. Please check your Tembo API key.';
  }

  if (error instanceof NotFoundError) {
    return error.message;
  }

  if (error instanceof RateLimitError) {
    return 'Rate limit exceeded. Please try again in a few moments.';
  }

  if (error instanceof ServiceUnavailableError) {
    return 'Tembo service is temporarily unavailable. Please try again later.';
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

  return 'An unexpected error occurred. Please try again later.';
}

/**
 * Handle Tembo API errors and convert them to appropriate error types
 */
export function handleTemboApiError(error: unknown, endpoint: string): TemboApiError {
  // If it's already a TemboApiError, return as-is
  if (error instanceof TemboApiError) {
    return error;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('401') || message.includes('unauthorized')) {
      return new AuthenticationError(endpoint, error);
    }

    if (message.includes('404') || message.includes('not found')) {
      return new NotFoundError('Resource', endpoint, error);
    }

    if (message.includes('429') || message.includes('rate limit')) {
      return new RateLimitError(endpoint, error);
    }

    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('unavailable')) {
      return new ServiceUnavailableError(endpoint, error);
    }

    // Generic API error
    return new TemboApiError(error.message, 500, endpoint, error);
  }

  // Unknown error type
  return new TemboApiError('An unexpected error occurred with the Tembo API.', 500, endpoint, error);
}

/**
 * Type guard for checking if error is a Tembo auth error
 */
export function isAuthError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard for checking if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard for checking if error is a Tembo API error
 */
export function isTemboApiError(error: unknown): error is TemboApiError {
  return error instanceof TemboApiError;
}
