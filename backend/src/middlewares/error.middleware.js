/**
 * Centralized Error-Handling Middleware
 * Catches all errors forwarded via next(err) or thrown asynchronously.
 * Formats standardized, user-friendly error responses.
 */

const getDefaultErrorCode = (statusCode) => {
  switch (statusCode) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'RECORD_NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'TOO_MANY_REQUESTS';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
};

export const errorMiddleware = (err, req, res, next) => {
  const statusCode = typeof err.statusCode === 'number'
    ? err.statusCode
    : typeof err.status === 'number'
    ? err.status
    : 500;

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);

  let message = err.message || 'An unexpected internal server error occurred.';
  let code = err.code || getDefaultErrorCode(statusCode);
  let suggestion = err.suggestion || null;
  let details = err.details || null;
  let errors = err.errors || null;

  // Handle unformatted Postgres database constraints gracefully
  if (err.code === '23505') {
    code = 'DUPLICATE_RECORD';
    message = 'A record with duplicate unique details already exists.';
    suggestion = 'Please ensure all unique identifiers (such as code, name, or email) are distinct.';
  } else if (err.code === '23503') {
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Cannot complete this operation because referenced related records exist or are invalid.';
    suggestion = 'Please check associated dependencies before proceeding.';
  }

  // Never expose sensitive SQL, credentials, or internal stack traces in client response
  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(details && { details }),
    ...(suggestion && { suggestion }),
    ...(errors !== null && { errors }),
  });
};
