// 🔐 Password Policy Enforcement
// Comprehensive password security policy and enforcement

import { PasswordPolicy, PasswordValidation, ValidationResult } from '../../types/auth-enhanced';
import { AuthValidation } from './AuthValidation';

// Default password policy configuration
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
  preventRecentPasswords: 5,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'.split('')
};

// Password breach database (simplified for demo - in production use HaveIBeenPwned API)
const BREACHED_PASSWORDS = new Set([
  'password123', 'admin123', 'qwerty123', 'password!', 'welcome123',
  'letmein123', 'monkey123', 'dragon123', 'password1!', 'admin2023'
]);

// Password patterns to avoid
const DANGEROUS_PATTERNS = [
  // Sequential patterns
  /012345|123456|234567|345678|456789|567890|678901|789012|890123|901234/i,
  /abcdef|bcdefg|cdefgh|defghi|efghij|fghijk|ghijkl|hijklm|ijklmn|jklmno|klmnop|lmnopq|mnopqr|nopqrs|opqrst|pqrstu|qrstuv|rstuvw|stuvwx|tuvwxy|uvwxyz/i,
  
  // Keyboard patterns
  /qwerty|asdfgh|zxcvbn|qwertyui|asdfghjk|zxcvbnm/i,
  /qaz|wsx|edc|rfv|tgb|yhn|ujm|ik|ol|p/i,
  
  // Repetitive patterns
  /(..)\1{2,}/i, // 4+ consecutive repeated pairs
  /(.)\1{3,}/i,  // 4+ repeated characters
  
  // Common substitutions
  /p@ssw0rd|p4ssw0rd|passw0rd|l3tm31n|4dm1n|w3lc0m3/i
];

// Common personal info patterns
const PERSONAL_INFO_PATTERNS = [
  /birthday|birth|bday/i,
  /family|mom|dad|mother|father|parent/i,
  /school|college|university|edu/i,
  /address|street|city|state/i,
  /phone|mobile|cell/i
];

export class PasswordPolicyEnforcer {
  private policy: PasswordPolicy;
  private recentPasswords: Map<string, string[]>; // userId -> password hashes

  constructor(customPolicy?: Partial<PasswordPolicy>) {
    this.policy = { ...DEFAULT_PASSWORD_POLICY, ...customPolicy };
    this.recentPasswords = new Map();
  }

  /**
   * Get the current password policy
   */
  getPolicy(): PasswordPolicy {
    return { ...this.policy };
  }

