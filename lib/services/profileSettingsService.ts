// ================================================
// Profile Settings Service
// Manages invoice notification preferences and digital signatures
// ================================================

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import type {
  InvoiceNotificationPreferences,
  UserInvoiceNotificationSettings,
  UpdateInvoiceNotificationPreferencesRequest,
  SignatureInfo,
  NotificationEvent,
  NotificationChannel,
  TestNotificationRequest,
} from '@/lib/types/profile';
import { sanitizePreferences } from '@/lib/types/profile';

export class ProfileSettingsService {
  private static get supabase() {
    return assertSupabase();
  }

  /**
   * Get current user's invoice notification settings and signature info
   */
  static async getInvoiceNotificationSettings(): Promise<UserInvoiceNotificationSettings> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data, error } = await this.supabase
        .from('profiles')
        .select('invoice_notification_preferences, signature_url, signature_public_id, signature_updated_at')
        .eq('id', user.user.id)
        .single();

      if (error) throw error;

      // Generate signed URL for signature if it exists
      let signatureUrl = data?.signature_url;
      if (signatureUrl) {
        try {
          const { data: signedUrl } = await this.supabase.storage
            .from('signatures')
            .createSignedUrl(signatureUrl, 3600); // 1 hour expiry
          signatureUrl = signedUrl?.signedUrl || signatureUrl;
        } catch (signError) {
          console.warn('Failed to generate signed URL for signature:', signError);
          // Keep the original path as fallback
        }
      }

      return {
        preferences: (data?.invoice_notification_preferences as InvoiceNotificationPreferences),
        signature: {
          url: signatureUrl || undefined,
          public_id: data?.signature_public_id || undefined,
          updated_at: data?.signature_updated_at || undefined,
        },
      };
    } catch (error) {
      console.error('Error getting invoice notification settings:', error);
      throw new Error(`Failed to get notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user's invoice notification preferences
   */
  static async updateInvoiceNotificationPreferences(
    req: UpdateInvoiceNotificationPreferencesRequest
  ): Promise<InvoiceNotificationPreferences> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Sanitize the preferences before saving
      const sanitizedPrefs = sanitizePreferences(req.preferences);

      // Use the merge function to preserve nested structure
      const { data, error } = await this.supabase.rpc('merge_invoice_notification_prefs', {
        p_user_id: user.user.id,
        p_updates: sanitizedPrefs,
      });

      if (error) throw error;

      // Track analytics
      track('edudash.profile.notify_prefs_updated', { 
        user_id: user.user.id, 
        changes: sanitizedPrefs 
      });

      return data as InvoiceNotificationPreferences;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw new Error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a new digital signature
   */
  static async uploadSignature(localUri: string): Promise<SignatureInfo> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Create unique filename for the signature
      const fileName = `${user.user.id}/signature-${Date.now()}.png`;

      // Convert local URI to blob
      const fileResp = await fetch(localUri);
      const blob = await fileResp.blob();

      // Remove existing signature files to keep only one per user
      try {
        const { data: existing } = await this.supabase.storage
          .from('signatures')
          .list(`${user.user.id}/`, { limit: 100 });

        if (existing && existing.length > 0) {
          const filesToRemove = existing.map(f => `${user.user.id}/${f.name}`);
          await this.supabase.storage
            .from('signatures')
            .remove(filesToRemove);
        }
      } catch (cleanupError) {
        console.warn('Could not clean up existing signatures:', cleanupError);
        // Continue with upload even if cleanup fails
      }

      // Upload the new signature
      const { data: upload, error: uploadErr } = await this.supabase.storage
        .from('signatures')
        .upload(fileName, blob, {
          upsert: true,
          contentType: 'image/png',
        });

      if (uploadErr) throw uploadErr;
      if (!upload?.path) throw new Error('Upload succeeded but no path returned');

      // Update profile with signature metadata
      const { data: updated, error: updateError } = await this.supabase
        .from('profiles')
        .update({
          signature_url: upload.path,
          signature_public_id: upload.path,
          signature_updated_at: new Date().toISOString(),
        })
        .eq('id', user.user.id)
        .select('signature_url, signature_public_id, signature_updated_at')
        .single();

      if (updateError) throw updateError;

      // Generate signed URL for immediate use
      let signedUrl = upload.path;
      try {
        const { data: signed } = await this.supabase.storage
          .from('signatures')
          .createSignedUrl(upload.path, 3600);
        signedUrl = signed?.signedUrl || upload.path;
      } catch (signError) {
        console.warn('Could not generate signed URL:', signError);
      }

      // Track analytics
      track('edudash.signature.uploaded', { user_id: user.user.id });

      return {
        url: signedUrl,
        public_id: updated.signature_public_id,
        updated_at: updated.signature_updated_at,
      };
    } catch (error) {
      console.error('Error uploading signature:', error);
      throw new Error(`Failed to upload signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user's digital signature
   */
  static async deleteSignature(): Promise<void> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      // Get current signature info
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('signature_public_id')
        .eq('id', user.user.id)
        .single();

      // Remove the file from storage if it exists
      if (profile?.signature_public_id) {
        try {
          await this.supabase.storage
            .from('signatures')
            .remove([profile.signature_public_id]);
        } catch (storageError) {
          console.warn('Could not remove signature file from storage:', storageError);
          // Continue with profile update even if storage removal fails
        }
      }

      // Clear signature metadata from profile
      const { error } = await this.supabase
        .from('profiles')
        .update({ 
          signature_url: null, 
          signature_public_id: null, 
          signature_updated_at: new Date().toISOString() 
        })
        .eq('id', user.user.id);

      if (error) throw error;

      // Track analytics
      track('edudash.signature.deleted', { user_id: user.user.id });
    } catch (error) {
      console.error('Error deleting signature:', error);
      throw new Error(`Failed to delete signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send a test notification to verify settings
   */
  static async sendTestNotification(req: TestNotificationRequest): Promise<void> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const targetUserId = req.target_user_id || user.user.id;

      // Only allow testing for self unless user is admin
      if (targetUserId !== user.user.id) {
        const { data: profile } = await this.supabase
          .from('profiles')
          .select('role')
          .eq('id', user.user.id)
          .single();

        if (!profile || !['superadmin', 'principal_admin'].includes(profile.role)) {
          throw new Error('Not authorized to send test notifications for other users');
        }
      }

      // Invoke the notifications dispatcher with test payload
      const { error } = await this.supabase.functions.invoke('notifications-dispatcher', {
        body: {
          test: true,
          event_type: req.event,
          channel: req.channel,
          target_user_id: targetUserId,
          template_override: {
            title: `Test: ${req.event.replace('_', ' ')} notification`,
            body: `This is a test ${req.channel} notification for ${req.event} events.`,
            data: {
              test: true,
              event_type: req.event,
              channel: req.channel,
            }
          }
        },
      });

      if (error) throw error;

      // Track analytics
      track('edudash.notification.test_sent', {
        user_id: targetUserId,
        sender_id: user.user.id,
        event: req.event,
        channel: req.channel,
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      throw new Error(`Failed to send test notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's role for UI customization
   */
  static async getUserRole(): Promise<string> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) throw new Error('User not authenticated');

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('role')
        .eq('id', user.user.id)
        .single();

      return profile?.role || 'parent';
    } catch (error) {
      console.error('Error getting user role:', error);
      return 'parent'; // Safe default
    }
  }

  /**
   * Check if signature storage is available and configured
   */
  static async checkSignatureStorageStatus(): Promise<{ available: boolean; error?: string }> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) return { available: false, error: 'User not authenticated' };

      // Try to list the user's signature folder
      const { error } = await this.supabase.storage
        .from('signatures')
        .list(`${user.user.id}/`, { limit: 1 });

      if (error) {
        return { available: false, error: error.message };
      }

      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown storage error' 
      };
    }
  }
}

export default ProfileSettingsService;