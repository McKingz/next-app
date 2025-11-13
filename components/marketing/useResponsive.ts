import { useWindowDimensions } from 'react-native';

/**
 * Responsive breakpoints and utilities for marketing page
 * Mobile-first design with progressive enhancement
 */

export function useResponsive() {
  const { width } = useWindowDimensions();
  
  const isSM = width < 480;
  const isMD = width >= 480 && width < 768;
  const isLG = width >= 768 && width < 1024;
  const isXL = width >= 1024;
  
  // Grid columns based on viewport width
  const columns = isXL ? 3 : isLG ? 3 : isMD ? 2 : 1;
  
  // Horizontal padding
  const padX = isSM ? 16 : isMD ? 24 : 32;
  
  // Vertical section spacing
  const sectionSpacing = isSM ? 48 : isMD ? 56 : 72;
  
  return {
    width,
    isSM,
    isMD,
    isLG,
    isXL,
    columns,
    padX,
    sectionSpacing,
  };
}
