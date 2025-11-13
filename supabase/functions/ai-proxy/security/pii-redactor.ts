/**
 * PII Redaction Service
 * 
 * Redacts personally identifiable information (PII) from text
 * before sending to AI services, per WARP.md security requirements.
 */

import type { PIIRedactionResult } from '../types.ts'

// PII redaction patterns per WARP.md
const PII_PATTERNS = [
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
  {
    name: 'phone',
    pattern: /\+27\s*\d{2}\s*\d{3}\s*\d{4}|\b0\d{9}\b/g, // South African phone numbers (with or without spaces)
  },
  {
    name: 'id_number',
    pattern: /\b\d{13}\b/g, // South African ID numbers
  },
  {
    name: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  },
]

/**
 * Redacts PII from text using configured patterns
 */
export function redactPII(text: string): PIIRedactionResult {
  let redactedText = text
  let redactionCount = 0
  const redactionsByType: Record<string, number> = {}

  PII_PATTERNS.forEach(({ name, pattern }) => {
    const matches = redactedText.match(pattern)
    if (matches) {
      const count = matches.length
      redactionCount += count
      redactionsByType[name] = count
      redactedText = redactedText.replace(pattern, '[REDACTED]')
    }
  })

  return {
    redactedText,
    redactionCount,
  }
}

/**
 * Redacts PII from complex objects (recursively)
 */
export function redactPIIFromObject(obj: any): {
  redactedObject: any
  redactionCount: number
} {
  let totalRedactions = 0

  function redactValue(value: any): any {
    if (typeof value === 'string') {
      const result = redactPII(value)
      totalRedactions += result.redactionCount
      return result.redactedText
    }
    if (Array.isArray(value)) {
      return value.map(redactValue)
    }
    if (value && typeof value === 'object') {
      const redacted: any = {}
      for (const [key, val] of Object.entries(value)) {
        redacted[key] = redactValue(val)
      }
      return redacted
    }
    return value
  }

  return {
    redactedObject: redactValue(obj),
    redactionCount: totalRedactions,
  }
}

/**
 * Check if text contains PII without redacting (for validation)
 */
export function containsPII(text: string): boolean {
  // Need to reset regex lastIndex for global patterns
  return PII_PATTERNS.some(({ pattern }) => {
    const regex = new RegExp(pattern.source, pattern.flags)
    return regex.test(text)
  })
}
