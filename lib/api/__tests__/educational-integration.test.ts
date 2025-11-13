/**
 * Educational System Integration Tests
 * 
 * Comprehensive integration tests covering assignments, submissions,
 * grading, enrollment flows, and RBAC role scenario testing.
 */

// Set environment variables for Supabase
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CourseService } from '../../services/CourseService';
import { AssignmentService } from '../../services/AssignmentService';
import { SubmissionService } from '../../services/SubmissionService';
import { GradeService } from '../../services/GradeService';
import { EducationalWorkflowService } from '../../services/EducationalWorkflowService';
import { UserRole } from '../../security/rbac';

// ====================================================================
// TEST SETUP AND CONFIGURATION
// ====================================================================

// Skip integration tests that require actual Supabase credentials
describe.skip('Educational System Integration Tests', () => {
  let supabase: SupabaseClient;
  let courseService: CourseService;
  let assignmentService: AssignmentService;
  let submissionService: SubmissionService;
  let gradeService: GradeService;
  let workflowService: EducationalWorkflowService;

  // Test data
  let testOrganizationId: string;
  let testInstructorId: string;
  let testStudentIds: string[];
  let testCourseId: string;
  let testAssignmentIds: string[];
  let testSubmissionIds: string[];
  let testGradeIds: string[];

  beforeAll(async () => {
    // Initialize Supabase client for testing
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Initialize services
    courseService = new CourseService();
    assignmentService = new AssignmentService(supabase);
    submissionService = new SubmissionService(supabase);
    gradeService = new GradeService(supabase);
    workflowService = new EducationalWorkflowService(supabase);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  // ================================================================
  // COURSE-ASSIGNMENT-SUBMISSION-GRADE WORKFLOW TESTS
  // ================================================================

  describe('Complete Educational Workflow', () => {
    test('should complete end-to-end course workflow', async () => {
      // 1. Create course
      const courseData = {
        title: 'Integration Test Course',
        code: 'ITC101',
        description: 'Test course for integration testing',
        credits: 3,
        max_students: 50,
        allow_late_submissions: true,
        late_penalty_percent: 10
      };

      const courseResult = await courseService.createCourse(
        courseData,
        testInstructorId,
        testOrganizationId
      );

      expect(courseResult.success).toBe(true);
      expect(courseResult.data).toBeDefined();
      testCourseId = courseResult.data!.id;

      // 2. Enroll students
      const enrollmentResult = await workflowService.processAutoEnrollment(
        testStudentIds,
        {
          course_id: testCourseId,
          auto_approve: true,
          send_welcome_email: false,
          assign_default_role: UserRole.STUDENT,
          notify_instructor: false,
          create_gradebook_entry: true
        },
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(enrollmentResult.success).toBe(true);
      expect(enrollmentResult.processed).toBe(testStudentIds.length);

      // 3. Create assignments
      const assignmentData = {
        course_id: testCourseId,
        title: 'Test Assignment 1',
        description: 'First test assignment',
        assignment_type: 'homework' as const,
        max_points: 100,
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Due in 1 week
        allow_late_submissions: true,
        late_penalty_percent: 15,
        submission_type: 'both' as const
      };

      const assignmentResult = await assignmentService.createAssignment(
        assignmentData,
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(assignmentResult.success).toBe(true);
      expect(assignmentResult.data).toBeDefined();
      const assignmentId = assignmentResult.data!.id;

      // 4. Students submit assignments
      for (const studentId of testStudentIds) {
        const submissionData = {
          assignment_id: assignmentId,
          content: `Test submission from student ${studentId}`,
          submission_type: 'text' as const,
          is_draft: false
        };

        const submissionResult = await submissionService.createSubmission(
          submissionData,
          studentId,
          UserRole.STUDENT,
          testOrganizationId
        );

        expect(submissionResult.success).toBe(true);
        testSubmissionIds.push(submissionResult.data!.id);
      }

      // 5. Grade submissions
      const gradePromises = testSubmissionIds.map(async (submissionId, index) => {
        const gradeData = {
          submission_id: submissionId,
          points_earned: 85 + (index * 5), // Varying grades: 85, 90, 95, etc.
          points_possible: 100,
          feedback: `Good work! Grade ${index + 1}`,
          is_final: true,
          is_published: true
        };

        return gradeService.createGrade(
          gradeData,
          testInstructorId,
          UserRole.INSTRUCTOR,
          testOrganizationId
        );
      });

      const gradeResults = await Promise.all(gradePromises);
      gradeResults.forEach(result => {
        expect(result.success).toBe(true);
        testGradeIds.push(result.data!.id);
      });

      // 6. Aggregate course grades
      const aggregationResult = await workflowService.processGradeAggregation(
        {
          course_id: testCourseId,
          weight_by_category: false,
          drop_lowest: 0,
          include_unpublished: false,
          calculate_final_grade: true
        },
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(aggregationResult.success).toBe(true);
      expect(aggregationResult.processed).toBe(testStudentIds.length);

      // 7. Track student progress
      const progressResult = await workflowService.processProgressTracking(
        {
          course_id: testCourseId,
          track_assignments: true,
          track_attendance: false,
          track_participation: false,
          generate_alerts: false,
          alert_thresholds: {
            missing_assignments: 2,
            low_grade_percentage: 70,
            attendance_percentage: 80
          }
        },
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(progressResult.success).toBe(true);
    });
  });

  // ================================================================
  // RBAC PERMISSION TESTS
  // ================================================================

  describe('RBAC Permission Scenarios', () => {
    test('should enforce student permissions correctly', async () => {
      const studentId = testStudentIds[0];

      // Students should NOT be able to create courses
      const courseData = {
        title: 'Unauthorized Course',
        code: 'UNAUTH101',
        description: 'Should not be created',
        credits: 1
      };

      const courseResult = await courseService.createCourse(
        courseData,
        studentId,
        testOrganizationId
      );

      expect(courseResult.success).toBe(false);
      expect(courseResult.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Students should NOT be able to create assignments
      const assignmentData = {
        course_id: testCourseId,
        title: 'Unauthorized Assignment',
        description: 'Should not be created',
        assignment_type: 'homework' as const,
        max_points: 50
      };

      const assignmentResult = await assignmentService.createAssignment(
        assignmentData,
        studentId,
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(assignmentResult.success).toBe(false);
      expect(assignmentResult.code).toBe('INSUFFICIENT_PERMISSIONS');

      // Students should NOT be able to grade submissions
      const gradeData = {
        submission_id: testSubmissionIds[0],
        points_earned: 100,
        points_possible: 100,
        feedback: 'Unauthorized grade'
      };

      const gradeResult = await gradeService.createGrade(
        gradeData,
        studentId,
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(gradeResult.success).toBe(false);
      expect(gradeResult.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should enforce instructor permissions correctly', async () => {
      // Instructors should be able to manage their own courses
      const courseData = {
        title: 'Instructor Course',
        code: 'INST101',
        description: 'Instructor created course',
        credits: 3
      };

      const courseResult = await courseService.createCourse(
        courseData,
        testInstructorId,
        testOrganizationId
      );

      expect(courseResult.success).toBe(true);
      const instructorCourseId = courseResult.data!.id;

      // Instructors should be able to create assignments for their courses
      const assignmentData = {
        course_id: instructorCourseId,
        title: 'Instructor Assignment',
        description: 'Assignment by instructor',
        assignment_type: 'quiz' as const,
        max_points: 50
      };

      const assignmentResult = await assignmentService.createAssignment(
        assignmentData,
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(assignmentResult.success).toBe(true);

      // Instructors should NOT be able to manage other instructors' courses
      // This would require another instructor account to test properly
    });

    test('should handle cross-organization access correctly', async () => {
      // Create a different organization ID
      const otherOrgId = 'other-org-' + Date.now();

      // Attempt to access course from different organization
      const courseResult = await courseService.getCourseById(
        testCourseId,
        testInstructorId,
        UserRole.INSTRUCTOR
      );

      expect(courseResult.success).toBe(false);
      expect(courseResult.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  // ================================================================
  // ENROLLMENT WORKFLOW TESTS
  // ================================================================

  describe('Enrollment Workflows', () => {
    test('should handle course capacity limits', async () => {
      // Create course with limited capacity
      const limitedCourseData = {
        title: 'Limited Capacity Course',
        code: 'LCC101',
        description: 'Course with enrollment limits',
        credits: 2,
        max_students: 2 // Only allow 2 students
      };

      const courseResult = await courseService.createCourse(
        limitedCourseData,
        testInstructorId,
        testOrganizationId
      );

      expect(courseResult.success).toBe(true);
      const limitedCourseId = courseResult.data!.id;

      // Attempt to enroll more students than capacity
      const enrollmentResult = await workflowService.processAutoEnrollment(
        testStudentIds, // More students than capacity
        {
          course_id: limitedCourseId,
          auto_approve: true,
          send_welcome_email: false,
          assign_default_role: UserRole.STUDENT,
          notify_instructor: false,
          create_gradebook_entry: false
        },
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      // Should succeed but with warnings about capacity
      expect(enrollmentResult.success).toBe(true);
      expect(enrollmentResult.warnings).toBeDefined();
      expect(enrollmentResult.warnings!.length).toBeGreaterThan(0);
    });

    test('should prevent duplicate enrollments', async () => {
      // Attempt to enroll the same students again
      const duplicateEnrollmentResult = await workflowService.processAutoEnrollment(
        [testStudentIds[0]], // Same student as before
        {
          course_id: testCourseId,
          auto_approve: true,
          send_welcome_email: false,
          assign_default_role: UserRole.STUDENT,
          notify_instructor: false,
          create_gradebook_entry: false
        },
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(duplicateEnrollmentResult.success).toBe(true);
      expect(duplicateEnrollmentResult.warnings).toContain(
        expect.stringContaining('already enrolled')
      );
    });
  });

  // ================================================================
  // ASSIGNMENT AND SUBMISSION WORKFLOW TESTS
  // ================================================================

  describe('Assignment and Submission Workflows', () => {
    test('should handle late submission penalties', async () => {
      // Create assignment with past due date
      const pastDueAssignment = {
        course_id: testCourseId,
        title: 'Past Due Assignment',
        description: 'Assignment with past due date',
        assignment_type: 'homework' as const,
        max_points: 100,
        due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Due yesterday
        allow_late_submissions: true,
        late_penalty_percent: 20
      };

      const assignmentResult = await assignmentService.createAssignment(
        pastDueAssignment,
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(assignmentResult.success).toBe(true);
      const pastDueAssignmentId = assignmentResult.data!.id;

      // Submit late assignment
      const lateSubmissionData = {
        assignment_id: pastDueAssignmentId,
        content: 'Late submission content',
        submission_type: 'text' as const,
        is_draft: false
      };

      const submissionResult = await submissionService.createSubmission(
        lateSubmissionData,
        testStudentIds[0],
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(submissionResult.success).toBe(true);
      expect(submissionResult.data!.is_late).toBe(true);

      // Grade the late submission - penalty should be applied automatically
      const lateGradeData = {
        submission_id: submissionResult.data!.id,
        points_earned: 100,
        points_possible: 100,
        feedback: 'Late submission test',
        is_published: true
      };

      const gradeResult = await gradeService.createGrade(
        lateGradeData,
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(gradeResult.success).toBe(true);
      // Points should be reduced due to late penalty
      expect(gradeResult.data!.points_earned).toBeLessThan(100);
    });

    test('should handle submission attempt limits', async () => {
      // Create assignment with attempt limit
      const limitedAttemptsAssignment = {
        course_id: testCourseId,
        title: 'Limited Attempts Assignment',
        description: 'Assignment with submission limits',
        assignment_type: 'quiz' as const,
        max_points: 50,
        max_attempts: 2
      };

      const assignmentResult = await assignmentService.createAssignment(
        limitedAttemptsAssignment,
        testInstructorId,
        UserRole.INSTRUCTOR,
        testOrganizationId
      );

      expect(assignmentResult.success).toBe(true);
      const limitedAssignmentId = assignmentResult.data!.id;

      const studentId = testStudentIds[0];

      // First submission - should succeed
      const firstSubmission = await submissionService.createSubmission(
        {
          assignment_id: limitedAssignmentId,
          content: 'First attempt',
          submission_type: 'text' as const,
          is_draft: false
        },
        studentId,
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(firstSubmission.success).toBe(true);

      // Second submission - should succeed
      const secondSubmission = await submissionService.createSubmission(
        {
          assignment_id: limitedAssignmentId,
          content: 'Second attempt',
          submission_type: 'text' as const,
          is_draft: false
        },
        studentId,
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(secondSubmission.success).toBe(true);

      // Third submission - should fail due to attempt limit
      const thirdSubmission = await submissionService.createSubmission(
        {
          assignment_id: limitedAssignmentId,
          content: 'Third attempt',
          submission_type: 'text' as const,
          is_draft: false
        },
        studentId,
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(thirdSubmission.success).toBe(false);
      expect(thirdSubmission.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    });
  });

  // ================================================================
  // GRADE AGGREGATION TESTS
  // ================================================================

  describe('Grade Aggregation and Statistics', () => {
    test.skip('should calculate course statistics correctly', async () => {
      // TODO: Implement getCourseStats method in GradeService
      // const statsResult = await gradeService.getCourseStats(
      //   testCourseId,
      //   testInstructorId,
      //   UserRole.INSTRUCTOR,
      //   testOrganizationId
      // );
      // expect(statsResult.success).toBe(true);
    });

    test.skip('should calculate student progress correctly', async () => {
      // TODO: Implement getStudentProgress method in GradeService
      // const progressResult = await gradeService.getStudentProgress(
      //   testInstructorId,
      //   testCourseId,
      //   testStudentIds[0]
      // );
      // expect(progressResult.success).toBe(true);
    });
  });

  // ================================================================
  // ERROR HANDLING TESTS
  // ================================================================

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid IDs gracefully', async () => {
      const invalidId = 'invalid-uuid';

      const courseResult = await courseService.getCourseById(
        invalidId,
        testInstructorId,
        UserRole.INSTRUCTOR
      );

      expect(courseResult.success).toBe(false);
    });

    test('should handle database connection issues gracefully', async () => {
      // This would require mocking the database connection
      // For now, we'll test with invalid data that would cause DB errors
      
      const invalidSubmissionData = {
        assignment_id: 'non-existent-assignment-id',
        content: 'Test content',
        submission_type: 'text' as const
      };

      const result = await submissionService.createSubmission(
        invalidSubmissionData,
        testStudentIds[0],
        UserRole.STUDENT,
        testOrganizationId
      );

      expect(result.success).toBe(false);
    });
  });

  // ================================================================
  // HELPER FUNCTIONS
  // ================================================================

  async function setupTestData() {
    testOrganizationId = 'test-org-' + Date.now();
    testInstructorId = 'test-instructor-' + Date.now();
    testStudentIds = [
      'test-student-1-' + Date.now(),
      'test-student-2-' + Date.now(),
      'test-student-3-' + Date.now()
    ];
    testAssignmentIds = [];
    testSubmissionIds = [];
    testGradeIds = [];

    // Create test profiles in database
    const profiles = [
      {
        id: testInstructorId,
        first_name: 'Test',
        last_name: 'Instructor',
        email: 'instructor@test.com',
        role: UserRole.INSTRUCTOR,
        organization_id: testOrganizationId
      },
      ...testStudentIds.map((id, index) => ({
        id,
        first_name: 'Test',
        last_name: `Student ${index + 1}`,
        email: `student${index + 1}@test.com`,
        role: UserRole.STUDENT,
        organization_id: testOrganizationId
      }))
    ];

    // Insert test profiles
    for (const profile of profiles) {
      await supabase
        .from('profiles')
        .upsert([profile])
        .select()
        .single();
    }
  }

  async function cleanupTestData() {
    // Clean up in reverse order to handle foreign key constraints
    
    // Delete grades
    if (testGradeIds.length > 0) {
      await supabase
        .from('grades')
        .delete()
        .in('id', testGradeIds);
    }

    // Delete submissions
    if (testSubmissionIds.length > 0) {
      await supabase
        .from('submissions')
        .delete()
        .in('id', testSubmissionIds);
    }

    // Delete assignments
    if (testAssignmentIds.length > 0) {
      await supabase
        .from('assignments')
        .delete()
        .in('id', testAssignmentIds);
    }

    // Delete enrollments
    if (testCourseId) {
      await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', testCourseId);
    }

    // Delete course
    if (testCourseId) {
      await supabase
        .from('courses')
        .delete()
        .eq('id', testCourseId);
    }

    // Delete test profiles
    const allTestIds = [testInstructorId, ...testStudentIds];
    await supabase
      .from('profiles')
      .delete()
      .in('id', allTestIds);

    // Delete any workflow-related test data
    await supabase
      .from('course_grades')
      .delete()
      .eq('course_id', testCourseId);

    await supabase
      .from('student_progress')
      .delete()
      .eq('course_id', testCourseId);

    await supabase
      .from('gradebook_entries')
      .delete()
      .eq('course_id', testCourseId);

    await supabase
      .from('push_notifications')
      .delete()
      .in('recipient_user_id', allTestIds);
  }
});