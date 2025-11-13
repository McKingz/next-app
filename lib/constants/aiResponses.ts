/**
 * AI Response Templates for Dash
 * 
 * Provides varied, context-aware response templates to avoid repetitive,
 * robotic interactions. Templates support variable interpolation.
 */

export interface ResponseTemplate {
  greetNewSession: string[];
  ackFollowUp: string[];
  clarify: string[];
  thanks: string[];
  confirm: string[];
  transition: string[];
  shortSpeechVariants: string[];
  error: string[];
}

/**
 * Response templates with South African English tone
 * Professional yet friendly, avoiding excessive formality
 */
export const responses: ResponseTemplate = {
  // Only used once per session when user first engages
  greetNewSession: [
    "Hi {firstName}, how can I help today?",
    "Hello {firstName}! What would you like to do?",
    "Hey {firstName}, I'm ready to assist.",
    "Good {timeOfDay} {firstName}! What can I do for you?",
  ],
  
  // Short acknowledgments for continuing conversation
  ackFollowUp: [
    "Got it.",
    "Okay, I'm on it.",
    "Sure thing.",
    "Noted.",
    "Right, let me help with that.",
    "Understood.",
    "Yep, working on it.",
  ],
  
  // When user input is ambiguous
  clarify: [
    "Could you clarify what you mean by '{topic}'?",
    "I might have missed that—do you mean '{topic}'?",
    "Just to confirm, you're asking about '{topic}'?",
    "Can you tell me more about '{topic}'?",
  ],
  
  // User says thank you
  thanks: [
    "You're welcome!",
    "Anytime!",
    "Happy to help!",
    "My pleasure!",
    "Glad I could help!",
  ],
  
  // User confirms with yes/ok/sure
  confirm: [
    "Done.",
    "All set.",
    "Perfect.",
    "Great, done.",
    "Sorted.",
  ],
  
  // Transitional phrases when moving topics
  transition: [
    "Let's move on to that.",
    "Right, next up:",
    "Okay, here's what I found:",
    "Here's what I've got:",
  ],
  
  // Super concise for speech mode
  shortSpeechVariants: [
    "On it.",
    "Yup.",
    "Okay.",
    "Sure.",
    "Got it.",
    "Done.",
  ],
  
  // Error fallbacks
  error: [
    "Sorry, I had trouble with that. Can you try again?",
    "Hmm, something went wrong. Mind rephrasing?",
    "I couldn't process that. Could you rephrase?",
  ],
};

/**
 * Interpolate variables in template strings
 * Example: "Hi {firstName}" with {firstName: "John"} => "Hi John"
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] || match;
  });
}

/**
 * Get time of day greeting (morning, afternoon, evening)
 */
export function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Simple hash for deduplication
 * Normalizes text and creates a basic hash
 */
export function simpleHash(text: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Simple djb2 hash
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
  }
  return hash.toString(36);
}

/**
 * Detect user intent from message
 */
export type UserIntent = 'greeting' | 'thanks' | 'confirm' | 'question' | 'request' | 'other';

export function detectIntent(message: string): UserIntent {
  const lower = message.toLowerCase().trim();
  
  // Greetings
  if (/^(hi|hello|hey|howzit|good morning|good afternoon|good evening|morning|afternoon|evening)/.test(lower)) {
    return 'greeting';
  }
  
  // Thanks
  if (/^(thanks|thank you|thx|appreciate|cheers)/.test(lower)) {
    return 'thanks';
  }
  
  // Confirmation
  if (/^(ok|okay|yes|yep|yup|sure|alright|got it|understood|cool|fine)$/.test(lower)) {
    return 'confirm';
  }
  
  // Question (starts with question words or ends with ?)
  if (/^(what|when|where|who|why|how|can|could|would|is|are|do|does)\b/.test(lower) || lower.endsWith('?')) {
    return 'question';
  }
  
  // Request (imperative verbs)
  if (/^(create|generate|make|build|show|find|search|help|tell|give|send)/.test(lower)) {
    return 'request';
  }
  
  return 'other';
}

/**
 * Strip common AI disclaimers and verbose patterns
 * Used for speech mode to keep responses concise
 */
export function stripDisclaimers(text: string): string {
  const patterns = [
    /^As an AI(?: assistant| teaching assistant)?,?\s*/i,
    /^As a(?: language model| AI)?,?\s*/i,
    /^I('m| am) an AI(?: assistant| teaching assistant| model)?,?\s*/i,
    /\bI('m| am) here to help\.?/i,
    /\bFeel free to ask\.?/i,
    /\bLet me know if (?:you need|you'd like|there's) (?:anything|something) else\.?/i,
    /\bIs there anything else I can help (?:you )?with\??/i,
  ];
  
  let cleaned = text;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  
  return cleaned;
}

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string | undefined | null): string | null {
  if (!fullName || typeof fullName !== 'string') return null;
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || null;
}
