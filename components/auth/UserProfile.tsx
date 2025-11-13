// 👤 User Profile Management Component
// Comprehensive profile management with security settings and activity logs

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  Image,
  FlatList,
  Modal,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { EnhancedUser, SecurityEvent, NotificationSettings, PrivacySettings } from '../../types/auth-enhanced';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

interface UserProfileProps {
  user: EnhancedUser;
  onProfileUpdate?: (updatedUser: Partial<EnhancedUser>) => void;
  onPasswordChange?: (currentPassword: string, newPassword: string) => void;
  onSecuritySettingsUpdate?: (settings: any) => void;
  onError?: (error: string) => void;
  showBackButton?: boolean;
  onBack?: () => void;
}

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bio?: string;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  deviceTracking: boolean;
  ipWhitelist: string[];
  sessionTimeout: number;
  passwordExpiry: number;
}

type TabType = 'profile' | 'security' | 'privacy' | 'activity' | 'password';

const MOCK_ACTIVITY_LOGS: SecurityEvent[] = [
  {
    id: '1',
    type: 'login_success',
    email: 'user@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    details: { device: 'Chrome on Windows', location: 'New York, NY' },
    riskLevel: 'low',
    resolved: true
  },
  {
    id: '2',
    type: 'password_change',
    email: 'user@example.com',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date('2024-01-14T14:22:00Z'),
    details: { reason: 'User initiated' },
    riskLevel: 'medium',
    resolved: true
  },
  {
    id: '3',
    type: 'login_failure',
    email: 'user@example.com',
    ipAddress: '203.0.113.5',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date('2024-01-13T09:45:00Z'),
    details: { reason: 'Invalid password', attempts: 3 },
    riskLevel: 'high',
    resolved: true
  }
];

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onProfileUpdate,
  onPasswordChange,
  onSecuritySettingsUpdate,
  onError,
  showBackButton = false,
  onBack
}) => {
  const { theme, isDark } = useTheme();
  
  // State management
  const [activeTab, setActiveTab] = React.useState<TabType>('profile');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  
  const [profileData, setProfileData] = React.useState<ProfileFormData>({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: '',
    bio: ''
  });
  
  const [passwordData, setPasswordData] = React.useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [notificationSettings, setNotificationSettings] = React.useState<NotificationSettings>(
    user.settings.notifications
  );
  
  const [privacySettings, setPrivacySettings] = React.useState<PrivacySettings>(
    user.settings.privacy
  );
  
  const [securitySettings, setSecuritySettings] = React.useState<SecuritySettings>({
    twoFactorEnabled: true,
    loginNotifications: true,
    deviceTracking: true,
    ipWhitelist: [],
    sessionTimeout: 30,
    passwordExpiry: 90
  });
  
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);
  const [activityLogs, setActivityLogs] = React.useState<SecurityEvent[]>(MOCK_ACTIVITY_LOGS);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Validation
  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!profileData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!profileData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!profileData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!passwordData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle profile save
  const handleProfileSave = async () => {
    if (!validateProfile()) return;
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      const updatedUser = {
        ...user,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email
      };
      
      onProfileUpdate?.(updatedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      onError?.('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!validatePassword()) return;
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      onPasswordChange?.(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordModal(false);
      Alert.alert('Success', 'Password changed successfully');
    } catch (error) {
      onError?.('Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle settings update
  const handleSettingsUpdate = async (type: 'notifications' | 'privacy' | 'security', settings: any) => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      
      if (type === 'security') {
        onSecuritySettingsUpdate?.(settings);
      } else {
        const updatedUser = {
          ...user,
          settings: {
            ...user.settings,
            [type]: settings
          }
        };
        onProfileUpdate?.(updatedUser);
      }
      
      Alert.alert('Success', `${type} settings updated`);
    } catch (error) {
      onError?.(`Failed to update ${type} settings`);
    } finally {
      setIsLoading(false);
    }
  };

  // Render tab navigation
  const renderTabNavigation = () => {
    const tabs = [
      { id: 'profile', title: 'Profile', icon: '👤' },
      { id: 'security', title: 'Security', icon: '🔒' },
      { id: 'privacy', title: 'Privacy', icon: '👁️' },
      { id: 'activity', title: 'Activity', icon: '📊' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabNavigation}
        contentContainerStyle={styles.tabNavigationContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                backgroundColor: activeTab === tab.id ? theme.primary : theme.surface,
                borderColor: theme.border
              }
            ]}
            onPress={() => setActiveTab(tab.id as TabType)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabTitle,
              {
                color: activeTab === tab.id ? theme.onPrimary : theme.text
              }
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render profile tab
  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: theme.surface }]}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.primary }]}>
          <Text style={[styles.avatarText, { color: theme.onPrimary }]}>
            {user.firstName.charAt(0).toUpperCase()}{user.lastName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={[styles.profileRole, { color: theme.textSecondary }]}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
            {user.email}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: theme.primary }]}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Text style={[styles.editButtonText, { color: theme.onPrimary }]}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Form */}
      <View style={styles.formSection}>
        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            First Name
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: errors.firstName ? theme.error : theme.border,
                color: theme.text
              }
            ]}
            value={profileData.firstName}
            onChangeText={firstName => setProfileData({ ...profileData, firstName })}
            placeholder="Enter first name"
            placeholderTextColor={theme.textSecondary}
            editable={isEditing}
          />
          {errors.firstName && (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {errors.firstName}
            </Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Last Name
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: errors.lastName ? theme.error : theme.border,
                color: theme.text
              }
            ]}
            value={profileData.lastName}
            onChangeText={lastName => setProfileData({ ...profileData, lastName })}
            placeholder="Enter last name"
            placeholderTextColor={theme.textSecondary}
            editable={isEditing}
          />
          {errors.lastName && (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {errors.lastName}
            </Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Email Address
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: errors.email ? theme.error : theme.border,
                color: theme.text
              }
            ]}
            value={profileData.email}
            onChangeText={email => setProfileData({ ...profileData, email })}
            placeholder="Enter email address"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={isEditing}
          />
          {errors.email && (
            <Text style={[styles.errorText, { color: theme.error }]}>
              {errors.email}
            </Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Phone Number
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text
              }
            ]}
            value={profileData.phone}
            onChangeText={phone => setProfileData({ ...profileData, phone })}
            placeholder="Enter phone number"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            editable={isEditing}
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            Bio
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.multilineInput,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                color: theme.text
              }
            ]}
            value={profileData.bio}
            onChangeText={bio => setProfileData({ ...profileData, bio })}
            placeholder="Tell us about yourself..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={isEditing}
          />
        </View>

        {isEditing && (
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={handleProfileSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: theme.onPrimary }]}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Account Actions */}
      <View style={[styles.actionSection, { backgroundColor: theme.surface }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowPasswordModal(true)}
        >
          <Text style={[styles.actionIcon]}>🔑</Text>
          <Text style={[styles.actionText, { color: theme.text }]}>
            Change Password
          </Text>
          <Text style={[styles.actionArrow, { color: theme.textSecondary }]}>
            →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render security tab
  const renderSecurityTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          🔐 Two-Factor Authentication
        </Text>
        <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
          Add an extra layer of security to your account
        </Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Enable 2FA
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              {securitySettings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <Switch
            value={securitySettings.twoFactorEnabled}
            onValueChange={value => {
              setSecuritySettings(prev => ({ ...prev, twoFactorEnabled: value }));
              handleSettingsUpdate('security', { ...securitySettings, twoFactorEnabled: value });
            }}
            trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📧 Login Notifications
        </Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Email Notifications
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              Get notified of new sign-ins
            </Text>
          </View>
          <Switch
            value={securitySettings.loginNotifications}
            onValueChange={value => {
              setSecuritySettings(prev => ({ ...prev, loginNotifications: value }));
              handleSettingsUpdate('security', { ...securitySettings, loginNotifications: value });
            }}
            trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          🕐 Session Management
        </Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Session Timeout
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              {securitySettings.sessionTimeout} minutes
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.settingButton, { borderColor: theme.border }]}
            onPress={() => {
              Alert.alert(
                'Session Timeout',
                'Choose session timeout duration',
                [
                  { text: '15 minutes', onPress: () => setSecuritySettings(prev => ({ ...prev, sessionTimeout: 15 })) },
                  { text: '30 minutes', onPress: () => setSecuritySettings(prev => ({ ...prev, sessionTimeout: 30 })) },
                  { text: '60 minutes', onPress: () => setSecuritySettings(prev => ({ ...prev, sessionTimeout: 60 })) },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
          >
            <Text style={[styles.settingButtonText, { color: theme.primary }]}>
              Change
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render privacy tab
  const renderPrivacyTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          🎭 Profile Visibility
        </Text>
        
        <View style={styles.settingColumn}>
          {['public', 'organization', 'private'].map((visibility) => (
            <TouchableOpacity
              key={visibility}
              style={[
                styles.radioRow,
                {
                  backgroundColor: privacySettings.profileVisibility === visibility 
                    ? theme.primaryLight + '20' 
                    : 'transparent'
                }
              ]}
              onPress={() => {
                const newSettings = { ...privacySettings, profileVisibility: visibility as any };
                setPrivacySettings(newSettings);
                handleSettingsUpdate('privacy', newSettings);
              }}
            >
              <View style={[
                styles.radioButton,
                {
                  borderColor: theme.primary,
                  backgroundColor: privacySettings.profileVisibility === visibility 
                    ? theme.primary 
                    : 'transparent'
                }
              ]}>
                {privacySettings.profileVisibility === visibility && (
                  <View style={[styles.radioInner, { backgroundColor: theme.onPrimary }]} />
                )}
              </View>
              <View style={styles.radioText}>
                <Text style={[styles.radioLabel, { color: theme.text }]}>
                  {visibility.charAt(0).toUpperCase() + visibility.slice(1)}
                </Text>
                <Text style={[styles.radioDescription, { color: theme.textSecondary }]}>
                  {visibility === 'public' && 'Anyone can see your profile'}
                  {visibility === 'organization' && 'Only members of your organization can see your profile'}
                  {visibility === 'private' && 'Only you can see your profile'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📞 Contact Information
        </Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Show Email
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              Display email in your profile
            </Text>
          </View>
          <Switch
            value={privacySettings.showEmail}
            onValueChange={value => {
              const newSettings = { ...privacySettings, showEmail: value };
              setPrivacySettings(newSettings);
              handleSettingsUpdate('privacy', newSettings);
            }}
            trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Show Phone
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              Display phone number in your profile
            </Text>
          </View>
          <Switch
            value={privacySettings.showPhone}
            onValueChange={value => {
              const newSettings = { ...privacySettings, showPhone: value };
              setPrivacySettings(newSettings);
              handleSettingsUpdate('privacy', newSettings);
            }}
            trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: theme.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          📊 Data & Analytics
        </Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>
              Data Collection
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
              Help improve our services with usage data
            </Text>
          </View>
          <Switch
            value={privacySettings.dataCollection}
            onValueChange={value => {
              const newSettings = { ...privacySettings, dataCollection: value };
              setPrivacySettings(newSettings);
              handleSettingsUpdate('privacy', newSettings);
            }}
            trackColor={{ false: theme.surfaceVariant, true: theme.primary }}
            thumbColor={theme.surface}
          />
        </View>
      </View>
    </View>
  );

  // Render activity tab
  const renderActivityTab = () => {
    const formatDate = (date: Date) => {
      return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getEventIcon = (type: string) => {
      switch (type) {
        case 'login_success': return '✅';
        case 'login_failure': return '❌';
        case 'password_change': return '🔑';
        case 'email_verification': return '📧';
        default: return '📝';
      }
    };

    const getEventTitle = (type: string) => {
      switch (type) {
        case 'login_success': return 'Successful Login';
        case 'login_failure': return 'Failed Login Attempt';
        case 'password_change': return 'Password Changed';
        case 'email_verification': return 'Email Verified';
        default: return 'Account Activity';
      }
    };

    const getRiskColor = (riskLevel: string) => {
      switch (riskLevel) {
        case 'low': return theme.success;
        case 'medium': return theme.warning;
        case 'high': return theme.error;
        default: return theme.textSecondary;
      }
    };

    return (
      <View style={styles.tabContent}>
        <View style={[styles.activityHeader, { backgroundColor: theme.surface }]}>
          <Text style={[styles.activityTitle, { color: theme.text }]}>
            Recent Activity
          </Text>
          <Text style={[styles.activitySubtitle, { color: theme.textSecondary }]}>
            Last 30 days of account activity
          </Text>
        </View>

        <FlatList
          data={activityLogs}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.activityItem, { backgroundColor: theme.surface }]}>
              <View style={styles.activityIcon}>
                <Text style={styles.activityEmoji}>{getEventIcon(item.type)}</Text>
              </View>
              
              <View style={styles.activityContent}>
                <View style={styles.activityHeader}>
                  <Text style={[styles.activityEventTitle, { color: theme.text }]}>
                    {getEventTitle(item.type)}
                  </Text>
                  <View style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskColor(item.riskLevel) + '20' }
                  ]}>
                    <Text style={[
                      styles.riskText,
                      { color: getRiskColor(item.riskLevel) }
                    ]}>
                      {item.riskLevel.toUpperCase()}
                    </Text>
                  </View>
                </View>
                
                <Text style={[styles.activityDate, { color: theme.textSecondary }]}>
                  {formatDate(item.timestamp)}
                </Text>
                
                <Text style={[styles.activityDetails, { color: theme.textSecondary }]}>
                  IP: {item.ipAddress}
                  {item.details.device && ` • ${item.details.device}`}
                  {item.details.location && ` • ${item.details.location}`}
                </Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.activitySeparator} />}
        />
      </View>
    );
  };

  // Render password change modal
  const renderPasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPasswordModal(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
            <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]}>
            Change Password
          </Text>
          <TouchableOpacity onPress={handlePasswordChange} disabled={isLoading}>
            <Text style={[styles.modalSave, { color: theme.primary }]}>
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Current Password
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: errors.currentPassword ? theme.error : theme.border,
                  color: theme.text
                }
              ]}
              value={passwordData.currentPassword}
              onChangeText={currentPassword => setPasswordData({ ...passwordData, currentPassword })}
              placeholder="Enter current password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
            />
            {errors.currentPassword && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.currentPassword}
              </Text>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              New Password
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: errors.newPassword ? theme.error : theme.border,
                  color: theme.text
                }
              ]}
              value={passwordData.newPassword}
              onChangeText={newPassword => setPasswordData({ ...passwordData, newPassword })}
              placeholder="Enter new password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
            />
            {errors.newPassword && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.newPassword}
              </Text>
            )}
          </View>

          {passwordData.newPassword && (
            <PasswordStrengthIndicator 
              password={passwordData.newPassword}
              userInfo={{
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
              }}
            />
          )}

          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Confirm New Password
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: errors.confirmPassword ? theme.error : theme.border,
                  color: theme.text
                }
              ]}
              value={passwordData.confirmPassword}
              onChangeText={confirmPassword => setPasswordData({ ...passwordData, confirmPassword })}
              placeholder="Confirm new password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
            />
            {errors.confirmPassword && (
              <Text style={[styles.errorText, { color: theme.error }]}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Main render function
  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab();
      case 'security':
        return renderSecurityTab();
      case 'privacy':
        return renderPrivacyTab();
      case 'activity':
        return renderActivityTab();
      default:
        return renderProfileTab();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={[styles.backButtonText, { color: theme.primary }]}>
              ← Back
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Account Settings
        </Text>
      </View>

      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>

      {/* Password Modal */}
      {renderPasswordModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabNavigation: {
    paddingVertical: 16,
  },
  tabNavigationContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 120,
  },
  tabIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formSection: {
    marginBottom: 24,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  multilineInput: {
    height: 100,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
  formActions: {
    marginTop: 24,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionSection: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  actionArrow: {
    fontSize: 16,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingColumn: {
    gap: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  settingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radioText: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 14,
  },
  activityHeader: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
  },
  activityIcon: {
    marginRight: 16,
    marginTop: 4,
  },
  activityEmoji: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityEventTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  activityDetails: {
    fontSize: 13,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  activitySeparator: {
    height: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
});

export default UserProfile;