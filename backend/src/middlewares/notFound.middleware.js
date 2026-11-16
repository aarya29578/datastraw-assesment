/**
 * 404 Not Found Middleware
 * Intercepts requests that do not match any registered routes.
 */
export const notFoundMiddleware = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    suggestion: 'Please verify the API endpoint URL and HTTP method.',
  });
};
