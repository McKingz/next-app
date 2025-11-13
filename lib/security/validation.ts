import { z } from 'zod';
import { createSecureErrorResponse } from './middleware';
import { getSecurityMessage, getUserLanguage, SECURITY_MESSAGE_KEYS } from '../i18n/securityMessages';

/**
 * Request validation middleware using Zod schemas
 * Provides type-safe validation for all API requests
 */

/**
 * Type definition for request validation context
 */
export interface ValidationContext {
  request: Request;
  params?: Record<string, string>;
  origin?: string;
  environment?: string;
}

/**
 * Validate request body against a Zod schema
 */
export async function validateRequestBody<T>(
  context: ValidationContext,
  schema: z.ZodType<T>,
  options: {
    stripUnknown?: boolean;
    maxSize?: number;
  } = {}
): Promise<{ valid: true; data: T } | { valid: false; response: Response }> {
  const { request, origin, environment } = context;
  const { stripUnknown = true, maxSize = 1024 * 1024 } = options;

  // Check content type for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const userLanguage = getUserLanguage(request);
      return {
        valid: false,
        response: createSecureErrorResponse(
          getSecurityMessage(SECURITY_MESSAGE_KEYS.CONTENT_TYPE_REQUIRED, { lng: userLanguage }),
          415,
          origin,
          environment
        ),
      };
    }
  }

  // Check request size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    const userLanguage = getUserLanguage(request);
    return {
      valid: false,
      response: createSecureErrorResponse(
        getSecurityMessage(SECURITY_MESSAGE_KEYS.REQUEST_TOO_LARGE, { 
          lng: userLanguage,
          maxSize: Math.floor(maxSize / 1024)
        }),
        413,
        origin,
        environment
      ),
    };
  }

  // For GET/DELETE requests, no body validation needed
  if (['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return { valid: true, data: {} as T };
  }

  try {
    // Parse request body
    const body = await request.json();
    
    // Validate against schema
    const result = stripUnknown 
      ? (schema as any).strip().safeParse(body) 
      : schema.safeParse(body);
    
    if (!result.success) {
      // Format validation errors
      const formattedErrors = formatZodErrors(result.error);
      
      return {
        valid: false,
        response: createSecureErrorResponse(
          {
            message: 'Validation failed',
            errors: formattedErrors,
          },
          400,
          origin,
          environment
        ),
      };
    }
    
    return { valid: true, data: result.data };
  } catch (error) {
    console.error('Error parsing request body:', error);
    
    const userLanguage = getUserLanguage(request);
    return {
      valid: false,
      response: createSecureErrorResponse(
        getSecurityMessage(SECURITY_MESSAGE_KEYS.INVALID_JSON, { lng: userLanguage }),
        400,
        origin,
        environment
      ),
    };
  }
}

/**
 * Validate URL parameters against a Zod schema
 */
export function validateParams<T>(
  context: ValidationContext,
  schema: z.ZodType<T>
): { valid: true; data: T } | { valid: false; response: Response } {
  const { params, origin, environment } = context;
  
  if (!params) {
    return {
      valid: false,
      response: createSecureErrorResponse(
        'No URL parameters provided',
        400,
        origin,
        environment
      ),
    };
  }

  const result = schema.safeParse(params);
  
  if (!result.success) {
    const formattedErrors = formatZodErrors(result.error);
    
    return {
      valid: false,
      response: createSecureErrorResponse(
        {
          message: 'Invalid URL parameters',
          errors: formattedErrors,
        },
        400,
        origin,
        environment
      ),
    };
  }
  
  return { valid: true, data: result.data };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  context: ValidationContext,
  schema: z.ZodType<T>
): { valid: true; data: T } | { valid: false; response: Response } {
  const { request, origin, environment } = context;
  
  const url = new URL(request.url);
  const queryParams: Record<string, string> = {};
  
  // Convert URLSearchParams to plain object
  url.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const result = schema.safeParse(queryParams);
  
  if (!result.success) {
    const formattedErrors = formatZodErrors(result.error);
    
    return {
      valid: false,
      response: createSecureErrorResponse(
        {
          message: 'Invalid query parameters',
          errors: formattedErrors,
        },
        400,
        origin,
        environment
      ),
    };
  }
  
  return { valid: true, data: result.data };
}

/**
 * Format Zod validation errors into a more user-friendly format
 */
function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  
  error.issues.forEach((err: any) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });
  
  return errors;
}

/**
 * Common validation schemas for reuse across endpoints
 */
export const ValidationSchemas = {
  /**
   * Login credentials validation
   */
  login: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
  
  /**
   * Registration validation with strong password requirements
   */
  register: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^a-zA-Z0-9]/, 'Password must include a symbol'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
  }),
  
  /**
   * Pagination parameters
   */
  pagination: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val >= 1, { message: 'Page must be at least 1' }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .refine((val) => val >= 1 && val <= 100, {
        message: 'Limit must be between 1 and 100',
      }),
  }),
  
  /**
   * Course ID parameter
   */
  courseId: z.object({
    courseId: z.string().uuid('Course ID must be a valid UUID'),
  }),
  
  /**
   * Assignment ID parameter
   */
  assignmentId: z.object({
    assignmentId: z.string().uuid('Assignment ID must be a valid UUID'),
  }),

  /**
   * Course creation schema
   */
  courseCreate: z.object({
    title: z.string().min(3, 'Title must be at least 3 characters'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    subject: z.string().min(2, 'Subject is required'),
    grade_level: z.string().min(1, 'Grade level is required'),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  
  /**
   * Course enrollment schema
   */
  courseEnroll: z.object({
    join_code: z.string().min(6, 'Valid join code is required'),
  }),
};

/**
 * Helper to create a validation middleware function
 */
export function createValidation<T>(schema: z.ZodType<T>, options?: {
  stripUnknown?: boolean;
  maxSize?: number;
}) {
  return async (context: ValidationContext) => {
    return validateRequestBody(context, schema, options);
  };
}

/**
 * Predefined validation middlewares for common operations
 */
export const Validators = {
  login: createValidation(ValidationSchemas.login),
  register: createValidation(ValidationSchemas.register),
  courseCreate: createValidation(ValidationSchemas.courseCreate),
  courseEnroll: createValidation(ValidationSchemas.courseEnroll),
};