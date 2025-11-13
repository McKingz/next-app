/**
 * Announcement Service
 * Uses existing 'announcements' table from database schema
 * Phase 6: Updated to support organization-first API
 */

import { assertSupabase } from '@/lib/supabase';
import { AnnouncementData } from '@/components/modals/AnnouncementModal';
import { createOrganizationFilter } from '@/lib/tenant/compat';

export interface DatabaseAnnouncement {
  id: string;
  preschool_id: string; // Legacy field, maps to organization_id
  title: string;
  content: string;
  author_id: string;
  target_audience: 'all' | 'teachers' | 'parents' | 'students';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_published: boolean;
  published_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export class AnnouncementService {
  /**
   * Create a new announcement using existing database table
   * @param organizationId - Organization/school identifier
   * @param authorId - User ID of the announcement creator
   * @param announcementData - Announcement content and settings
   */
  static async createAnnouncement(
    organizationId: string,
    authorId: string,
    announcementData: AnnouncementData
  ): Promise<{ success: boolean; data?: DatabaseAnnouncement; error?: string }> {
    try {
      console.log('📢 Creating announcement:', announcementData);

      // Map the announcement data to database format
      const dbAnnouncement = {
        preschool_id: organizationId, // Database still uses preschool_id field
        author_id: authorId,
        title: announcementData.title,
        content: announcementData.message,
        target_audience: this.mapAudienceToDbFormat(announcementData.audience),
        priority: announcementData.priority === 'normal' ? 'medium' : announcementData.priority,
        is_published: true,
        published_at: new Date().toISOString(),
        expires_at: announcementData.scheduled ? 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : // 30 days from now
          null,
      };

      const { data, error } = await assertSupabase()
        .from('announcements')
        .insert(dbAnnouncement)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating announcement:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Announcement created successfully:', data);
      return { success: true, data };
    } catch (err) {
      console.error('💥 Unexpected error creating announcement:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get announcements for an organization
   * @param organizationId - Organization/school identifier
   * @param limit - Maximum number of announcements to return
   */
  static async getAnnouncements(
    organizationId: string,
    limit: number = 10
  ): Promise<{ success: boolean; data?: DatabaseAnnouncement[]; error?: string }> {
    try {
      const filter = createOrganizationFilter(organizationId, 'announcements');
      
      const { data, error } = await assertSupabase()
        .from('announcements')
        .select('*')
        .match(filter)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching announcements:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (err) {
      console.error('💥 Unexpected error fetching announcements:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get recent announcements count for dashboard
   * @param organizationId - Organization/school identifier
   * @param daysBack - Number of days to look back
   */
  static async getAnnouncementsCount(
    organizationId: string,
    daysBack: number = 7
  ): Promise<number> {
    try {
      const dateThreshold = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      const filter = createOrganizationFilter(organizationId, 'announcements');
      
      const { count, error } = await assertSupabase()
        .from('announcements')
        .select('id', { count: 'exact', head: true })
        .match(filter)
        .eq('is_published', true)
        .gte('published_at', dateThreshold);

      if (error) {
        console.error('❌ Error getting announcements count:', error);
        return 0;
      }

      return count || 0;
    } catch (err) {
      console.error('💥 Error getting announcements count:', err);
      return 0;
    }
  }

  /**
   * Map audience array to database target_audience format
   * Since DB only supports single target_audience, we pick the primary one
   */
  private static mapAudienceToDbFormat(audiences: string[]): 'all' | 'teachers' | 'parents' | 'students' {
    if (audiences.length > 1) {
      return 'all'; // Multiple audiences = all
    }
    
    const audience = audiences[0];
    switch (audience) {
      case 'teachers':
        return 'teachers';
      case 'parents':
        return 'parents';
      case 'students':
        return 'students';
      case 'admin':
        return 'teachers'; // Map admin to teachers
      default:
        return 'all';
    }
  }

  /**
   * Map database target_audience to display format
   */
  static mapDbAudienceToDisplay(dbAudience: string): string[] {
    switch (dbAudience) {
      case 'teachers':
        return ['teachers'];
      case 'parents':
        return ['parents'];
      case 'students':
        return ['students'];
      case 'all':
        return ['teachers', 'parents', 'students'];
      default:
        return ['all'];
    }
  }

  /**
   * Delete an announcement (admin only)
   */
  static async deleteAnnouncement(
    announcementId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Only allow deletion by author or principals
      const { error } = await assertSupabase()
        .from('announcements')
        .delete()
        .eq('id', announcementId)
        .eq('author_id', userId); // RLS will ensure user can only delete their own

      if (error) {
        console.error('❌ Error deleting announcement:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Announcement deleted successfully');
      return { success: true };
    } catch (err) {
      console.error('💥 Error deleting announcement:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }
}

export default AnnouncementService;