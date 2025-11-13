import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

export function useAppUpdates() {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const check = useCallback(async (interactive = false) => {
    if (Platform.OS === 'web') return { isAvailable: false };
    try {
      setChecking(true);
      setError(null);
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setAvailable(true);
        return { isAvailable: true };
      } else {
        setAvailable(false);
        return { isAvailable: false };
      }
    } catch (e: any) {
      setError(e);
      if (interactive) throw e;
      return { isAvailable: false, error: e };
    } finally {
      setChecking(false);
    }
  }, []);

  const apply = useCallback(async () => {
    if (Platform.OS === 'web') return;
    await Updates.reloadAsync();
  }, []);

  useEffect(() => {
    // initial background check
    check(false);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check(false);
    });
    return () => sub.remove();
  }, [check]);

  return { checking, available, error, check, apply };
}
