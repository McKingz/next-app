/**
 * Worksheet Service for Automated Generation
 * Used by Dash AI to create educational worksheets programmatically
 */

export interface WorksheetConfig {
  ageGroup: string;
  difficulty: string;
  [key: string]: any;
}

export interface MathWorksheetConfig extends WorksheetConfig {
  operation: 'addition' | 'subtraction' | 'multiplication' | 'division' | 'mixed';
  problemCount: number;
  includeHints: boolean;
}

export interface ReadingWorksheetConfig extends WorksheetConfig {
  topic: string;
  includeImages: boolean;
}

export interface ActivityWorksheetConfig extends WorksheetConfig {
  topic: string;
  activityType: 'creative' | 'cognitive' | 'physical' | 'social';
}

export class WorksheetService {
  
  /**
   * Generate a math worksheet
   */
  async generateMathWorksheet(config: MathWorksheetConfig): Promise<any> {
    console.log('[WorksheetService] Generating math worksheet:', config);
    
    const problems = [];
    const difficultyLevels = {
      'Easy': { min: 1, max: 10 },
      'Medium': { min: 5, max: 25 },
      'Hard': { min: 10, max: 50 }
    };
    
    const range = difficultyLevels[config.difficulty as keyof typeof difficultyLevels] || difficultyLevels.Medium;
    
    // Generate problems based on operation type
    for (let i = 0; i < config.problemCount; i++) {
      let problem;
      
      if (config.operation === 'mixed') {
        const operations = ['addition', 'subtraction', 'multiplication'];
        const randomOp = operations[Math.floor(Math.random() * operations.length)];
        problem = this.generateMathProblem(randomOp as any, range);
      } else {
        problem = this.generateMathProblem(config.operation, range);
      }
      
      problems.push(problem);
    }
    
    return {
      type: 'math',
      title: `Math Practice - ${config.operation.charAt(0).toUpperCase() + config.operation.slice(1)}`,
      ageGroup: config.ageGroup,
      difficulty: config.difficulty,
      problems,
      includeHints: config.includeHints,
      metadata: {
        generatedBy: 'DashAI',
        generatedAt: new Date().toISOString(),
        estimatedTime: `${Math.ceil(config.problemCount / 3)} minutes`
      }
    };
  }
  
  /**
   * Generate a reading worksheet
   */
  async generateReadingWorksheet(config: ReadingWorksheetConfig): Promise<any> {
    console.log('[WorksheetService] Generating reading worksheet:', config);
    
    const readingActivities = this.getReadingActivitiesByAge(config.ageGroup);
    const selectedActivities = readingActivities.slice(0, 3); // Select 3 activities
    
    return {
      type: 'reading',
      title: `Reading Activities - ${config.topic}`,
      ageGroup: config.ageGroup,
      difficulty: config.difficulty,
      topic: config.topic,
      activities: selectedActivities,
      includeImages: config.includeImages,
      metadata: {
        generatedBy: 'DashAI',
        generatedAt: new Date().toISOString(),
        estimatedTime: '15-20 minutes',
        skills: ['reading comprehension', 'vocabulary', 'phonics']
      }
    };
  }
  
  /**
   * Generate an activity worksheet
   */
  async generateActivityWorksheet(config: ActivityWorksheetConfig): Promise<any> {
    console.log('[WorksheetService] Generating activity worksheet:', config);
    
    const activities = this.getActivitiesByType(config.activityType, config.ageGroup);
    
    return {
      type: 'activity',
      title: `${config.activityType.charAt(0).toUpperCase() + config.activityType.slice(1)} Activities`,
      ageGroup: config.ageGroup,
      difficulty: config.difficulty,
      topic: config.topic,
      activityType: config.activityType,
      activities,
      metadata: {
        generatedBy: 'DashAI',
        generatedAt: new Date().toISOString(),
        estimatedTime: '20-30 minutes',
        skills: this.getSkillsByActivityType(config.activityType)
      }
    };
  }
  
  /**
   * Generate a single math problem
   */
  private generateMathProblem(operation: 'addition' | 'subtraction' | 'multiplication' | 'division', range: { min: number; max: number }) {
    const num1 = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    const num2 = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    
    let question: string;
    let answer: number;
    
    switch (operation) {
      case 'addition':
        question = `${num1} + ${num2} = ___`;
        answer = num1 + num2;
        break;
      case 'subtraction': {
        // Ensure positive result
        const larger = Math.max(num1, num2);
        const smaller = Math.min(num1, num2);
        question = `${larger} - ${smaller} = ___`;
        answer = larger - smaller;
        break;
      }
      case 'multiplication': {
        // Keep numbers smaller for multiplication
        const mult1 = Math.min(num1, 12);
        const mult2 = Math.min(num2, 12);
        question = `${mult1} × ${mult2} = ___`;
        answer = mult1 * mult2;
        break;
      }
      case 'division': {
        // Ensure clean division
        const divisor = Math.max(2, Math.min(num2, 12));
        const quotient = Math.max(1, Math.min(num1, 12));
        const dividend = divisor * quotient;
        question = `${dividend} ÷ ${divisor} = ___`;
        answer = quotient;
        break;
      }
      default:
        question = `${num1} + ${num2} = ___`;
        answer = num1 + num2;
    }
    
    return {
      question,
      answer,
      operation,
      difficulty: this.getProblemDifficulty(answer)
    };
  }
  
