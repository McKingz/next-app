import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useTheme } from '@/contexts/ThemeContext';
import SalesLeads from '@/components/superadmin/SalesLeads';

export default function SuperAdminLeadsScreen() {
  const [loading, setLoading] = useState(false);
  const { theme, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <ThemedStatusBar />
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <RoleBasedHeader 
          title="Sales/Leads" 
          showBackButton={false} 
          backgroundColor={theme.headerBackground}
          textColor={theme.headerText}
        />
        <SalesLeads loading={loading} setLoading={setLoading} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});