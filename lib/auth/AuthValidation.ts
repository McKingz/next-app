// 🔐 Enhanced Authentication Validation Library
// Comprehensive validation functions for all authentication fields

import { 
  ValidationResult, 
  PasswordValidation, 
  ValidationError,
  OrganizationType,
  Address 
} from '../../types/auth-enhanced';

// Common passwords list (top 100 most common passwords)
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789', 'password1',
  '1234567', '12345', 'iloveyou', '123123', 'admin', 'welcome', 
  'monkey', 'login', 'abc123', '123', '1234567890', 'dragon',
  'pass', 'master', 'hello', 'freedom', 'whatever', 'qazwsx',
  'trustno1', 'jordan', 'harley', '1234', 'robert', 'matthew',
  'jordan23', '1000', 'baseball', 'superman', 'access', 'batman',
  'tigger', 'charlie', 'alexander', 'diamond', 'football', 'august',
  'michelle', 'pepper', '11111', 'zxcvbnm', '121212', 'jordan1',
  '123qwe', 'security', 'princess', '1q2w3e', 'sunshine', 'iloveu',
  'maggie', 'starwars', 'summer', '11111111', 'asdfgh', 'computer',
  'michelle1', 'jessica', 'pepper1', 'cowboys', 'angels', 'friends',
  'mickey', 'babygirl', 'chelsea', 'jessica1', 'barbie', 'simples',
  'michelle2', 'jordan12', 'jennifer', 'butterfly', 'daniel', 'hannah',
  'lauren', 'amanda', 'loveme', 'ashley', 'nicole', 'beautiful',
  'chocolate', 'password123', 'samuel', 'lovely', 'jessica2', 'music',
  'blink182', 'linkinpark', 'michael1', 'ferrari', 'trustno1', 'aaaa',
  'peaches', 'claire', 'single', 'madison', 'andrea', 'andy',
  'grace', 'alex', 'torres', 'adriana', 'bryant', 'carlos'
]);

export class AuthValidation {
  /**
   * Validates an email address
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email || email.trim() === '') {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // Basic email regex pattern
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(trimmedEmail)) {
      errors.push('Please enter a valid email address');
    }

    if (trimmedEmail.length > 254) {
      errors.push('Email address is too long');
    }

    // Check for disposable email domains (basic list)
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
      'mailinator.com', 'throwaway.email', 'temp-mail.org'
    ];
    
    const domain = trimmedEmail.split('@')[1];
    if (domain && disposableDomains.includes(domain)) {
      errors.push('Disposable email addresses are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates password with comprehensive strength checking
   */
  static validatePassword(password: string, userInfo?: { email?: string; firstName?: string; lastName?: string }): PasswordValidation {
    const errors: string[] = [];
    const feedback: string[] = [];
    let score = 0;
    
    const requirements = {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumbers: false,
      hasSpecialChars: false,
      notCommon: true,
      noUserInfo: true
    };

    if (!password) {
      errors.push('Password is required');
      return {
        isValid: false,
        errors,
        strength: 'weak',
        score: 0,
        requirements,
        feedback: ['Password is required']
      };
    }

    // Length check
    if (password.length >= 8) {
      requirements.minLength = true;
      score += 20;
    } else {
      errors.push('Password must be at least 8 characters long');
      feedback.push('Use at least 8 characters');
    }

    if (password.length >= 12) {
      score += 10;
      feedback.push('Great length!');
    }

    // Character type checks
    if (/[A-Z]/.test(password)) {
      requirements.hasUppercase = true;
      score += 15;
    } else {
      errors.push('Password must contain at least one uppercase letter');
      feedback.push('Add uppercase letters');
    }

    if (/[a-z]/.test(password)) {
      requirements.hasLowercase = true;
      score += 15;
    } else {
      errors.push('Password must contain at least one lowercase letter');
      feedback.push('Add lowercase letters');
    }

    if (/[0-9]/.test(password)) {
      requirements.hasNumbers = true;
      score += 15;
    } else {
      errors.push('Password must contain at least one number');
      feedback.push('Add numbers');
    }

    // eslint-disable-next-line no-useless-escape
    const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    if (specialChars.test(password)) {
      requirements.hasSpecialChars = true;
      score += 15;
    } else {
      errors.push('Password must contain at least one special character');
      feedback.push('Add special characters (!@#$%^&*)');
    }

    // Common password check
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
      requirements.notCommon = false;
      errors.push('This password is too common');
      feedback.push('Avoid common passwords');
      score = Math.max(0, score - 30);
    }

