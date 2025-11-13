import { logger } from '@/lib/logger';
/**
 * React Query hooks for POP (Proof of Payment & Picture of Progress) uploads
 * Handles file uploads, fetching history, status updates, and real-time sync
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  uploadPOPFile, 
  POPUploadType, 
  UploadResult, 
  getPOPFileUrl 
} from '@/lib/popUpload';

// POP Upload interface
export interface POPUpload {
  id: string;
  student_id: string;
  uploaded_by: string;
  preschool_id: string;
  upload_type: POPUploadType;
  title: string;
  description?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  
  // Proof of Payment specific
  payment_amount?: number;
  payment_method?: string;
  payment_date?: string;
  payment_reference?: string;
  
  // Picture of Progress specific
  subject?: string;
  achievement_level?: string;
  learning_area?: string;
  
  // Status and review
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  reviewer_name?: string;
  student?: {
    first_name: string;
    last_name: string;
  };
}

// POP Upload statistics
export interface POPStats {
  proof_of_payment: {
    pending: number;
    approved: number;
    rejected: number;
    recent: number;
  };
  picture_of_progress: {
    pending: number;
    approved: number;
    rejected: number;
    recent: number;
  };
  total_pending: number;
  total_recent: number;
}

// Upload creation data
export interface CreatePOPUploadData {
  student_id: string;
  upload_type: POPUploadType;
  title: string;
  description?: string;
  file_uri: string;
  file_name: string;
  
  // Payment specific
  payment_amount?: number;
  payment_method?: string;
  payment_date?: string;
  payment_reference?: string;
  
  // Progress specific
  subject?: string;
  achievement_level?: string;
  learning_area?: string;
}

// Query keys
export const POP_QUERY_KEYS = {
  all: ['pop_uploads'] as const,
  lists: () => [...POP_QUERY_KEYS.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...POP_QUERY_KEYS.lists(), filters] as const,
  details: () => [...POP_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...POP_QUERY_KEYS.details(), id] as const,
  stats: () => [...POP_QUERY_KEYS.all, 'stats'] as const,
  studentStats: (studentId: string) => [...POP_QUERY_KEYS.stats(), studentId] as const,
};

/**
 * Fetch POP upload statistics for dashboard
 */
