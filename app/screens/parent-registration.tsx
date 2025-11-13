import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import EnhancedRegistrationForm from '@/components/auth/EnhancedRegistrationForm';
import { EnhancedRegistration } from '@/types/auth-enhanced';
import { assertSupabase } from '@/lib/supabase';

export default function ParentRegistrationScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const [invitationCode, setInvitationCode] = useState<string | undefined>(params.invitationCode as string | undefined);
  const [organizationId, setOrganizationId] = useState<string | undefined>();

  // Validate invitation code on mount if provided
  useEffect(() => {
    if (invitationCode) {
      validateInvitationCode(invitationCode);
    }
  }, [invitationCode]);

  const validateInvitationCode = async (code: string) => {
    try {
      const { data, error } = await assertSupabase()
        .from('school_invitation_codes')
        .select('id, preschool_id, school_id, is_active, expires_at, max_uses, current_uses')
        .eq('code', code.trim().toUpperCase())
        .eq('invitation_type', 'parent')
        .single();

      if (error || !data) {
        Alert.alert('Invalid Code', 'The invitation code is not valid.');
        setInvitationCode(undefined);
        return;
      }

      // Check if code is active
      if (!data.is_active) {
        Alert.alert('Inactive Code', 'This invitation code is no longer active.');
        setInvitationCode(undefined);
        return;
      }

      // Check if code has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        Alert.alert('Expired Code', 'This invitation code has expired.');
        setInvitationCode(undefined);
        return;
      }

      // Check if code has reached max uses
      if (data.max_uses && data.current_uses && data.current_uses >= data.max_uses) {
        Alert.alert('Code Limit Reached', 'This invitation code has reached its maximum number of uses.');
        setInvitationCode(undefined);
        return;
      }

      // Set organization ID from the code
      setOrganizationId(data.preschool_id || data.school_id || undefined);
      Alert.alert('Code Validated', 'Your invitation code has been validated successfully!');
    } catch (error: any) {
      console.error('Invitation code validation error:', error);
      Alert.alert('Validation Error', 'Failed to validate invitation code.');
      setInvitationCode(undefined);
    }
  };

  const handleRegistrationSuccess = async (registration: EnhancedRegistration) => {
    try {
      // Create user account with Supabase Auth
      const { data: authData, error: authError } = await assertSupabase().auth.signUp({
        email: registration.email,
        password: registration.password,
        options: {
          emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm',
          data: {
            first_name: registration.firstName,
            last_name: registration.lastName,
            phone: registration.phone,
            role: 'parent',
          }
        }
      });

      if (authError) throw authError;

      // If confirmations are enabled, Supabase returns no session until the email is verified
      if (!authData.session) {
        router.replace({
          pathname: '/screens/verify-your-email',
          params: { email: registration.email }
        } as any);
        return;
      }

      // Get invitation code from URL params or from the form
      const parentReg = registration as any;
      const codeToUse = invitationCode || parentReg.invitationToken;

      // If we have an invitation code, redeem it to link the parent to the school
      if (codeToUse && authData.user) {
        try {
          const fullName = `${registration.firstName} ${registration.lastName}`.trim();
          const { error: redeemError } = await assertSupabase()
            .rpc('use_invitation_code', {
              p_auth_user_id: authData.user.id,
              p_code: codeToUse.trim().toUpperCase(),
              p_name: fullName,
              p_phone: registration.phone || null,
            });

          if (redeemError) {
            console.error('Failed to redeem invitation code:', redeemError);
            Alert.alert(
              'Registration Successful',
              'Your account was created, but we couldn\'t link you to the school. You can join later using the invitation code.',
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Success!',
              'Your account has been created and linked to the school.',
              [{ text: 'OK' }]
            );
          }
        } catch (codeError) {
          console.error('Invitation code redemption error:', codeError);
        }
      }

      // Navigate to parent dashboard or child registration
      if (codeToUse) {
        router.replace('/screens/parent-children');
      } else {
        router.replace('/screens/parent-dashboard');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      handleRegistrationError(error.message || 'Registration failed');
    }
  };

  const handleRegistrationError = (error: string) => {
    console.error('Registration error:', error);
    // Error handling is done by the form component
  };

  const handleCancel = () => {
    router.back();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: 'Parent Registration',
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.surface,
          },
          headerTitleStyle: {
            color: theme.text,
          },
          headerTintColor: theme.primary,
        }}
      />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <EnhancedRegistrationForm
            role="parent"
            invitationToken={invitationCode}
            organizationId={organizationId}
            onSuccess={handleRegistrationSuccess}
            onCancel={handleCancel}
            onError={handleRegistrationError}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
