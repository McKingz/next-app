import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, Text, Platform, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { assertSupabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
export default function InviteEntry() {
  const params = useLocalSearchParams<{ code?: string }>();
  const isWeb = Platform.OS === 'web';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.edudashpro';
  const { t } = useTranslation();

  const [detectedType, setDetectedType] = useState<'parent' | 'student' | 'member' | 'unknown'>('unknown');

  const code = useMemo(() => {
    return typeof params?.code === 'string' ? params.code.trim() : '';
  }, [params?.code]);

  const tryOpenApp = (pathAndQuery: string) => {
    if (!isWeb) return;
    const schemeUrl = `edudashpro://${pathAndQuery.replace(/^\//, '')}`;
    let didHide = false;
    const visibilityHandler = () => {
      if (document.hidden) didHide = true;
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    window.location.href = schemeUrl;
    setTimeout(() => {
      document.removeEventListener('visibilitychange', visibilityHandler);
      if (!didHide) window.location.href = playStoreUrl;
    }, 1200);
  };

  useEffect(() => {
    const detectAndRoute = async () => {
      if (!code) {
        if (!isWeb) router.replace('/');
        return;
      }

      // Attempt to detect invite type via RPC; fall back to parent if unknown
      let inviteType: 'parent' | 'student' | 'member' | 'unknown' = 'unknown';
      try {
        const { data } = await assertSupabase().rpc('validate_invitation_code', { p_code: code, p_email: '' });
        if (data && typeof data.invitation_type === 'string') {
          const t = data.invitation_type.toLowerCase();
          if (t === 'parent' || t === 'student' || t === 'member') inviteType = t as any;
        }
      } catch {
        // ignore and fall back
      }
      setDetectedType(inviteType);

      // Compute target path in-app
      const targetPath = inviteType === 'student' || inviteType === 'member'
        ? `/screens/student-join-by-code?code=${encodeURIComponent(code)}`
        : `/screens/parent-registration?invitationCode=${encodeURIComponent(code)}`;

      if (!isWeb) {
        router.replace(targetPath as any);
      } else {
        tryOpenApp(targetPath);
      }
    };

    detectAndRoute();
  }, [code]);

  // Minimal web fallback UI
  if (isWeb) {
    const targetHint = detectedType === 'student' || detectedType === 'member'
      ? `/screens/student-join-by-code?code=${encodeURIComponent(code)}`
      : `/screens/parent-registration?invitationCode=${encodeURIComponent(code)}`;

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator color="#00f5ff" />
        <Text style={{ color: '#ffffff', textAlign: 'center' }}>{t('invite.opening_app', { defaultValue: 'Opening the app...' })}</Text>
        <TouchableOpacity onPress={() => tryOpenApp(targetHint)} style={{ backgroundColor: '#00f5ff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
          <Text style={{ color: '#000', fontWeight: '800' }}>{t('invite.open_app_cta', { defaultValue: 'Open EduDash Pro App' })}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(playStoreUrl)}>
          <Text style={{ color: '#9CA3AF', textDecorationLine: 'underline' }}>{t('invite.install_google_play', { defaultValue: 'Install from Google Play' })}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Native: loader; navigation occurs in effect
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
      <ActivityIndicator color="#00f5ff" />
    </View>
  );
}
