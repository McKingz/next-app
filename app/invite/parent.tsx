import React, { useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Text, Platform, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

export default function InviteParentEntry() {
  const params = useLocalSearchParams<{ code?: string }>();
  const isWeb = Platform.OS === 'web';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.edudashpro';
  const { t } = useTranslation();

  const code = useMemo(() => {
    return typeof params?.code === 'string' ? params.code : '';
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
    if (!code) {
      if (!isWeb) router.replace('/');
      return;
    }
    if (!isWeb) {
      router.replace(`/screens/parent-registration?invitationCode=${encodeURIComponent(code)}` as any);
    } else {
      tryOpenApp(`/screens/parent-registration?invitationCode=${encodeURIComponent(code)}`);
    }
  }, [code]);

  if (!isWeb) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
        <ActivityIndicator color="#00f5ff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#0a0a0f' }}>
      <ActivityIndicator color="#00f5ff" />
      <Text style={{ color: '#ffffff' }}>{t('invite.opening_parent_registration', { defaultValue: 'Opening the app for parent registration...' })}</Text>
      <TouchableOpacity onPress={() => tryOpenApp(`/screens/parent-registration?invitationCode=${encodeURIComponent(code)}`)} style={{ backgroundColor: '#00f5ff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}>
        <Text style={{ color: '#000', fontWeight: '800' }}>{t('invite.open_app_cta', { defaultValue: 'Open EduDash Pro App' })}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL(playStoreUrl)}>
        <Text style={{ color: '#9CA3AF', textDecorationLine: 'underline' }}>{t('invite.install_google_play', { defaultValue: 'Install from Google Play' })}</Text>
      </TouchableOpacity>
    </View>
  );
}
