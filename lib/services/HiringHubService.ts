/**
 * Hiring Hub Service
 * Phase 1, Epic 1.1: Hiring Hub
 * 
 * API service for teacher recruitment system
 * All methods enforce preschool_id isolation and use RLS
 */

import { assertSupabase } from '@/lib/supabase';
import type {
  JobPosting,
  JobApplication,
  CandidateProfile,
  InterviewSchedule,
  OfferLetter,
  CreateJobPostingRequest,
  UpdateJobPostingRequest,
  CreateCandidateProfileRequest,
  SubmitApplicationRequest,
  ReviewApplicationRequest,
  ScheduleInterviewRequest,
  GenerateOfferRequest,
  RespondToOfferRequest,
  HiringHubStats,
  ApplicationWithDetails,
} from '@/types/hiring';
import { ApplicationStatus, JobPostingStatus } from '@/types/hiring';

export class HiringHubService {
  // =====================================================
  // JOB POSTINGS
  // =====================================================

  /**
   * Create a new job posting
   */
  static async createJobPosting(
    data: CreateJobPostingRequest,
    createdBy: string
  ): Promise<JobPosting> {
    const supabase = assertSupabase();

    const { data: jobPosting, error } = await supabase
      .from('job_postings')
      .insert({
        preschool_id: data.preschool_id,
        title: data.title,
        description: data.description,
        requirements: data.requirements || null,
        salary_range_min: data.salary_range_min || null,
        salary_range_max: data.salary_range_max || null,
        location: data.location || null,
        employment_type: data.employment_type,
        status: data.status || JobPostingStatus.ACTIVE,
        expires_at: data.expires_at || null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating job posting:', error);
      throw new Error(`Failed to create job posting: ${error.message}`);
    }

    return jobPosting;
  }

  /**
   * Get all job postings for a school
   */
  static async getJobPostings(preschoolId: string): Promise<JobPosting[]> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('preschool_id', preschoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching job postings:', error);
      throw new Error(`Failed to fetch job postings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single job posting by ID
   */
  static async getJobPostingById(id: string): Promise<JobPosting | null> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching job posting:', error);
      throw new Error(`Failed to fetch job posting: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a job posting
   */
  static async updateJobPosting(
    id: string,
    updates: UpdateJobPostingRequest
  ): Promise<JobPosting> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_postings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating job posting:', error);
      throw new Error(`Failed to update job posting: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a job posting
   */
  static async deleteJobPosting(id: string): Promise<void> {
    const supabase = assertSupabase();

    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting job posting:', error);
      throw new Error(`Failed to delete job posting: ${error.message}`);
    }
  }

  // =====================================================
  // CANDIDATE PROFILES
  // =====================================================

  /**
   * Create or get existing candidate profile
   */
  static async createOrGetCandidateProfile(
    data: CreateCandidateProfileRequest
  ): Promise<CandidateProfile> {
    const supabase = assertSupabase();

    // Check if profile exists
    const { data: existing, error: fetchError } = await supabase
      .from('candidate_profiles')
      .select('*')
      .eq('email', data.email.toLowerCase())
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // Create new profile
    const { data: newProfile, error: createError } = await supabase
      .from('candidate_profiles')
      .insert({
        email: data.email.toLowerCase(),
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        location: data.location || null,
        experience_years: data.experience_years,
        qualifications: data.qualifications || [],
        skills: data.skills || [],
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating candidate profile:', createError);
      throw new Error(`Failed to create candidate profile: ${createError.message}`);
    }

    return newProfile;
  }

  // =====================================================
  // JOB APPLICATIONS
  // =====================================================

  /**
   * Submit a job application
   */
  static async submitApplication(
    data: SubmitApplicationRequest,
    resumeFilePath?: string
  ): Promise<JobApplication> {
    const supabase = assertSupabase();

    const { data: application, error } = await supabase
      .from('job_applications')
      .insert({
        job_posting_id: data.job_posting_id,
        candidate_profile_id: data.candidate_profile_id,
        cover_letter: data.cover_letter || null,
        resume_file_path: resumeFilePath || null,
        status: ApplicationStatus.NEW,
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting application:', error);
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    return application;
  }

  /**
   * Get all applications for a job posting
   */
  static async getApplicationsForJob(
    jobPostingId: string
  ): Promise<ApplicationWithDetails[]> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        candidate_profile:candidate_profiles(*)
      `)
      .eq('job_posting_id', jobPostingId)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching applications:', error);
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }

    // Transform to ApplicationWithDetails
    const applications: ApplicationWithDetails[] = (data || []).map((app: any) => ({
      ...app,
      candidate_name: app.candidate_profile
        ? `${app.candidate_profile.first_name} ${app.candidate_profile.last_name}`
        : 'Unknown',
      candidate_email: app.candidate_profile?.email || '',
      candidate_phone: app.candidate_profile?.phone || undefined,
      candidate_experience_years: app.candidate_profile?.experience_years || 0,
      job_title: '', // Will be populated if needed
      has_resume: !!app.resume_file_path,
    }));

    return applications;
  }

  /**
   * Get all applications for a school (across all job postings)
   */
  static async getApplicationsForSchool(
    preschoolId: string
  ): Promise<ApplicationWithDetails[]> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        candidate_profile:candidate_profiles(*),
        job_posting:job_postings!inner(*)
      `)
      .eq('job_posting.preschool_id', preschoolId)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching school applications:', error);
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }

    const applications: ApplicationWithDetails[] = (data || []).map((app: any) => ({
      ...app,
      candidate_name: app.candidate_profile
        ? `${app.candidate_profile.first_name} ${app.candidate_profile.last_name}`
        : 'Unknown',
      candidate_email: app.candidate_profile?.email || '',
      candidate_phone: app.candidate_profile?.phone || undefined,
      candidate_experience_years: app.candidate_profile?.experience_years || 0,
      job_title: app.job_posting?.title || 'Unknown Position',
      has_resume: !!app.resume_file_path,
    }));

    return applications;
  }

  /**
   * Review an application (update status)
   */
  static async reviewApplication(
    data: ReviewApplicationRequest,
    reviewedBy: string
  ): Promise<JobApplication> {
    const supabase = assertSupabase();

    const { data: application, error } = await supabase
      .from('job_applications')
      .update({
        status: data.status,
        notes: data.notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
      })
      .eq('id', data.application_id)
      .select()
      .single();

    if (error) {
      console.error('Error reviewing application:', error);
      throw new Error(`Failed to review application: ${error.message}`);
    }

    return application;
  }

  /**
   * Get application by ID with full details
   */
  static async getApplicationById(id: string): Promise<any> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        candidate_profile:candidate_profiles(*),
        job_posting:job_postings(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching application:', error);
      throw new Error(`Failed to fetch application: ${error.message}`);
    }

    // Transform data to include helpful fields
    const application = {
      ...data,
      candidate_name: data.candidate_profile
        ? `${data.candidate_profile.first_name} ${data.candidate_profile.last_name}`
        : 'Unknown',
      candidate_email: data.candidate_profile?.email || '',
      candidate_phone: data.candidate_profile?.phone || undefined,
      resume_url: data.resume_file_path
        ? (await this.getResumeUrl(data.resume_file_path))
        : undefined,
      created_at: data.applied_at,
    };

    return application;
  }

  /**
   * Update application status
   */
  static async updateApplicationStatus(
    applicationId: string,
    newStatus: ApplicationStatus,
    reviewedBy: string,
    notes?: string
  ): Promise<JobApplication> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('job_applications')
      .update({
        status: newStatus,
        notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
      })
      .eq('id', applicationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating application status:', error);
      throw new Error(`Failed to update application status: ${error.message}`);
    }

    return data;
  }

  // =====================================================
  // INTERVIEW SCHEDULES
  // =====================================================

  /**
   * Schedule an interview
   */
  static async scheduleInterview(
    data: ScheduleInterviewRequest,
    scheduledBy: string
  ): Promise<InterviewSchedule> {
    const supabase = assertSupabase();

    const { data: interview, error } = await supabase
      .from('interview_schedules')
      .insert({
        application_id: data.application_id,
        scheduled_by: scheduledBy,
        interview_date: data.interview_date,
        interview_time: data.interview_time,
        meeting_link: data.meeting_link || null,
        location: data.location || null,
        notes: data.notes || null,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) {
      console.error('Error scheduling interview:', error);
      throw new Error(`Failed to schedule interview: ${error.message}`);
    }

    // Update application status
    await this.reviewApplication(
      {
        application_id: data.application_id,
        status: ApplicationStatus.INTERVIEW_SCHEDULED,
      },
      scheduledBy
    );

    return interview;
  }

  /**
   * Get interviews for an application
   */
  static async getInterviewsForApplication(
    applicationId: string
  ): Promise<InterviewSchedule[]> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('interview_schedules')
      .select('*')
      .eq('application_id', applicationId)
      .order('interview_date', { ascending: true });

    if (error) {
      console.error('Error fetching interviews:', error);
      throw new Error(`Failed to fetch interviews: ${error.message}`);
    }

    return data || [];
  }

  // =====================================================
  // OFFER LETTERS
  // =====================================================

  /**
   * Generate an offer letter
   */
  static async generateOffer(
    data: GenerateOfferRequest,
    generatedBy: string
  ): Promise<OfferLetter> {
    const supabase = assertSupabase();

    const { data: offer, error } = await supabase
      .from('offer_letters')
      .insert({
        application_id: data.application_id,
        salary_offered: data.salary_offered,
        start_date: data.start_date,
        employment_type: data.employment_type,
        terms: data.terms || {},
        generated_by: generatedBy,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error generating offer:', error);
      throw new Error(`Failed to generate offer: ${error.message}`);
    }

    // Update application status
    await this.reviewApplication(
      {
        application_id: data.application_id,
        status: ApplicationStatus.OFFERED,
      },
      generatedBy
    );

    return offer;
  }

  /**
   * Respond to an offer (accept/decline)
   */
  static async respondToOffer(data: RespondToOfferRequest): Promise<OfferLetter> {
    const supabase = assertSupabase();

    const updateData: any = {
      status: data.accepted ? 'accepted' : 'declined',
    };

    if (data.accepted) {
      updateData.accepted_at = new Date().toISOString();
    } else {
      updateData.declined_at = new Date().toISOString();
    }

    const { data: offer, error } = await supabase
      .from('offer_letters')
      .update(updateData)
      .eq('id', data.offer_id)
      .select()
      .single();

    if (error) {
      console.error('Error responding to offer:', error);
      throw new Error(`Failed to respond to offer: ${error.message}`);
    }

    // Update application status if accepted
    if (data.accepted && offer) {
      const { data: offerWithApp } = await supabase
        .from('offer_letters')
        .select('application_id')
        .eq('id', data.offer_id)
        .single();

      if (offerWithApp) {
        await supabase
          .from('job_applications')
          .update({ status: ApplicationStatus.ACCEPTED })
          .eq('id', offerWithApp.application_id);
      }
    }

    return offer;
  }

  /**
   * Get offer for an application
   */
  static async getOfferForApplication(applicationId: string): Promise<OfferLetter | null> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('offer_letters')
      .select('*')
      .eq('application_id', applicationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching offer:', error);
      throw new Error(`Failed to fetch offer: ${error.message}`);
    }

    return data;
  }

  // =====================================================
  // STATISTICS & ANALYTICS
  // =====================================================

  /**
   * Get hiring hub statistics for a school
   */
  static async getHiringHubStats(preschoolId: string): Promise<HiringHubStats> {
    const supabase = assertSupabase();

    try {
      // Get job postings stats
      const { count: totalPostings } = await supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId);

      const { count: activePostings } = await supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('status', 'active');

      // Get applications stats
      const { data: applications } = await supabase
        .from('job_applications')
        .select('status, job_posting:job_postings!inner(preschool_id)')
        .eq('job_posting.preschool_id', preschoolId);

      const totalApplications = applications?.length || 0;
      const pendingReviews = applications?.filter(
        (app: any) => app.status === ApplicationStatus.NEW
      ).length || 0;
      const shortlisted = applications?.filter(
        (app: any) => app.status === ApplicationStatus.SHORTLISTED
      ).length || 0;
      const interviewScheduled = applications?.filter(
        (app: any) => app.status === ApplicationStatus.INTERVIEW_SCHEDULED
      ).length || 0;

      // Get pending offers
      const { data: offers } = await supabase
        .from('offer_letters')
        .select('status, application:job_applications!inner(job_posting:job_postings!inner(preschool_id))')
        .eq('status', 'pending');

      const pendingOffers = offers?.filter(
        (offer: any) => offer.application?.job_posting?.preschool_id === preschoolId
      ).length || 0;

      return {
        total_job_postings: totalPostings || 0,
        active_job_postings: activePostings || 0,
        total_applications: totalApplications,
        pending_reviews: pendingReviews,
        shortlisted_candidates: shortlisted,
        scheduled_interviews: interviewScheduled,
        pending_offers: pendingOffers,
      };
    } catch (error) {
      console.error('Error fetching hiring hub stats:', error);
      // Return zeros on error
      return {
        total_job_postings: 0,
        active_job_postings: 0,
        total_applications: 0,
        pending_reviews: 0,
        shortlisted_candidates: 0,
        scheduled_interviews: 0,
        pending_offers: 0,
      };
    }
  }

  // =====================================================
  // JOB DISTRIBUTION TRACKING
  // =====================================================

  /**
   * Track job distribution event across different channels
   */
  static async trackJobDistribution(data: {
    job_posting_id: string;
    channel: 'whatsapp' | 'email' | 'sms' | 'social_media' | 'public_board';
    distributed_by: string;
    recipients_count?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const supabase = assertSupabase();

    const { error } = await supabase
      .from('job_distributions')
      .insert({
        job_posting_id: data.job_posting_id,
        channel: data.channel,
        distributed_by: data.distributed_by,
        recipients_count: data.recipients_count || 0,
        metadata: data.metadata || {},
      });

    if (error) {
      console.error('Error tracking job distribution:', error);
      // Non-fatal - don't throw, just log
    }
  }

  // =====================================================
  // STORAGE HELPERS
  // =====================================================

  /**
   * Upload resume file to storage
   */
  static async uploadResume(
    file: File | Blob,
    candidateEmail: string,
    originalFilename: string
  ): Promise<string> {
    const supabase = assertSupabase();

    // Generate unique filename using the helper function
    const { data: filename, error: filenameError } = await supabase
      .rpc('generate_resume_filename', {
        candidate_email: candidateEmail,
        original_filename: originalFilename,
      });

    if (filenameError) {
      console.error('Error generating filename:', filenameError);
      throw new Error('Failed to generate filename');
    }

    const filePath = filename as string;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('candidate-resumes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading resume:', uploadError);
      throw new Error(`Failed to upload resume: ${uploadError.message}`);
    }

    return filePath;
  }

  /**
   * Get public URL for resume
   */
  static async getResumeUrl(filePath: string): Promise<string> {
    const supabase = assertSupabase();

    const { data } = supabase.storage
      .from('candidate-resumes')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Download resume as blob
   */
  static async downloadResume(filePath: string): Promise<Blob> {
    const supabase = assertSupabase();

    const { data, error } = await supabase.storage
      .from('candidate-resumes')
      .download(filePath);

    if (error) {
      console.error('Error downloading resume:', error);
      throw new Error(`Failed to download resume: ${error.message}`);
    }

    return data;
  }
}

export default HiringHubService;