    // User info check
    if (userInfo) {
      const userStrings = [
        userInfo.email?.split('@')[0]?.toLowerCase(),
        userInfo.firstName?.toLowerCase(),
        userInfo.lastName?.toLowerCase()
      ].filter(Boolean);

      const passwordLower = password.toLowerCase();
      for (const userString of userStrings) {
        if (userString && userString.length > 2 && passwordLower.includes(userString)) {
          requirements.noUserInfo = false;
          errors.push('Password should not contain your personal information');
          feedback.push('Avoid using your name or email in the password');
          score = Math.max(0, score - 20);
          break;
        }
      }
    }

    // Bonus points for complexity
    const uniqueChars = new Set(password).size;
    if (uniqueChars > password.length * 0.7) {
      score += 10;
      feedback.push('Good character variety!');
    }

    // Pattern detection (sequences, repetitions)
    const hasSequence = /012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password);
    const hasRepetition = /(.)\1{2,}/.test(password);
    
    if (hasSequence) {
      score = Math.max(0, score - 10);
      feedback.push('Avoid sequences like 123 or abc');
    }
    
    if (hasRepetition) {
      score = Math.max(0, score - 10);
      feedback.push('Avoid repeating characters like aaa');
    }

    // Determine strength
    let strength: PasswordValidation['strength'];
    if (score >= 85) {
      strength = 'excellent';
      feedback.push('Excellent password strength!');
    } else if (score >= 70) {
      strength = 'strong';
      feedback.push('Strong password!');
    } else if (score >= 50) {
      strength = 'good';
      feedback.push('Good password');
    } else if (score >= 30) {
      strength = 'fair';
      feedback.push('Password strength is fair');
    } else {
      strength = 'weak';
      feedback.push('Password is too weak');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.min(100, Math.max(0, score)),
      requirements,
      feedback
    };
  }

  /**
   * Validates a person's name
   */
  static validateName(name: string, fieldName: string = 'Name'): ValidationResult {
    const errors: string[] = [];
    
    if (!name || name.trim() === '') {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      errors.push(`${fieldName} must be at least 2 characters long`);
    }

    if (trimmedName.length > 50) {
      errors.push(`${fieldName} must be less than 50 characters long`);
    }

    // Only allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(trimmedName)) {
      errors.push(`${fieldName} can only contain letters, spaces, hyphens, and apostrophes`);
    }

    // Check for suspicious patterns
    if (/\d/.test(trimmedName)) {
      errors.push(`${fieldName} should not contain numbers`);
    }

    if (trimmedName.includes('  ')) {
      errors.push(`${fieldName} should not contain multiple consecutive spaces`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates a phone number
   */
  static validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];
    
    if (!phone || phone.trim() === '') {
      return { isValid: true, errors: [] }; // Phone is optional
    }

    const trimmedPhone = phone.trim();
    
    // Remove all non-digit characters for validation
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    
    if (digitsOnly.length < 10) {
      errors.push('Phone number must have at least 10 digits');
    }

    if (digitsOnly.length > 15) {
      errors.push('Phone number is too long');
    }

    // Check for valid phone number patterns
    // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^[\+]?[1-9][\d]{0,14}$|^[\d\s\-\(\)\+\.]{10,}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      errors.push('Please enter a valid phone number');
    }

    // Check for obviously fake numbers
    const fakePatterns = [
      /^(\d)\1+$/, // All same digit
      /^123456789/, // Sequential
      /^000000000/, // All zeros
    ];

    for (const pattern of fakePatterns) {
      if (pattern.test(digitsOnly)) {
        errors.push('Please enter a valid phone number');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates organization data
   */
  static validateOrganization(orgData: {
    name: string;
    type: OrganizationType;
    address: Address;
    phone: string;
  }): ValidationResult {
    const errors: string[] = [];

    // Organization name validation
    if (!orgData.name || orgData.name.trim() === '') {
      errors.push('Organization name is required');
    } else if (orgData.name.trim().length < 3) {
      errors.push('Organization name must be at least 3 characters long');
    } else if (orgData.name.trim().length > 100) {
      errors.push('Organization name must be less than 100 characters long');
    }

    // Organization type validation
    const validTypes: OrganizationType[] = [
      'elementary_school', 'middle_school', 'high_school', 
      'k12_school', 'university', 'training_center', 'other'
    ];
    if (!validTypes.includes(orgData.type)) {
      errors.push('Please select a valid organization type');
    }

    // Address validation
    if (!orgData.address.street || orgData.address.street.trim() === '') {
      errors.push('Street address is required');
    }

    if (!orgData.address.city || orgData.address.city.trim() === '') {
      errors.push('City is required');
    }

    if (!orgData.address.state || orgData.address.state.trim() === '') {
      errors.push('State is required');
    }

    if (!orgData.address.zipCode || orgData.address.zipCode.trim() === '') {
      errors.push('ZIP code is required');
    } else {
      // US ZIP code validation
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(orgData.address.zipCode.trim())) {
        errors.push('Please enter a valid ZIP code');
      }
    }

    if (!orgData.address.country || orgData.address.country.trim() === '') {
      errors.push('Country is required');
    }

    // Phone validation for organization
    const phoneValidation = this.validatePhone(orgData.phone);
    if (!orgData.phone || orgData.phone.trim() === '') {
      errors.push('Organization phone number is required');
    } else if (!phoneValidation.isValid) {
      errors.push(...phoneValidation.errors.map(error => `Organization ${error.toLowerCase()}`));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates age/date of birth
   */
  static validateDateOfBirth(dateOfBirth: Date): ValidationResult {
    const errors: string[] = [];
    
    if (!dateOfBirth) {
      return { isValid: true, errors: [] }; // Optional field
    }

    const now = new Date();
    const age = now.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = now.getMonth() - dateOfBirth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) {
      // Age calculation adjustment
    }

    if (dateOfBirth > now) {
      errors.push('Date of birth cannot be in the future');
    }

    if (age < 3) {
      errors.push('Student must be at least 3 years old');
    }

    if (age > 100) {
      errors.push('Please enter a valid date of birth');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates confirmation password
   */
  static validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
    const errors: string[] = [];
    
    if (!confirmPassword) {
      errors.push('Please confirm your password');
    } else if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Validates terms acceptance
   */
  static validateTermsAcceptance(accepted: boolean): ValidationResult {
    const errors: string[] = [];
    
    if (!accepted) {
      errors.push('You must accept the terms and conditions');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Formats phone number for display
   */
  static formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    
    return phone; // Return as-is if not standard format
  }

  /**
   * Validates multiple fields at once
   */
  static validateFields(data: Record<string, any>, rules: Record<string, (value: any) => ValidationResult>): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      results[field] = rule(data[field]);
    }
    
    return results;
  }

  /**
   * Checks if all validation results are valid
   */
  static allValidationsPassed(validations: Record<string, ValidationResult>): boolean {
    return Object.values(validations).every(result => result.isValid);
  }

  /**
   * Gets all errors from validation results
   */
  static getAllErrors(validations: Record<string, ValidationResult>): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    
    for (const [field, result] of Object.entries(validations)) {
      if (result.errors.length > 0) {
        errors[field] = result.errors;
      }
    }
    
    return errors;
  }

  /**
   * Real-time field validation for forms
   */
  static validateField(fieldName: string, value: any, extraData?: any): ValidationResult {
    switch (fieldName) {
      case 'email':
        return this.validateEmail(value);
      case 'password':
        return this.validatePassword(value, extraData?.userInfo);
      case 'confirmPassword':
        return this.validateConfirmPassword(extraData?.password, value);
      case 'firstName':
        return this.validateName(value, 'First name');
      case 'lastName':
        return this.validateName(value, 'Last name');
      case 'phone':
        return this.validatePhone(value);
      case 'dateOfBirth':
        return this.validateDateOfBirth(value);
      case 'acceptTerms':
        return this.validateTermsAcceptance(value);
      default:
        return { isValid: true, errors: [] };
    }
  }
}