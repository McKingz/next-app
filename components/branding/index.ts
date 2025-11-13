/**
 * EduDash Pro Branding Components
 * 
 * Official brand assets and components for consistent visual identity.
 * All assets follow the brand guidelines in assets/branding/README.md
 */

export { Logo, BrandColors } from './Logo';
export type { LogoVariant, LogoSize } from './Logo';

// Brand color constants for use throughout the app
export const BrandGradients = {
  primary: ['#33C3D4', '#1E6FBF', '#7B3FF2'],
  edu: ['#33C3D4', '#1E6FBF'],
  dash: ['#7B3FF2', '#9B5FF2'],
  bookmark: ['#FF4D8F', '#FF8C5F', '#FFD54D'],
} as const;

// Direct asset paths for cases where you need the raw images
export const BrandAssets = {
  icon: {
    '1024': require('@/assets/branding/png/icon-1024.png'),
    '512': require('@/assets/branding/png/icon-512.png'),
    '192': require('@/assets/branding/png/icon-192.png'),
  },
  horizontal: require('@/assets/branding/png/logo-horizontal-1024w.png'),
  full: require('@/assets/branding/png/logo-full-1024w.png'),
  monochrome: require('@/assets/branding/png/logo-monochrome-1024w.png'),
} as const;
