import { router } from 'expo-router';

/**
 * Type-safe navigation utility for handling dynamic routes that may not be
 * statically typed in the Expo Router system.
 */
export const navigateTo = {
  // Marketing routes
  contact: () => router.push('/sales/contact' as any),
  
  // Plan selection helpers
  signUpWithPlan: ({ tier, billing }: { tier: string; billing: 'monthly' | 'annual' }) => {
    router.push({ 
      pathname: '/(auth)/sign-up' as any, 
      params: { planTier: tier, billing } 
    } as any);
  },
  
  subscriptionSetup: ({ planId, billing, auto }: { planId?: string; billing?: 'monthly' | 'annual'; auto?: boolean }) => {
    const params: any = {};
    if (planId) params.planId = planId;
    if (billing) params.billing = billing;
    if (auto) params.auto = '1';
    
    router.push({
      pathname: '/screens/subscription-setup' as any,
      params
    } as any);
  },
  
  // Screen routes with dynamic parameters (mapped to existing screens)
  classStudents: (classId: string) => 
    router.push({ pathname: '/screens/class-teacher-management' as any, params: { classId } } as any),
  
  editClass: (classId: string) => 
    router.push({ pathname: '/screens/class-teacher-management' as any, params: { classId, edit: '1' } } as any),
  
  addTeacher: () => 
    router.push('/screens/teacher-management' as any),
  
  teacherClasses: (teacherId: string) => 
    router.push({ pathname: '/screens/class-teacher-management' as any, params: { teacherId } } as any),
  
  editTeacher: (teacherId: string) => 
    router.push({ pathname: '/screens/teacher-management' as any, params: { teacherId, edit: '1' } } as any),
  
  // Petty cash routes
  pettyCashHistory: () => 
    router.push('/screens/financial-transactions' as any),
  
  pettyCashReport: () => 
    router.push('/screens/financial-reports' as any),
  
  // Student routes  
  editStudent: (studentId: string) => 
    router.push({ pathname: '/screens/student-management' as any, params: { studentId, edit: '1' } } as any),
  
  studentFees: (studentId: string) => 
    router.push({ pathname: '/screens/financial-transactions' as any, params: { studentId } } as any),
  
  // Financial routes (map to existing financial screens)
  addTransaction: () => 
    router.push('/screens/financial-transactions' as any),
  
  paymentReminders: () => 
    router.push('/screens/financial-transactions' as any),
  
  expenseCategories: () => 
    router.push('/screens/financial-transactions' as any),
  
  exportData: () => 
    router.push('/screens/financial-reports' as any),
  
  exportAllData: () => 
    router.push('/screens/financial-reports' as any),
  
  scheduleReports: () => 
    router.push('/screens/financial-reports' as any),
  
  reportTemplates: () => 
    router.push('/screens/financial-reports' as any),
  
  // Analytics routes
  exportAnalytics: () => 
    router.push('/screens/principal-analytics' as any),
  
  academicReports: () => 
    router.push('/screens/teacher-reports' as any),
  
  approvalHistory: () => 
    router.push('/screens/principal-analytics' as any),
  
  // Dynamic report routes
  dynamicReport: (_reportName: string) => {
    router.push('/screens/financial-reports' as any);
  },
  
  // AI and class management
  aiProgressAnalysis: () => 
    router.push('/screens/teacher-reports' as any),
  
  classDetails: (classId: string, className: string) => 
    router.push({ pathname: '/screens/class-teacher-management' as any, params: { classId, className } } as any),
  
  assignmentDetails: (assignmentId: string, title: string) => 
    router.push({ pathname: '/screens/teacher-reports' as any, params: { assignmentId, title } } as any),
  
  createClass: () => 
    router.push('/screens/class-teacher-management' as any),
  
  createEvent: () => 
    router.push('/screens/teacher-reports' as any),
  
  // Announcements
  announcementsHistory: () => 
    router.push('/screens/teacher-messages' as any),
  
  // Help routes
  financialReportsHelp: () => 
    router.push('/screens/financial-reports' as any),
};

/**
 * Fallback function for any route not covered above
 */
export const navigateToPath = (path: string) => {
  try {
    router.push(path as any);
  } catch (error) {
    console.warn(`Navigation failed for path: ${path}`, error);
  }
};