  /**
   * Update password policy
   */
  updatePolicy(updates: Partial<PasswordPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Comprehensive password validation with policy enforcement
   */
  validatePassword(
    password: string, 
    userInfo?: { 
      userId?: string;
      email?: string; 
      firstName?: string; 
      lastName?: string;
      dateOfBirth?: Date;
      phone?: string;
    }
  ): PasswordValidation {
    const baseValidation = AuthValidation.validatePassword(password, userInfo);
    const policyErrors: string[] = [...baseValidation.errors];
    const policyFeedback: string[] = [...baseValidation.feedback];
    let policyScore = baseValidation.score;

    // Length policy check
    if (password.length > this.policy.maxLength) {
      policyErrors.push(`Password must be less than ${this.policy.maxLength} characters`);
      policyScore = Math.max(0, policyScore - 20);
    }

    // Breach database check
    if (this.isPasswordBreached(password)) {
      policyErrors.push('This password has been found in data breaches and is not secure');
      policyFeedback.push('This password is compromised - please choose a different one');
      policyScore = Math.max(0, policyScore - 50);
    }

    // Dangerous pattern detection
    const patternViolations = this.detectDangerousPatterns(password);
    if (patternViolations.length > 0) {
      policyErrors.push(...patternViolations);
      policyScore = Math.max(0, policyScore - (patternViolations.length * 10));
    }

    // Enhanced user info check
    if (userInfo) {
      const userInfoViolations = this.detectUserInfoInPassword(password, userInfo);
      if (userInfoViolations.length > 0) {
        policyErrors.push(...userInfoViolations);
        policyFeedback.push('Avoid using personal information in your password');
        policyScore = Math.max(0, policyScore - (userInfoViolations.length * 15));
      }
    }

    // Recent password check
    if (userInfo?.userId && this.isRecentPassword(userInfo.userId, password)) {
      policyErrors.push(`You cannot reuse any of your last ${this.policy.preventRecentPasswords} passwords`);
      policyFeedback.push('Choose a password you haven\'t used recently');
      policyScore = Math.max(0, policyScore - 25);
    }

    // Dictionary word detection
    const dictionaryScore = this.checkDictionaryWords(password);
    policyScore = Math.max(0, policyScore - dictionaryScore);
    if (dictionaryScore > 0) {
      policyFeedback.push('Consider using less common words or mix words with numbers/symbols');
    }

    // Recalculate strength based on adjusted score
    let strength: PasswordValidation['strength'];
    if (policyScore >= 85) strength = 'excellent';
    else if (policyScore >= 70) strength = 'strong';
    else if (policyScore >= 50) strength = 'good';
    else if (policyScore >= 30) strength = 'fair';
    else strength = 'weak';

    return {
      isValid: policyErrors.length === 0,
      errors: policyErrors,
      strength,
      score: policyScore,
      requirements: baseValidation.requirements,
      feedback: policyFeedback
    };
  }

  /**
   * Check if password has been found in data breaches
   */
  private isPasswordBreached(password: string): boolean {
    // In a real implementation, this would check against HaveIBeenPwned API
    // For demo purposes, using a small local set
    return BREACHED_PASSWORDS.has(password.toLowerCase());
  }

  /**
   * Detect dangerous patterns in password
   */
  private detectDangerousPatterns(password: string): string[] {
    const violations: string[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(password)) {
        if (pattern.source.includes('012345|123456')) {
          violations.push('Avoid sequential numbers like 123456');
        } else if (pattern.source.includes('abcdef|bcdefg')) {
          violations.push('Avoid sequential letters like abcdef');
        } else if (pattern.source.includes('qwerty|asdfgh')) {
          violations.push('Avoid keyboard patterns like qwerty');
        } else if (pattern.source.includes('(..)\\1{2,}')) {
          violations.push('Avoid repetitive patterns like abab');
        } else if (pattern.source.includes('(.)\\1{3,}')) {
          violations.push('Avoid repeating the same character multiple times');
        } else if (pattern.source.includes('p@ssw0rd')) {
          violations.push('Avoid common password variations with substitutions');
        }
      }
    }

    return violations;
  }

  /**
   * Detect user information in password
   */
  private detectUserInfoInPassword(password: string, userInfo: {
    email?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    phone?: string;
  }): string[] {
    const violations: string[] = [];
    const passwordLower = password.toLowerCase();

    // Check email parts
    if (userInfo.email) {
      const emailParts = userInfo.email.split('@')[0].split(/[._+-]/);
      for (const part of emailParts) {
        if (part.length > 2 && passwordLower.includes(part.toLowerCase())) {
          violations.push('Password contains parts of your email address');
          break;
        }
      }

      const domain = userInfo.email.split('@')[1]?.split('.')[0];
      if (domain && domain.length > 2 && passwordLower.includes(domain.toLowerCase())) {
        violations.push('Password contains your email domain');
      }
    }

    // Check name parts
    const nameParts = [
      userInfo.firstName,
      userInfo.lastName
    ].filter(Boolean);

    for (const name of nameParts) {
      if (name && name.length > 2 && passwordLower.includes(name.toLowerCase())) {
        violations.push('Password contains your name');
        break;
      }
    }

    // Check date of birth
    if (userInfo.dateOfBirth) {
      const year = userInfo.dateOfBirth.getFullYear().toString();
      const month = (userInfo.dateOfBirth.getMonth() + 1).toString().padStart(2, '0');
      const day = userInfo.dateOfBirth.getDate().toString().padStart(2, '0');

      if (password.includes(year)) {
        violations.push('Password contains your birth year');
      }
      if (password.includes(month + day) || password.includes(day + month)) {
        violations.push('Password contains your birth date');
      }
    }

    // Check phone number
    if (userInfo.phone) {
      const digits = userInfo.phone.replace(/\D/g, '');
      const lastFour = digits.slice(-4);
      const firstThree = digits.slice(0, 3);
      
      if (lastFour.length === 4 && password.includes(lastFour)) {
        violations.push('Password contains part of your phone number');
      }
      if (firstThree.length === 3 && password.includes(firstThree)) {
        violations.push('Password contains part of your phone number');
      }
    }

    // Check personal info patterns
    for (const pattern of PERSONAL_INFO_PATTERNS) {
      if (pattern.test(passwordLower)) {
        violations.push('Password contains common personal information terms');
        break;
      }
    }

    return violations;
  }

