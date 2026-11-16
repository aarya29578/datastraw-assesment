/**
 * Centralized Error Parsing and Formatting Utilities for DataStraw Frontend
 */

/**
 * Extracts a clear, user-friendly message with actionable suggestions from an API error.
 * @param {Error|Object} error
 * @param {string} defaultFallback
 * @returns {string}
 */
export function formatErrorMessage(error, defaultFallback = 'An unexpected error occurred.') {
  if (!error) return defaultFallback;

  // Handle browser network errors
  if (error.message && (error.message.includes('fetch') || error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
    return 'Unable to reach the server. Please verify your connection or check if the backend service is running.';
  }

  const rawMessage = error.message || (typeof error === 'string' ? error : defaultFallback);

  // Combine message and actionable suggestion if provided
  if (error.suggestion && typeof error.suggestion === 'string') {
    const cleanMessage = rawMessage.trim().replace(/[.]+$/, '');
    const cleanSuggestion = error.suggestion.trim();
    if (!cleanMessage.toLowerCase().includes(cleanSuggestion.toLowerCase())) {
      return `${cleanMessage}. ${cleanSuggestion}`;
    }
  }

  return rawMessage;
}

/**
 * Extracts field-level validation errors from an API error to bind to form inputs.
 * @param {Error|Object} error
 * @returns {Record<string, string>}
 */
export function extractFieldErrors(error) {
  if (!error) return {};

  const fieldErrors = {};

  // If backend provided structured validation errors
  if (error.errors && typeof error.errors === 'object') {
    Object.entries(error.errors).forEach(([field, msg]) => {
      fieldErrors[field] = typeof msg === 'string' ? msg : msg?.message || 'Invalid value';
    });
  }

  // Derive field errors from known error codes
  if (error.code) {
    switch (error.code) {
      case 'DUPLICATE_EMAIL':
        fieldErrors.email = error.message;
        break;
      case 'DUPLICATE_EMPLOYEE_CODE':
      case 'EMPLOYEE_CODE_REQUIRED':
        fieldErrors.employeeId = error.message;
        fieldErrors.employee_code = error.message;
        break;
      case 'INVALID_PHONE_FORMAT':
        fieldErrors.phone = error.message;
        break;
      case 'DUPLICATE_POD_NAME':
      case 'POD_NAME_REQUIRED':
        fieldErrors.name = error.message;
        break;
      case 'DUPLICATE_BRAND_NAME':
      case 'BRAND_NAME_REQUIRED':
        fieldErrors.name = error.message;
        break;
      case 'DUPLICATE_PROCESS_CODE':
      case 'PROCESS_CODE_REQUIRED':
        fieldErrors.code = error.message;
        break;
      case 'PROCESS_NAME_REQUIRED':
        fieldErrors.name = error.message;
        break;
      case 'INVALID_DATE_RANGE':
      case 'INVALID_LEAVE_DATES':
        fieldErrors.endDate = error.message;
        fieldErrors.effective_to = error.message;
        break;
      default:
        break;
    }
  }

  return fieldErrors;
}

export default {
  formatErrorMessage,
  extractFieldErrors,
};
