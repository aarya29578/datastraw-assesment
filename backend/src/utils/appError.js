/**
 * Custom Application Error class
 * Allows throwing errors with specific HTTP status codes, machine-readable codes,
 * actionable suggestions, and contextual details.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, options = {}) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    if (typeof options === 'string') {
      this.code = options;
      this.details = null;
      this.suggestion = null;
      this.errors = null;
    } else if (options && typeof options === 'object') {
      this.code = options.code || null;
      this.details = options.details || null;
      this.suggestion = options.suggestion || null;
      this.errors = options.errors || null;
    } else {
      this.code = null;
      this.details = null;
      this.suggestion = null;
      this.errors = null;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}
