/**
 * Phone number utilities for WhatsApp integration
 * Handles South African phone number formatting and E.164 conversion
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  e164?: string;
  error?: string;
}

/**
 * Convert South African phone numbers to E.164 format
 * Handles various input formats:
 * - 0821234567 -> +27821234567
 * - 082 123 4567 -> +27821234567
 * - +27821234567 -> +27821234567 (already E.164)
 * - 27821234567 -> +27821234567
 */
export function convertToE164(phoneNumber: string): PhoneValidationResult {
  // Clean the input - remove all non-digits except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Remove leading + for processing
  const hasPlus = cleaned.startsWith('+');
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }

  // South African country code
  const SA_COUNTRY_CODE = '27';
  
  // Validate and convert different formats
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Format: 0821234567
    // Remove the 0 and add country code
    const withoutLeadingZero = cleaned.substring(1);
    const e164 = `+${SA_COUNTRY_CODE}${withoutLeadingZero}`;
    
    if (isValidSAMobileNumber(withoutLeadingZero)) {
      return {
        isValid: true,
        formatted: formatForDisplay(e164),
        e164: e164
      };
    }
  } else if (cleaned.startsWith(SA_COUNTRY_CODE) && cleaned.length === 11) {
    // Format: 27821234567
    const e164 = `+${cleaned}`;
    const localNumber = cleaned.substring(2);
    
    if (isValidSAMobileNumber(localNumber)) {
      return {
        isValid: true,
        formatted: formatForDisplay(e164),
        e164: e164
      };
    }
  } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    // Format: 821234567 (missing leading 0)
    const e164 = `+${SA_COUNTRY_CODE}${cleaned}`;
    
    if (isValidSAMobileNumber(cleaned)) {
      return {
        isValid: true,
        formatted: formatForDisplay(e164),
        e164: e164
      };
    }
  }

  // If already in E.164 format, validate
  if (hasPlus && cleaned.startsWith(SA_COUNTRY_CODE) && cleaned.length === 11) {
    const e164 = `+${cleaned}`;
    const localNumber = cleaned.substring(2);
    
    if (isValidSAMobileNumber(localNumber)) {
      return {
        isValid: true,
        formatted: formatForDisplay(e164),
        e164: e164
      };
    }
  }

  // Invalid format
  return {
    isValid: false,
    error: getErrorMessage(phoneNumber)
  };
}

/**
 * Validate if a South African mobile number is valid
 * SA mobile numbers start with: 6, 7, 8
 */
function isValidSAMobileNumber(localNumber: string): boolean {
  if (localNumber.length !== 9) return false;
  
  // SA mobile prefixes (without country code and leading 0)
  const validPrefixes = ['6', '7', '8'];
  return validPrefixes.some(prefix => localNumber.startsWith(prefix));
}

/**
 * Format phone number for display (human-readable)
 * +27821234567 -> +27 82 123 4567
 */
export function formatForDisplay(e164: string): string {
  if (!e164.startsWith('+27') || e164.length !== 12) {
    return e164; // Return as-is if not SA format
  }
  
  const countryCode = '+27';
  const localNumber = e164.substring(3); // Remove +27
  
  // Format as: +27 82 123 4567
  return `${countryCode} ${localNumber.substring(0, 2)} ${localNumber.substring(2, 5)} ${localNumber.substring(5)}`;
}

/**
 * Get user-friendly error message for invalid phone numbers
 */
function getErrorMessage(input: string): string {
  const digitsOnly = input.replace(/\D/g, '');
  
  if (digitsOnly.length === 0) {
    return 'Please enter a phone number';
  }
  
  if (digitsOnly.length < 9) {
    return 'Phone number is too short';
  }
  
  if (digitsOnly.length > 11) {
    return 'Phone number is too long';
  }
  
  if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    const localNumber = digitsOnly.substring(1);
    if (!isValidSAMobileNumber(localNumber)) {
      return 'Invalid mobile number prefix. Must start with 06, 07, or 08';
    }
  }
  
  return 'Invalid phone number format. Use format: 082 123 4567';
}

/**
 * Auto-format phone number as user types
 * Adds spaces for readability: 082 123 4567
 */
export function formatAsUserTypes(input: string): string {
  // Remove all non-digits
  const digitsOnly = input.replace(/\D/g, '');
  
  // Don't format if starts with country code
  if (digitsOnly.startsWith('27')) {
    return input;
  }
  
  // Format SA mobile numbers with spaces
  if (digitsOnly.length <= 3) {
    return digitsOnly;
  } else if (digitsOnly.length <= 6) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3)}`;
  } else if (digitsOnly.length <= 10) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
  }
  
  // Limit to 10 digits for local format
  const truncated = digitsOnly.slice(0, 10);
  return `${truncated.slice(0, 3)} ${truncated.slice(3, 6)} ${truncated.slice(6)}`;
}

/**
 * Example phone numbers for placeholder text
 */
export const EXAMPLE_PHONE_NUMBERS = {
  local: '082 123 4567',
  e164: '+27 82 123 4567',
  withoutSpaces: '0821234567'
};

/**
 * Validate phone number and return user-friendly feedback
 */
export function validatePhoneNumber(input: string): {
  isValid: boolean;
  message?: string;
  e164?: string;
} {
  if (!input || input.trim() === '') {
    return {
      isValid: false,
      message: 'Phone number is required'
    };
  }
  
  const result = convertToE164(input);
  
  return {
    isValid: result.isValid,
    message: result.error,
    e164: result.e164
  };
}