  /**
   * Get reading activities by age group
   */
  private getReadingActivitiesByAge(ageGroup: string) {
    const activities = {
      '3-4 years': [
        {
          title: 'Letter Recognition',
          description: 'Circle all the letters "A" in the picture',
          type: 'recognition',
          instructions: 'Look at each letter carefully and circle the ones that match.'
        },
        {
          title: 'Picture Words',
          description: 'Match the picture to the word',
          type: 'matching',
          instructions: 'Draw a line from each picture to its matching word.'
        },
        {
          title: 'Story Time',
          description: 'Listen to the story and answer simple questions',
          type: 'comprehension',
          instructions: 'After hearing the story, circle the correct answer.'
        }
      ],
      '4-5 years': [
        {
          title: 'Beginning Sounds',
          description: 'Circle the pictures that start with the same sound',
          type: 'phonics',
          instructions: 'Say each picture name and circle ones with matching starting sounds.'
        },
        {
          title: 'Sight Words',
          description: 'Find and color the sight words in the word search',
          type: 'word_recognition',
          instructions: 'Look for these common words: the, and, is, you.'
        },
        {
          title: 'Simple Sentences',
          description: 'Read the sentence and draw a picture',
          type: 'comprehension',
          instructions: 'Read each sentence carefully and draw what it describes.'
        }
      ],
      '5-6 years': [
        {
          title: 'Reading Comprehension',
          description: 'Read the short story and answer questions',
          type: 'comprehension',
          instructions: 'Read the story twice, then answer the questions below.'
        },
        {
          title: 'Rhyming Words',
          description: 'Match words that rhyme',
          type: 'phonics',
          instructions: 'Connect words that sound similar at the end.'
        },
        {
          title: 'Sentence Building',
          description: 'Put words in order to make a sentence',
          type: 'grammar',
          instructions: 'Arrange the word cards to create complete sentences.'
        }
      ]
    };
    
    return activities[ageGroup as keyof typeof activities] || activities['5-6 years'];
  }
  
  /**
   * Get activities by type and age group
   */
  private getActivitiesByType(activityType: string, ageGroup: string) {
    const baseActivities = {
      creative: [
        {
          title: 'Design Your Dream Playground',
          description: 'Draw and label your perfect playground',
          materials: ['Crayons', 'Paper', 'Stickers'],
          timeEstimate: '15 minutes'
        },
        {
          title: 'Create a Story Character',
          description: 'Invent a character and describe their adventure',
          materials: ['Paper', 'Pencils', 'Colored pencils'],
          timeEstimate: '20 minutes'
        },
        {
          title: 'Nature Art Collage',
          description: 'Make art using things you find outside',
          materials: ['Leaves', 'Flowers', 'Glue', 'Paper'],
          timeEstimate: '25 minutes'
        }
      ],
      cognitive: [
        {
          title: 'Pattern Detective',
          description: 'Find and continue the patterns',
          materials: ['Worksheet', 'Pencil', 'Colored pencils'],
          timeEstimate: '10 minutes'
        },
        {
          title: 'Memory Game',
          description: 'Look at pictures, then recall what you saw',
          materials: ['Picture cards', 'Timer'],
          timeEstimate: '15 minutes'
        },
        {
          title: 'Logic Puzzles',
          description: 'Solve age-appropriate brain teasers',
          materials: ['Puzzle worksheets', 'Pencil'],
          timeEstimate: '20 minutes'
        }
      ],
      physical: [
        {
          title: 'Animal Movement Game',
          description: 'Move like different animals',
          materials: ['Space to move', 'Animal cards'],
          timeEstimate: '15 minutes'
        },
        {
          title: 'Balance Challenge',
          description: 'Practice balancing skills with fun activities',
          materials: ['Balance beam', 'Bean bags', 'Cones'],
          timeEstimate: '20 minutes'
        },
        {
          title: 'Fine Motor Skills',
          description: 'Activities to strengthen hand muscles',
          materials: ['Playdough', 'Scissors', 'Tweezers', 'Beads'],
          timeEstimate: '25 minutes'
        }
      ],
      social: [
        {
          title: 'Friendship Circle',
          description: 'Share something special about a friend',
          materials: ['Circle time space', 'Talking stick'],
          timeEstimate: '15 minutes'
        },
        {
          title: 'Team Building Challenge',
          description: 'Work together to solve a problem',
          materials: ['Building blocks', 'Challenge cards'],
          timeEstimate: '20 minutes'
        },
        {
          title: 'Kindness Cards',
          description: 'Make cards to brighten someone\'s day',
          materials: ['Cardstock', 'Markers', 'Stickers'],
          timeEstimate: '25 minutes'
        }
      ]
    };
    
    return baseActivities[activityType as keyof typeof baseActivities] || baseActivities.creative;
  }
  
  /**
   * Get problem difficulty based on answer
   */
  private getProblemDifficulty(answer: number): string {
    if (answer <= 10) return 'Easy';
    if (answer <= 50) return 'Medium';
    return 'Hard';
  }
  
  /**
   * Get skills by activity type
   */
  private getSkillsByActivityType(activityType: string): string[] {
    const skillsMap = {
      creative: ['creativity', 'self-expression', 'fine motor skills', 'imagination'],
      cognitive: ['problem-solving', 'critical thinking', 'memory', 'pattern recognition'],
      physical: ['gross motor skills', 'coordination', 'balance', 'strength'],
      social: ['communication', 'cooperation', 'empathy', 'teamwork']
    };
    
    return skillsMap[activityType as keyof typeof skillsMap] || skillsMap.creative;
  }
}