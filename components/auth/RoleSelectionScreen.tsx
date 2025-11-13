// 🔐 Role Selection Screen Component
// Intuitive role selection with hierarchy explanation
// Now with organization-aware terminology

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { EnhancedUserRole, RoleSelectionProps } from '../../types/auth-enhanced';
import { useOrganizationTerminology, useOrgType } from '@/lib/hooks/useOrganizationTerminology';

interface RoleOption {
  role: EnhancedUserRole;
  title: string;
  description: string;
  icon: string;
  color: string;
  requirements: string[];
  capabilities: string[];
  invitationRequired: boolean;
  level: number;
}

// Helper function to generate organization-aware role options
function generateRoleOptions(terminology: any, orgType: any): RoleOption[] {
  const { 
    isPreschool, 
    isK12, 
    isCorporate, 
    isSportsClub, 
    isUniversity 
  } = orgType;
  
  // Principal/Administrator role
  const principalRole: RoleOption = {
    role: 'principal',
    title: isCorporate 
      ? 'Organization Administrator'
      : isSportsClub
      ? 'Club Administrator'
      : isUniversity
      ? 'Department Head / Dean'
      : 'Principal / Administrator',
    description: isCorporate
      ? 'Manage your organization with complete administrative control'
      : isSportsClub
      ? 'Manage your sports club with complete administrative control'
      : `Manage your ${terminology.institution.toLowerCase()} with complete administrative control`,
    icon: isCorporate ? '👔' : isSportsClub ? '⚽' : '🏛️',
    color: '#8B5CF6',
    requirements: [
      `Must be an ${terminology.institution.toLowerCase()} administrator`,
      'Authorized to create organizational accounts',
      'Responsible for institutional compliance'
    ],
    capabilities: [
      'Create and manage the organization',
      `Invite and manage ${terminology.instructors.toLowerCase()}`,
      'View institutional analytics',
      'Configure organizational settings',
      'Export institutional data',
      'Manage billing and subscriptions'
    ],
    invitationRequired: false,
    level: 1
  };
  
  // Teacher/Instructor role
  const teacherRole: RoleOption = {
    role: 'teacher',
    title: terminology.getRoleLabel('teacher'),
    description: isCorporate
      ? `Train ${terminology.members.toLowerCase()} and manage department activities`
      : isSportsClub
      ? `Train ${terminology.members.toLowerCase()} and manage team activities`
      : `Educate ${terminology.members.toLowerCase()} and manage ${terminology.group.toLowerCase()} activities`,
    icon: isCorporate ? '👨‍💼' : isSportsClub ? '🏋️' : '👩‍🏫',
    color: '#10B981',
    requirements: [
      'Must be invited by an Administrator',
      isCorporate ? 'Professional training credentials (recommended)' : 'Professional credentials (recommended)',
      `Assigned to specific ${terminology.groups.toLowerCase()}`
    ],
    capabilities: [
      `Create and manage ${terminology.groups.toLowerCase()}`,
      isCorporate ? 'Create training programs and assessments' : 'Create assignments and assessments',
      isCorporate ? `Track ${terminology.member.toLowerCase()} progress` : `Grade ${terminology.member.toLowerCase()} work`,
      `Track ${terminology.member.toLowerCase()} progress`,
      `Invite ${terminology.guardians.toLowerCase()}`,
      `Communicate with ${terminology.guardians.toLowerCase()} and ${terminology.members.toLowerCase()}`
    ],
    invitationRequired: true,
    level: 2
  };
  
  // Parent/Guardian role
  const parentRole: RoleOption = {
    role: 'parent',
    title: terminology.getRoleLabel('parent'),
    description: isCorporate
      ? `Monitor ${terminology.member.toLowerCase()} progress and stay connected`
      : isSportsClub
      ? `Monitor your ${terminology.member.toLowerCase()}'s progress and stay connected`
      : `Monitor your child's educational progress and stay connected`,
    icon: '👨‍👩‍👧‍👦',
    color: '#F59E0B',
    requirements: [
      `Must be invited by your ${terminology.member.toLowerCase()}'s ${terminology.instructor.toLowerCase()}`,
      `Connected to one or more ${terminology.members.toLowerCase()}`,
      'Verified identity and relationship'
    ],
    capabilities: [
      isCorporate ? `View ${terminology.member.toLowerCase()} training progress` : `View ${terminology.member.toLowerCase()}'s assignments and grades`,
      isCorporate ? 'Track performance progress' : 'Track academic progress',
      `Communicate with ${terminology.instructors.toLowerCase()}`,
      'Receive notifications and updates',
      `Access ${terminology.institution.toLowerCase()} announcements`,
      isCorporate ? 'Schedule performance reviews' : 'Schedule conferences'
    ],
    invitationRequired: true,
    level: 3
  };
  
  // Student/Member role
  const studentRole: RoleOption = {
    role: 'student',
    title: terminology.getRoleLabel('student'),
    description: isCorporate
      ? 'Access your training programs and track your professional development'
      : isSportsClub
      ? 'Access your training programs, track performance, and develop your skills'
      : 'Access your coursework, assignments, and track your academic journey',
    icon: isCorporate ? '💼' : isSportsClub ? '🏃' : '🎓',
    color: '#3B82F6',
    requirements: [
      `Must be enrolled in participating ${terminology.institution.toLowerCase()} (recommended)`,
      'Age appropriate',
      `${terminology.guardian} approval may be required`
    ],
    capabilities: [
      isCorporate ? 'View and complete training modules' : 'View and submit assignments',
      isCorporate ? 'Access training materials' : 'Access course materials',
      'Track grades and progress',
      isCorporate ? 'Participate in training sessions' : isSportsClub ? 'Participate in training sessions' : 'Participate in online classes',
      `Communicate with ${terminology.instructors.toLowerCase()}`,
      isCorporate ? 'Access professional development resources' : 'Access educational resources'
    ],
    invitationRequired: false,
    level: 4
  };
  
  return [principalRole, teacherRole, parentRole, studentRole];
}

