/**
 * Hiring Hub Type Definitions
 * Phase 1, Epic 1.1: Hiring Hub
 * 
 * TypeScript interfaces and enums for teacher recruitment system
 */

// =====================================================
// ENUMS
// =====================================================

export enum JobPostingStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  DRAFT = 'draft',
}

export enum ApplicationStatus {
  NEW = 'new',
  UNDER_REVIEW = 'under_review',
  SHORTLISTED = 'shortlisted',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum EmploymentType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
}

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

// =====================================================
// INTERFACES
// =====================================================

export interface JobPosting {
  id: string;
  preschool_id: string;
  title: string;
  description: string;
  requirements?: string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  location?: string | null;
  employment_type: EmploymentType;
  status: JobPostingStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

export interface CandidateProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  location?: string | null;
  experience_years: number;
  qualifications: QualificationRecord[];
  skills: string[];
  created_at: string;
}

export interface QualificationRecord {
  degree?: string;
  institution?: string;
  year?: number;
  field?: string;
}

export interface JobApplication {
  id: string;
  job_posting_id: string;
  candidate_profile_id: string;
  status: ApplicationStatus;
  cover_letter?: string | null;
  resume_file_path?: string | null;
  applied_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  notes?: string | null;
  
  // Joined data (optional, for enriched queries)
  job_posting?: JobPosting;
  candidate_profile?: CandidateProfile;
}

export interface InterviewSchedule {
  id: string;
  application_id: string;
  scheduled_by: string;
  interview_date: string; // Date in ISO format
  interview_time: string; // Time in HH:MM:SS format
  meeting_link?: string | null;
  location?: string | null;
  notes?: string | null;
  status: InterviewStatus;
  created_at: string;
  
  // Joined data (optional)
  application?: JobApplication;
}

export interface OfferLetter {
  id: string;
  application_id: string;
  salary_offered: number;
  start_date: string; // Date in ISO format
  employment_type: EmploymentType;
  terms: OfferTerms;
  generated_by: string;
  generated_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  status: OfferStatus;
  
  // Joined data (optional)
  application?: JobApplication;
}

