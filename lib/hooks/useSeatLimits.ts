/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Custom hook for managing teacher seat limits
 * 
 * Uses TanStack Query for caching and background updates
 * Provides real-time seat limit information for UI components
 */

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { SeatService } from '@/lib/services/seatService';
import { 
  SeatLimits, 
  SeatUsageDisplay, 
  SeatManagementError,
  AssignSeatParams,
  RevokeSeatParams
} from '@/lib/types/seats';

// Query keys for cache management
export const SEAT_QUERY_KEYS = {
  limits: ['seat-limits'] as const,
  seats: ['teacher-seats'] as const,
} as const;

/**
 * Hook for fetching and managing seat limits
 */
export function useSeatLimits() {
  const queryClient = useQueryClient();

  // Fetch current seat limits
  const limitsQuery = useQuery({
    queryKey: SEAT_QUERY_KEYS.limits,
    queryFn: SeatService.getSeatLimits,
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry permission errors
      if (error instanceof Error && 'code' in error) {
        const seatError = error as SeatManagementError;
        if (seatError.code === 'PERMISSION_DENIED') {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  // Assign teacher seat mutation
  const assignSeatMutation = useMutation({
    mutationFn: SeatService.assignTeacherSeat,
    onSuccess: (data, variables) => {
      // Invalidate and refetch seat limits
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.seats });
      
      if (data.status === 'assigned') {
        Alert.alert('Success', 'Teacher seat assigned successfully!');
      } else if (data.status === 'already_assigned') {
        Alert.alert('Info', 'Teacher already has an active seat.');
      }
    },
    onError: (error: SeatManagementError) => {
      let title = 'Assignment Failed';
      let message = 'Failed to assign teacher seat.';
      
      switch (error.code) {
        case 'LIMIT_EXCEEDED':
          title = 'Seat Limit Reached';
          message = 'No teacher seats available for your current plan. Consider upgrading your subscription.';
          break;
        case 'PERMISSION_DENIED':
          title = 'Permission Denied';
          message = 'Only principals can assign teacher seats.';
          break;
        case 'USER_NOT_FOUND':
          title = 'Invalid Teacher';
          message = 'The selected user must be a teacher in your school.';
          break;
        case 'ALREADY_ASSIGNED':
          title = 'Already Assigned';
          message = 'This teacher already has an active seat.';
          break;
        default:
          message = error.message || 'An unexpected error occurred.';
      }
      
      Alert.alert(title, message);
      console.error('Seat assignment error:', error);
    },
  });

  // Revoke teacher seat mutation
  const revokeSeatMutation = useMutation({
    mutationFn: SeatService.revokeTeacherSeat,
    onSuccess: (data, variables) => {
      // Invalidate and refetch seat limits
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.limits });
      queryClient.invalidateQueries({ queryKey: SEAT_QUERY_KEYS.seats });
      
      if (data.status === 'revoked') {
        Alert.alert('Success', 'Teacher seat revoked successfully!');
      } else if (data.status === 'no_active_seat') {
        Alert.alert('Info', 'Teacher does not have an active seat.');
      }
    },
    onError: (error: SeatManagementError) => {
      let title = 'Revocation Failed';
      let message = 'Failed to revoke teacher seat.';
      
      switch (error.code) {
        case 'PERMISSION_DENIED':
          title = 'Permission Denied';
          message = 'Only principals can revoke teacher seats.';
          break;
        case 'NO_ACTIVE_SEAT':
          title = 'No Active Seat';
          message = 'This teacher does not have an active seat to revoke.';
          break;
        default:
          message = error.message || 'An unexpected error occurred.';
      }
      
      Alert.alert(title, message);
      console.error('Seat revocation error:', error);
    },
  });

  // Generate UI-friendly display data
  const seatUsageDisplay: SeatUsageDisplay | null = limitsQuery.data 
    ? SeatService.formatSeatUsage(limitsQuery.data)
    : null;

  // Check if assignment should be disabled
  const shouldDisableAssignment = limitsQuery.data 
    ? SeatService.shouldDisableAssignment(limitsQuery.data)
    : true; // Default to disabled while loading

  return {
    // Data
    limits: limitsQuery.data,
    seatUsageDisplay,
    shouldDisableAssignment,
    
    // Loading states
    isLoading: limitsQuery.isLoading,
    isError: limitsQuery.isError,
    error: limitsQuery.error,
    
    // Mutations
    assignSeat: assignSeatMutation.mutate,
    revokeSeat: revokeSeatMutation.mutate,
    isAssigning: assignSeatMutation.isPending,
    isRevoking: revokeSeatMutation.isPending,
    
    // Actions
    refetch: limitsQuery.refetch,
  };
}

/**
 * Hook for listing teacher seats in the school
 */
export function useTeacherSeats() {
  const seatsQuery = useQuery({
    queryKey: SEAT_QUERY_KEYS.seats,
    queryFn: SeatService.listTeacherSeats,
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: (failureCount, error) => {
      // Don't retry permission errors
      if (error instanceof Error && 'code' in error) {
        const seatError = error as SeatManagementError;
        if (seatError.code === 'PERMISSION_DENIED') {
          return false;
        }
      }
      return failureCount < 2;
    },
  });

  return {
    seats: seatsQuery.data || [],
    isLoading: seatsQuery.isLoading,
    isError: seatsQuery.isError,
    error: seatsQuery.error,
    refetch: seatsQuery.refetch,
  };
}

/**
 * Helper function to check if a specific teacher has an active seat
 */
export function useTeacherHasSeat(teacherUserId: string) {
  const { seats } = useTeacherSeats();
  
  // Debug logging
  React.useEffect(() => {
    const show = true; // Force enable debug for troubleshooting
    if (show && teacherUserId) {
      console.log('[useTeacherHasSeat debug]', {
        teacherUserId,
        seats: seats.map(seat => ({
          user_id: seat.user_id,
          assigned_at: seat.assigned_at,
          revoked_at: seat.revoked_at,
        })),
        hasActiveSeat: seats.some(seat => 
          seat.user_id === teacherUserId && 
          seat.revoked_at === null
        ),
      });
    }
  }, [seats, teacherUserId]);
  
  return seats.some(seat => 
    seat.user_id === teacherUserId && 
    seat.revoked_at === null
  );
}
