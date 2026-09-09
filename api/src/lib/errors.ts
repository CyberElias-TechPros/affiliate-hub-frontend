import type { ApiError, ErrorCode } from '../../../shared/api-contract';
import { ERROR_CODES } from '../../../shared/api-contract';

/**
 * An expected, client-safe failure. `message` is written for end users, so it
 * must never contain stack traces, SQL, or internal identifiers.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  toApiError(requestId: string): ApiError {
    return {
      code: this.code,
      message: this.message,
      requestId,
      ...(this.fields ? { fields: this.fields } : {}),
    };
  }

  static validation(message: string, fields?: Record<string, string>): HttpError {
    return new HttpError(400, ERROR_CODES.VALIDATION, message, fields);
  }

  static unauthenticated(message = 'Sign in to continue.'): HttpError {
    return new HttpError(401, ERROR_CODES.UNAUTHENTICATED, message);
  }

  static forbidden(message = 'You do not have access to that.'): HttpError {
    return new HttpError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'Not found.'): HttpError {
    return new HttpError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string): HttpError {
    return new HttpError(409, ERROR_CODES.CONFLICT, message);
  }

  static rateLimited(message = 'Too many requests. Slow down and try again.'): HttpError {
    return new HttpError(429, ERROR_CODES.RATE_LIMITED, message);
  }

  static payloadTooLarge(message = 'That file is too large.'): HttpError {
    return new HttpError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, message);
  }

  /**
   * Server-side failure. The user-facing text is deliberately generic: internal
   * detail belongs in logs, correlated by `requestId`, never in the response.
   */
  static internal(message = 'Something went wrong on our side. Please try again.'): HttpError {
    return new HttpError(500, ERROR_CODES.INTERNAL, message);
  }
}
