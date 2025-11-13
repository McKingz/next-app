import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

export default function ParentChildrenScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const loadChildren = useCallback(async () => {
    try {
      setLoading(true);
      
      if (user?.id) {
        const client = assertSupabase();
        
        // Get user's internal ID and preschool
        const { data: me } = await client
          .from('users')
          .select('id, preschool_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        if (me?.id) {
          const { data: studentsData } = await client
            .from('students')
            .select(`
              id, first_name, last_name, class_id, is_active, 
              preschool_id, date_of_birth, parent_id, guardian_id,
              classes!left(id, name, grade_level)
            `)
            .or(`parent_id.eq.${me.id},guardian_id.eq.${me.id}`)
            .eq('is_active', true);
          
          setChildren(studentsData || []);
        }
      }
    } catch (error) {
      console.error('Error loading children:', error);
      Alert.alert('Error', 'Failed to load children');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    setRefreshing(false);
  }, [loadChildren]);

  const getChildAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 'Age unknown';
    try {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      const age = Math.floor((today.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age > 0 && age < 10 ? `${age} years old` : 'Age unknown';
    } catch {
      return 'Age unknown';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    childCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    childHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.primary,
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 4,
    },
    childDetails: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.success + '20',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.success,
      textTransform: 'capitalize',
    },
    childActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.primary + '10',
      borderWidth: 1,
      borderColor: theme.primary + '20',
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.primary,
      marginLeft: 4,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    addButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    addButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title="My Children" showBackButton={true} onBackPress={handleBackPress} />
        <View style={[styles.section, { justifyContent: 'center', flex: 1 }]}>
          <Text style={{ color: theme.text, textAlign: 'center' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RoleBasedHeader title="My Children" showBackButton={true} onBackPress={handleBackPress} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          {children.length > 0 ? (
            children.map((child) => {
              const initials = `${child.first_name?.[0] || ''}${child.last_name?.[0] || ''}`.toUpperCase();
              
              return (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childCard}
                  onPress={() => router.push(`/screens/student-detail?id=${child.id}` as any)}
                >
                  <View style={styles.childHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    
                    <View style={styles.childInfo}>
                      <Text style={styles.childName}>
                        {child.first_name} {child.last_name}
                      </Text>
                      <Text style={styles.childDetails}>
                        {getChildAge(child.date_of_birth)} • {child.classes?.grade_level || 'Preschool'}
                      </Text>
                      <Text style={styles.childDetails}>
                        Class: {child.classes?.name || 'Not assigned'}
                      </Text>
                    </View>
                    
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>Active</Text>
                    </View>
                  </View>
                  
                  <View style={styles.childActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => router.push(`/screens/attendance?id=${child.id}` as any)}
                    >
                      <Ionicons name="calendar" size={16} color={theme.primary} />
                      <Text style={styles.actionButtonText}>Attendance</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => console.log('Homework coming soon')}
                    >
                      <Ionicons name="book" size={16} color={theme.primary} />
                      <Text style={styles.actionButtonText}>Homework</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => console.log('Progress report coming soon')}
                    >
                      <Ionicons name="trending-up" size={16} color={theme.primary} />
                      <Text style={styles.actionButtonText}>Progress</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-add" size={64} color={theme.textSecondary} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No Children Found</Text>
              <Text style={styles.emptySubtitle}>
                You don't have any children linked to your account yet. 
                Register a new child or request to link an existing one.
              </Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => router.push('/screens/parent-child-registration')}
              >
                <Text style={styles.addButtonText}>Register Child</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => router.push('/screens/parent-join-by-code')}
              >
                <Text style={styles.addButtonText}>Have a school code? Join by Code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
