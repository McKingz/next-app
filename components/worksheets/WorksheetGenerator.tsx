/**
 * Worksheet Generator Component
 * 
 * Comprehensive interface for generating educational PDF worksheets,
 * activities, and printable resources for children and teachers.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  EducationalPDFService,
  type WorksheetOptions,
  type MathWorksheetData,
  type ReadingWorksheetData,
  type ActivitySheetData,
  type WorksheetType 
} from '@/lib/services/EducationalPDFService';
import type { Assignment } from '@/lib/models/Assignment';

// ====================================================================
// TYPES
// ====================================================================

interface WorksheetGeneratorProps {
  assignment?: Assignment;
  mode?: 'standalone' | 'assignment-based';
  visible: boolean;
  onClose: () => void;
}

interface WorksheetTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: WorksheetType;
  color: string;
  ageGroups: string[];
}

// ====================================================================
// WORKSHEET TEMPLATES
// ====================================================================

const WORKSHEET_TEMPLATES: WorksheetTemplate[] = [
  {
    id: 'math-addition',
    title: 'Math Addition',
    description: 'Simple addition problems with visual aids',
    icon: '➕',
    type: 'math',
    color: '#FF6B6B',
    ageGroups: ['3-4', '4-5', '5-6', '6-7']
  },
  {
    id: 'math-subtraction',
    title: 'Math Subtraction',
    description: 'Subtraction practice with counting help',
    icon: '➖',
    type: 'math',
    color: '#4ECDC4',
    ageGroups: ['4-5', '5-6', '6-7', '7-8']
  },
  {
    id: 'math-multiplication',
    title: 'Math Multiplication',
    description: 'Times tables and multiplication practice',
    icon: '✖️',
    type: 'math',
    color: '#45B7D1',
    ageGroups: ['6-7', '7-8']
  },
  {
    id: 'reading-comprehension',
    title: 'Reading Comprehension',
    description: 'Stories with questions to test understanding',
    icon: '📖',
    type: 'reading',
    color: '#96CEB4',
    ageGroups: ['4-5', '5-6', '6-7', '7-8']
  },
  {
    id: 'reading-vocabulary',
    title: 'Vocabulary Builder',
    description: 'New words with definitions and examples',
    icon: '📚',
    type: 'reading',
    color: '#FECA57',
    ageGroups: ['5-6', '6-7', '7-8']
  },
  {
    id: 'activity-coloring',
    title: 'Coloring Activity',
    description: 'Fun coloring pages with educational themes',
    icon: '🎨',
    type: 'activity',
    color: '#FF9FF3',
    ageGroups: ['3-4', '4-5', '5-6']
  },
  {
    id: 'activity-tracing',
    title: 'Letter Tracing',
    description: 'Practice writing letters and numbers',
    icon: '✏️',
    type: 'activity',
    color: '#54A0FF',
    ageGroups: ['3-4', '4-5', '5-6']
  },
  {
    id: 'activity-matching',
    title: 'Matching Game',
    description: 'Match objects, sounds, and concepts',
    icon: '🔗',
    type: 'activity',
    color: '#5F27CD',
    ageGroups: ['3-4', '4-5', '5-6', '6-7']
  }
];

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function WorksheetGenerator({ 
  assignment, 
  mode = 'standalone', 
  visible, 
  onClose 
}: WorksheetGeneratorProps) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // State management
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<WorksheetTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [worksheetOptions, setWorksheetOptions] = useState<WorksheetOptions>({
    difficulty: 'medium',
    ageGroup: '5-6',
    colorMode: 'color',
    paperSize: 'A4',
    orientation: 'portrait',
    includeAnswerKey: false,
  });
  const [worksheetData, setWorksheetData] = useState<any>({});

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedTemplate(null);
      setWorksheetOptions({
        difficulty: 'medium',
        ageGroup: '5-6',
        colorMode: 'color',
        paperSize: 'A4',
        orientation: 'portrait',
        includeAnswerKey: false,
      });
      setWorksheetData({});
    }
  }, [visible]);

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleTemplateSelect = (template: WorksheetTemplate) => {
    setSelectedTemplate(template);
    setStep(2);
  };

  const handleGenerateWorksheet = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    try {
      switch (selectedTemplate.type) {
        case 'math':
          await generateMathWorksheet();
          break;
        case 'reading':
          await generateReadingWorksheet();
          break;
        case 'activity':
          await generateActivityWorksheet();
          break;
        case 'assignment':
          if (assignment) {
            await EducationalPDFService.generateWorksheetFromAssignment(assignment, worksheetOptions);
          }
          break;
      }

      Alert.alert(
        '🎉 Worksheet Generated!',
        'Your worksheet has been created and is ready to share or print.',
        [{ text: 'Great!', onPress: onClose }]
      );
    } catch (error) {
      console.error('Worksheet generation error:', error);
      Alert.alert(
        'Generation Failed',
        'Sorry, we couldn\'t create your worksheet. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMathWorksheet = async () => {
    const mathData: MathWorksheetData = {
      type: selectedTemplate!.id.includes('addition') ? 'addition' : 
            selectedTemplate!.id.includes('subtraction') ? 'subtraction' :
            selectedTemplate!.id.includes('multiplication') ? 'multiplication' : 'mixed',
      problemCount: worksheetData.problemCount || 10,
      numberRange: worksheetData.numberRange || { min: 1, max: 10 },
      showHints: worksheetData.showHints || false,
      includeImages: worksheetData.includeImages || false,
    };

    await EducationalPDFService.generateMathWorksheet(mathData, worksheetOptions);
  };

  const generateReadingWorksheet = async () => {
    const readingData: ReadingWorksheetData = {
      type: selectedTemplate!.id.includes('comprehension') ? 'comprehension' : 'vocabulary',
      content: worksheetData.content || 'Sample reading passage for comprehension practice.',
      questions: worksheetData.questions || [
        {
          question: 'What is the main idea of this passage?',
          type: 'short-answer' as const,
          correctAnswer: 'Sample answer'
        },
        {
          question: 'Choose the correct answer:',
          type: 'multiple-choice' as const,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'Option A'
        }
      ]
    };

    await EducationalPDFService.generateReadingWorksheet(readingData, worksheetOptions);
  };

  const generateActivityWorksheet = async () => {
    const activityData: ActivitySheetData = {
      type: selectedTemplate!.id.includes('coloring') ? 'coloring' :
            selectedTemplate!.id.includes('tracing') ? 'tracing' :
            selectedTemplate!.id.includes('matching') ? 'matching' : 'creative',
      theme: worksheetData.theme || 'Animals',
      instructions: worksheetData.instructions || 'Follow the instructions and have fun learning!',
      materials: worksheetData.materials || ['Crayons or colored pencils', 'Eraser']
    };

    await EducationalPDFService.generateActivitySheet(activityData, worksheetOptions);
  };

  // ====================================================================
  // RENDER METHODS
  // ====================================================================

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose a Worksheet Type</Text>
      <Text style={styles.stepDescription}>
        Select the type of worksheet you'd like to create for your students
      </Text>

      <ScrollView style={styles.templatesContainer} showsVerticalScrollIndicator={false}>
        {WORKSHEET_TEMPLATES.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={[styles.templateCard, { borderColor: template.color }]}
            onPress={() => handleTemplateSelect(template)}
          >
            <View style={styles.templateHeader}>
              <View style={[styles.templateIcon, { backgroundColor: template.color + '20' }]}>
                <Text style={styles.templateEmoji}>{template.icon}</Text>
              </View>
              <View style={styles.templateInfo}>
                <Text style={styles.templateTitle}>{template.title}</Text>
                <Text style={styles.templateDescription}>{template.description}</Text>
                <View style={styles.templateMeta}>
                  <Text style={styles.templateAges}>
                    Ages: {template.ageGroups.join(', ')}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {mode === 'assignment-based' && assignment && (
        <TouchableOpacity
          style={[styles.templateCard, styles.assignmentCard]}
          onPress={() => {
            setSelectedTemplate({
              id: 'assignment-worksheet',
              title: assignment.title,
              description: 'Generate worksheet from assignment',
              icon: '📝',
              type: 'assignment',
              color: theme.primary,
              ageGroups: ['5-6', '6-7', '7-8']
            });
            setStep(2);
          }}
        >
          <View style={styles.templateHeader}>
            <View style={[styles.templateIcon, { backgroundColor: theme.primary + '20' }]}>
              <Text style={styles.templateEmoji}>📝</Text>
            </View>
            <View style={styles.templateInfo}>
              <Text style={styles.templateTitle}>From Assignment: {assignment.title}</Text>
              <Text style={styles.templateDescription}>
                Create a printable worksheet based on this assignment
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep(1)}
      >
        <Ionicons name="chevron-back" size={20} color={theme.primary} />
        <Text style={styles.backButtonText}>Back to Templates</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Customize Your Worksheet</Text>
      <Text style={styles.stepDescription}>
        Personalize the worksheet settings for your students
      </Text>

      {/* Basic Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Student Name (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={worksheetOptions.studentName || ''}
            onChangeText={(text) => setWorksheetOptions(prev => ({ ...prev, studentName: text }))}
            placeholder="Leave blank for generic worksheet"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Worksheet Title (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={worksheetOptions.title || ''}
            onChangeText={(text) => setWorksheetOptions(prev => ({ ...prev, title: text }))}
            placeholder={selectedTemplate?.title || 'Auto-generated'}
            placeholderTextColor={theme.textSecondary}
          />
        </View>
      </View>

      {/* Age and Difficulty */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Age & Difficulty</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Age Group</Text>
          <View style={styles.buttonGroup}>
            {['3-4', '4-5', '5-6', '6-7', '7-8'].map((age) => (
              <TouchableOpacity
                key={age}
                style={[
                  styles.optionButton,
                  worksheetOptions.ageGroup === age && styles.optionButtonActive
                ]}
                onPress={() => setWorksheetOptions(prev => ({ ...prev, ageGroup: age as any }))}
              >
                <Text style={[
                  styles.optionButtonText,
                  worksheetOptions.ageGroup === age && styles.optionButtonTextActive
                ]}>
                  {age} years
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Difficulty Level</Text>
          <View style={styles.buttonGroup}>
            {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
              <TouchableOpacity
                key={difficulty}
                style={[
                  styles.optionButton,
                  worksheetOptions.difficulty === difficulty && styles.optionButtonActive
                ]}
                onPress={() => setWorksheetOptions(prev => ({ ...prev, difficulty }))}
              >
                <Text style={[
                  styles.optionButtonText,
                  worksheetOptions.difficulty === difficulty && styles.optionButtonTextActive
                ]}>
                  {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Content-Specific Options */}
      {renderContentSpecificOptions()}

      {/* Print Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Print Options</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Color Mode</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                worksheetOptions.colorMode === 'color' && styles.optionButtonActive
              ]}
              onPress={() => setWorksheetOptions(prev => ({ ...prev, colorMode: 'color' }))}
            >
              <Text style={[
                styles.optionButtonText,
                worksheetOptions.colorMode === 'color' && styles.optionButtonTextActive
              ]}>
                🌈 Color
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                worksheetOptions.colorMode === 'blackwhite' && styles.optionButtonActive
              ]}
              onPress={() => setWorksheetOptions(prev => ({ ...prev, colorMode: 'blackwhite' }))}
            >
              <Text style={[
                styles.optionButtonText,
                worksheetOptions.colorMode === 'blackwhite' && styles.optionButtonTextActive
              ]}>
                ⚫ Black & White
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Paper Size</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                worksheetOptions.paperSize === 'A4' && styles.optionButtonActive
              ]}
              onPress={() => setWorksheetOptions(prev => ({ ...prev, paperSize: 'A4' }))}
            >
              <Text style={[
                styles.optionButtonText,
                worksheetOptions.paperSize === 'A4' && styles.optionButtonTextActive
              ]}>
                A4
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                worksheetOptions.paperSize === 'Letter' && styles.optionButtonActive
              ]}
              onPress={() => setWorksheetOptions(prev => ({ ...prev, paperSize: 'Letter' }))}
            >
              <Text style={[
                styles.optionButtonText,
                worksheetOptions.paperSize === 'Letter' && styles.optionButtonTextActive
              ]}>
                Letter
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setWorksheetOptions(prev => ({ 
            ...prev, 
            includeAnswerKey: !prev.includeAnswerKey 
          }))}
        >
          <Ionicons 
            name={worksheetOptions.includeAnswerKey ? "checkbox" : "checkbox-outline"} 
            size={24} 
            color={theme.primary} 
          />
          <Text style={styles.checkboxText}>Include Answer Key for Teachers</Text>
        </TouchableOpacity>
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
        onPress={handleGenerateWorksheet}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <View style={styles.generatingContent}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.generateButtonText}>Creating PDF...</Text>
          </View>
        ) : (
          <>
            <Ionicons name="document" size={20} color="white" />
            <Text style={styles.generateButtonText}>Generate PDF Worksheet</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderContentSpecificOptions = () => {
    if (!selectedTemplate) return null;

    switch (selectedTemplate.type) {
      case 'math':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Math Options</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Problems</Text>
              <View style={styles.buttonGroup}>
                {[5, 10, 15, 20].map((count) => (
                  <TouchableOpacity
                    key={count}
                    style={[
                      styles.optionButton,
                      worksheetData.problemCount === count && styles.optionButtonActive
                    ]}
                    onPress={() => setWorksheetData((prev: any) => ({ ...prev, problemCount: count }))}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      worksheetData.problemCount === count && styles.optionButtonTextActive
                    ]}>
                      {count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setWorksheetData((prev: any) => ({
                ...prev, 
                showHints: !prev.showHints 
              }))}
            >
              <Ionicons 
                name={worksheetData.showHints ? "checkbox" : "checkbox-outline"} 
                size={24} 
                color={theme.primary} 
              />
              <Text style={styles.checkboxText}>Include Hints for Struggling Students</Text>
            </TouchableOpacity>
          </View>
        );

      case 'activity':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Options</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Activity Theme</Text>
              <TextInput
                style={styles.textInput}
                value={worksheetData.theme || ''}
                onChangeText={(text) => setWorksheetData((prev: any) => ({ ...prev, theme: text }))}
                placeholder="e.g., Animals, Colors, Shapes"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Instructions</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={worksheetData.instructions || ''}
                onChangeText={(text) => setWorksheetData((prev: any) => ({ ...prev, instructions: text }))}
                placeholder="What should the child do with this activity?"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  // ====================================================================
  // MAIN RENDER
  // ====================================================================

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === 1 ? 'Worksheet Generator' : 'Customize Worksheet'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>
      </View>
    </Modal>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.cardBackground,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  templatesContainer: {
    flex: 1,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.border,
  },
  assignmentCard: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  templateHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  templateEmoji: {
    fontSize: 24,
  },
  templateInfo: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateAges: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: theme.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: theme.primary,
    fontSize: 16,
    marginLeft: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.border,
  },
  optionButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: theme.text,
  },
  optionButtonTextActive: {
    color: 'white',
    fontWeight: '500',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxText: {
    fontSize: 16,
    color: theme.text,
    marginLeft: 12,
    flex: 1,
  },
  generateButton: {
    backgroundColor: theme.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  generatingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});