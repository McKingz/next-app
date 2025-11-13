import i18n from '../i18n';

/**
 * i18n Integration for Security Middleware
 * 
 * Provides localized error messages for security validation,
 * authentication, and authorization failures.
 */

/**
 * Get localized security error message
 */
export function getSecurityMessage(
  key: string, 
  options?: { 
    lng?: string;
    [key: string]: string | number | undefined;
  }
): string {
  const fullKey = `errors.security.${key}`;
  
  // Check if translation exists
  if (i18n.exists(fullKey)) {
    return i18n.t(fullKey, options);
  }
  
  // Fallback to English or generic message
  return getFallbackSecurityMessage(key, options);
}

/**
 * Fallback security messages in case translations are missing
 */
function getFallbackSecurityMessage(
  key: string, 
  options?: { [key: string]: string | number | undefined }
): string {
  const fallbacks: Record<string, string> = {
    validation_failed: 'Validation failed',
    content_type_required: 'Content-Type must be application/json',
    request_too_large: options?.maxSize 
      ? `Request too large. Maximum size is ${options.maxSize} KB`
      : 'Request too large',
    invalid_json: 'Invalid JSON in request body',
    invalid_parameters: 'Invalid URL parameters',
    invalid_query: 'Invalid query parameters',
    authentication_required: 'Authentication required',
    invalid_token: 'Invalid or expired authentication token',
    insufficient_permissions: 'Insufficient permissions',
    rate_limit_exceeded: 'Too many requests, please try again later',
    login_attempts_exceeded: 'Too many login attempts. Please try again later.',
    account_locked: options?.minutes 
      ? `Account temporarily locked due to too many failed login attempts. Try again in ${options.minutes} minutes.`
      : 'Account temporarily locked due to too many failed login attempts.',
    internal_security_error: 'Internal security error',
  };
  
  return fallbacks[key] || 'Security error occurred';
}

/**
 * Get localized validation field error message
 */
export function getValidationFieldMessage(
  field: string,
  error: string,
  options?: { lng?: string }
): string {
  // Try to get field-specific error message
  const fieldKey = `validation.fields.${field}.${error}`;
  if (i18n.exists(fieldKey)) {
    return i18n.t(fieldKey, options);
  }
  
  // Try generic validation error
  const genericKey = `validation.errors.${error}`;
  if (i18n.exists(genericKey)) {
    return i18n.t(genericKey, options);
  }
  
  // Fallback to the original error message
  return error;
}

/**
 * Get localized rate limit message with timing information
 */
export function getRateLimitMessage(
  retryAfter?: number,
  resetTime?: number,
  options?: { lng?: string }
): string {
  const baseMessage = getSecurityMessage('rate_limit_exceeded', options);
  
  if (retryAfter && retryAfter > 0) {
    const minutes = Math.ceil(retryAfter / 60);
    const seconds = retryAfter % 60;
    
    if (minutes > 1) {
      return `${baseMessage} Try again in ${minutes} minutes.`;
    } else if (seconds > 0) {
      return `${baseMessage} Try again in ${seconds} seconds.`;
    }
  }
  
  return baseMessage;
}

/**
 * Get localized login attempt lockout message
 */
export function getLoginLockoutMessage(
  lockoutExpiry?: number,
  options?: { lng?: string }
): string {
  if (lockoutExpiry) {
    const minutes = Math.ceil((lockoutExpiry - Date.now()) / (60 * 1000));
    return getSecurityMessage('account_locked', { 
      ...options, 
      minutes: minutes > 0 ? minutes : 1 
    });
  }
  
  return getSecurityMessage('login_attempts_exceeded', options);
}

/**
 * Get user's preferred language for error messages
 */
export function getUserLanguage(request?: Request): string {
  if (!request) return i18n.language;
  
  // Try to get language from Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().toLowerCase());
    
    // Find first supported language
    for (const lang of languages) {
      if (Array.isArray(i18n.options.supportedLngs) && i18n.options.supportedLngs.includes(lang)) {
        return lang;
      }
      
      // Try language without region (e.g., 'en' from 'en-US')
      const baseLang = lang.split('-')[0];
      if (Array.isArray(i18n.options.supportedLngs) && i18n.options.supportedLngs.includes(baseLang)) {
        return baseLang;
      }
    }
  }
  
  return i18n.language;
}

/**
 * Security message keys for TypeScript autocompletion
 */
export const SECURITY_MESSAGE_KEYS = {
  VALIDATION_FAILED: 'validation_failed',
  CONTENT_TYPE_REQUIRED: 'content_type_required',
  REQUEST_TOO_LARGE: 'request_too_large',
  INVALID_JSON: 'invalid_json',
  INVALID_PARAMETERS: 'invalid_parameters',
  INVALID_QUERY: 'invalid_query',
  AUTHENTICATION_REQUIRED: 'authentication_required',
  INVALID_TOKEN: 'invalid_token',
  INSUFFICIENT_PERMISSIONS: 'insufficient_permissions',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  LOGIN_ATTEMPTS_EXCEEDED: 'login_attempts_exceeded',
  ACCOUNT_LOCKED: 'account_locked',
  INTERNAL_SECURITY_ERROR: 'internal_security_error',
} as const;