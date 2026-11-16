/**
 * Standardized API Response Utilities
 */

export const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== null && { data }),
  });
};

export const paginatedResponse = (
  res,
  data = [],
  pagination = {},
  message = 'Success',
  statusCode = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination: {
      total: pagination.total || 0,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      totalPages: pagination.totalPages || 0,
    },
  });
};

export const errorResponse = (
  res,
  message = 'An error occurred',
  statusCode = 400,
  errors = null,
  code = null,
  suggestion = null,
  details = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(code && { code }),
    ...(details && { details }),
    ...(suggestion && { suggestion }),
    ...(errors !== null && { errors }),
  });
};