  /**
   * Check if password was used recently
   */
  private isRecentPassword(userId: string, password: string): boolean {
    const userPasswords = this.recentPasswords.get(userId);
    if (!userPasswords) return false;

    // In a real implementation, passwords would be hashed
    const passwordHash = this.hashPassword(password);
    return userPasswords.includes(passwordHash);
  }

  /**
   * Record a new password (when successfully changed)
   */
  recordPassword(userId: string, password: string): void {
    const passwordHash = this.hashPassword(password);
    const userPasswords = this.recentPasswords.get(userId) || [];
    
    // Add new password and maintain limit
    userPasswords.unshift(passwordHash);
    if (userPasswords.length > this.policy.preventRecentPasswords) {
      userPasswords.pop();
    }
    
    this.recentPasswords.set(userId, userPasswords);
  }

  /**
   * Check for dictionary words (simplified implementation)
   */
  private checkDictionaryWords(password: string): number {
    // Common dictionary words that reduce password strength
    const commonWords = [
      'password', 'admin', 'user', 'login', 'welcome', 'hello', 'world',
      'computer', 'internet', 'website', 'email', 'phone', 'mobile',
      'school', 'student', 'teacher', 'education', 'learning', 'study',
      'family', 'friend', 'love', 'happy', 'good', 'best', 'great',
      'home', 'work', 'office', 'business', 'company', 'team',
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];

    let penalty = 0;
    const passwordLower = password.toLowerCase();
    
    for (const word of commonWords) {
      if (passwordLower.includes(word)) {
        penalty += Math.max(5, word.length); // Penalty based on word length
      }
    }

    return Math.min(30, penalty); // Cap penalty at 30 points
  }