export interface OfferTerms {
  benefits?: string[];
  probation_period_months?: number;
  notice_period_days?: number;
  work_hours?: string;
  leave_days?: number;
  additional_notes?: string;
  [key: string]: any; // Allow flexible terms
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateJobPostingRequest {
  preschool_id: string;
  title: string;
  description: string;
  requirements?: string;
  salary_range_min?: number;
  salary_range_max?: number;
  location?: string;
  employment_type: EmploymentType;
  expires_at?: string;
  status?: JobPostingStatus;
}

export interface UpdateJobPostingRequest {
  title?: string;
  description?: string;
  requirements?: string;
  salary_range_min?: number;
  salary_range_max?: number;
  location?: string;
  employment_type?: EmploymentType;
  expires_at?: string;
  status?: JobPostingStatus;
}

export interface CreateCandidateProfileRequest {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  location?: string;
  experience_years: number;
  qualifications?: QualificationRecord[];
  skills?: string[];
}

export interface SubmitApplicationRequest {
  job_posting_id: string;
  candidate_profile_id: string;
  cover_letter?: string;
  resume_file?: File | Blob;
}

export interface ReviewApplicationRequest {
  application_id: string;
  status: ApplicationStatus;
  notes?: string;
}

export interface ScheduleInterviewRequest {
  application_id: string;
  interview_date: string;
  interview_time: string;
  meeting_link?: string;
  location?: string;
  notes?: string;
}

export interface GenerateOfferRequest {
  application_id: string;
  salary_offered: number;
  start_date: string;
  employment_type: EmploymentType;
  terms?: OfferTerms;
}

export interface RespondToOfferRequest {
  offer_id: string;
  accepted: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface HiringHubStats {
  total_job_postings: number;
  active_job_postings: number;
  total_applications: number;
  pending_reviews: number;
  shortlisted_candidates: number;
  scheduled_interviews: number;
  pending_offers: number;
}

export interface ApplicationWithDetails extends JobApplication {
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  candidate_experience_years: number;
  job_title: string;
  has_resume: boolean;
}

// =====================================================
// FILTER/SEARCH TYPES
// =====================================================

export interface ApplicationFilters {
  status?: ApplicationStatus[];
  experience_min?: number;
  experience_max?: number;
  location?: string;
  search_query?: string; // Search by name, email, skills
}

export interface ApplicationSortOptions {
  sort_by: 'applied_at' | 'experience_years' | 'candidate_name';
  sort_order: 'asc' | 'desc';
}

// =====================================================
// VALIDATION HELPERS
// =====================================================

export const isValidApplicationStatus = (status: string): status is ApplicationStatus => {
  return Object.values(ApplicationStatus).includes(status as ApplicationStatus);
};

export const isValidJobPostingStatus = (status: string): status is JobPostingStatus => {
  return Object.values(JobPostingStatus).includes(status as JobPostingStatus);
};

export const isValidEmploymentType = (type: string): type is EmploymentType => {
  return Object.values(EmploymentType).includes(type as EmploymentType);
};

// =====================================================
// DISPLAY HELPERS
// =====================================================

export const getApplicationStatusLabel = (status: ApplicationStatus): string => {
  const labels: Record<ApplicationStatus, string> = {
    [ApplicationStatus.NEW]: 'New Application',
    [ApplicationStatus.UNDER_REVIEW]: 'Under Review',
    [ApplicationStatus.SHORTLISTED]: 'Shortlisted',
    [ApplicationStatus.INTERVIEW_SCHEDULED]: 'Interview Scheduled',
    [ApplicationStatus.OFFERED]: 'Offer Sent',
    [ApplicationStatus.ACCEPTED]: 'Accepted',
    [ApplicationStatus.REJECTED]: 'Rejected',
  };
  return labels[status] || status;
};

export const getApplicationStatusColor = (status: ApplicationStatus): string => {
  const colors: Record<ApplicationStatus, string> = {
    [ApplicationStatus.NEW]: '#3B82F6', // Blue
    [ApplicationStatus.UNDER_REVIEW]: '#F59E0B', // Amber
    [ApplicationStatus.SHORTLISTED]: '#8B5CF6', // Purple
    [ApplicationStatus.INTERVIEW_SCHEDULED]: '#EC4899', // Pink
    [ApplicationStatus.OFFERED]: '#10B981', // Green
    [ApplicationStatus.ACCEPTED]: '#059669', // Dark Green
    [ApplicationStatus.REJECTED]: '#EF4444', // Red
  };
  return colors[status] || '#6B7280';
};

export const getEmploymentTypeLabel = (type: EmploymentType): string => {
  const labels: Record<EmploymentType, string> = {
    [EmploymentType.FULL_TIME]: 'Full-Time',
    [EmploymentType.PART_TIME]: 'Part-Time',
    [EmploymentType.CONTRACT]: 'Contract',
    [EmploymentType.TEMPORARY]: 'Temporary',
  };
  return labels[type] || type;
};

export const formatSalaryRange = (min?: number | null, max?: number | null, currency: string = 'R'): string => {
  if (!min && !max) return 'Not specified';
  if (min && !max) return `${currency}${min.toLocaleString()}+`;
  if (!min && max) return `Up to ${currency}${max.toLocaleString()}`;
  return `${currency}${min?.toLocaleString()} - ${currency}${max?.toLocaleString()}`;
};

export const getCandidateFullName = (candidate: CandidateProfile): string => {
  return `${candidate.first_name} ${candidate.last_name}`.trim();
};

export const getExperienceLabel = (years: number): string => {
  if (years === 0) return 'Entry Level';
  if (years === 1) return '1 year';
  return `${years} years`;
};
