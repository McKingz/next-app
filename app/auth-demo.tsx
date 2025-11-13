// 🔐 Authentication Demo Screen
// Interactive showcase of all authentication components

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import EnhancedSignIn from '../components/auth/EnhancedSignIn';
import TwoFactorAuth from '../components/auth/TwoFactorAuth';
import UserProfile from '../components/auth/UserProfile';
import PasswordRecovery from '../components/auth/PasswordRecovery';
import InvitationManager from '../components/auth/InvitationManager';
import { EnhancedUser } from '../types/auth-enhanced';

type DemoComponent = 'signin' | '2fa' | 'profile' | 'recovery' | 'invitations' | null;

const DEMO_USER: EnhancedUser = {
  id: '1',
  email: 'demo@edudash.com',
  firstName: 'Demo',
  lastName: 'User',
  role: 'principal',
  organizationId: 'demo_org',
  profileComplete: true,
  emailVerified: true,
  lastLogin: new Date(),
  createdAt: new Date(),
  settings: {
    theme: 'light',
    language: 'en',
    notifications: { email: true, push: true, sms: false, marketing: false },
    privacy: { profileVisibility: 'organization', showEmail: true, showPhone: false, dataCollection: true }
  },
  permissions: ['read', 'write', 'admin']
};

export default function AuthDemo() {
  const { theme, isDark } = useTheme();
  const [activeComponent, setActiveComponent] = React.useState<DemoComponent>(null);

  const components = [
    {
      id: 'signin' as DemoComponent,
      title: '🔐 Enhanced Sign-In',
      description: 'Multi-factor authentication, social login, account lockout protection',
      features: ['MFA Support', 'Social Login', 'Account Lockout', 'Remember Me'],
      color: theme.primary
    },
    {
      id: '2fa' as DemoComponent,
      title: '📱 Two-Factor Auth',
      description: 'QR codes, SMS verification, backup codes management',
      features: ['TOTP Setup', 'QR Codes', 'Backup Codes', 'SMS Option'],
      color: theme.secondary
    },
    {
      id: 'profile' as DemoComponent,
      title: '👤 User Profile',
      description: 'Profile editing, security settings, activity monitoring',
      features: ['Profile Editing', 'Security Settings', 'Privacy Controls', 'Activity Logs'],
      color: theme.accent
    },
    {
      id: 'recovery' as DemoComponent,
      title: '🔑 Password Recovery',
      description: 'Multi-step recovery with email verification and security questions',
      features: ['Email Verification', 'Security Questions', 'Admin Reset', 'Progress Tracking'],
      color: theme.warning
    },
    {
      id: 'invitations' as DemoComponent,
      title: '📧 Invitation Manager',
      description: 'Invite teachers and parents with bulk support',
      features: ['Individual Invites', 'Bulk CSV', 'Role-Specific Fields', 'Status Tracking'],
      color: theme.success
    }
  ];

  const renderComponent = () => {
    switch (activeComponent) {
      case 'signin':
        return (
          <EnhancedSignIn
            onSuccess={(user, response) => {
              Alert.alert('✅ Sign In Success!', `Welcome ${user.firstName}! This is a demo - in a real app you'd be redirected to the dashboard.`);
            }}
            onError={(error) => {
              Alert.alert('Demo Info', `Error: ${error}\n\nTip: Try admin@test.com / password or enable 2FA to see the MFA flow!`);
            }}
            onForgotPassword={() => {
              Alert.alert('Demo Tip', 'This would open the password recovery flow. Want to see it? Close this and tap the Password Recovery demo!');
            }}
            onRegister={() => {
              Alert.alert('Demo Info', 'This would open the registration flow (not shown in this demo).');
            }}
            showSocialLogin={true}
            enableMFA={true}
          />
        );
      
      case '2fa':
        return (
          <TwoFactorAuth
            user={DEMO_USER}
            mode="setup"
            onSetupComplete={(backupCodes) => {
              Alert.alert('🎉 2FA Setup Complete!', `Your backup codes have been generated. In a real app, you'd save these securely:\n\n${backupCodes.slice(0, 3).join('\n')}...`);
            }}
            onVerificationComplete={() => {
              Alert.alert('✅ Verification Success!', 'Two-factor authentication verified successfully!');
            }}
            onError={(error) => {
              Alert.alert('Demo Info', `Error: ${error}\n\nTip: Use 123456 as the verification code in this demo!`);
            }}
          />
        );
      
      case 'profile':
        return (
          <UserProfile
            user={DEMO_USER}
            onProfileUpdate={(updatedUser) => {
              Alert.alert('✅ Profile Updated!', 'Your profile changes have been saved successfully!');
            }}
            onPasswordChange={(current, newPassword) => {
              Alert.alert('🔑 Password Changed!', 'Your password has been updated successfully!');
            }}
            onSecuritySettingsUpdate={(settings) => {
              Alert.alert('🔐 Security Updated!', 'Your security settings have been saved!');
            }}
            onError={(error) => {
              Alert.alert('Demo Info', `Error: ${error}`);
            }}
            showBackButton={false}
          />
        );
      
      case 'recovery':
        return (
          <PasswordRecovery
            onRecoveryComplete={(email) => {
              Alert.alert('🎉 Recovery Complete!', `Password reset successful for ${email}! In a real app, you'd be redirected to sign in.`);
            }}
            onError={(error) => {
              Alert.alert('Demo Info', `Error: ${error}\n\nTip: Use 123456 as verification codes in this demo!`);
            }}
            onCancel={() => setActiveComponent(null)}
            initialEmail="demo@example.com"
          />
        );
      
      case 'invitations':
        return (
          <InvitationManager
            userRole="principal"
            organizationId="demo_org"
            onInvitationSent={(invitations) => {
              Alert.alert('📤 Invitations Sent!', `Successfully sent ${invitations.length} invitations!`);
            }}
            onError={(error) => {
              Alert.alert('Demo Info', `Error: ${error}`);
            }}
          />
        );
      
      default:
        return null;
    }
  };

  const renderComponentCard = (component: typeof components[0]) => (
    <TouchableOpacity
      key={component.id}
      style={[styles.componentCard, { backgroundColor: theme.surface }]}
      onPress={() => setActiveComponent(component.id)}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {component.title}
        </Text>
        <View style={[styles.colorDot, { backgroundColor: component.color }]} />
      </View>
      
      <Text style={[styles.cardDescription, { color: theme.textSecondary }]}>
        {component.description}
      </Text>
      
      <View style={styles.features}>
        {component.features.map((feature, index) => (
          <View key={index} style={[styles.featureBadge, { backgroundColor: component.color + '20' }]}>
            <Text style={[styles.featureText, { color: component.color }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
      
      <View style={styles.cardFooter}>
        <Text style={[styles.tapText, { color: theme.primary }]}>
          Tap to Demo →
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.background} 
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          🔐 Authentication Demo
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Interactive showcase of all auth components
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introSection}>
          <Text style={[styles.introText, { color: theme.textSecondary }]}>
            Welcome to the authentication system demo! Tap any component below to see it in action. 
            These are fully functional components with interactive features and realistic demo data.
          </Text>
        </View>

        <View style={styles.componentsGrid}>
          {components.map(renderComponentCard)}
        </View>

        <View style={styles.tipsSection}>
          <Text style={[styles.tipsTitle, { color: theme.text }]}>
            💡 Demo Tips
          </Text>
          <View style={[styles.tipCard, { backgroundColor: theme.primaryLight + '20' }]}>
            <Text style={[styles.tipText, { color: theme.text }]}>
              • For Sign-In: Use admin@test.com / password{'\n'}
              • For 2FA: Use 123456 as verification code{'\n'}
              • For Recovery: Use 123456 for all verification codes{'\n'}
              • Pull down to refresh live data in components{'\n'}
              • All interactions show realistic responses
            </Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={[styles.statsTitle, { color: theme.text }]}>
            📊 What We've Built
          </Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statNumber, { color: theme.primary }]}>5</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Auth Components</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statNumber, { color: theme.secondary }]}>4,500+</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lines of Code</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.surface }]}>
              <Text style={[styles.statNumber, { color: theme.success }]}>100%</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TypeScript</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Component Modal */}
      <Modal
        visible={activeComponent !== null}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setActiveComponent(null)}
            >
              <Text style={[styles.closeButtonText, { color: theme.primary }]}>
                ← Back to Demo
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {components.find(c => c.id === activeComponent)?.title || 'Demo'}
            </Text>
          </View>
          
          {renderComponent()}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  introSection: {
    padding: 20,
  },
  introText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  componentsGrid: {
    paddingHorizontal: 20,
  },
  componentCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featureBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    alignItems: 'flex-end',
  },
  tapText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipCard: {
    padding: 16,
    borderRadius: 12,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    marginRight: 16,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
});