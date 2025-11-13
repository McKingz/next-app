/**
 * Feedback Service
 * 
 * Supabase v2 API layer for tester feedback system.
 * Handles submission, screenshot upload, and status updates.
 * 
 * Documentation Sources:
 * - Supabase JS v2: https://supabase.com/docs/reference/javascript/introduction
 * - Supabase Storage: https://supabase.com/docs/reference/javascript/storage-from-upload
 * - Supabase Auth: https://supabase.com/docs/reference/javascript/auth-getsession
 * 
 * WARP.md Compliance:
 * - Supabase v2 syntax only (signInWithPassword, not signIn)
 * - All queries filtered by preschool_id
 * - File size: ≤500 lines
 */

import { SupabaseClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import type {
  TesterFeedback,
  InsertFeedbackPayload,
  UpdateFeedbackStatusPayload,
  AttachScreenshotPayload,
  FeedbackFilters,
  FeedbackCounts,
} from '@/types/feedback.types';

// ============================================
// SUBMIT FEEDBACK
// ============================================

/**
 * Submit new feedback to database
 * Returns the inserted feedback record with generated ID
 */
export async function submitFeedback(
  supabase: SupabaseClient,
  payload: InsertFeedbackPayload
): Promise<TesterFeedback> {
  const { data, error } = await supabase
    .from('tester_feedback')
    .insert({
      preschool_id: payload.preschool_id,
      user_id: payload.user_id,
      feedback_text: payload.feedback_text,
      severity: payload.severity,
      status: payload.status || 'new',
      device_info: payload.device_info || {},
      app_version: payload.app_version || null,
      platform: payload.platform || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[FeedbackService] Submit error:', error);
    throw new Error(error.message || 'Failed to submit feedback');
  }

  if (!data) {
    throw new Error('No data returned from feedback submission');
  }

  return data as TesterFeedback;
}

// ============================================
// SCREENSHOT UPLOAD
// ============================================

/**
 * Upload screenshot to storage bucket
 * Path format: ${preschool_id}/${user_id}/${feedback_id}.jpg
 * 
 * @param localUri - Local file URI from react-native-view-shot
 */
export async function uploadScreenshot(
  supabase: SupabaseClient,
  localUri: string,
  preschoolId: string,
  userId: string,
  feedbackId: string
): Promise<string> {
  try {
    // Generate storage path
    const storagePath = `${preschoolId}/${userId}/${feedbackId}.jpg`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer
    const arrayBuffer = decode(base64);

    // Upload to storage
    const { data, error } = await supabase.storage
      .from('feedback-screenshots')
      .upload(storagePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true, // Replace if exists (re-upload case)
      });

    if (error) {
      console.error('[FeedbackService] Upload error:', error);
      throw new Error(error.message || 'Failed to upload screenshot');
    }

    if (!data || !data.path) {
      throw new Error('No path returned from screenshot upload');
    }

    return data.path;
  } catch (error) {
    console.error('[FeedbackService] Screenshot upload exception:', error);
    throw error;
  }
}

// ============================================
// ATTACH SCREENSHOT TO FEEDBACK
// ============================================

/**
 * Update feedback record with screenshot path
 * Only allowed while status = 'new' (RLS policy)
 */
export async function attachScreenshotToFeedback(
  supabase: SupabaseClient,
  payload: AttachScreenshotPayload
): Promise<void> {
  const { error } = await supabase
    .from('tester_feedback')
    .update({
      screenshot_path: payload.screenshot_path,
    })
    .eq('id', payload.id);

  if (error) {
    console.error('[FeedbackService] Attach screenshot error:', error);
    throw new Error(error.message || 'Failed to attach screenshot');
  }
}

// ============================================
// FETCH FEEDBACK (Superadmin)
// ============================================

/**
 * Fetch all feedback with filters (superadmin only)
 * RLS policy enforces superadmin access
 */
export async function fetchAllFeedback(
  supabase: SupabaseClient,
  filters: FeedbackFilters = {}
): Promise<TesterFeedback[]> {
  let query = supabase
    .from('tester_feedback')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.preschool_id) {
    query = query.eq('preschool_id', filters.preschool_id);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.platform) {
    query = query.eq('platform', filters.platform);
  }
  if (filters.search && filters.search.trim()) {
    query = query.ilike('feedback_text', `%${filters.search.trim()}%`);
  }
  if (filters.from_date) {
    query = query.gte('created_at', filters.from_date);
  }
  if (filters.to_date) {
    query = query.lte('created_at', filters.to_date);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[FeedbackService] Fetch error:', error);
    throw new Error(error.message || 'Failed to fetch feedback');
  }

  return (data || []) as TesterFeedback[];
}

// ============================================
// FETCH FEEDBACK FOR PRESCHOOL
// ============================================

/**
 * Fetch feedback for specific preschool (tenant users)
 * RLS policy enforces preschool_id filtering
 */
