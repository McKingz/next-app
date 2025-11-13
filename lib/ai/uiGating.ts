/**
 * UI gating helpers for component-level decisions.
 * Pure functions so they can be easily tested.
 */

import type { Tier } from './capabilities';
import { hasCapability } from './capabilities';

export type AttachmentKind = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'other';

export function canAttach(tier: Tier, kinds: AttachmentKind[]): {
  ok: boolean;
  missing: string[]; // capability ids
} {
  const missing: string[] = [];
  const needsDocs = kinds.some(k => ['pdf', 'document', 'spreadsheet', 'presentation'].includes(k));
  const needsImages = kinds.some(k => k === 'image');

  if (needsDocs && !hasCapability(tier, 'multimodal.documents')) missing.push('multimodal.documents');
  if (needsImages && !hasCapability(tier, 'multimodal.vision')) missing.push('multimodal.vision');

  return { ok: missing.length === 0, missing };
}

export function canSearchHistory(tier: Tier): boolean {
  // Basic (Starter) and above
  return hasCapability(tier, 'memory.standard');
}