// Legacy hardcoded options removed - now generated dynamically

export const RoleSelectionScreen: React.FC<RoleSelectionProps> = ({
  onRoleSelect,
  allowedRoles,
  showHierarchy = true
}) => {
  const { theme } = useTheme();
  const { terminology } = useOrganizationTerminology();
  const orgType = useOrgType();
  const [selectedRole, setSelectedRole] = React.useState<EnhancedUserRole | null>(null);

  // Generate organization-aware role options
  const ROLE_OPTIONS = React.useMemo(
    () => generateRoleOptions(terminology, orgType),
    [terminology, orgType]
  );

  // Filter roles based on allowed roles
  const availableRoles = allowedRoles 
    ? ROLE_OPTIONS.filter(role => allowedRoles.includes(role.role))
    : ROLE_OPTIONS;

  const handleRoleSelection = (role: EnhancedUserRole) => {
    setSelectedRole(role);
    // Small delay for visual feedback before proceeding
    setTimeout(() => {
      onRoleSelect(role);
    }, 150);
  };

  const renderHierarchyExplanation = () => {
    if (!showHierarchy) return null;

    const hierarchyTitle = orgType.isCorporate
      ? 'Organizational Hierarchy'
      : orgType.isSportsClub
      ? 'Club Hierarchy'
      : 'Organizational Hierarchy';

    return (
      <View style={[
        styles.hierarchyContainer,
        { backgroundColor: theme.colors.surfaceVariant }
      ]}>
        <Text style={[
          styles.hierarchyTitle,
          { 
            color: theme.colors.onSurfaceVariant,
            fontSize: theme.typography.subtitle2.fontSize,
            fontWeight: theme.typography.subtitle2.fontWeight as any
          }
        ]}>
          {hierarchyTitle}
        </Text>
        
        <View style={styles.hierarchyFlow}>
          <HierarchyItem
            icon={ROLE_OPTIONS[0].icon}
            title={terminology.getRoleLabel('principal')}
            description="Creates organization"
            level={1}
            theme={theme}
          />
          <HierarchyArrow theme={theme} />
          <HierarchyItem
            icon={ROLE_OPTIONS[1].icon}
            title={terminology.getRoleLabelPlural('teacher')}
            description="Invited by Administrator"
            level={2}
            theme={theme}
          />
          <HierarchyArrow theme={theme} />
          <HierarchyItem
            icon={ROLE_OPTIONS[2].icon}
            title={terminology.getRoleLabelPlural('parent')}
            description={`Invited by ${terminology.getRoleLabelPlural('teacher')}`}
            level={3}
            theme={theme}
          />
          <HierarchyArrow theme={theme} />
          <HierarchyItem
            icon={ROLE_OPTIONS[3].icon}
            title={terminology.getRoleLabelPlural('student')}
            description="Self-register or invited"
            level={4}
            theme={theme}
          />
        </View>
      </View>
    );
  };

  const renderRoleCard = (roleOption: RoleOption) => {
    const isSelected = selectedRole === roleOption.role;
    
    return (
      <TouchableOpacity
        key={roleOption.role}
        style={[
          styles.roleCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isSelected ? roleOption.color : theme.colors.outline,
            borderWidth: isSelected ? 2 : 1
          }
        ]}
        onPress={() => handleRoleSelection(roleOption.role)}
        activeOpacity={0.8}
      >
        <View style={styles.roleCardHeader}>
          <View style={[
            styles.roleIcon,
            { backgroundColor: roleOption.color + '20' }
          ]}>
            <Text style={styles.roleIconText}>{roleOption.icon}</Text>
          </View>
          
          <View style={styles.roleHeaderText}>
            <Text style={[
              styles.roleTitle,
              { 
                color: theme.colors.onSurface,
                fontSize: theme.typography.subtitle1.fontSize,
                fontWeight: theme.typography.subtitle1.fontWeight as any
              }
            ]}>
              {roleOption.title}
            </Text>
            
            {roleOption.invitationRequired && (
              <View style={[
                styles.invitationBadge,
                { backgroundColor: theme.colors.primaryContainer }
              ]}>
                <Text style={[
                  styles.invitationText,
                  { 
                    color: theme.colors.onPrimaryContainer,
                    fontSize: theme.typography.caption.fontSize
                  }
                ]}>
                  Invitation Required
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[
          styles.roleDescription,
          { 
            color: theme.colors.onSurfaceVariant,
            fontSize: theme.typography.body2.fontSize
          }
        ]}>
          {roleOption.description}
        </Text>

        <View style={styles.roleDetails}>
          <View style={styles.detailSection}>
            <Text style={[
              styles.detailTitle,
              { 
                color: theme.colors.onSurface,
                fontSize: theme.typography.caption.fontSize,
                fontWeight: theme.typography.subtitle2.fontWeight as any
              }
            ]}>
              Requirements:
            </Text>
            {roleOption.requirements.map((requirement, index) => (
              <Text
                key={index}
                style={[
                  styles.detailItem,
                  { 
                    color: theme.colors.onSurfaceVariant,
                    fontSize: theme.typography.caption.fontSize
                  }
                ]}
              >
                • {requirement}
              </Text>
            ))}
          </View>

          <View style={styles.detailSection}>
            <Text style={[
              styles.detailTitle,
              { 
                color: theme.colors.onSurface,
                fontSize: theme.typography.caption.fontSize,
                fontWeight: theme.typography.subtitle2.fontWeight as any
              }
            ]}>
              What you can do:
            </Text>
            {roleOption.capabilities.slice(0, 3).map((capability, index) => (
              <Text
                key={index}
                style={[
                  styles.detailItem,
                  { 
                    color: theme.colors.onSurfaceVariant,
                    fontSize: theme.typography.caption.fontSize
                  }
                ]}
              >
                • {capability}
              </Text>
            ))}
            {roleOption.capabilities.length > 3 && (
              <Text style={[
                styles.detailItem,
                { 
                  color: theme.colors.primary,
                  fontSize: theme.typography.caption.fontSize,
                  fontStyle: 'italic'
                }
              ]}>
                + {roleOption.capabilities.length - 3} more capabilities
              </Text>
            )}
          </View>
        </View>

        {isSelected && (
          <View style={[
            styles.selectedIndicator,
            { backgroundColor: roleOption.color }
          ]}>
            <Text style={styles.selectedText}>Selected ✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[
            styles.title,
            { 
              color: theme.colors.onBackground,
              fontSize: theme.typography.headlineSmall.fontSize,
              fontWeight: theme.typography.headlineSmall.fontWeight as any
            }
          ]}>
            Choose Your Role
          </Text>
          
          <Text style={[
            styles.subtitle,
            { 
              color: theme.colors.onSurfaceVariant,
              fontSize: theme.typography.body1.fontSize
            }
          ]}>
            Select the role that best describes your position in the {terminology.institution.toLowerCase()}
          </Text>
        </View>

        {renderHierarchyExplanation()}

        <View style={styles.rolesContainer}>
          {availableRoles.map(renderRoleCard)}
        </View>

        <View style={styles.footer}>
          <Text style={[
            styles.footerText,
            { 
              color: theme.colors.onSurfaceVariant,
              fontSize: theme.typography.caption.fontSize
            }
          ]}>
            💡 Don't see your role? Contact your institution administrator for assistance.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

// Helper Components
interface HierarchyItemProps {
  icon: string;
  title: string;
  description: string;
  level: number;
  theme: any;
}

const HierarchyItem: React.FC<HierarchyItemProps> = ({
  icon,
  title,
  description,
  theme
}) => (
  <View style={styles.hierarchyItem}>
    <View style={[
      styles.hierarchyIcon,
      { backgroundColor: theme.colors.surface }
    ]}>
      <Text style={styles.hierarchyIconText}>{icon}</Text>
    </View>
    <Text style={[
      styles.hierarchyItemTitle,
      { 
        color: theme.colors.onSurfaceVariant,
        fontSize: theme.typography.caption.fontSize,
        fontWeight: '600'
      }
    ]}>
      {title}
    </Text>
    <Text style={[
      styles.hierarchyItemDescription,
      { 
        color: theme.colors.onSurfaceVariant,
        fontSize: theme.typography.caption.fontSize
      }
    ]}>
      {description}
    </Text>
  </View>
);

const HierarchyArrow: React.FC<{ theme: any }> = ({ theme }) => (
  <View style={styles.hierarchyArrow}>
    <Text style={[
      styles.arrowText,
      { color: theme.colors.onSurfaceVariant }
    ]}>
      ↓
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
  hierarchyContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  hierarchyTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  hierarchyFlow: {
    alignItems: 'center',
  },
  hierarchyItem: {
    alignItems: 'center',
    marginVertical: 4,
  },
  hierarchyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  hierarchyIconText: {
    fontSize: 20,
  },
  hierarchyItemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  hierarchyItemDescription: {
    textAlign: 'center',
  },
  hierarchyArrow: {
    paddingVertical: 4,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rolesContainer: {
    gap: 16,
  },
  roleCard: {
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleIconText: {
    fontSize: 28,
  },
  roleHeaderText: {
    flex: 1,
  },
  roleTitle: {
    marginBottom: 4,
  },
  invitationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  invitationText: {
    fontWeight: '500',
  },
  roleDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  roleDetails: {
    gap: 12,
  },
  detailSection: {
    gap: 4,
  },
  detailTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  detailItem: {
    lineHeight: 16,
    marginLeft: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  selectedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default RoleSelectionScreen;