export async function fetchPreschoolFeedback(
  supabase: SupabaseClient,
  preschoolId: string
): Promise<TesterFeedback[]> {
  const { data, error } = await supabase
    .from('tester_feedback')
    .select('*')
    .eq('preschool_id', preschoolId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[FeedbackService] Fetch preschool feedback error:', error);
    throw new Error(error.message || 'Failed to fetch feedback');
  }

  return (data || []) as TesterFeedback[];
}

// ============================================
// UPDATE FEEDBACK STATUS (Superadmin)
// ============================================

/**
 * Update feedback status (superadmin only)
 * new -> reviewing -> resolved
 */
export async function updateFeedbackStatus(
  supabase: SupabaseClient,
  payload: UpdateFeedbackStatusPayload
): Promise<void> {
  const { error } = await supabase
    .from('tester_feedback')
    .update({
      status: payload.status,
    })
    .eq('id', payload.id);

  if (error) {
    console.error('[FeedbackService] Update status error:', error);
    throw new Error(error.message || 'Failed to update feedback status');
  }
}

// ============================================
// DELETE FEEDBACK (Superadmin)
// ============================================

/**
 * Delete feedback record (superadmin only)
 * Note: ON DELETE CASCADE will remove associated data
 */
export async function deleteFeedback(
  supabase: SupabaseClient,
  feedbackId: string
): Promise<void> {
  // First, try to delete screenshot from storage if exists
  try {
    const { data: feedback } = await supabase
      .from('tester_feedback')
      .select('screenshot_path')
      .eq('id', feedbackId)
      .single();

    if (feedback?.screenshot_path) {
      await supabase.storage
        .from('feedback-screenshots')
        .remove([feedback.screenshot_path]);
    }
  } catch (storageError) {
    console.warn('[FeedbackService] Screenshot deletion warning:', storageError);
    // Continue with feedback deletion even if screenshot removal fails
  }

  // Delete feedback record
  const { error } = await supabase
    .from('tester_feedback')
    .delete()
    .eq('id', feedbackId);

  if (error) {
    console.error('[FeedbackService] Delete error:', error);
    throw new Error(error.message || 'Failed to delete feedback');
  }
}

// ============================================
// GET FEEDBACK COUNTS (Superadmin)
// ============================================

/**
 * Get feedback counts by status for dashboard badges
 */
export async function getFeedbackCounts(
  supabase: SupabaseClient,
  preschoolId?: string
): Promise<FeedbackCounts> {
  let query = supabase
    .from('tester_feedback')
    .select('status', { count: 'exact', head: false });

  if (preschoolId) {
    query = query.eq('preschool_id', preschoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[FeedbackService] Get counts error:', error);
    throw new Error(error.message || 'Failed to get feedback counts');
  }

  // Count by status
  const counts: FeedbackCounts = {
    new: 0,
    reviewing: 0,
    resolved: 0,
    total: 0,
  };

  if (data) {
    data.forEach((item: any) => {
      if (item.status === 'new') counts.new++;
      else if (item.status === 'reviewing') counts.reviewing++;
      else if (item.status === 'resolved') counts.resolved++;
      counts.total++;
    });
  }

  return counts;
}

// ============================================
// GET SCREENSHOT SIGNED URL
// ============================================

/**
 * Generate signed URL for screenshot preview
 * Valid for 60 seconds (configurable)
 */
export async function getScreenshotSignedUrl(
  supabase: SupabaseClient,
  screenshotPath: string,
  expiresIn: number = 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('feedback-screenshots')
    .createSignedUrl(screenshotPath, expiresIn);

  if (error) {
    console.error('[FeedbackService] Signed URL error:', error);
    throw new Error(error.message || 'Failed to generate screenshot URL');
  }

  if (!data || !data.signedUrl) {
    throw new Error('No signed URL returned');
  }

  return data.signedUrl;
}

// ============================================
// SUBMIT FEEDBACK WITH SCREENSHOT (Complete Flow)
// ============================================

/**
 * Complete feedback submission flow with optional screenshot
 * 1. Insert feedback record
 * 2. Upload screenshot (if provided)
 * 3. Attach screenshot path to feedback
 * 
 * Returns the feedback ID
 */
export async function submitFeedbackWithScreenshot(
  supabase: SupabaseClient,
  payload: InsertFeedbackPayload,
  screenshotUri?: string
): Promise<string> {
  try {
    // Step 1: Insert feedback
    const feedback = await submitFeedback(supabase, payload);

    // Step 2: Upload screenshot if provided
    if (screenshotUri) {
      const screenshotPath = await uploadScreenshot(
        supabase,
        screenshotUri,
        payload.preschool_id,
        payload.user_id,
        feedback.id
      );

      // Step 3: Attach screenshot path
      await attachScreenshotToFeedback(supabase, {
        id: feedback.id,
        screenshot_path: screenshotPath,
      });
    }

    return feedback.id;
  } catch (error) {
    console.error('[FeedbackService] Complete submission error:', error);
    throw error;
  }
}

// ============================================
// UTILITY: CHECK USER PERMISSIONS
// ============================================

/**
 * Check if current user has superadmin role
 */
export async function isSuperadmin(
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (error || !data) return false;

    return data.role === 'superadmin';
  } catch {
    return false;
  }
}
