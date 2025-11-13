// Error handling utilities

export class TemboError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'TemboError';
  }
}

export class DiscordError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'DiscordError';
  }
}

export function formatErrorForUser(error: unknown): string {
  if (error instanceof TemboError) {
    return `Tembo API Error: ${error.message}`;
  }
  
  if (error instanceof DiscordError) {
    return `Discord Error: ${error.message}`;
  }
  
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  
  return 'An unexpected error occurred. Please try again later.';
}

export function isTemboAuthError(error: unknown): boolean {
  if (error instanceof TemboError && error.statusCode === 401) {
    return true;
  }
  return false;
}

export function handleTemboApiError(error: unknown): TemboError {
  if (error instanceof TemboError) {
    return error;
  }
  
  // Handle fetch errors
  if (error instanceof Error) {
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return new TemboError('Invalid Tembo API key. Please check your credentials.', 401, error);
    }
    if (error.message.includes('404')) {
      return new TemboError('Resource not found.', 404, error);
    }
    if (error.message.includes('429')) {
      return new TemboError('Rate limit exceeded. Please try again later.', 429, error);
    }
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return new TemboError('Tembo service is temporarily unavailable. Please try again later.', 503, error);
    }
    
    return new TemboError(error.message, undefined, error);
  }
  
  return new TemboError('An unexpected error occurred with the Tembo API.', undefined, error);
}

