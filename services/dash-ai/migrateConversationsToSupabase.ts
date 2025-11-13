/**
 * migrateConversationsToSupabase
 * 
 * One-time migration utility to move existing AsyncStorage conversations to Supabase.
 * Ensures proper tenant isolation by assigning preschool_id from user profile.
 * 
 * Usage:
 * - Call from app initialization after DashAI is ready
 * - Runs once per user (tracked via migration flag in AsyncStorage)
 * - Safely handles partial failures and idempotent retries
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import type { DashConversation } from './types';

const MIGRATION_FLAG_KEY = '@dash_conversations_migrated_to_supabase';
const OLD_CONVERSATIONS_PREFIX = 'dash_conversations_';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Check if migration has already been completed
 */
async function isMigrationCompleted(): Promise<boolean> {
  try {
    const flag = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    return flag === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark migration as completed
 */
async function markMigrationCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch (error) {
    console.error('[Migration] Failed to mark migration completed:', error);
  }
}

/**
 * Get all old conversation keys from AsyncStorage
 */
async function getOldConversationKeys(): Promise<string[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter((k) => k.startsWith(OLD_CONVERSATIONS_PREFIX));
  } catch (error) {
    console.error('[Migration] Failed to get conversation keys:', error);
    return [];
  }
}

/**
 * Fetch user's preschool_id from profile
 */
async function getUserPreschoolId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preschool_id')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return data?.preschool_id || null;
  } catch (error) {
    console.error('[Migration] Failed to fetch preschool_id:', error);
    return null;
  }
}

/**
 * Migrate a single conversation to Supabase
 */
async function migrateConversation(
  conversationData: DashConversation,
  userId: string,
  preschoolId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if conversation already exists in Supabase
    const { data: existing } = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('conversation_id', conversationData.id)
      .eq('user_id', userId)
      .single();

    if (existing) {
      console.log(`[Migration] Skipping existing conversation: ${conversationData.id}`);
      return { success: true }; // Already migrated
    }

    // Insert into Supabase with tenant isolation
    const { error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userId,
        preschool_id: preschoolId,
        conversation_id: conversationData.id,
        title: conversationData.title,
        messages: conversationData.messages,
        created_at: new Date(conversationData.created_at).toISOString(),
        updated_at: new Date(conversationData.updated_at).toISOString(),
      });

    if (error) throw error;

    console.log(`[Migration] Successfully migrated: ${conversationData.id}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Migration] Failed to migrate conversation ${conversationData.id}:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Main migration function
 * Migrates all AsyncStorage conversations to Supabase with proper tenant isolation
 */
export async function migrateConversationsToSupabase(
  userId: string,
  options?: {
    force?: boolean; // Force re-migration even if already completed
    deleteLocal?: boolean; // Delete AsyncStorage conversations after successful migration
  }
): Promise<MigrationResult> {
  console.log('[Migration] Starting conversation migration to Supabase...');

  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // Check if migration already completed
    if (!options?.force && (await isMigrationCompleted())) {
      console.log('[Migration] Migration already completed, skipping');
      result.success = true;
      return result;
    }

    // Fetch user's preschool_id
    const preschoolId = await getUserPreschoolId(userId);
    if (!preschoolId) {
      const error = 'Failed to fetch preschool_id - tenant isolation required';
      console.error(`[Migration] ${error}`);
      result.errors.push(error);
      return result;
    }

    // Get all old conversation keys
    const conversationKeys = await getOldConversationKeys();
    console.log(`[Migration] Found ${conversationKeys.length} conversations to migrate`);

    if (conversationKeys.length === 0) {
      // No conversations to migrate - mark as completed
      await markMigrationCompleted();
      result.success = true;
      return result;
    }

    // Migrate each conversation
    const keysToDelete: string[] = [];

    for (const key of conversationKeys) {
      try {
        const conversationJson = await AsyncStorage.getItem(key);
        if (!conversationJson) {
          result.skippedCount++;
          continue;
        }

        const conversation: DashConversation = JSON.parse(conversationJson);

        // Validate conversation structure
        if (!conversation.id || !Array.isArray(conversation.messages)) {
          console.warn(`[Migration] Invalid conversation structure for key: ${key}`);
          result.skippedCount++;
          continue;
        }

        // Migrate to Supabase
        const migrationResult = await migrateConversation(
          conversation,
          userId,
          preschoolId
        );

        if (migrationResult.success) {
          result.migratedCount++;
          keysToDelete.push(key);
        } else {
          result.errorCount++;
          result.errors.push(`${conversation.id}: ${migrationResult.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Migration] Failed to process key ${key}:`, error);
        result.errorCount++;
        result.errors.push(`${key}: ${errorMsg}`);
      }
    }

    // Delete local AsyncStorage conversations if requested
    if (options?.deleteLocal && keysToDelete.length > 0) {
      try {
        await AsyncStorage.multiRemove(keysToDelete);
        console.log(`[Migration] Deleted ${keysToDelete.length} local conversations`);
      } catch (error) {
        console.error('[Migration] Failed to delete local conversations:', error);
      }
    }

    // Mark migration as completed if no errors
    if (result.errorCount === 0) {
      await markMigrationCompleted();
      result.success = true;
      console.log(
        `[Migration] Migration completed successfully: ${result.migratedCount} migrated, ${result.skippedCount} skipped`
      );
    } else {
      console.warn(
        `[Migration] Migration completed with errors: ${result.migratedCount} migrated, ${result.errorCount} failed`
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Migration] Migration failed:', error);
    result.errors.push(`Fatal error: ${errorMsg}`);
  }

  return result;
}

/**
 * Reset migration flag (for testing or re-migration)
 */
export async function resetMigrationFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('[Migration] Migration flag reset');
  } catch (error) {
    console.error('[Migration] Failed to reset migration flag:', error);
  }
}

export default migrateConversationsToSupabase;
