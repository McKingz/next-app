/**
 * Progress Report Helper Utilities
 * 
 * Extracted from progress-report-creator.tsx for better maintainability
 */

// Get appropriate subjects based on organization type
export const getSubjectsForOrganization = (orgType?: string): Record<string, { grade: string; comments: string }> => {
  // Preschool/ECD subjects (ages 0-6)
  const preschoolSubjects = {
    'Numbers & Counting': { grade: '', comments: '' },
    'Language & Communication': { grade: '', comments: '' },
    'Creative Arts': { grade: '', comments: '' },
    'Physical Development': { grade: '', comments: '' },
  };

  // Primary school subjects (ages 6-13)
  const primarySubjects = {
    'Mathematics': { grade: '', comments: '' },
    'Home Language': { grade: '', comments: '' },
    'First Additional Language': { grade: '', comments: '' },
    'Life Skills': { grade: '', comments: '' },
  };

  // High school subjects (ages 13+)
  const highSchoolSubjects = {
    'Mathematics': { grade: '', comments: '' },
    'Physical Sciences': { grade: '', comments: '' },
    'Life Sciences': { grade: '', comments: '' },
    'English': { grade: '', comments: '' },
  };

  // Map organization types to subject sets
  switch (orgType?.toLowerCase()) {
    case 'preschool':
    case 'ecd':
    case 'daycare':
    case 'nursery':
      return preschoolSubjects;
    case 'k12_school':
    case 'primary':
    case 'primary_school':
    case 'elementary':
      return primarySubjects;
    case 'high':
    case 'high_school':
    case 'secondary':
    case 'university':
      return highSchoolSubjects;
    default:
      // Default to preschool if unknown
      return preschoolSubjects;
  }
};

// Age-appropriate suggestions for progress reports
export const getAgeSuggestions = (
  ageYears: number = 4,
  category: 'general' | 'school_readiness' = 'general'
): { strengths: string[]; improvements: string[]; recommendations?: string[] } => {
  if (category === 'school_readiness') {
    return {
      strengths: [
        'Shows enthusiasm for learning new things',
        'Participates actively in group activities',
        'Demonstrates good listening skills during story time',
        'Follows classroom routines independently',
        'Shows kindness and empathy towards peers',
      ],
      improvements: [
        'Continue practicing fine motor skills (cutting, writing)',
        'Work on sitting still during circle time',
        'Build confidence in sharing ideas with the class',
        'Practice counting and number recognition at home',
        'Encourage independence in self-care tasks',
      ],
      recommendations: [
        'Reading together daily will help build vocabulary and listening skills',
        'Practice writing letters and numbers in fun, engaging ways',
        'Encourage playdates to develop social skills',
        'Establish consistent routines at home to support school readiness',
        'Visit the local library to foster a love of learning',
      ],
    };
  }

  // Age-specific general suggestions
  if (ageYears <= 3) {
    return {
      strengths: [
        'Curious and eager to explore the environment',
        'Developing language skills rapidly',
        'Enjoys sensory play and hands-on activities',
        'Beginning to play alongside other children',
        'Shows affection and forms bonds with teachers',
      ],
      improvements: [
        'Continue working on sharing toys with peers',
        'Practice following simple two-step instructions',
        'Develop self-help skills like putting on shoes',
        'Build vocabulary through songs and stories',
        'Work on emotional regulation during transitions',
      ],
    };
  } else if (ageYears <= 4) {
    return {
      strengths: [
        'Demonstrates creativity in art and play',
        'Shows improved attention span during activities',
        'Developing friendships with classmates',
        'Expresses thoughts and feelings clearly',
        'Enjoys helping with classroom tasks',
      ],
      improvements: [
        'Continue practicing taking turns during games',
        'Work on recognizing and writing own name',
        'Build confidence in trying new activities',
        'Practice counting objects up to 10',
        'Develop patience when waiting for teacher attention',
      ],
    };
  } else {
    return {
      strengths: [
        'Shows school readiness skills',
        'Demonstrates independence in self-care',
        'Works well in group settings',
        'Shows interest in letters and numbers',
        'Follows multi-step instructions',
      ],
      improvements: [
        'Continue practicing letter formation and writing',
        'Build confidence in problem-solving',
        'Work on conflict resolution with peers',
        'Develop organizational skills',
        'Practice patience and perseverance',
      ],
    };
  }
};
