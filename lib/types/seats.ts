/**
 * Types for Teacher Seat Management System
 * 
 * Corresponds to the new seat management RPC functions created in the database
 */

// RPC Response Types
export interface SeatAssignResponse {
  status: 'assigned' | 'already_assigned';
}

export interface SeatRevokeResponse {
  status: 'revoked' | 'no_active_seat';
}

export interface SeatLimits {
  limit: number | null; // null means unlimited
  used: number;
  available: number | null; // null means unlimited
}

export interface TeacherSeat {
  user_id: string; // This matches the RPC return column
  assigned_at: string; // ISO date string
  revoked_at: string | null; // ISO date string or null for active seats
  assigned_by: string | null;
  revoked_by: string | null;
}

// UI State Types
export interface SeatUsageDisplay {
  used: number;
  total: number | null; // null means unlimited
  available: number | null; // null means unlimited
  isOverLimit: boolean; // true if used > total (legacy data)
  displayText: string; // e.g., "3/5 seats used" or "3 seats used (Unlimited)"
}

// Error Types
export interface SeatManagementError extends Error {
  code: 'LIMIT_EXCEEDED' | 'PERMISSION_DENIED' | 'USER_NOT_FOUND' | 'ALREADY_ASSIGNED' | 'NO_ACTIVE_SEAT' | 'NETWORK_ERROR' | 'UNKNOWN';
  details?: string;
}

// Service Parameters
export interface AssignSeatParams {
  teacherUserId: string;
}

export interface RevokeSeatParams {
  teacherUserId: string;
}