export const usePOPStats = (studentId?: string) => {
  return useQuery({
    queryKey: studentId ? POP_QUERY_KEYS.studentStats(studentId) : POP_QUERY_KEYS.stats(),
    queryFn: async (): Promise<POPStats> => {
      const { data, error } = await supabase.rpc('get_pop_upload_stats', {
        target_student_id: studentId || null,
        target_preschool_id: null,
      });
      
      if (error) {
        console.error('Failed to fetch POP stats:', error);
        throw new Error(`Failed to load upload statistics: ${error.message}`);
      }
      
      return data || {
        proof_of_payment: { pending: 0, approved: 0, rejected: 0, recent: 0 },
        picture_of_progress: { pending: 0, approved: 0, rejected: 0, recent: 0 },
        total_pending: 0,
        total_recent: 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

/**
 * Fetch POP uploads for a specific student
 */
export const useStudentPOPUploads = (studentId: string, limit = 10) => {
  return useQuery({
    queryKey: POP_QUERY_KEYS.list({ student_id: studentId, limit }),
    queryFn: async (): Promise<POPUpload[]> => {
      const { data, error } = await supabase.rpc('get_student_pop_uploads', {
        target_student_id: studentId,
        limit_count: limit,
      });
      
      if (error) {
        console.error('Failed to fetch student POP uploads:', error);
        throw new Error(`Failed to load uploads: ${error.message}`);
      }
      
      return data || [];
    },
    enabled: !!studentId,
  });
};

/**
 * Fetch all POP uploads for current user (parent view)
 */
export const useMyPOPUploads = (
  filters: { 
    upload_type?: POPUploadType; 
    status?: string; 
    student_id?: string 
  } = {}
) => {
  return useQuery({
    queryKey: POP_QUERY_KEYS.list(filters),
    queryFn: async (): Promise<POPUpload[]> => {
      let query = supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (filters.upload_type) {
        query = query.eq('upload_type', filters.upload_type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.student_id) {
        query = query.eq('student_id', filters.student_id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Failed to fetch POP uploads:', error);
        throw new Error(`Failed to load uploads: ${error.message}`);
      }
      
      return (data || []).map(upload => ({
        ...upload,
        reviewer_name: undefined,
      }));
    },
  });
};

/**
 * Upload POP file mutation
 */
export const useCreatePOPUpload = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreatePOPUploadData): Promise<POPUpload> => {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      
      // Get user's preschool_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', user.id)
        .single();
        
      if (profileError || !profile?.preschool_id) {
        throw new Error('User profile not found');
      }
      
      logger.info('Starting POP upload process...');
      
      // Upload file to storage
      const uploadResult: UploadResult = await uploadPOPFile(
        data.file_uri,
        data.upload_type,
        user.id,
        data.student_id,
        data.file_name
      );
      
      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.error || 'File upload failed');
      }
      
      logger.info('File uploaded successfully, creating database record...');
      
      // Create database record
      const dbData = {
        student_id: data.student_id,
        uploaded_by: user.id,
        preschool_id: profile.preschool_id,
        upload_type: data.upload_type,
        title: data.title,
        description: data.description,
        file_path: uploadResult.filePath,
        file_name: uploadResult.fileName || data.file_name,
        file_size: uploadResult.fileSize || 0,
        file_type: uploadResult.fileType || 'unknown',
        
        // Payment specific fields
        ...(data.upload_type === 'proof_of_payment' && {
          payment_amount: data.payment_amount,
          payment_method: data.payment_method,
          payment_date: data.payment_date,
          payment_reference: data.payment_reference,
        }),
        
        // Progress specific fields
        ...(data.upload_type === 'picture_of_progress' && {
          subject: data.subject,
          achievement_level: data.achievement_level,
          learning_area: data.learning_area,
        }),
      };
      
      const { data: newUpload, error: dbError } = await supabase
        .from('pop_uploads')
        .insert(dbData)
        .select(`
          *,
          student:students (
            first_name,
            last_name
          )
        `)
        .single();
        
      if (dbError) {
        console.error('Database insert failed:', dbError);
        throw new Error(`Failed to save upload: ${dbError.message}`);
      }
      
      logger.info('POP upload completed successfully');
      return newUpload;
    },
    onSuccess: (newUpload) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['parent_dashboard_data'] });
      
      logger.info('POP upload successful, queries invalidated');
    },
    onError: (error) => {
      console.error('POP upload failed:', error);
    },
  });
};

/**
 * Update POP upload status (for teachers/principals)
 */
export const useUpdatePOPStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      uploadId,
      status,
      reviewNotes,
    }: {
      uploadId: string;
      status: 'approved' | 'rejected' | 'needs_revision';
      reviewNotes?: string;
    }): Promise<POPUpload> => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('pop_uploads')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
        })
        .eq('id', uploadId)
        .select(`
          *,
          student:students (
            first_name,
            last_name
          )
        `)
        .single();
        
      if (error) {
        throw new Error(`Failed to update status: ${error.message}`);
      }
      
      return {
        ...data,
        reviewer_name: undefined,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
    },
  });
};

/**
 * Delete POP upload
 */
export const useDeletePOPUpload = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (uploadId: string): Promise<void> => {
      const { error } = await supabase
        .from('pop_uploads')
        .delete()
        .eq('id', uploadId);
        
      if (error) {
        throw new Error(`Failed to delete upload: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['parent_dashboard_data'] });
    },
  });
};

/**
 * Get signed URL for file viewing
 */
export const usePOPFileUrl = (upload: POPUpload | null) => {
  return useQuery({
    queryKey: ['pop_file_url', upload?.id],
    queryFn: async (): Promise<string | null> => {
      if (!upload) return null;
      
      return await getPOPFileUrl(
        upload.upload_type,
        upload.file_path,
        3600 // 1 hour expiry
      );
    },
    enabled: !!upload,
    staleTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};