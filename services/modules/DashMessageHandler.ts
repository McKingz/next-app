/**
 * DashMessageHandler
 * 
 * Handles message text processing, normalization for speech synthesis,
 * and language detection for Dash AI Assistant.
 * 
 * Responsibilities:
 * - Text normalization for TTS (remove markdown, clean formatting)
 * - Number and date formatting for natural speech
 * - Language detection from text content
 * - Educational content normalization
 * 
 * Extracted from DashAIAssistant.ts as part of Phase 4 modularization.
 */

export type AppLanguage = 'en' | 'af' | 'zu' | 'xh' | 'nso';

/**
 * Handles message text processing and language detection
 */
export class DashMessageHandler {
  private isDisposed = false;
  
  /**
   * Normalize text for speech synthesis
   * Main entry point for text-to-speech preprocessing
   */
  public normalizeTextForSpeech(text: string): string {
    this.checkDisposed();
    let normalized = text;
    
    // CRITICAL: Remove action text in asterisks like "*opens browser*" or "*typing*"
    normalized = normalized.replace(/\*[^*]+\*/g, '');
    
    // CRITICAL: Remove standalone timestamps at the beginning of messages
    normalized = normalized.replace(/^\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[-–—]?\s*/i, '');
    
    // Remove markdown formatting
    normalized = normalized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
    normalized = normalized.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
    normalized = normalized.replace(/\*([^*]+)\*/g, '$1'); // Italic
    normalized = normalized.replace(/`([^`]+)`/g, '$1'); // Code
    
    // Handle text processing pipeline
    normalized = this.normalizeBulletPoints(normalized);
    normalized = this.normalizeNumbers(normalized);
    normalized = this.normalizeDatesAndTime(normalized);
    normalized = this.normalizeSpecialFormatting(normalized);
    normalized = this.normalizeAbbreviations(normalized);
    normalized = this.normalizeMathExpressions(normalized);
    
    // Remove emojis and special characters
    normalized = normalized
      .replace(/[\u2600-\u26FF]/g, '')
      .replace(/[\u2700-\u27BF]/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/([.!?])\s*$/, '$1')
      .trim();
    
    // Final cleanup
    normalized = this.finalizeForSpeech(normalized);
    
    return normalized;
  }
  
  /**
   * Detect language from text content (heuristic)
   */
  public detectLanguageFromText(text: string): AppLanguage {
    this.checkDisposed();
    try {
      const t = (text || '').toLowerCase();
      
      // UNIQUE markers for each language
      const uniqueMarkers = {
        xh: /\b(molo|ndiyabulela|uxolo|ewe|hayi|yintoni|ndiza|umntwana)\b/i,
        zu: /\b(sawubona|ngiyabonga|ngiyaphila|umfundi|siyakusiza|ufunde|yebo|cha|baba|umama)\b/i,
        af: /\b(hallo|asseblief|baie|goed|graag|ek|jy|nie|met|van|is|dit)\b/i,
        nso: /\b(thobela|le\s+kae|ke\s+a\s+leboga|hle|ka\s+kgopelo)\b/i,
      };
      
      // Shared words (lower priority)
      const sharedWords = {
        zuXhShared: /\b(unjani|kakhulu|enkosi)\b/i,
      };
      
      // Check unique markers first
      if (uniqueMarkers.xh.test(t)) return 'xh';
      if (uniqueMarkers.zu.test(t)) return 'zu';
      if (uniqueMarkers.af.test(t)) return 'af';
      if (uniqueMarkers.nso.test(t)) return 'nso';
      
      // Shared Nguni words → default to Zulu
      if (sharedWords.zuXhShared.test(t)) return 'zu';
      
      return 'en';
    } catch {
      return 'en';
    }
  }
  
  /**
   * Map Azure language codes to app language codes
   */
  public mapLanguageCode(azureCode: string): AppLanguage {
    this.checkDisposed();
    const mapping: Record<string, AppLanguage> = {
      'en-ZA': 'en', 'en-US': 'en', 'en': 'en',
      'af-ZA': 'af', 'af': 'af',
      'zu-ZA': 'zu', 'zu': 'zu',
      'xh-ZA': 'xh', 'xh': 'xh',
      'nso-ZA': 'nso', 'nso': 'nso',
      'st-ZA': 'nso', 'st': 'nso', // Sesotho → Sepedi
    };
    return mapping[azureCode] || 'en';
  }
  
  // ===== PRIVATE HELPER METHODS =====
  
  private normalizeBulletPoints(text: string): string {
    return text
      .replace(/^[\s]*[-•*+]\s+/gm, '')
      .replace(/\n[\s]*[-•*+]\s+/g, '\n')
      .replace(/^[\s]*(\d+)[.)\s]+/gm, '')
      .replace(/\n[\s]*(\d+)[.)\s]+/g, '\n')
      .replace(/([a-zA-Z])\s*-\s*([A-Z][a-z])/g, '$1, $2')
      .replace(/([0-9])\s*-\s*([0-9])/g, '$1 to $2')
      .replace(/\n\s*\n/g, '. ')
      .replace(/\n/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private normalizeNumbers(text: string): string {
    return text
      // South African currency
      .replace(/\bR\s*(\d{1,3}(?:,\d{3})*)(?:\.(\d{2}))?\b/g, (match, whole, cents) => {
        return this.formatSouthAfricanCurrency(whole.replace(/,/g, ''), cents);
      })
      // Large numbers with separators
      .replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (match) => {
        const number = parseInt(match.replace(/,/g, ''));
        return this.numberToWords(number);
      })
      // Decimal numbers
      .replace(/\b(\d+)\.(\d+)\b/g, (match, whole, decimal) => {
        const wholeWords = this.numberToWords(parseInt(whole));
        const decimalWords = decimal.split('').map((d: string) => this.numberToWords(parseInt(d))).join(' ');
        return `${wholeWords} point ${decimalWords}`;
      })
      // Ordinal numbers
      .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (match, num) => {
        return this.numberToOrdinal(parseInt(num));
      })
      // Regular numbers
      .replace(/\b\d+\b/g, (match) => {
        const number = parseInt(match);
        if (number > 2024 && number < 2100) {
          return this.numberToWords(number, true);
        }
        return this.numberToWords(number);
      });
  }
  
  private normalizeDatesAndTime(text: string): string {
    return text
      // ISO dates
      .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (match, year, month, day) => {
        const monthName = this.getMonthName(parseInt(month));
        const dayOrdinal = this.numberToOrdinal(parseInt(day));
        return `${monthName} ${dayOrdinal}, ${year}`;
      })
      // US dates
      .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (match, month, day, year) => {
        const monthName = this.getMonthName(parseInt(month));
        const dayOrdinal = this.numberToOrdinal(parseInt(day));
        return `${monthName} ${dayOrdinal}, ${year}`;
      })
      // Time
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (match, hour, minute) => {
        return this.timeToWords(parseInt(hour), parseInt(minute));
      });
  }
  
  private normalizeSpecialFormatting(text: string): string {
    return text
      .replace(/([a-zA-Z]+)_([a-zA-Z]+)/g, '$1 $2')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b([a-zA-Z]+)-([a-zA-Z]+)\b/g, (match, word1, word2) => {
        const compoundWords = [
          'well-known', 'up-to-date', 'state-of-the-art', 'real-time',
          'high-quality', 'low-cost', 'long-term', 'short-term',
          'user-friendly', 'self-service', 'full-time', 'part-time'
        ];
        if (compoundWords.includes(match.toLowerCase())) {
          return `${word1} ${word2}`;
        }
        return `${word1} ${word2}`;
      })
      .replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|png|gif)\b/gi, (match, ext) => {
        return ` dot ${ext.toUpperCase().split('').join(' ')}`;
      });
  }
  
  private normalizeAbbreviations(text: string): string {
    const abbreviations: Record<string, string> = {
      'Mr.': 'Mister', 'Mrs.': 'Missus', 'Dr.': 'Doctor',
      'Prof.': 'Professor', 'St.': 'Street', 'Ave.': 'Avenue',
      'Rd.': 'Road', 'Ltd.': 'Limited', 'Inc.': 'Incorporated',
      'vs.': 'versus', 'etc.': 'etcetera', 'i.e.': 'that is',
      'e.g.': 'for example', 'AI': 'A I', 'API': 'A P I',
      'URL': 'U R L', 'HTML': 'H T M L', 'CSS': 'C S S',
      'JS': 'JavaScript', 'PDF': 'P D F', 'FAQ': 'F A Q',
      'CEO': 'C E O', 'CTO': 'C T O'
    };
    
    let normalized = text;
    for (const [abbr, expansion] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'gi');
      normalized = normalized.replace(regex, expansion);
    }
    return normalized;
  }
  
  private normalizeMathExpressions(text: string): string {
    const hasMathContext = /\b(math|equation|formula|calculate|solve|problem|exercise)\b/i.test(text) ||
                          /\d+\s*[+\-*/=]\s*\d+/g.test(text) ||
                          /\b\d+\s*\/\s*\d+\b/.test(text);
    
    if (!hasMathContext) {
      return text
        .replace(/\b(\d+)\s*%/g, '$1 percent')
        .replace(/\b(\d+)\s*\/\s*(\d+)\b(?=[^a-zA-Z]|$)/g, (match, num, den) => {
          return this.fractionToWords(parseInt(num), parseInt(den));
        });
    }
    
    return text
      .replace(/\+/g, ' plus ')
      .replace(/(?<!\w)-(?=\d)/g, ' minus ')
      .replace(/\*/g, ' times ')
      .replace(/\//g, ' divided by ')
      .replace(/=/g, ' equals ')
      .replace(/%/g, ' percent ')
      .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (match, num, den) => {
        return this.fractionToWords(parseInt(num), parseInt(den));
      });
  }
  
  private finalizeForSpeech(text: string): string {
    return text
      .replace(/([^.!?])$/, '$1.')
      .replace(/\b(Mr|Mrs|Dr|Prof|St|Ave|Rd)\.$/, '$1')
      .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
      .replace(/,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .replace(/^[,.]\s*/, '')
      .trim();
  }
  
  // ===== NUMBER CONVERSION HELPERS =====
  
  private numberToWords(num: number, isYear: boolean = false): string {
    if (num === 0) return 'zero';
    
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion'];
    
    // Year handling
    if (isYear && num >= 1000 && num <= 9999) {
      const century = Math.floor(num / 100);
      const yearPart = num % 100;
      if (yearPart === 0) {
        return this.numberToWords(century) + ' hundred';
      }
      return this.numberToWords(century) + ' ' + (yearPart < 10 ? 'oh ' + this.numberToWords(yearPart) : this.numberToWords(yearPart));
    }
    
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' ' + this.numberToWords(num % 100) : '');
    
    let result = '';
    let thousandIndex = 0;
    
    while (num > 0) {
      const chunk = num % 1000;
      if (chunk !== 0) {
        const chunkWords = this.numberToWords(chunk);
        result = chunkWords + (thousands[thousandIndex] ? ' ' + thousands[thousandIndex] : '') + (result ? ' ' + result : '');
      }
      num = Math.floor(num / 1000);
      thousandIndex++;
    }
    
    return result;
  }
  
  private numberToOrdinal(num: number): string {
    const ordinals: Record<number, string> = {
      1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
      6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
      11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth',
      16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
      21: 'twenty first', 22: 'twenty second', 23: 'twenty third', 30: 'thirtieth'
    };
    
    if (ordinals[num]) return ordinals[num];
    
    if (num > 20) {
      const lastDigit = num % 10;
      const tens = Math.floor(num / 10) * 10;
      if (lastDigit === 0) {
        const tensWord = this.numberToWords(tens);
        return tensWord.slice(0, -1) + 'ieth';
      }
      return this.numberToWords(tens) + ' ' + this.numberToOrdinal(lastDigit);
    }
    
    return this.numberToWords(num) + 'th';
  }
  
  private getMonthName(month: number): string {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || 'Invalid Month';
  }
  
  private timeToWords(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    if (minute === 0) return `${this.numberToWords(displayHour)} o'clock ${period}`;
    if (minute === 15) return `quarter past ${this.numberToWords(displayHour)} ${period}`;
    if (minute === 30) return `half past ${this.numberToWords(displayHour)} ${period}`;
    if (minute === 45) {
      const nextHour = displayHour === 12 ? 1 : displayHour + 1;
      return `quarter to ${this.numberToWords(nextHour)} ${period}`;
    }
    return `${this.numberToWords(displayHour)} ${this.numberToWords(minute)} ${period}`;
  }
  
  private fractionToWords(numerator: number, denominator: number): string {
    const fractions: Record<string, string> = {
      '1/2': 'one half', '1/3': 'one third', '2/3': 'two thirds',
      '1/4': 'one quarter', '3/4': 'three quarters',
      '1/5': 'one fifth', '2/5': 'two fifths', '3/5': 'three fifths', '4/5': 'four fifths'
    };
    
    const key = `${numerator}/${denominator}`;
    if (fractions[key]) return fractions[key];
    
    const numWords = this.numberToWords(numerator);
    const denWords = this.numberToOrdinal(denominator);
    return `${numWords} ${denWords}${numerator > 1 ? 's' : ''}`;
  }
  
  private formatSouthAfricanCurrency(whole: string, cents?: string): string {
    const wholeAmount = parseInt(whole);
    let result = '';
    
    if (wholeAmount === 0) {
      result = 'zero rand';
    } else if (wholeAmount === 1) {
      result = 'one rand';
    } else {
      result = this.numberToWords(wholeAmount) + ' rand';
    }
    
    if (cents && cents !== '00') {
      const centsAmount = parseInt(cents);
      if (centsAmount > 0) {
        const centsWords = this.numberToWords(centsAmount);
        result += ` and ${centsWords} cent${centsAmount === 1 ? '' : 's'}`;
      }
    }
    
    return result;
  }
  
  /**
   * Dispose and clean up
   */
  public dispose(): void {
    console.log('[DashMessageHandler] Disposing...');
    this.isDisposed = true;
    console.log('[DashMessageHandler] Disposed');
  }
  
  private checkDisposed(): void {
    if (this.isDisposed) {
      throw new Error('[DashMessageHandler] Cannot perform operation: instance has been disposed');
    }
  }
}
