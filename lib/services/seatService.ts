/**
 * Teacher Seat Management Service
 * 
 * Provides a clean interface to the seat management RPC functions
 * Created to fix inconsistent seat assignment issues on plans like starter
 */

import { assertSupabase } from '@/lib/supabase';
import { 
  SeatAssignResponse, 
  SeatRevokeResponse, 
  SeatLimits, 
  TeacherSeat, 
  SeatUsageDisplay,
  SeatManagementError,
  AssignSeatParams,
  RevokeSeatParams
} from '@/lib/types/seats';

export class SeatService {
  
  /**
   * Get current seat limits and usage for the caller's school
   * Works for both principals and teachers
   */
  static async getSeatLimits(): Promise<SeatLimits> {
    try {
      const { data, error } = await assertSupabase()
        .rpc('rpc_teacher_seat_limits');

      if (error) {
        console.error('Error fetching seat limits:', error);
        throw this.createError('NETWORK_ERROR', 'Failed to fetch seat limits', error.message);
      }

      // The RPC returns a single row with limit, used, available
      if (!data || data.length === 0) {
        throw this.createError('UNKNOWN', 'No seat limit data returned');
      }

      const result = data[0];
      return {
        limit: result.limit,
        used: result.used,
        available: result.available
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw SeatManagementError
      }
      console.error('Unexpected error fetching seat limits:', error);
      throw this.createError('UNKNOWN', 'Unexpected error fetching seat limits', String(error));
    }
  }

  /**
   * Assign a teacher seat to a user
   * Only principals can assign seats for their school
   */
  static async assignTeacherSeat({ teacherUserId }: AssignSeatParams): Promise<SeatAssignResponse> {
    try {
      const { data, error } = await assertSupabase()
        .rpc('rpc_assign_teacher_seat', { target_user_id: teacherUserId });

      if (error) {
        console.error('Error assigning teacher seat:', error);
        
        // Map specific error messages to error codes
        if (error.message.includes('Only principals can assign')) {
          throw this.createError('PERMISSION_DENIED', 'Only principals can assign teacher seats');
        }
        if (error.message.includes('No teacher seats available')) {
          throw this.createError('LIMIT_EXCEEDED', 'No teacher seats available for this plan');
        }
        if (error.message.includes('Target must be a teacher')) {
          throw this.createError('USER_NOT_FOUND', 'Target user must be a teacher in the same school');
        }
        
        throw this.createError('NETWORK_ERROR', 'Failed to assign teacher seat', error.message);
      }

      return data as SeatAssignResponse;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw SeatManagementError
      }
      console.error('Unexpected error assigning teacher seat:', error);
      throw this.createError('UNKNOWN', 'Unexpected error assigning teacher seat', String(error));
    }
  }

  /**
   * Revoke a teacher seat from a user
   * Only principals can revoke seats for their school
   */
  static async revokeTeacherSeat({ teacherUserId }: RevokeSeatParams): Promise<SeatRevokeResponse> {
    try {
      const { data, error } = await assertSupabase()
        .rpc('rpc_revoke_teacher_seat', { target_user_id: teacherUserId });

      if (error) {
        console.error('Error revoking teacher seat:', error);
        
        // Map specific error messages to error codes
        if (error.message.includes('Only principals can revoke')) {
          throw this.createError('PERMISSION_DENIED', 'Only principals can revoke teacher seats');
        }
        
        throw this.createError('NETWORK_ERROR', 'Failed to revoke teacher seat', error.message);
      }

      return data as SeatRevokeResponse;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw SeatManagementError
      }
      console.error('Unexpected error revoking teacher seat:', error);
      throw this.createError('UNKNOWN', 'Unexpected error revoking teacher seat', String(error));
    }
  }

  /**
   * List all teacher seats for the caller's school (if principal) or own seats (if teacher)
   */
  static async listTeacherSeats(): Promise<TeacherSeat[]> {
    try {
      const { data, error } = await assertSupabase()
        .rpc('rpc_list_teacher_seats');

      if (error) {
        console.error('Error listing teacher seats:', error);
        throw this.createError('NETWORK_ERROR', 'Failed to list teacher seats', error.message);
      }

      return data as TeacherSeat[];
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw SeatManagementError
      }
      console.error('Unexpected error listing teacher seats:', error);
      throw this.createError('UNKNOWN', 'Unexpected error listing teacher seats', String(error));
    }
  }

  /**
   * Generate UI-friendly display information for seat usage
   */
  static formatSeatUsage(limits: SeatLimits): SeatUsageDisplay {
    const { limit, used, available } = limits;
    
    // Check if over limit (legacy data scenario)
    const isOverLimit = limit !== null && used > limit;
    
    let displayText: string;
    
    if (limit === null) {
      // Unlimited plan
      displayText = `${used} seats used (Unlimited)`;
    } else {
      // Limited plan
      displayText = `${used}/${limit} seats used`;
      if (isOverLimit) {
        displayText += ' (Over limit)';
      }
    }

    return {
      used,
      total: limit,
      available,
      isOverLimit,
      displayText
    };
  }

  /**
   * Check if seat assignment should be disabled in UI
   */
  static shouldDisableAssignment(limits: SeatLimits): boolean {
    const { limit, available } = limits;
    
    // If unlimited plan, never disable
    if (limit === null) {
      return false;
    }
    
    // If no seats available, disable
    return available === null || available <= 0;
  }

  /**
   * Create a properly typed SeatManagementError
   */
  private static createError(
    code: SeatManagementError['code'], 
    message: string, 
    details?: string
  ): SeatManagementError {
    const error = new Error(message) as SeatManagementError;
    error.code = code;
    error.details = details;
    error.name = 'SeatManagementError';
    return error;
  }
}

export default SeatService;