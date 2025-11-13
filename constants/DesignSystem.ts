export const DesignSystem = {
  colors: {
    background: '#0b1220',
    surface: '#111827',
    primary: '#00f5ff',
    secondary: '#ff0080',
    text: {
      primary: '#FFFFFF',
      secondary: '#9CA3AF',
      quantum: '#00f5ff',
    },
  },
  gradients: {
    professionalSubtle: ['#0f3460', '#533a71'],
    // Light neutral card background for better contrast on text
    surfaceCard: ['#F9FAFB', '#F3F4F6'],
  },
  borderRadius: {
    xl: 20,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  breakpoints: {
    lg: 1024,
  },
} as const;

// Export Colors as an alias to DesignSystem.colors for backward compatibility
export const Colors = DesignSystem.colors;

export function getRoleColors(role: string) {
  switch (role) {
    case 'parent':
      return { primary: '#00f5ff', secondary: '#0080ff' } as const;
    case 'teacher':
      return { primary: '#ff0080', secondary: '#ff8000' } as const;
    case 'principal':
      return { primary: '#8000ff', secondary: '#00f5ff' } as const;
    default:
      return { primary: '#00f5ff', secondary: '#ff0080' } as const;
  }
}

