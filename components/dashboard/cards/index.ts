export { DashboardCard } from './DashboardCard';
export { AnnouncementsCard } from './AnnouncementsCard';
export { ScheduleCard } from './ScheduleCard';
export { AssignmentsCard } from './AssignmentsCard';
export { GradesCard } from './GradesCard';
export { FixturesCard } from './FixturesCard';
export { CertificationsCard } from './CertificationsCard';

// Widget key to component mapping
export const WIDGET_COMPONENTS = {
  announcements: AnnouncementsCard,
  schedule: ScheduleCard,
  assignments: AssignmentsCard,
  grades: GradesCard,
  fixtures: FixturesCard,
  certifications: CertificationsCard,
  // TODO: Add remaining widgets as they're implemented
  // chat: ChatCard,
  // attendance: AttendanceCard,
  // progress_report: ProgressReportCard,
  // training_modules: TrainingModulesCard,
  // performance_metrics: PerformanceMetricsCard,
} as const;

export type WidgetKey = keyof typeof WIDGET_COMPONENTS;