  /**
   * Simple password hashing for demo (use proper hashing in production)
   */
  private hashPassword(password: string): string {
    // In production, use bcrypt, scrypt, or Argon2
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Generate password strength requirements text
   */
  generateRequirementsText(): string[] {
    const requirements: string[] = [];
    
    requirements.push(`At least ${this.policy.minLength} characters long`);
    
    if (this.policy.requireUppercase) {
      requirements.push('At least one uppercase letter (A-Z)');
    }
    
    if (this.policy.requireLowercase) {
      requirements.push('At least one lowercase letter (a-z)');
    }
    
    if (this.policy.requireNumbers) {
      requirements.push('At least one number (0-9)');
    }
    
    if (this.policy.requireSpecialChars) {
      requirements.push(`At least one special character (${this.policy.specialChars})`);
    }
    
    if (this.policy.preventCommonPasswords) {
      requirements.push('Cannot be a commonly used password');
    }
    
    if (this.policy.preventUserInfoInPassword) {
      requirements.push('Cannot contain your personal information');
    }
    
    if (this.policy.preventRecentPasswords > 0) {
      requirements.push(`Cannot be one of your last ${this.policy.preventRecentPasswords} passwords`);
    }

    requirements.push('Should not appear in known data breaches');
    requirements.push('Avoid keyboard patterns and repetitive sequences');

    return requirements;
  }

  /**
   * Get password strength color for UI
   */
  getStrengthColor(strength: PasswordValidation['strength']): string {
    switch (strength) {
      case 'excellent': return '#10B981'; // Green-500
      case 'strong': return '#059669';    // Green-600
      case 'good': return '#F59E0B';      // Amber-500
      case 'fair': return '#F97316';      // Orange-500
      case 'weak': return '#EF4444';      // Red-500
      default: return '#9CA3AF';          // Gray-400
    }
  }

  /**
   * Generate password suggestions based on validation results
   */
  generatePasswordSuggestions(currentPassword: string, validation: PasswordValidation): string[] {
    const suggestions: string[] = [];

    if (!validation.requirements.minLength) {
      suggestions.push('Make your password longer - add more characters');
    }

    if (!validation.requirements.hasUppercase) {
      suggestions.push('Add some uppercase letters (A-Z)');
    }

    if (!validation.requirements.hasLowercase) {
      suggestions.push('Add some lowercase letters (a-z)');
    }

    if (!validation.requirements.hasNumbers) {
      suggestions.push('Include some numbers (0-9)');
    }

    if (!validation.requirements.hasSpecialChars) {
      suggestions.push('Add special characters like !@#$%^&*');
    }

    if (!validation.requirements.notCommon) {
      suggestions.push('Create a more unique password - avoid common passwords');
    }

    if (!validation.requirements.noUserInfo) {
      suggestions.push('Remove personal information from your password');
    }

    if (validation.strength === 'weak' || validation.strength === 'fair') {
      suggestions.push('Consider using a passphrase - multiple words with numbers and symbols');
      suggestions.push('Try combining unrelated words with numbers and special characters');
    }

    return suggestions;
  }

  /**
   * Validate password policy compliance for administrative review
   */
  auditPasswordCompliance(passwords: { userId: string; password: string; userInfo: any }[]): {
    compliant: number;
    nonCompliant: number;
    issues: Array<{ userId: string; issues: string[] }>;
  } {
    let compliant = 0;
    let nonCompliant = 0;
    const issues: Array<{ userId: string; issues: string[] }> = [];

    for (const { userId, password, userInfo } of passwords) {
      const validation = this.validatePassword(password, userInfo);
      
      if (validation.isValid) {
        compliant++;
      } else {
        nonCompliant++;
        issues.push({
          userId,
          issues: validation.errors
        });
      }
    }

    return { compliant, nonCompliant, issues };
  }
}

// Export a default instance
export const passwordPolicyEnforcer = new PasswordPolicyEnforcer();

// Export validation utilities
export const PasswordUtils = {
  /**
   * Generate a secure password that meets policy requirements
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Ensure at least one character from each required set
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  /**
   * Calculate password entropy (bits of randomness)
   */
  calculateEntropy(password: string): number {
    const charset = new Set(password).size;
    return Math.log2(Math.pow(charset, password.length));
  },

  /**
   * Estimate time to crack password
   */
  estimateCrackTime(password: string, guessesPerSecond: number = 1000000000): string {
    const entropy = PasswordUtils.calculateEntropy(password);
    const possibleCombinations = Math.pow(2, entropy);
    const secondsToHalf = possibleCombinations / (2 * guessesPerSecond);
    
    if (secondsToHalf < 60) return 'Less than a minute';
    if (secondsToHalf < 3600) return `${Math.round(secondsToHalf / 60)} minutes`;
    if (secondsToHalf < 86400) return `${Math.round(secondsToHalf / 3600)} hours`;
    if (secondsToHalf < 31536000) return `${Math.round(secondsToHalf / 86400)} days`;
    if (secondsToHalf < 315360000) return `${Math.round(secondsToHalf / 31536000)} years`;
    
    return 'Centuries';
  }
};