import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { validateUserAccess, routeAfterLogin } from '@/lib/routeAfterLogin';
import { fetchEnhancedUserProfile, type Role } from '@/lib/rbac';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { assertSupabase } from '@/lib/supabase';

const ROLES = [
  {
    value: 'parent' as Role,
    label: 'Parent',
    description: 'Access your child\'s learning journey',
    icon: 'people',
  },
  {
    value: 'teacher' as Role,
    label: 'Teacher',
    description: 'Manage your classroom and students',
    icon: 'school',
  },
  {
    value: 'principal_admin' as Role,
    label: 'Principal/Administrator',
    description: 'Oversee school operations',
    icon: 'business',
  },
] as const;

/**
 * Enhanced Profile Gate Screen
 * - Handles cases where users need profile setup or validation
 * - Integrates with RBAC system for proper role assignment
 * - Provides clear path forward for users with access issues
 */
export default function ProfilesGateScreen() {
  const { user, profile, refreshProfile, loading, signOut } = useAuth();
  const { isOnboardingComplete } = useOnboarding();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accessValidation, setAccessValidation] = useState<ReturnType<typeof validateUserAccess> | null>(null);
  const navigationInProgressRef = useRef(false);

  useEffect(() => {
    // Check if user needs onboarding (missing DOB, org type, etc.)
    const checkOnboardingNeeded = async () => {
      if (!profile || !user) return;

      // Check if user has completed basic onboarding requirements
      const needsOnboarding = !profile.date_of_birth;

      if (needsOnboarding && !isOnboardingComplete && !navigationInProgressRef.current) {
        console.log('Profiles-gate: User needs onboarding, redirecting...');
        navigationInProgressRef.current = true;
        router.replace('/onboarding');
        return true;
      }
      return false;
    };

    // Special case: If user came from biometric login and has no profile data,
    // they might be an existing user - try to detect their role
    const handleExistingUser = async () => {
      if (!profile && user) {
        console.log('Profiles-gate: No profile found, checking if existing user...');
        try {
          // Set routing lock
          if (typeof window !== 'undefined') {
            (window as any)[routingLock] = true;
          }
          
          // Try to detect user role from legacy methods
          const { detectRoleAndSchool } = await import('@/lib/routeAfterLogin');
          const { role } = await detectRoleAndSchool(user);
          
          if (role && !navigationInProgressRef.current) {
            console.log('Profiles-gate: Found existing user role:', role);
            navigationInProgressRef.current = true;
            // Route based on detected role
            const routes = {
              'parent': '/screens/parent-dashboard',
              'teacher': '/screens/teacher-dashboard', 
              'principal_admin': '/screens/principal-dashboard',
              'super_admin': '/screens/super-admin-dashboard'
            };
            const targetRoute = routes[role as keyof typeof routes] || '/(auth)/sign-in';
            
            // Use timeout to prevent blocking UI
            setTimeout(() => {
              router.replace(targetRoute as any);
            }, 100);
            return;
          }
        } catch (error) {
          console.error('Error detecting existing user role:', error);
        } finally {
          // Clear routing lock after delay
          setTimeout(() => {
            if (typeof window !== 'undefined') {
              delete (window as any)[routingLock];
            }
          }, 2000);
        }
      }
    };

    if (profile) {
      // Check onboarding first
      checkOnboardingNeeded().then(needsOnboarding => {
        if (needsOnboarding) return; // Already redirected

        const validation = validateUserAccess(profile);
        setAccessValidation(validation);
        
        // If user has valid access, route them appropriately
        if (validation.hasAccess && !navigationInProgressRef.current) {
          navigationInProgressRef.current = true;
          routeAfterLogin(user, profile).catch(console.error);
        }
      });
    } else {
      // Try to handle existing users who may not have proper profile data
      handleExistingUser();
    }
  }, [profile, user, loading]);

  const handleRoleSelection = (role: Role) => {
    setSelectedRole(role);
    track('edudash.profile_gate.role_selected', {
      user_id: user?.id,
      selected_role: role,
    });
  };

  const handleContinue = async () => {
    if (!selectedRole || !user) return;

    setIsSubmitting(true);
    
    try {
      console.log('Profile gate: Continuing with selected role:', selectedRole);
      
      track('edudash.profile_gate.role_submitted', {
        user_id: user.id,
        submitted_role: selectedRole,
      });

      // First, try to update the user's profile/metadata with selected role
      try {
        // Update user metadata to persist the selected role
        try {
          const { error: updateError } = await assertSupabase().auth.updateUser({
            data: { 
              role: selectedRole,
              profile_completed: true,
              profile_completion_timestamp: new Date().toISOString()
            }
          });

          if (updateError) {
            console.error('Failed to update user metadata:', updateError);
          } else {
            console.log('Successfully updated user metadata with role:', selectedRole);
          }
        } catch { /* Intentional: non-fatal */ }

      } catch (metadataError) {
        console.error('Error updating user metadata:', metadataError);
        // Continue anyway, as this is not critical for routing
      }

      // Refresh profile to get updated data
      await refreshProfile();
      
      // Try to get enhanced profile first
      let updatedProfile;
      try {
        updatedProfile = await fetchEnhancedUserProfile(user.id);
      } catch (profileError) {
        console.error('Error fetching enhanced profile:', profileError);
      }

      // If we have an enhanced profile with proper role, use enhanced routing
      if (updatedProfile && updatedProfile.role) {
        console.log('Profile gate: Using enhanced routing with profile:', updatedProfile);
        await routeAfterLogin(user, updatedProfile);
        return;
      }
      
      // Fallback: Route directly based on selected role
      console.log('Profile gate: Using fallback routing for role:', selectedRole);
      const routes = {
        'parent': '/screens/parent-dashboard',
        'teacher': '/screens/teacher-dashboard', 
        'principal_admin': '/screens/principal-dashboard',
      };
      
      const targetRoute = routes[selectedRole as keyof typeof routes];
      if (targetRoute && !navigationInProgressRef.current) {
        console.log('Profile gate: Routing to:', targetRoute);
        navigationInProgressRef.current = true;
        router.replace(targetRoute as any);
        return;
      }
      // Default fallback to sign-in
      if (!navigationInProgressRef.current) {
        navigationInProgressRef.current = true;
        router.replace('/(auth)/sign-in' as any);
      }
      return;
    } catch (error) {
      console.error('Profile gate: Continue failed:', error);
      reportError(new Error('Profile setup failed'), {
        userId: user.id,
        selectedRole,
        error,
      });
      
      Alert.alert(
        'Setup Error',
        'There was a problem setting up your profile. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContactSupport = () => {
    track('edudash.profile_gate.contact_support', {
      user_id: user?.id,
      reason: accessValidation?.reason,
    });
    
    Alert.alert(
      'Contact Support',
      'Please contact your organization administrator or our support team for assistance with your account access.',
      [{ text: 'OK' }]
    );
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Ensure we land on the auth screen immediately after sign-out
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If user has profile but access issues
  if (profile && accessValidation && !accessValidation.hasAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <RoleBasedHeader title="Account Access" />
        
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning-outline" size={64} color="#FF9500" />
          </View>
          
          <Text style={styles.title}>Account Setup Required</Text>
          <Text style={styles.description}>
            Your account needs to be configured with the correct role and permissions.
            Please contact your administrator or select your role below.
          </Text>
          
          <Text style={styles.suggestion}>
            If you're unsure of your role, please contact support for assistance.
          </Text>
          
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleContactSupport}
            accessibilityLabel="Contact support for help"
          >
            <Text style={styles.primaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Profile setup flow for users without profiles
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <RoleBasedHeader title="Complete Your Profile" />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add-outline" size={64} color="#007AFF" />
        </View>
        
        <Text style={styles.title}>Welcome to EduDash</Text>
        <Text style={styles.description}>
          To get started, please let us know your role in education.
        </Text>
        
        <View style={styles.rolesList}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.value}
              style={[
                styles.roleCard,
                selectedRole === role.value && styles.selectedRoleCard,
              ]}
              onPress={() => handleRoleSelection(role.value)}
              accessibilityLabel={`Select ${role.label} role`}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedRole === role.value }}
            >
              <View style={styles.roleCardContent}>
                <Ionicons 
                  name={role.icon as any} 
                  size={32} 
                  color={selectedRole === role.value ? '#007AFF' : '#666'} 
                />
                <Text style={[
                  styles.roleTitle,
                  selectedRole === role.value && styles.selectedRoleTitle,
                ]}>
                  {role.label}
                </Text>
                <Text style={[
                  styles.roleDescription,
                  selectedRole === role.value && styles.selectedRoleDescription,
                ]}>
                  {role.description}
                </Text>
              </View>
              
              <View style={styles.radioContainer}>
                <View style={[
                  styles.radio,
                  selectedRole === role.value && styles.selectedRadio,
                ]}>
                  {selectedRole === role.value && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedRole || isSubmitting) && styles.disabledButton,
          ]}
          onPress={handleContinue}
          disabled={!selectedRole || isSubmitting}
          accessibilityLabel="Continue with selected role"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        >
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  suggestion: {
    fontSize: 14,
    color: '#FF9500',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 32,
  },
  rolesList: {
    width: '100%',
    marginBottom: 32,
  },
  roleCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRoleCard: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  roleCardContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  selectedRoleTitle: {
    color: '#007AFF',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  selectedRoleDescription: {
    color: '#0066CC',
  },
  radioContainer: {
    marginLeft: 16,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedRadio: {
    borderColor: '#007AFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  continueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    height: 56,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

