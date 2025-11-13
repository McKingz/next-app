export const rolesContent = [
  { id: 'parent', title: 'Parents', subtitle: 'Stay in the loop', description: 'Track progress and communicate.', benefits: [] },
  { id: 'teacher', title: 'Teachers', subtitle: 'AI-powered teaching', description: 'Plan, grade, and analyze.', benefits: [] },
  { id: 'principal', title: 'Principals', subtitle: 'Manage your school', description: 'Oversight and analytics.', benefits: [] },
];

export const featuresContent = [
  {
    id: 'ai-lessons',
    title: 'AI Lesson Generator',
    subtitle: 'Curriculum-aligned in seconds',
    description: 'Generate adaptive lesson plans instantly.',
    tech: 'Anthropic via server proxy',
    color: ['#00f5ff', '#0080ff'] as const,
  },
  {
    id: 'auto-grading',
    title: 'Automated Grading',
    subtitle: 'Faster feedback',
    description: 'Grade homework with explainable results.',
    tech: 'Vision + LLM (server-side)',
    color: ['#ff0080', '#ff8000'] as const,
  },
  {
    id: 'analytics',
    title: 'Learning Analytics',
    subtitle: 'Spot trends early',
    description: 'Actionable insights for every student.',
    tech: 'Supabase + warehouse',
    color: ['#8000ff', '#00f5ff'] as const,
  },
];

export const testimonialsContent = [
  {
    name: 'Lerato M.',
    role: 'Teacher',
    org: 'Mamelodi Primary',
    rating: 5,
    message: 'EduDash Pro helped my class improve within weeks.',
    imageUri: null,
    isVideo: false,
  },
  {
    name: 'Thabo K.',
    role: 'Parent',
    org: 'Pretoria',
    rating: 5,
    message: 'I finally know how my child is doing every day.',
    imageUri: null,
    isVideo: false,
  },
  {
    name: 'Ms. Naidoo',
    role: 'Principal',
    org: 'Durban East',
    rating: 4,
    message: 'Analytics gave us clarity across grades.',
    imageUri: null,
    isVideo: false,
  },
];

