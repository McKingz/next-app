export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string | null
          age_appropriate_max: number | null
          age_appropriate_min: number | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration: number | null
          id: string
          instructions: string | null
          is_active: boolean | null
          lesson_id: string | null
          materials_needed: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          age_appropriate_max?: number | null
          age_appropriate_min?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          lesson_id?: string | null
          materials_needed?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          age_appropriate_max?: number | null
          age_appropriate_min?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          lesson_id?: string | null
          materials_needed?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_feed: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          preschool_id: string
          target_id: string
          target_type: string
          visibility: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          preschool_id: string
          target_id: string
          target_type: string
          visibility?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          preschool_id?: string
          target_id?: string
          target_type?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      activity_progress: {
        Row: {
          activity_id: string
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          score: number | null
          student_id: string
          time_spent_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          activity_id: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          student_id: string
          time_spent_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          activity_id?: string
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          score?: number | null
          student_id?: string
          time_spent_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_progress_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      addresses: {
        Row: {
          address_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          postal_code: string | null
          state: string | null
          street_address: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          last_login_at: string | null
          permissions: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_login_at?: string | null
          permissions?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_login_at?: string | null
          permissions?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      age_groups: {
        Row: {
          age_max: number | null
          age_min: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_age_months: number | null
          min_age_months: number | null
          name: string
          preschool_id: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_age_months?: number | null
          min_age_months?: number | null
          name: string
          preschool_id?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_age_months?: number | null
          min_age_months?: number | null
          name?: string
          preschool_id?: string | null
        }
        Relationships: []
      }
      ai_admin_actions: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          details: Json
          id: string
          target_preschool_id: string | null
          target_scope: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          details?: Json
          id?: string
          target_preschool_id?: string | null
          target_scope?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_preschool_id?: string | null
          target_scope?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_admin_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_admin_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_admin_actions_target_preschool_id_fkey"
            columns: ["target_preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_overage_logs: {
        Row: {
          amount: number
          created_at: string
          feature: string
          id: string
          units: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          feature: string
          id?: string
          units?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          feature?: string
          id?: string
          units?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_overage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_overage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_services: {
        Row: {
          created_at: string
          id: string
          input_cost_per_1k_tokens: number
          is_active: boolean | null
          is_available: boolean | null
          model_version: string
          name: string
          output_cost_per_1k_tokens: number
          provider: string
          rate_limit_per_day: number | null
          rate_limit_per_hour: number | null
          rate_limit_per_minute: number | null
          supports_grading: boolean | null
          supports_homework_help: boolean | null
          supports_lesson_generation: boolean | null
          supports_stem_activities: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_cost_per_1k_tokens: number
          is_active?: boolean | null
          is_available?: boolean | null
          model_version: string
          name: string
          output_cost_per_1k_tokens: number
          provider: string
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          supports_grading?: boolean | null
          supports_homework_help?: boolean | null
          supports_lesson_generation?: boolean | null
          supports_stem_activities?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          input_cost_per_1k_tokens?: number
          is_active?: boolean | null
          is_available?: boolean | null
          model_version?: string
          name?: string
          output_cost_per_1k_tokens?: number
          provider?: string
          rate_limit_per_day?: number | null
          rate_limit_per_hour?: number | null
          rate_limit_per_minute?: number | null
          supports_grading?: boolean | null
          supports_homework_help?: boolean | null
          supports_lesson_generation?: boolean | null
          supports_stem_activities?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          ai_confidence_score: number | null
          ai_model_used: string | null
          ai_service_id: string
          ai_temperature: number | null
          created_at: string
          error_message: string | null
          id: string
          input_cost: number | null
          input_text: string | null
          input_tokens: number | null
          organization_id: string
          output_cost: number | null
          output_text: string | null
          output_tokens: number | null
          preschool_id: string | null
          request_context: string | null
          response_time_ms: number | null
          service_type: string
          session_id: string | null
          status: string
          system_prompt: string | null
          total_cost: number | null
          user_feedback: string | null
          user_id: string
          user_rating: number | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_model_used?: string | null
          ai_service_id: string
          ai_temperature?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_cost?: number | null
          input_text?: string | null
          input_tokens?: number | null
          organization_id: string
          output_cost?: number | null
          output_text?: string | null
          output_tokens?: number | null
          preschool_id?: string | null
          request_context?: string | null
          response_time_ms?: number | null
          service_type: string
          session_id?: string | null
          status: string
          system_prompt?: string | null
          total_cost?: number | null
          user_feedback?: string | null
          user_id: string
          user_rating?: number | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_model_used?: string | null
          ai_service_id?: string
          ai_temperature?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_cost?: number | null
          input_text?: string | null
          input_tokens?: number | null
          organization_id?: string
          output_cost?: number | null
          output_text?: string | null
          output_tokens?: number | null
          preschool_id?: string | null
          request_context?: string | null
          response_time_ms?: number | null
          service_type?: string
          session_id?: string | null
          status?: string
          system_prompt?: string | null
          total_cost?: number | null
          user_feedback?: string | null
          user_id?: string
          user_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_ai_service_id_fkey"
            columns: ["ai_service_id"]
            isOneToOne: false
            referencedRelation: "ai_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_resets: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          mode: string
          reason: string | null
          requested_by_user_id: string
          status: string
          target_preschool_id: string | null
          target_scope: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string
          reason?: string | null
          requested_by_user_id: string
          status?: string
          target_preschool_id?: string | null
          target_scope: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string
          reason?: string | null
          requested_by_user_id?: string
          status?: string
          target_preschool_id?: string | null
          target_scope?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_resets_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_resets_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_resets_target_preschool_id_fkey"
            columns: ["target_preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_resets_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_resets_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_published: boolean | null
          preschool_id: string | null
          priority: string | null
          published_at: string | null
          target_audience: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          preschool_id?: string | null
          priority?: string | null
          published_at?: string | null
          target_audience?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_published?: boolean | null
          preschool_id?: string | null
          priority?: string | null
          published_at?: string | null
          target_audience?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_rubrics: {
        Row: {
          age_group_id: string | null
          created_at: string | null
          created_by: string
          criteria: Json
          description: string | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          name: string
          preschool_id: string
          scoring_scale: Json
          subject_area: string | null
          updated_at: string | null
        }
        Insert: {
          age_group_id?: string | null
          created_at?: string | null
          created_by: string
          criteria: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          preschool_id: string
          scoring_scale: Json
          subject_area?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group_id?: string | null
          created_at?: string | null
          created_by?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          preschool_id?: string
          scoring_scale?: Json
          subject_area?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_rubrics_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_rubrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_rubrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_rubrics_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessment_type: string | null
          class_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_published: boolean | null
          student_id: string | null
          teacher_id: string | null
          title: string
          total_points: number | null
          updated_at: string | null
        }
        Insert: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_published?: boolean | null
          student_id?: string | null
          teacher_id?: string | null
          title: string
          total_points?: number | null
          updated_at?: string | null
        }
        Update: {
          assessment_type?: string | null
          class_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_published?: boolean | null
          student_id?: string | null
          teacher_id?: string | null
          title?: string
          total_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assessment_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assessment_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_assessment_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_grades: {
        Row: {
          ai_confidence: number | null
          ai_feedback: string | null
          ai_generated: boolean | null
          created_at: string
          feedback: string | null
          id: string
          letter_grade: string | null
          max_points: number | null
          percentage: number | null
          points_earned: number | null
          private_notes: string | null
          published_at: string | null
          status: string
          submission_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_generated?: boolean | null
          created_at?: string
          feedback?: string | null
          id?: string
          letter_grade?: string | null
          max_points?: number | null
          percentage?: number | null
          points_earned?: number | null
          private_notes?: string | null
          published_at?: string | null
          status?: string
          submission_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_feedback?: string | null
          ai_generated?: boolean | null
          created_at?: string
          feedback?: string | null
          id?: string
          letter_grade?: string | null
          max_points?: number | null
          percentage?: number | null
          points_earned?: number | null
          private_notes?: string | null
          published_at?: string | null
          status?: string
          submission_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_grades_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "assignment_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_rubrics: {
        Row: {
          assignment_id: string
          created_at: string
          criteria_description: string | null
          criteria_name: string
          id: string
          max_points: number
          rubric_levels: Json
          updated_at: string
          weight: number | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          criteria_description?: string | null
          criteria_name: string
          id?: string
          max_points?: number
          rubric_levels?: Json
          updated_at?: string
          weight?: number | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          criteria_description?: string | null
          criteria_name?: string
          id?: string
          max_points?: number
          rubric_levels?: Json
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_rubrics_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attachment_urls: string[] | null
          created_at: string | null
          feedback: string | null
          file_urls: string[] | null
          grade: string | null
          graded_at: string | null
          homework_assignment_id: string
          id: string
          status: string | null
          student_id: string
          submission_text: string | null
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string
          attachment_urls?: string[] | null
          created_at?: string | null
          feedback?: string | null
          file_urls?: string[] | null
          grade?: string | null
          graded_at?: string | null
          homework_assignment_id: string
          id?: string
          status?: string | null
          student_id: string
          submission_text?: string | null
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          attachment_urls?: string[] | null
          created_at?: string | null
          feedback?: string | null
          file_urls?: string[] | null
          grade?: string | null
          graded_at?: string | null
          homework_assignment_id?: string
          id?: string
          status?: string | null
          student_id?: string
          submission_text?: string | null
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_homework_assignment_id_fkey"
            columns: ["homework_assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          ai_assistance_enabled: boolean | null
          ai_grading_enabled: boolean | null
          assigned_date: string
          category_id: string | null
          class_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          is_visible_to_parents: boolean | null
          is_visible_to_students: boolean | null
          max_points: number | null
          organization_id: string
          status: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ai_assistance_enabled?: boolean | null
          ai_grading_enabled?: boolean | null
          assigned_date?: string
          category_id?: string | null
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_visible_to_parents?: boolean | null
          is_visible_to_students?: boolean | null
          max_points?: number | null
          organization_id: string
          status?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          ai_assistance_enabled?: boolean | null
          ai_grading_enabled?: boolean | null
          assigned_date?: string
          category_id?: string | null
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_visible_to_parents?: boolean | null
          is_visible_to_students?: boolean | null
          max_points?: number | null
          organization_id?: string
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "assignment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          arrival_time: string | null
          attendance_date: string
          created_at: string | null
          departure_time: string | null
          id: string
          notes: string | null
          recorded_by: string
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          arrival_time?: string | null
          attendance_date?: string
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          recorded_by: string
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          arrival_time?: string | null
          attendance_date?: string
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          recorded_by?: string
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_attendance_recorded_by"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_recorded_by"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attendance_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          arrival_time: string | null
          attendance_date: string
          attendance_rate: number | null
          class_id: string
          created_at: string | null
          departure_time: string | null
          id: string
          notes: string | null
          status: string
          student_id: string
          updated_at: string | null
        }
        Insert: {
          arrival_time?: string | null
          attendance_date?: string
          attendance_rate?: number | null
          class_id: string
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id: string
          updated_at?: string | null
        }
        Update: {
          arrival_time?: string | null
          attendance_date?: string
          attendance_rate?: number | null
          class_id?: string
          created_at?: string | null
          departure_time?: string | null
          id?: string
          notes?: string | null
          status?: string
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          app_version: string | null
          auth_user_id: string
          build_channel: string | null
          category: string | null
          consent_diagnostics: boolean
          created_at: string
          description: string
          device_info: Json | null
          id: string
          persona: string | null
          platform: string | null
          role: string | null
          screen: string | null
          severity: string | null
          steps: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          auth_user_id: string
          build_channel?: string | null
          category?: string | null
          consent_diagnostics?: boolean
          created_at?: string
          description: string
          device_info?: Json | null
          id?: string
          persona?: string | null
          platform?: string | null
          role?: string | null
          screen?: string | null
          severity?: string | null
          steps?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          auth_user_id?: string
          build_channel?: string | null
          category?: string | null
          consent_diagnostics?: boolean
          created_at?: string
          description?: string
          device_info?: Json | null
          id?: string
          persona?: string | null
          platform?: string | null
          role?: string | null
          screen?: string | null
          severity?: string | null
          steps?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback_attachments: {
        Row: {
          created_at: string
          feedback_id: string
          file_path: string
          id: string
        }
        Insert: {
          created_at?: string
          feedback_id: string
          file_path: string
          id?: string
        }
        Update: {
          created_at?: string
          feedback_id?: string
          file_path?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_attachments_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "beta_feedback"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cycles: {
        Row: {
          amount: number
          auto_renew: boolean | null
          billing_period: string
          created_at: string | null
          cycle_end: string
          cycle_start: string
          id: string
          next_billing_date: string | null
          preschool_id: string
          status: string
          subscription_plan_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          auto_renew?: boolean | null
          billing_period: string
          created_at?: string | null
          cycle_end: string
          cycle_start: string
          id?: string
          next_billing_date?: string | null
          preschool_id: string
          status?: string
          subscription_plan_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          auto_renew?: boolean | null
          billing_period?: string
          created_at?: string | null
          cycle_end?: string
          cycle_start?: string
          id?: string
          next_billing_date?: string | null
          preschool_id?: string
          status?: string
          subscription_plan_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_cycles_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_cycles_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          due_date: string
          id: string
          invoice_data: Json | null
          invoice_number: string
          paid_at: string | null
          school_id: string | null
          status: string
          subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          due_date: string
          id?: string
          invoice_data?: Json | null
          invoice_number: string
          paid_at?: string | null
          school_id?: string | null
          status: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          invoice_data?: Json | null
          invoice_number?: string
          paid_at?: string | null
          school_id?: string | null
          status?: string
          subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_preferences: {
        Row: {
          created_at: string
          overage_enabled: boolean
          overage_price_per_unit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          overage_enabled?: boolean
          overage_price_per_unit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          overage_enabled?: boolean
          overage_price_per_unit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      class_assignments: {
        Row: {
          assigned_date: string | null
          class_id: string | null
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_date?: string | null
          class_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_date?: string | null
          class_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          age_group: string | null
          age_group_id: string | null
          age_max: number | null
          age_min: number | null
          capacity: number | null
          created_at: string | null
          current_enrollment: number
          id: string
          is_active: boolean | null
          max_capacity: number
          name: string
          preschool_id: string
          room_number: string | null
          teacher_id: string | null
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          age_group_id?: string | null
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string | null
          current_enrollment?: number
          id?: string
          is_active?: boolean | null
          max_capacity?: number
          name: string
          preschool_id: string
          room_number?: string | null
          teacher_id?: string | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          age_group_id?: string | null
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string | null
          current_enrollment?: number
          id?: string
          is_active?: boolean | null
          max_capacity?: number
          name?: string
          preschool_id?: string
          room_number?: string | null
          teacher_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_reports: {
        Row: {
          achievement_badges: string[] | null
          activities_summary: Json | null
          areas_for_improvement: string | null
          bathroom_visits: number | null
          behavior_notes: string | null
          class_id: string | null
          created_at: string | null
          diaper_changes: number | null
          follow_up_needed: boolean | null
          health_observations: string | null
          id: string
          incidents: string | null
          is_sent_to_parents: boolean | null
          learning_highlights: string | null
          meals_eaten: string[] | null
          media_highlights: string[] | null
          medications_given: string[] | null
          mood_rating: number | null
          nap_time_end: string | null
          nap_time_start: string | null
          next_steps: string | null
          parent_acknowledgment: string | null
          parent_message: string | null
          parent_viewed_at: string | null
          participation_level: string | null
          photo_count: number | null
          preschool_id: string
          report_date: string
          report_type: string
          sent_at: string | null
          skills_developed: string[] | null
          social_interactions: string | null
          student_id: string
          teacher_id: string
          temperature_checks: Json | null
          total_activities: number | null
          updated_at: string | null
        }
        Insert: {
          achievement_badges?: string[] | null
          activities_summary?: Json | null
          areas_for_improvement?: string | null
          bathroom_visits?: number | null
          behavior_notes?: string | null
          class_id?: string | null
          created_at?: string | null
          diaper_changes?: number | null
          follow_up_needed?: boolean | null
          health_observations?: string | null
          id?: string
          incidents?: string | null
          is_sent_to_parents?: boolean | null
          learning_highlights?: string | null
          meals_eaten?: string[] | null
          media_highlights?: string[] | null
          medications_given?: string[] | null
          mood_rating?: number | null
          nap_time_end?: string | null
          nap_time_start?: string | null
          next_steps?: string | null
          parent_acknowledgment?: string | null
          parent_message?: string | null
          parent_viewed_at?: string | null
          participation_level?: string | null
          photo_count?: number | null
          preschool_id: string
          report_date: string
          report_type: string
          sent_at?: string | null
          skills_developed?: string[] | null
          social_interactions?: string | null
          student_id: string
          teacher_id: string
          temperature_checks?: Json | null
          total_activities?: number | null
          updated_at?: string | null
        }
        Update: {
          achievement_badges?: string[] | null
          activities_summary?: Json | null
          areas_for_improvement?: string | null
          bathroom_visits?: number | null
          behavior_notes?: string | null
          class_id?: string | null
          created_at?: string | null
          diaper_changes?: number | null
          follow_up_needed?: boolean | null
          health_observations?: string | null
          id?: string
          incidents?: string | null
          is_sent_to_parents?: boolean | null
          learning_highlights?: string | null
          meals_eaten?: string[] | null
          media_highlights?: string[] | null
          medications_given?: string[] | null
          mood_rating?: number | null
          nap_time_end?: string | null
          nap_time_start?: string | null
          next_steps?: string | null
          parent_acknowledgment?: string | null
          parent_message?: string | null
          parent_viewed_at?: string | null
          participation_level?: string | null
          photo_count?: number | null
          preschool_id?: string
          report_date?: string
          report_type?: string
          sent_at?: string | null
          skills_developed?: string[] | null
          social_interactions?: string | null
          student_id?: string
          teacher_id?: string
          temperature_checks?: Json | null
          total_activities?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_reports_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_reports_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_reports_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          cleared_at: string | null
          conversation_id: string
          id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          cleared_at?: string | null
          conversation_id: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          cleared_at?: string | null
          conversation_id?: string
          id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string | null
          preschool_id: string
          settings: Json
          type: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          preschool_id: string
          settings?: Json
          type?: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string | null
          preschool_id?: string
          settings?: Json
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_activities: {
        Row: {
          activity_date: string | null
          activity_name: string
          class_id: string
          created_at: string | null
          created_by: string
          description: string | null
          end_time: string | null
          id: string
          learning_objectives: string[] | null
          materials_needed: string[] | null
          notes: string | null
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_name: string
          class_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          end_time?: string | null
          id?: string
          learning_objectives?: string[] | null
          materials_needed?: string[] | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_name?: string
          class_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_time?: string | null
          id?: string
          learning_objectives?: string[] | null
          materials_needed?: string[] | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_daily_activity_class"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_daily_activity_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_daily_activity_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_settings: {
        Row: {
          cleared_at: string | null
          created_at: string
          id: string
          is_muted: boolean
          partner_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          id?: string
          is_muted?: boolean
          partner_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          id?: string
          is_muted?: boolean
          partner_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_settings_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_settings_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          address: string | null
          can_pickup: boolean | null
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string
          relationship: string
          student_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          can_pickup?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone: string
          relationship: string
          student_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          can_pickup?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string
          relationship?: string
          student_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_leads: {
        Row: {
          contact_email: string
          contact_name: string | null
          country: string | null
          created_at: string
          id: string
          notes: string | null
          organization_name: string | null
          phone: string | null
          plan_interest: string | null
          role: string | null
          school_size: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_name?: string | null
          phone?: string | null
          plan_interest?: string | null
          role?: string | null
          school_size?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_name?: string | null
          phone?: string | null
          plan_interest?: string | null
          role?: string | null
          school_size?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: []
      }
      event_audiences: {
        Row: {
          audience_type: string
          created_at: string | null
          event_id: string
          id: string
          target_id: string | null
          target_value: string | null
        }
        Insert: {
          audience_type: string
          created_at?: string | null
          event_id: string
          id?: string
          target_id?: string | null
          target_value?: string | null
        }
        Update: {
          audience_type?: string
          created_at?: string | null
          event_id?: string
          id?: string
          target_id?: string | null
          target_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_audiences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          event_id: string
          id: string
          invited_at: string | null
          invitee_id: string
          inviter_id: string
          last_reminder_at: string | null
          reminder_count: number | null
          responded_at: string | null
          response_message: string | null
          status: string | null
        }
        Insert: {
          event_id: string
          id?: string
          invited_at?: string | null
          invitee_id: string
          inviter_id: string
          last_reminder_at?: string | null
          reminder_count?: number | null
          responded_at?: string | null
          response_message?: string | null
          status?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          invited_at?: string | null
          invitee_id?: string
          inviter_id?: string
          last_reminder_at?: string | null
          reminder_count?: number | null
          responded_at?: string | null
          response_message?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          media_type: string
          metadata: Json | null
          mime_type: string | null
          thumbnail_url: string | null
          update_id: string | null
          uploader_id: string
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          media_type: string
          metadata?: Json | null
          mime_type?: string | null
          thumbnail_url?: string | null
          update_id?: string | null
          uploader_id: string
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          media_type?: string
          metadata?: Json | null
          mime_type?: string | null
          thumbnail_url?: string | null
          update_id?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "event_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_media_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notifications: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          message: string | null
          metadata: Json | null
          notification_type: string
          read_at: string | null
          recipient_id: string
          sent_at: string | null
          title: string
          update_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          message?: string | null
          metadata?: Json | null
          notification_type: string
          read_at?: string | null
          recipient_id: string
          sent_at?: string | null
          title: string
          update_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          sent_at?: string | null
          title?: string
          update_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_notifications_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "event_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          created_at: string | null
          event_id: string
          id: string
          metadata: Json | null
          notes: string | null
          participation_type: string | null
          registered_at: string | null
          status: string | null
          student_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          participation_type?: string | null
          registered_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          metadata?: Json | null
          notes?: string | null
          participation_type?: string | null
          registered_at?: string | null
          status?: string | null
          student_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reactions: {
        Row: {
          content: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          id: string
          parent_reaction_id: string | null
          reaction_type: string
          update_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string
          parent_reaction_id?: string | null
          reaction_type: string
          update_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          id?: string
          parent_reaction_id?: string | null
          reaction_type?: string
          update_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_parent_reaction_id_fkey"
            columns: ["parent_reaction_id"]
            isOneToOne: false
            referencedRelation: "event_reactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "event_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      event_updates: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          deleted_at: string | null
          event_id: string
          id: string
          is_live: boolean | null
          metadata: Json | null
          posted_at: string | null
          title: string | null
          update_type: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          is_live?: boolean | null
          metadata?: Json | null
          posted_at?: string | null
          title?: string | null
          update_type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          is_live?: boolean | null
          metadata?: Json | null
          posted_at?: string | null
          title?: string | null
          update_type?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_updates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          audience_config: Json | null
          audience_type: string | null
          auto_accept_roles: string[] | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          current_participants: number | null
          description: string | null
          end_date: string | null
          event_type: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          location: string | null
          max_participants: number | null
          metadata: Json | null
          preschool_id: string | null
          requires_approval: boolean | null
          start_date: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          audience_config?: Json | null
          audience_type?: string | null
          auto_accept_roles?: string[] | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          location?: string | null
          max_participants?: number | null
          metadata?: Json | null
          preschool_id?: string | null
          requires_approval?: boolean | null
          start_date: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          audience_config?: Json | null
          audience_type?: string | null
          auto_accept_roles?: string[] | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          current_participants?: number | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          location?: string | null
          max_participants?: number | null
          metadata?: Json | null
          preschool_id?: string | null
          requires_approval?: boolean | null
          start_date?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invitations: {
        Row: {
          expires_at: string | null
          group_id: string
          id: string
          invited_at: string | null
          invitee_id: string
          inviter_id: string
          message: string | null
          responded_at: string | null
          status: string | null
        }
        Insert: {
          expires_at?: string | null
          group_id: string
          id?: string
          invited_at?: string | null
          invitee_id: string
          inviter_id: string
          message?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Update: {
          expires_at?: string | null
          group_id?: string
          id?: string
          invited_at?: string | null
          invitee_id?: string
          inviter_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invitations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "principal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          invited_by: string | null
          joined_at: string | null
          permissions: Json | null
          role_in_group: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role_in_group?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role_in_group?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "principal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          class_id: string | null
          created_at: string | null
          description: string | null
          difficulty_level: number | null
          due_date: string | null
          due_date_offset_days: number | null
          estimated_time_minutes: number | null
          id: string
          instructions: string | null
          is_active: boolean | null
          is_published: boolean | null
          is_required: boolean | null
          lesson_id: string | null
          materials_needed: string | null
          points_possible: number | null
          preschool_id: string | null
          teacher_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          due_date?: string | null
          due_date_offset_days?: number | null
          estimated_time_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          is_required?: boolean | null
          lesson_id?: string | null
          materials_needed?: string | null
          points_possible?: number | null
          preschool_id?: string | null
          teacher_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          due_date?: string | null
          due_date_offset_days?: number | null
          estimated_time_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_published?: boolean | null
          is_required?: boolean | null
          lesson_id?: string | null
          materials_needed?: string | null
          points_possible?: number | null
          preschool_id?: string | null
          teacher_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          assignment_id: string | null
          created_at: string | null
          feedback: string | null
          file_urls: string[] | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          homework_assignment_id: string | null
          id: string
          status: string | null
          student_id: string | null
          submission_text: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string | null
          feedback?: string | null
          file_urls?: string[] | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_assignment_id?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string | null
          feedback?: string | null
          file_urls?: string[] | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          homework_assignment_id?: string | null
          id?: string
          status?: string | null
          student_id?: string | null
          submission_text?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_homework_assignment_id_fkey"
            columns: ["homework_assignment_id"]
            isOneToOne: false
            referencedRelation: "homework_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      independent_children: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          first_name: string
          grade_level: string | null
          id: string
          is_active: boolean | null
          last_name: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name: string
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string
          grade_level?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "independent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "independent_children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      independent_content_library: {
        Row: {
          age_group: string | null
          content_type: string | null
          content_url: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_free: boolean | null
          preview_url: string | null
          price_cents: number | null
          subject: string | null
          title: string
        }
        Insert: {
          age_group?: string | null
          content_type?: string | null
          content_url?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          preview_url?: string | null
          price_cents?: number | null
          subject?: string | null
          title: string
        }
        Update: {
          age_group?: string | null
          content_type?: string | null
          content_url?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          preview_url?: string | null
          price_cents?: number | null
          subject?: string | null
          title?: string
        }
        Relationships: []
      }
      invitation_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          is_active: boolean | null
          preschool_id: string | null
          role: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          preschool_id?: string | null
          role: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          is_active?: boolean | null
          preschool_id?: string | null
          role?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activities: {
        Row: {
          activity_type: string | null
          age_group_id: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          is_active: boolean | null
          materials: string | null
          subject: string | null
          title: string
        }
        Insert: {
          activity_type?: string | null
          age_group_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          materials?: string | null
          subject?: string | null
          title: string
        }
        Update: {
          activity_type?: string | null
          age_group_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          materials?: string | null
          subject?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activities_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_categories: {
        Row: {
          color_code: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color_code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color_code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          age_group_max: number | null
          age_group_min: number | null
          category_id: string | null
          content: string | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          duration_minutes: number | null
          id: string
          is_ai_generated: boolean | null
          is_public: boolean | null
          materials_needed: string | null
          objectives: string[] | null
          preschool_id: string | null
          teacher_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          age_group_max?: number | null
          age_group_min?: number | null
          category_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          materials_needed?: string | null
          objectives?: string[] | null
          preschool_id?: string | null
          teacher_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          age_group_max?: number | null
          age_group_min?: number | null
          category_id?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_minutes?: number | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          materials_needed?: string | null
          objectives?: string[] | null
          preschool_id?: string | null
          teacher_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lesson_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      media_uploads: {
        Row: {
          created_at: string | null
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          is_public: boolean | null
          metadata: Json | null
          original_filename: string | null
          preschool_id: string | null
          storage_path: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename: string
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          original_filename?: string | null
          preschool_id?: string | null
          storage_path?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          original_filename?: string | null
          preschool_id?: string | null
          storage_path?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_uploads_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_action_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          session_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          session_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          session_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          camera_enabled_duration: number | null
          created_at: string
          duration_seconds: number | null
          id: string
          invitation_status: string | null
          invited_by: string | null
          joined_at: string | null
          left_at: string | null
          microphone_enabled_duration: number | null
          role: string
          screen_shared: boolean | null
          session_id: string
          user_id: string
        }
        Insert: {
          camera_enabled_duration?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          invitation_status?: string | null
          invited_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          microphone_enabled_duration?: number | null
          role?: string
          screen_shared?: boolean | null
          session_id: string
          user_id: string
        }
        Update: {
          camera_enabled_duration?: number | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          invitation_status?: string | null
          invited_by?: string | null
          joined_at?: string | null
          left_at?: string | null
          microphone_enabled_duration?: number | null
          role?: string
          screen_shared?: boolean | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_rooms: {
        Row: {
          access_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_recording_enabled: boolean | null
          is_screen_sharing_enabled: boolean | null
          is_whiteboard_enabled: boolean | null
          max_participants: number | null
          name: string
          organization_id: string
          requires_approval: boolean | null
          room_type: string
          updated_at: string
        }
        Insert: {
          access_type?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_recording_enabled?: boolean | null
          is_screen_sharing_enabled?: boolean | null
          is_whiteboard_enabled?: boolean | null
          max_participants?: number | null
          name: string
          organization_id: string
          requires_approval?: boolean | null
          room_type?: string
          updated_at?: string
        }
        Update: {
          access_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_recording_enabled?: boolean | null
          is_screen_sharing_enabled?: boolean | null
          is_whiteboard_enabled?: boolean | null
          max_participants?: number | null
          name?: string
          organization_id?: string
          requires_approval?: boolean | null
          room_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_rooms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sessions: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          agenda: string | null
          created_at: string
          external_meeting_id: string | null
          external_meeting_url: string | null
          host_id: string
          id: string
          is_recorded: boolean | null
          meeting_notes: string | null
          recording_url: string | null
          room_id: string
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          agenda?: string | null
          created_at?: string
          external_meeting_id?: string | null
          external_meeting_url?: string | null
          host_id: string
          id?: string
          is_recorded?: boolean | null
          meeting_notes?: string | null
          recording_url?: string | null
          room_id: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          agenda?: string | null
          created_at?: string
          external_meeting_id?: string | null
          external_meeting_url?: string | null
          host_id?: string
          id?: string
          is_recorded?: boolean | null
          meeting_notes?: string | null
          recording_url?: string | null
          room_id?: string
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "meeting_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_shared_resources: {
        Row: {
          created_at: string
          description: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          resource_id: string | null
          session_id: string
          shared_at: string | null
          shared_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          resource_id?: string | null
          session_id: string
          shared_at?: string | null
          shared_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          resource_id?: string | null
          session_id?: string
          shared_at?: string | null
          shared_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_shared_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_shared_resources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "meeting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_drafts: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          recipient_ids: string[] | null
          sender_id: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          recipient_ids?: string[] | null
          sender_id?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          recipient_ids?: string[] | null
          sender_id?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_drafts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_drafts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          archived_at: string | null
          created_at: string | null
          id: string
          is_archived: boolean
          is_read: boolean
          message_id: string | null
          read_at: string | null
          recipient_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message_id?: string | null
          read_at?: string | null
          recipient_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean
          is_read?: boolean
          message_id?: string | null
          read_at?: string | null
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          preschool_id: string | null
          preview: string | null
          priority: string | null
          receiver_id: string | null
          receiver_type: string | null
          sender_id: string | null
          sender_type: string | null
          sent_at: string | null
          subject: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          preschool_id?: string | null
          preview?: string | null
          priority?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sender_id?: string | null
          sender_type?: string | null
          sent_at?: string | null
          subject?: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          preschool_id?: string | null
          preview?: string | null
          priority?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sender_id?: string | null
          sender_type?: string | null
          sent_at?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          delivery_status: string | null
          error_message: string | null
          id: string
          recipient_ids: string[] | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          recipient_ids?: string[] | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          recipient_ids?: string[] | null
          sent_at?: string | null
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_requests: {
        Row: {
          created_at: string | null
          id: string
          principal_email: string
          principal_name: string
          principal_phone: string | null
          school_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          principal_email: string
          principal_name: string
          principal_phone?: string | null
          school_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          principal_email?: string
          principal_name?: string
          principal_phone?: string | null
          school_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string | null
          seat_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string | null
          seat_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string | null
          seat_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          plan_tier: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          plan_tier?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          plan_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      overage_billing_records: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string | null
          currency: string | null
          id: string
          overage_units: number
          paid_at: string | null
          payment_reference: string | null
          payment_url: string | null
          quota_type: string
          status: Database["public"]["Enums"]["overage_billing_status"] | null
          total_amount: number
          unit_price: number
          updated_at: string | null
          usage_tracking_id: string
          user_id: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string | null
          currency?: string | null
          id?: string
          overage_units: number
          paid_at?: string | null
          payment_reference?: string | null
          payment_url?: string | null
          quota_type: string
          status?: Database["public"]["Enums"]["overage_billing_status"] | null
          total_amount: number
          unit_price: number
          updated_at?: string | null
          usage_tracking_id: string
          user_id: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          overage_units?: number
          paid_at?: string | null
          payment_reference?: string | null
          payment_url?: string | null
          quota_type?: string
          status?: Database["public"]["Enums"]["overage_billing_status"] | null
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
          usage_tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overage_billing_records_usage_tracking_id_fkey"
            columns: ["usage_tracking_id"]
            isOneToOne: false
            referencedRelation: "user_usage_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      overage_notifications: {
        Row: {
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          quota_type: string
          read_at: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          quota_type: string
          read_at?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          quota_type?: string
          read_at?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      parent_access_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          preschool_id: string | null
          student_id: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          preschool_id?: string | null
          student_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          preschool_id?: string | null
          student_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_access_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_access_codes_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_access_codes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_access_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_access_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          payfast_payment_id: string | null
          payfast_token: string | null
          payment_method: string | null
          school_id: string | null
          status: string
          subscription_plan_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id: string
          metadata?: Json | null
          payfast_payment_id?: string | null
          payfast_token?: string | null
          payment_method?: string | null
          school_id?: string | null
          status: string
          subscription_plan_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          payfast_payment_id?: string | null
          payfast_token?: string | null
          payment_method?: string | null
          school_id?: string | null
          status?: string
          subscription_plan_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          amount_cents: number
          attachment_url: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          fee_ids: string[] | null
          id: string
          metadata: Json | null
          parent_id: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_reference: string | null
          preschool_id: string | null
          provider_payment_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string | null
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          amount_cents: number
          attachment_url?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          fee_ids?: string[] | null
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          preschool_id?: string | null
          provider_payment_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          amount_cents?: number
          attachment_url?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          fee_ids?: string[] | null
          id?: string
          metadata?: Json | null
          parent_id?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          preschool_id?: string | null
          provider_payment_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string | null
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_quotas: {
        Row: {
          annual_limit: number | null
          created_at: string | null
          id: string
          monthly_limit: number
          overage_enabled: boolean | null
          overage_unit_price: number | null
          plan_tier: string
          quota_type: string
          updated_at: string | null
        }
        Insert: {
          annual_limit?: number | null
          created_at?: string | null
          id?: string
          monthly_limit?: number
          overage_enabled?: boolean | null
          overage_unit_price?: number | null
          plan_tier: string
          quota_type: string
          updated_at?: string | null
        }
        Update: {
          annual_limit?: number | null
          created_at?: string | null
          id?: string
          monthly_limit?: number
          overage_enabled?: boolean | null
          overage_unit_price?: number | null
          plan_tier?: string
          quota_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_analytics: {
        Row: {
          dimensions: Json | null
          id: string
          metric_name: string
          metric_value: number | null
          recorded_at: string | null
        }
        Insert: {
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_value?: number | null
          recorded_at?: string | null
        }
        Update: {
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_value?: number | null
          recorded_at?: string | null
        }
        Relationships: []
      }
      platform_subscriptions: {
        Row: {
          amount: number
          billing_interval: string
          canceled_at: string | null
          created_at: string
          currency: string
          current_period_end: string
          current_period_start: string
          ended_at: string | null
          id: string
          metadata: Json
          payment_provider: string
          plan_id: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          billing_interval: string
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end: string
          current_period_start: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          payment_provider: string
          plan_id: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_interval?: string
          canceled_at?: string | null
          created_at?: string
          currency?: string
          current_period_end?: string
          current_period_start?: string
          ended_at?: string | null
          id?: string
          metadata?: Json
          payment_provider?: string
          plan_id?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      preschool_onboarding_requests: {
        Row: {
          address: string | null
          admin_email: string | null
          admin_name: string | null
          created_at: string | null
          id: string
          message: string | null
          notes: string | null
          number_of_students: number | null
          number_of_teachers: number | null
          phone: string | null
          preschool_name: string | null
          principal_email: string | null
          principal_name: string | null
          principal_phone: string | null
          registration_number: string | null
          school_name: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          admin_email?: string | null
          admin_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          number_of_students?: number | null
          number_of_teachers?: number | null
          phone?: string | null
          preschool_name?: string | null
          principal_email?: string | null
          principal_name?: string | null
          principal_phone?: string | null
          registration_number?: string | null
          school_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          admin_email?: string | null
          admin_name?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          notes?: string | null
          number_of_students?: number | null
          number_of_teachers?: number | null
          phone?: string | null
          preschool_name?: string | null
          principal_email?: string | null
          principal_name?: string | null
          principal_phone?: string | null
          registration_number?: string | null
          school_name?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      preschools: {
        Row: {
          address: string | null
          billing_email: string | null
          created_at: string | null
          domain: string | null
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_students: number | null
          max_teachers: number | null
          name: string
          onboarding_status: string | null
          payfast_token: string | null
          phone: string | null
          registration_number: string | null
          setup_completed: boolean | null
          subscription_end_date: string | null
          subscription_plan: string | null
          subscription_plan_id: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          subscription_tier: string | null
          tenant_slug: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          billing_email?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_students?: number | null
          max_teachers?: number | null
          name: string
          onboarding_status?: string | null
          payfast_token?: string | null
          phone?: string | null
          registration_number?: string | null
          setup_completed?: boolean | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tenant_slug?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          billing_email?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_students?: number | null
          max_teachers?: number | null
          name?: string
          onboarding_status?: string | null
          payfast_token?: string | null
          phone?: string | null
          registration_number?: string | null
          setup_completed?: boolean | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tenant_slug?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preschools_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_groups: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          group_type: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          preschool_id: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          group_type?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          preschool_id: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          group_type?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          preschool_id?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "principal_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "principal_groups_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          preschool_id: string | null
          role: string
          tenant_slug: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          preschool_id?: string | null
          role?: string
          tenant_slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          preschool_id?: string | null
          role?: string
          tenant_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string
          organization_id: string
          parent_category_id: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          organization_id: string
          parent_category_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          organization_id?: string
          parent_category_id?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_permissions: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          permission_type: string
          resource_id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          permission_type?: string
          resource_id: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          permission_type?: string
          resource_id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_permissions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_permissions_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_reviews: {
        Row: {
          created_at: string
          id: string
          is_flagged: boolean | null
          is_public: boolean | null
          rating: number
          resource_id: string
          review_text: string | null
          student_engagement_rating: number | null
          updated_at: string
          used_in_class: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_flagged?: boolean | null
          is_public?: boolean | null
          rating: number
          resource_id: string
          review_text?: string | null
          student_engagement_rating?: number | null
          updated_at?: string
          used_in_class?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_flagged?: boolean | null
          is_public?: boolean | null
          rating?: number
          resource_id?: string
          review_text?: string | null
          student_engagement_rating?: number | null
          updated_at?: string
          used_in_class?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_reviews_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          ai_generated: boolean | null
          ai_summary: string | null
          allow_comments: boolean | null
          allow_downloads: boolean | null
          average_rating: number | null
          category_id: string | null
          content_text: string | null
          created_at: string
          created_by: string
          description: string | null
          download_count: number | null
          duration_seconds: number | null
          external_url: string | null
          file_mime_type: string | null
          file_size_bytes: number | null
          file_url: string | null
          grade_levels: string[] | null
          id: string
          is_archived: boolean | null
          is_featured: boolean | null
          moderation_status: string | null
          organization_id: string
          rating_count: number | null
          resource_type: string
          subjects: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
          visibility: string
        }
        Insert: {
          ai_generated?: boolean | null
          ai_summary?: string | null
          allow_comments?: boolean | null
          allow_downloads?: boolean | null
          average_rating?: number | null
          category_id?: string | null
          content_text?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          download_count?: number | null
          duration_seconds?: number | null
          external_url?: string | null
          file_mime_type?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          grade_levels?: string[] | null
          id?: string
          is_archived?: boolean | null
          is_featured?: boolean | null
          moderation_status?: string | null
          organization_id: string
          rating_count?: number | null
          resource_type: string
          subjects?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
          visibility?: string
        }
        Update: {
          ai_generated?: boolean | null
          ai_summary?: string | null
          allow_comments?: boolean | null
          allow_downloads?: boolean | null
          average_rating?: number | null
          category_id?: string | null
          content_text?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          download_count?: number | null
          duration_seconds?: number | null
          external_url?: string | null
          file_mime_type?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          grade_levels?: string[] | null
          id?: string
          is_archived?: boolean | null
          is_featured?: boolean | null
          moderation_status?: string | null
          organization_id?: string
          rating_count?: number | null
          resource_type?: string
          subjects?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_grades: {
        Row: {
          created_at: string
          feedback: string | null
          grade_id: string
          id: string
          points_earned: number
          rubric_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          grade_id: string
          id?: string
          points_earned: number
          rubric_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          grade_id?: string
          id?: string
          points_earned?: number
          rubric_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_grades_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "assignment_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_grades_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "assignment_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      school_invitation_codes: {
        Row: {
          code: string
          created_at: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          invitation_type: string
          invited_by: string | null
          invited_email: string | null
          invited_name: string | null
          is_active: boolean | null
          max_uses: number | null
          metadata: Json | null
          preschool_id: string
          school_id: string | null
          updated_at: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          invitation_type: string
          invited_by?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean | null
          max_uses?: number | null
          metadata?: Json | null
          preschool_id: string
          school_id?: string | null
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          invitation_type?: string
          invited_by?: string | null
          invited_email?: string | null
          invited_name?: string | null
          is_active?: boolean | null
          max_uses?: number | null
          metadata?: Json | null
          preschool_id?: string
          school_id?: string | null
          updated_at?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_invitation_codes_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitation_codes_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitation_codes_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitation_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitation_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invitation_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_enrollments: {
        Row: {
          class_id: string
          created_at: string | null
          enrollment_date: string
          id: string
          is_active: boolean | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          enrollment_date?: string
          id?: string
          is_active?: boolean | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          enrollment_date?: string
          id?: string
          is_active?: boolean | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_parent_relationships: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          parent_id: string
          relationship_type: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          parent_id: string
          relationship_type?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          parent_id?: string
          relationship_type?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parent"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_parent"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_student"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_registrations: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          preschool_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name: string
          id?: string
          last_name: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          preschool_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          preschool_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_registrations_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          age_group_id: string | null
          allergies: string | null
          avatar_url: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          enrollment_date: string | null
          first_name: string
          gender: string | null
          guardian_id: string | null
          id: string
          is_active: boolean | null
          last_name: string
          medical_conditions: string | null
          parent_id: string | null
          preschool_id: string
          updated_at: string | null
        }
        Insert: {
          age_group_id?: string | null
          allergies?: string | null
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          enrollment_date?: string | null
          first_name: string
          gender?: string | null
          guardian_id?: string | null
          id?: string
          is_active?: boolean | null
          last_name: string
          medical_conditions?: string | null
          parent_id?: string | null
          preschool_id: string
          updated_at?: string | null
        }
        Update: {
          age_group_id?: string | null
          allergies?: string | null
          avatar_url?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          enrollment_date?: string | null
          first_name?: string
          gender?: string | null
          guardian_id?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string
          medical_conditions?: string | null
          parent_id?: string | null
          preschool_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_age_group_id_fkey"
            columns: ["age_group_id"]
            isOneToOne: false
            referencedRelation: "age_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          details: Json | null
          hashed_user_id: string
          id: string
          occurred_at: string
          plan_id_raw: string
          preschool_id: string | null
          resolved_plan_id: string | null
          resolver_stage: string | null
          success: boolean
        }
        Insert: {
          details?: Json | null
          hashed_user_id: string
          id?: string
          occurred_at?: string
          plan_id_raw: string
          preschool_id?: string | null
          resolved_plan_id?: string | null
          resolver_stage?: string | null
          success: boolean
        }
        Update: {
          details?: Json | null
          hashed_user_id?: string
          id?: string
          occurred_at?: string
          plan_id_raw?: string
          preschool_id?: string | null
          resolved_plan_id?: string | null
          resolver_stage?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_resolved_plan_id_fkey"
            columns: ["resolved_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          processed_at: string
          provider_payment_id: string | null
          status: string
          subscription_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          processed_at?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          processed_at?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "platform_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          ai_quota_monthly: number | null
          created_at: string | null
          currency: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_students: number | null
          max_teachers: number | null
          name: string
          price_annual: number | null
          price_monthly: number | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          ai_quota_monthly?: number | null
          created_at?: string | null
          currency?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          max_teachers?: number | null
          name: string
          price_annual?: number | null
          price_monthly?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_quota_monthly?: number | null
          created_at?: string | null
          currency?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_students?: number | null
          max_teachers?: number | null
          name?: string
          price_annual?: number | null
          price_monthly?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_seats: {
        Row: {
          assigned_at: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          subscription_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_seats_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_frequency: string
          cancelled_at: string | null
          created_at: string | null
          end_date: string
          id: string
          metadata: Json | null
          next_billing_date: string | null
          owner_type: Database["public"]["Enums"]["subscription_owner_type"]
          payfast_payment_id: string | null
          payfast_token: string | null
          plan_id: string
          school_id: string | null
          seats_total: number
          seats_used: number
          start_date: string
          status: string
          trial_end_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_frequency: string
          cancelled_at?: string | null
          created_at?: string | null
          end_date: string
          id?: string
          metadata?: Json | null
          next_billing_date?: string | null
          owner_type?: Database["public"]["Enums"]["subscription_owner_type"]
          payfast_payment_id?: string | null
          payfast_token?: string | null
          plan_id: string
          school_id?: string | null
          seats_total?: number
          seats_used?: number
          start_date: string
          status: string
          trial_end_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_frequency?: string
          cancelled_at?: string | null
          created_at?: string | null
          end_date?: string
          id?: string
          metadata?: Json | null
          next_billing_date?: string | null
          owner_type?: Database["public"]["Enums"]["subscription_owner_type"]
          payfast_payment_id?: string | null
          payfast_token?: string | null
          plan_id?: string
          school_id?: string | null
          seats_total?: number
          seats_used?: number
          start_date?: string
          status?: string
          trial_end_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string
          id: string
          preschool_id: string | null
          priority: string | null
          resolution_notes: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description: string
          id?: string
          preschool_id?: string | null
          priority?: string | null
          resolution_notes?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          id?: string
          preschool_id?: string | null
          priority?: string | null
          resolution_notes?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      teacher_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_code: string | null
          invited_by: string | null
          name: string | null
          preschool_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_code?: string | null
          invited_by?: string | null
          name?: string | null
          preschool_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_code?: string | null
          invited_by?: string | null
          name?: string | null
          preschool_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_invitations_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          preschool_id: string | null
          subject_specialization: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          preschool_id?: string | null
          subject_specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          preschool_id?: string | null
          subject_specialization?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          language: string | null
          notifications_email: boolean | null
          notifications_push: boolean | null
          notifications_sms: boolean | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          language?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          notifications_sms?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          language?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          notifications_sms?: boolean | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      user_usage_tracking: {
        Row: {
          created_at: string | null
          current_usage: number
          id: string
          last_updated: string | null
          overage_amount: number
          overage_status: Database["public"]["Enums"]["overage_status"] | null
          quota_limit: number
          quota_type: string
          usage_period_end: string
          usage_period_start: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_usage?: number
          id?: string
          last_updated?: string | null
          overage_amount?: number
          overage_status?: Database["public"]["Enums"]["overage_status"] | null
          quota_limit?: number
          quota_type: string
          usage_period_end: string
          usage_period_start: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_usage?: number
          id?: string
          last_updated?: string | null
          overage_amount?: number
          overage_status?: Database["public"]["Enums"]["overage_status"] | null
          quota_limit?: number
          quota_type?: string
          usage_period_end?: string
          usage_period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          age_groups_taught: string[] | null
          auth_user_id: string | null
          availability: Json | null
          avatar_url: string | null
          biography: string | null
          certifications: string[] | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          documents: Json | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_id: string | null
          employment_start_date: string | null
          employment_status: string | null
          gender: string | null
          highest_qualification: string | null
          id: string
          id_number: string | null
          institution_name: string | null
          is_active: boolean | null
          languages_spoken: string[] | null
          name: string
          nationality: string | null
          notes: string | null
          password_reset_required: boolean | null
          phone: string | null
          position_title: string | null
          postal_code: string | null
          preschool_id: string | null
          profile_completion_status: string | null
          profile_picture_url: string | null
          qualification_year: number | null
          role: string
          salary_amount: number | null
          salary_currency: string | null
          state_province: string | null
          street_address: string | null
          subjects_taught: string[] | null
          subscription_plan_id: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          subscription_tier: string | null
          teaching_experience_years: number | null
          updated_at: string | null
        }
        Insert: {
          age_groups_taught?: string[] | null
          auth_user_id?: string | null
          availability?: Json | null
          avatar_url?: string | null
          biography?: string | null
          certifications?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          documents?: Json | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_id?: string | null
          employment_start_date?: string | null
          employment_status?: string | null
          gender?: string | null
          highest_qualification?: string | null
          id?: string
          id_number?: string | null
          institution_name?: string | null
          is_active?: boolean | null
          languages_spoken?: string[] | null
          name: string
          nationality?: string | null
          notes?: string | null
          password_reset_required?: boolean | null
          phone?: string | null
          position_title?: string | null
          postal_code?: string | null
          preschool_id?: string | null
          profile_completion_status?: string | null
          profile_picture_url?: string | null
          qualification_year?: number | null
          role: string
          salary_amount?: number | null
          salary_currency?: string | null
          state_province?: string | null
          street_address?: string | null
          subjects_taught?: string[] | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          teaching_experience_years?: number | null
          updated_at?: string | null
        }
        Update: {
          age_groups_taught?: string[] | null
          auth_user_id?: string | null
          availability?: Json | null
          avatar_url?: string | null
          biography?: string | null
          certifications?: string[] | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          department?: string | null
          documents?: Json | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_id?: string | null
          employment_start_date?: string | null
          employment_status?: string | null
          gender?: string | null
          highest_qualification?: string | null
          id?: string
          id_number?: string | null
          institution_name?: string | null
          is_active?: boolean | null
          languages_spoken?: string[] | null
          name?: string
          nationality?: string | null
          notes?: string | null
          password_reset_required?: boolean | null
          phone?: string | null
          position_title?: string | null
          postal_code?: string | null
          preschool_id?: string | null
          profile_completion_status?: string | null
          profile_picture_url?: string | null
          qualification_year?: number | null
          role?: string
          salary_amount?: number | null
          salary_currency?: string | null
          state_province?: string | null
          street_address?: string | null
          subjects_taught?: string[] | null
          subscription_plan_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          teaching_experience_years?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
      video_call_participants: {
        Row: {
          call_id: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          invitation_sent: boolean | null
          invitation_sent_at: string | null
          joined_at: string | null
          left_at: string | null
          status: string | null
          student_id: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          joined_at?: string | null
          left_at?: string | null
          status?: string | null
          student_id?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          invitation_sent?: boolean | null
          invitation_sent_at?: string | null
          joined_at?: string | null
          left_at?: string | null
          status?: string | null
          student_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "video_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_call_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      video_calls: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          class_id: string | null
          created_at: string | null
          description: string | null
          id: string
          max_participants: number | null
          meeting_id: string | null
          meeting_password: string | null
          meeting_url: string | null
          preschool_id: string
          recording_enabled: boolean | null
          recording_url: string | null
          require_password: boolean | null
          scheduled_end: string
          scheduled_start: string
          status: string | null
          teacher_id: string
          title: string
          updated_at: string | null
          waiting_room_enabled: boolean | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          class_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_participants?: number | null
          meeting_id?: string | null
          meeting_password?: string | null
          meeting_url?: string | null
          preschool_id: string
          recording_enabled?: boolean | null
          recording_url?: string | null
          require_password?: boolean | null
          scheduled_end: string
          scheduled_start: string
          status?: string | null
          teacher_id: string
          title: string
          updated_at?: string | null
          waiting_room_enabled?: boolean | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          class_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_participants?: number | null
          meeting_id?: string | null
          meeting_password?: string | null
          meeting_url?: string | null
          preschool_id?: string
          recording_enabled?: boolean | null
          recording_url?: string | null
          require_password?: boolean | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string | null
          waiting_room_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "video_calls_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_calls_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_calls_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_calls_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "users_with_subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          source: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      users_with_subscription: {
        Row: {
          age_groups_taught: string[] | null
          auth_user_id: string | null
          availability: Json | null
          biography: string | null
          certifications: string[] | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          department: string | null
          documents: Json | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_id: string | null
          employment_start_date: string | null
          employment_status: string | null
          gender: string | null
          highest_qualification: string | null
          id: string | null
          id_number: string | null
          institution_name: string | null
          is_active: boolean | null
          languages_spoken: string[] | null
          latest_subscription_billing_interval: string | null
          latest_subscription_current_period_end: string | null
          latest_subscription_plan_id: string | null
          latest_subscription_status: string | null
          name: string | null
          nationality: string | null
          notes: string | null
          password_reset_required: boolean | null
          phone: string | null
          position_title: string | null
          postal_code: string | null
          preschool_id: string | null
          profile_completion_status: string | null
          profile_picture_url: string | null
          qualification_year: number | null
          role: string | null
          salary_amount: number | null
          salary_currency: string | null
          state_province: string | null
          street_address: string | null
          subjects_taught: string[] | null
          subscription_plan_id: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          subscription_tier: string | null
          teaching_experience_years: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_subscriptions_plan_id_fkey"
            columns: ["latest_subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_preschool_id_fkey"
            columns: ["preschool_id"]
            isOneToOne: false
            referencedRelation: "preschools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_message_attachment: {
        Args: {
          p_file_name: string
          p_file_size: number
          p_file_type: string
          p_file_url: string
          p_message_id: string
          p_mime_type?: string
        }
        Returns: string
      }
      algorithm_sign: {
        Args: { algorithm: string; secret: string; signables: string }
        Returns: string
      }
      app_is_admin: {
        Args: { uid: string }
        Returns: boolean
      }
      app_is_school_admin: {
        Args: { target_school: string }
        Returns: boolean
      }
      app_is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      assign_teacher_seat: {
        Args: { p_subscription_id: string; p_user_id: string }
        Returns: undefined
      }
      audit_rls_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          policy_count: number
          rls_enabled: boolean
          status: string
          table_name: string
        }[]
      }
      can_access_student_data: {
        Args: { student_org_id: string }
        Returns: boolean
      }
      can_send_in_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      can_user_access_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      can_user_see_event: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: boolean
      }
      check_subscription_status: {
        Args: { school_uuid: string }
        Returns: {
          days_remaining: number
          is_active: boolean
          needs_payment: boolean
          plan_id: string
          status: string
        }[]
      }
      create_school_with_admin: {
        Args: {
          p_admin_email: string
          p_admin_name: string
          p_school_name: string
          p_subscription_plan?: string
        }
        Returns: Json
      }
      create_specific_superadmin: {
        Args: { p_email: string; p_name?: string }
        Returns: Json
      }
      create_superadmin_for_current_user: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      create_teacher_for_preschool: {
        Args: {
          target_preschool_id: string
          teacher_email: string
          teacher_name: string
          teacher_phone?: string
        }
        Returns: string
      }
      create_test_superadmin: {
        Args: { p_auth_user_id: string; p_email: string; p_name: string }
        Returns: string
      }
      debug_auth_detailed: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      debug_auth_uid: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      debug_find_profile: {
        Args: { search_auth_id?: string }
        Returns: Json
      }
      debug_get_profile_direct: {
        Args: { target_auth_id: string }
        Returns: {
          address: string | null
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          preschool_id: string | null
          role: string
          tenant_slug: string | null
          updated_at: string
        }
      }
      debug_list_all_profiles: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_user_id: string
          email: string
          id: string
          role: string
        }[]
      }
      debug_messaging_contacts: {
        Args: Record<PropertyKey, never>
        Returns: {
          active_parents_count: number
          active_teachers_count: number
          all_roles_in_preschool: string[]
          current_user_auth_id: string
          current_user_internal_id: string
          current_user_preschool_id: string
          total_users_in_preschool: number
        }[]
      }
      debug_messaging_context: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_uid: string
          contacts_in_school: number
          internal_user_id: string
          preschool_id: string
          preschool_name: string
          user_name: string
          user_role: string
        }[]
      }
      debug_user_profile: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          org_member_exists: boolean
          org_member_seat_status: string
          preschool_id: string
          role: string
        }[]
      }
      generate_invitation_code: {
        Args: { p_email: string; p_preschool_id: string; p_role: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_connections: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_all_schools_for_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_all_users_for_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_message_with_attachments: {
        Args: { p_message_id: string }
        Returns: Json
      }
      get_messaging_contacts: {
        Args: {
          p_include_parents?: boolean
          p_include_staff?: boolean
          p_limit?: number
        }
        Returns: {
          avatar_url: string
          class_name: string
          email: string
          id: string
          name: string
          role: string
        }[]
      }
      get_my_org_member: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string | null
          seat_status: string
          updated_at: string
          user_id: string
        }
      }
      get_my_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          address: string | null
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          preschool_id: string | null
          role: string
          tenant_slug: string | null
          updated_at: string
        }
      }
      get_platform_stats_for_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_subscription_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          active_subscriptions: number
          annual_revenue: number
          avg_revenue_per_school: number
          cancelled_subscriptions: number
          churn_rate: number
          expired_subscriptions: number
          monthly_revenue: number
          total_revenue: number
          total_subscriptions: number
          trial_subscriptions: number
        }[]
      }
      get_total_unread_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          dm_unread: number
          room_unread: number
          total: number
        }[]
      }
      get_unread_announcements_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_unread_counts: {
        Args: { p_user_id: string }
        Returns: {
          total_unread: number
          unread_announcements: number
          unread_messages: number
        }[]
      }
      get_user_group_role: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: string
      }
      get_user_groups: {
        Args: { p_user_id: string }
        Returns: {
          group_id: string
          group_name: string
          group_type: string
          member_count: number
          role_in_group: string
        }[]
      }
      get_user_messages: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          content: string
          is_sent: boolean
          message_id: string
          read_at: string
          recipient_email: string
          recipient_name: string
          sender_email: string
          sender_name: string
          sent_at: string
          subject: string
        }[]
      }
      get_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_profile_by_auth_id: {
        Args: { p_auth_user_id: string }
        Returns: {
          auth_user_id: string
          avatar_url: string
          created_at: string
          email: string
          emergency_contact_1_name: string
          emergency_contact_1_phone: string
          emergency_contact_1_relationship: string
          emergency_contact_2_name: string
          emergency_contact_2_phone: string
          emergency_contact_2_relationship: string
          home_address: string
          home_city: string
          home_postal_code: string
          id: string
          is_active: boolean
          name: string
          phone: string
          pickup_authorized: string
          preschool_id: string
          profile_completed_at: string
          profile_completion_status: string
          relationship_to_child: string
          role: string
          updated_at: string
          work_address: string
          work_company: string
          work_phone: string
          work_position: string
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      has_active_seat: {
        Args: { org_id: string }
        Returns: boolean
      }
      has_role_in_preschool: {
        Args: { roles: string[]; target_preschool: string }
        Returns: boolean
      }
      increment_resource_view: {
        Args: { p_resource_id: string }
        Returns: undefined
      }
      is_conversation_admin: {
        Args: { p_auth_user_id: string; p_conversation_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { org_id: string }
        Returns: boolean
      }
      is_organization_admin: {
        Args: { target_org: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_preschool_id: string
          p_target_id: string
          p_target_type: string
          p_visibility?: string
        }
        Returns: undefined
      }
      log_audit_event: {
        Args: {
          action: string
          new_values?: Json
          old_values?: Json
          record_id?: string
          table_name?: string
        }
        Returns: undefined
      }
      revoke_teacher_seat: {
        Args: { p_subscription_id: string; p_user_id: string }
        Returns: undefined
      }
      send_direct_message: {
        Args: {
          p_content: string
          p_message_type?: string
          p_recipient_user_id: string
          p_subject?: string
        }
        Returns: string
      }
      send_school_announcement: {
        Args:
          | { p_audience?: string; p_content: string; p_subject?: string }
          | {
              p_content: string
              p_include_parents?: boolean
              p_include_sender?: boolean
              p_include_staff?: boolean
              p_subject?: string
            }
        Returns: string
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sign: {
        Args: { algorithm?: string; payload: Json; secret: string }
        Returns: string
      }
      superadmin_approve_onboarding: {
        Args: { request_id: string }
        Returns: Json
      }
      test_messaging_user_context: {
        Args: Record<PropertyKey, never>
        Returns: {
          auth_user_id: string
          error_message: string
          has_preschool: boolean
          internal_user_id: string
          preschool_id: string
          user_active: boolean
          user_exists: boolean
          user_role: string
        }[]
      }
      test_onboarding_access: {
        Args: Record<PropertyKey, never>
        Returns: {
          can_insert: boolean
          can_select: boolean
          jwt_role: string
          user_id: string
          user_role: string
        }[]
      }
      try_cast_double: {
        Args: { inp: string }
        Returns: number
      }
      update_event_statuses: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      url_decode: {
        Args: { data: string }
        Returns: string
      }
      url_encode: {
        Args: { data: string }
        Returns: string
      }
      use_invitation_code: {
        Args: {
          p_auth_user_id: string
          p_code: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      validate_invitation_code: {
        Args: { p_code: string; p_email: string }
        Returns: {
          code: string
          created_at: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          invitation_type: string
          invited_by: string | null
          invited_email: string | null
          invited_name: string | null
          is_active: boolean | null
          max_uses: number | null
          metadata: Json | null
          preschool_id: string
          school_id: string | null
          updated_at: string | null
          used_at: string | null
          used_by: string | null
        }
      }
      verify: {
        Args: { algorithm?: string; secret: string; token: string }
        Returns: {
          header: Json
          payload: Json
          valid: boolean
        }[]
      }
    }
    Enums: {
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "closed-won"
        | "closed-lost"
      overage_billing_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      overage_status: "none" | "approaching_limit" | "at_limit" | "exceeded"
      subscription_owner_type: "user" | "school"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "closed-won",
        "closed-lost",
      ],
      overage_billing_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      overage_status: ["none", "approaching_limit", "at_limit", "exceeded"],
      subscription_owner_type: ["user", "school"],
    },
  },
} as const
