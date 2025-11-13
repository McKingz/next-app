// React Query hooks for School Settings
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import SchoolSettingsService, { SchoolSettings } from '@/lib/services/SchoolSettingsService';

const SCHOOL_SETTINGS_KEYS = {
  bySchool: (schoolId: string) => ['school-settings', schoolId] as const,
};

export function useSchoolSettings(schoolId?: string) {
  return useQuery({
    queryKey: SCHOOL_SETTINGS_KEYS.bySchool(schoolId || 'missing'),
    queryFn: () => {
      if (!schoolId) throw new Error('Missing schoolId');
      return SchoolSettingsService.get(schoolId);
    },
    enabled: !!schoolId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useUpdateSchoolSettings(schoolId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<SchoolSettings>) => {
      if (!schoolId) throw new Error('Missing schoolId');
      return SchoolSettingsService.update(schoolId, updates);
    },
    onSuccess: (data) => {
      if (!schoolId) return;
      queryClient.setQueryData(SCHOOL_SETTINGS_KEYS.bySchool(schoolId), data);
      queryClient.invalidateQueries({ queryKey: SCHOOL_SETTINGS_KEYS.bySchool(schoolId) });
    },
  });
}
