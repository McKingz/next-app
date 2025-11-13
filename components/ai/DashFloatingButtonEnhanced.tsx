/**
 * Enhanced Dash AI Assistant Floating Action Button
 * 
 * A smart floating action button with agentic capabilities that provides:
 * - Role-based contextual suggestions
 * - Proactive task recommendations
 * - Quick action shortcuts
 * - Intelligent notifications
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { DashAIAssistant } from '@/services/dash-ai/DashAICompat';
import * as Haptics from 'expo-haptics';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  action: () => void;
  priority: 'high' | 'medium' | 'low';
  contextual: boolean;
}

interface ProactiveSuggestion {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'reminder' | 'insight' | 'automation';
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  action: () => void;
  dismissible: boolean;
}

interface DashFloatingButtonEnhancedProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onPress?: () => void;
  showWelcomeMessage?: boolean;
  showQuickActions?: boolean;
  enableProactiveSuggestions?: boolean;
  style?: any;
}

export const DashFloatingButtonEnhanced: React.FC<DashFloatingButtonEnhancedProps> = ({
  position = 'bottom-right',
  onPress,
  showWelcomeMessage = true,
  showQuickActions = true,
  enableProactiveSuggestions = true,
  style
}) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [showTooltip, setShowTooltip] = useState(false);
  const [showQuickActionsModal, setShowQuickActionsModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [activeReminders, setActiveReminders] = useState<any[]>([]);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [hasNewInsights, setHasNewInsights] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Animations
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const rotationAnimation = useRef(new Animated.Value(0)).current;
  const tooltipAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeDashContext();
    
    // Start proactive monitoring
    const interval = setInterval(() => {
      if (enableProactiveSuggestions) {
        updateProactiveSuggestions();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [profile]);

  // Initialize Dash context and load data
  const initializeDashContext = async () => {
    try {
      const dashInstance = DashAIAssistant.getInstance();
      await dashInstance.initialize();
      
      // Load active tasks and reminders
      const tasks = await dashInstance.getActiveTasks();
      const reminders = await dashInstance.getActiveReminders();
      
      setActiveTasks(tasks);
      setActiveReminders(reminders);
      
      // Generate role-based quick actions
      generateQuickActions();
      
      // Check for initial suggestions
      if (enableProactiveSuggestions) {
        await updateProactiveSuggestions();
      }
    } catch (error) {
      console.error('[DashButton] Failed to initialize:', error);
    }
  };

  // Generate role-based quick actions
  const generateQuickActions = () => {
    const role = profile?.role;
    let actions: QuickAction[] = [];

    switch (role) {
      case 'teacher':
        actions = [
          {
            id: 'create_lesson',
            title: 'Create Lesson',
            subtitle: 'Plan a new lesson',
            icon: 'book-outline',
            color: '#10B981',
            action: () => {
              setShowQuickActionsModal(false);
              // Route to existing AI lesson generator (or Lessons Hub)
              router.push('/screens/ai-lesson-generator');
            },
            priority: 'high',
            contextual: true
          },
          {
            id: 'grade_assignments',
            title: 'Grade Work',
            subtitle: 'AI-assisted grading',
            icon: 'checkmark-done-outline',
            color: '#F59E0B',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/ai-homework-grader-live');
            },
            priority: 'high',
            contextual: true
          },
          {
            id: 'parent_communication',
            title: 'Contact Parents',
            subtitle: 'Send updates',
            icon: 'mail-outline',
            color: '#8B5CF6',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/parent-messages');
            },
            priority: 'medium',
            contextual: false
          },
          {
            id: 'student_progress',
            title: 'Track Progress',
            subtitle: 'View student data',
            icon: 'analytics-outline',
            color: '#3B82F6',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/ai-progress-analysis');
            },
            priority: 'medium',
            contextual: false
          }
        ];
        break;

      case 'principal':
        actions = [
          {
            id: 'school_overview',
            title: 'School Overview',
            subtitle: 'Daily dashboard',
            icon: 'school-outline',
            color: '#059669',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/principal-dashboard');
            },
            priority: 'high',
            contextual: true
          },
          {
            id: 'staff_management',
            title: 'Staff Management',
            subtitle: 'Manage teachers',
            icon: 'people-outline',
            color: '#DC2626',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/staff-management');
            },
            priority: 'high',
            contextual: false
          },
          {
            id: 'financial_reports',
            title: 'Financial Reports',
            subtitle: 'View finances',
            icon: 'bar-chart-outline',
            color: '#7C3AED',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/financial-dashboard');
            },
            priority: 'medium',
            contextual: false
          },
          {
            id: 'enrollment',
            title: 'Student Enrollment',
            subtitle: 'Enroll new students',
            icon: 'person-add-outline',
            color: '#F59E0B',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/student-enrollment');
            },
            priority: 'medium',
            contextual: false
          }
        ];
        break;

      case 'parent':
        actions = [
          {
            id: 'homework_help',
            title: 'Homework Help',
            subtitle: 'Get AI assistance',
            icon: 'help-circle-outline',
            color: '#10B981',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/ai-homework-helper');
            },
            priority: 'high',
            contextual: true
          },
          {
            id: 'child_progress',
            title: 'Child Progress',
            subtitle: 'View reports',
            icon: 'trending-up-outline',
            color: '#3B82F6',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/child-progress');
            },
            priority: 'high',
            contextual: true
          },
          {
            id: 'school_communication',
            title: 'School Messages',
            subtitle: 'View announcements',
            icon: 'chatbubbles-outline',
            color: '#8B5CF6',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/parent-communication');
            },
            priority: 'medium',
            contextual: false
          },
          {
            id: 'calendar',
            title: 'School Calendar',
            subtitle: 'View events',
            icon: 'calendar-outline',
            color: '#F59E0B',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/screens/school-calendar');
            },
            priority: 'low',
            contextual: false
          }
        ];
        break;

      default:
        actions = [
          {
            id: 'dashboard',
            title: 'Dashboard',
            subtitle: 'Go to main screen',
            icon: 'grid-outline',
            color: '#6B7280',
            action: () => {
              setShowQuickActionsModal(false);
              router.push('/');
            },
            priority: 'high',
            contextual: false
          }
        ];
    }

    setQuickActions(actions);
  };

  // Update proactive suggestions
  const updateProactiveSuggestions = async () => {
    try {
      const suggestions: ProactiveSuggestion[] = [];
      const currentHour = new Date().getHours();
      const role = profile?.role;

      // Time-based suggestions
      if (role === 'teacher' && currentHour >= 8 && currentHour <= 16) {
        if (activeTasks.length === 0) {
          suggestions.push({
            id: 'morning_prep',
            title: 'Plan Your Day',
            description: 'Would you like me to help organize today\'s lessons and tasks?',
            type: 'task',
            urgency: 'medium',
            action: () => {
              setShowSuggestions(false);
              router.push('/screens/dash-assistant?initialMessage=Help me plan my teaching day');
            },
            dismissible: true
          });
        }
      }

      if (role === 'principal' && currentHour === 8) {
        suggestions.push({
          id: 'daily_briefing',
          title: 'Daily Briefing Available',
          description: 'Get your school\'s daily overview and key metrics',
          type: 'insight',
          urgency: 'high',
          action: () => {
            setShowSuggestions(false);
            router.push('/screens/dash-assistant?initialMessage=Show me today\'s school briefing');
          },
          dismissible: true
        });
      }

      if (role === 'parent' && (currentHour >= 18 && currentHour <= 20)) {
        suggestions.push({
          id: 'homework_check',
          title: 'Homework Time',
          description: 'Would you like help checking your child\'s homework?',
          type: 'task',
          urgency: 'medium',
          action: () => {
            setShowSuggestions(false);
            router.push('/screens/ai-homework-helper');
          },
          dismissible: true
        });
      }

      // Task-based suggestions
      if (activeTasks.length > 3) {
        suggestions.push({
          id: 'task_overflow',
          title: 'Busy Schedule Detected',
          description: `You have ${activeTasks.length} active tasks. Let me help prioritize them.`,
          type: 'automation',
          urgency: 'medium',
          action: () => {
            setShowSuggestions(false);
            router.push('/screens/dash-assistant?initialMessage=Help me prioritize my tasks');
          },
          dismissible: true
        });
      }

      // Reminder-based suggestions
      if (activeReminders.some(r => r.triggerAt <= Date.now() && r.status === 'active')) {
        suggestions.push({
          id: 'pending_reminders',
          title: 'Active Reminders',
          description: 'You have pending reminders that need attention',
          type: 'reminder',
          urgency: 'high',
          action: () => {
            setShowSuggestions(false);
            // Show reminders modal or navigate to task manager
          },
          dismissible: false
        });
      }

      setProactiveSuggestions(suggestions);
      setHasNewInsights(suggestions.length > 0);

      // Show pulse animation if there are urgent suggestions
      if (suggestions.some(s => s.urgency === 'urgent' || s.urgency === 'high')) {
        startPulseAnimation();
      }
    } catch (error) {
      console.error('[DashButton] Failed to update suggestions:', error);
    }
  };

  // Start pulse animation for attention
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (showTooltip) {
        hideTooltip();
      }

      if (onPress) {
        onPress();
      } else {
        // Show quick actions modal if available, otherwise open Dash
        if (showQuickActions && quickActions.length > 0) {
          setShowQuickActionsModal(true);
        } else {
          setShowCommandPalette(true);
        }
      }
    } catch (error) {
      console.error('Failed to handle button press:', error);
    }
  };

  const handleLongPress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      if (proactiveSuggestions.length > 0) {
        setShowSuggestions(true);
      } else {
        // Directly open Dash assistant
        router.push('/screens/dash-assistant');
      }
    } catch (error) {
      console.error('Failed to handle long press:', error);
    }
  };

  const hideTooltip = () => {
    Animated.timing(tooltipAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowTooltip(false));
  };

  const dismissSuggestion = (suggestionId: string) => {
    setProactiveSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    if (proactiveSuggestions.length <= 1) {
      setHasNewInsights(false);
    }
  };

  const getPositionStyle = () => {
    const margin = 20;
    const safeAreaBottom = Platform.OS === 'ios' ? 34 : 0;
    
    switch (position) {
      case 'bottom-right':
        return {
          position: 'absolute',
          bottom: margin + safeAreaBottom,
          right: margin,
        };
      case 'bottom-left':
        return {
          position: 'absolute',
          bottom: margin + safeAreaBottom,
          left: margin,
        };
      case 'top-right':
        return {
          position: 'absolute',
          top: margin + (Platform.OS === 'ios' ? 44 : 0),
          right: margin,
        };
      case 'top-left':
        return {
          position: 'absolute',
          top: margin + (Platform.OS === 'ios' ? 44 : 0),
          left: margin,
        };
      default:
        return {};
    }
  };

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <>
      {/* Main Floating Button */}
      <Animated.View
        style={[
          getPositionStyle(),
          {
            transform: [
              { scale: scaleAnimation },
              { scale: pulseAnimation }
            ],
          },
          style,
        ]}
      >
        <TouchableOpacity
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={[
            styles.floatingButton,
            { backgroundColor: theme.primary || '#3B82F6' },
            hasNewInsights && styles.hasInsights
          ]}
          activeOpacity={0.8}
        >
          <Ionicons 
            name="sparkles" 
            size={28} 
            color="white"
          />
          {hasNewInsights && (
            <View style={styles.insightsBadge}>
              <Text style={styles.insightsBadgeText}>{proactiveSuggestions.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Actions Modal */}
      <Modal
        visible={showQuickActionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickActionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Quick Actions
              </Text>
              <TouchableOpacity
                onPress={() => setShowQuickActionsModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.actionsContainer}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionItem, { borderBottomColor: theme.border }]}
                  onPress={action.action}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={[styles.actionTitle, { color: theme.text }]}>
                      {action.title}
                    </Text>
                    <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>
                      {action.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity
                style={[styles.actionItem, { borderBottomColor: theme.border }]}
                onPress={() => {
                  setShowQuickActionsModal(false);
                  router.push('/screens/dash-assistant');
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name="chatbubble-ellipses" size={24} color={theme.primary} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionTitle, { color: theme.text }]}>
                    Chat with Dash
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: theme.textSecondary }]}>
                    Ask anything or get help
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Command Palette */}
      <DashCommandPalette visible={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Proactive Suggestions Modal */}
      <Modal
        visible={showSuggestions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuggestions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.suggestionsModal, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Dash Suggestions
              </Text>
              <TouchableOpacity
                onPress={() => setShowSuggestions(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.suggestionsContainer}>
              {proactiveSuggestions.map((suggestion) => (
                <View
                  key={suggestion.id}
                  style={[
                    styles.suggestionItem, 
                    { 
                      backgroundColor: theme.cardBackground,
                      borderLeftColor: urgencyColor(suggestion.urgency)
                    }
                  ]}
                >
                  <View style={styles.suggestionHeader}>
                    <Text style={[styles.suggestionTitle, { color: theme.text }]}>
                      {suggestion.title}
                    </Text>
                    {suggestion.dismissible && (
                      <TouchableOpacity
                        onPress={() => dismissSuggestion(suggestion.id)}
                        style={styles.dismissButton}
                      >
                        <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.suggestionDescription, { color: theme.textSecondary }]}>
                    {suggestion.description}
                  </Text>
                  <TouchableOpacity
                    style={[styles.suggestionAction, { backgroundColor: theme.primary }]}
                    onPress={suggestion.action}
                  >
                    <Text style={styles.suggestionActionText}>
                      {suggestion.type === 'task' ? 'Start Task' :
                       suggestion.type === 'reminder' ? 'View Reminder' :
                       suggestion.type === 'insight' ? 'View Insight' : 'Automate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    position: 'relative',
  },
  hasInsights: {
    elevation: 12,
    shadowOpacity: 0.4,
  },
  insightsBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  insightsBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: screenHeight * 0.7,
  },
  suggestionsModal: {
    margin: 20,
    borderRadius: 20,
    maxHeight: screenHeight * 0.6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
  },
  suggestionsContainer: {
    padding: 20,
  },
  suggestionItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dismissButton: {
    padding: 4,
  },
  suggestionDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  suggestionAction: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  suggestionActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default DashFloatingButtonEnhanced;
