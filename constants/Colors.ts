/**
 * Color constants for EduDash Pro
 * 
 * Provides consistent color scheme across the application
 * Supports both light and dark themes
 */

const tintColorLight = '#2f95dc';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
    cardBackground: '#f8f9fa',
    border: '#e1e1e1',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    primary: '#007bff',
    secondary: '#6c757d',
    accent: '#6f42c1',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
    cardBackground: '#1a1a1a',
    border: '#333',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    primary: '#007bff',
    secondary: '#6c757d',
    accent: '#6f42c1',
  },
};

export default Colors;
