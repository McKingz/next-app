/**
 * Unit tests for navigation logic in lib/navigation.ts
 * Tests the shouldShowBackButton function to ensure correct behavior
 * for dashboard routes vs regular screens.
 */

import { jest } from '@jest/globals';

// Mock expo-router
const mockRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: mockRouter,
}));

// Import the functions we're testing after mocking
import { shouldShowBackButton, navigateBack } from '../lib/navigation';

describe('Navigation Logic', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('shouldShowBackButton', () => {
    describe('with navigation history (canGoBack = true)', () => {
      beforeEach(() => {
        mockRouter.canGoBack.mockReturnValue(true);
      });

      it('should return false for dashboard routes', () => {
        const dashboardRoutes = [
          'parent-dashboard',
          'teacher-dashboard', 
          'principal-dashboard',
          'super-admin-dashboard',
          'screens/parent-dashboard',
          'screens/teacher-dashboard',
          'screens/principal-dashboard',
          'screens/super-admin-dashboard',
          'some-other-dashboard',
        ];

        dashboardRoutes.forEach(route => {
          expect(shouldShowBackButton(route, true)).toBe(false);
          expect(shouldShowBackButton(route, false)).toBe(false);
        });
      });

      it('should return false for root/landing routes', () => {
        const rootRoutes = [
          'index',
          'landing',
          '(tabs)',
          '',
          'home',
        ];

        rootRoutes.forEach(route => {
          expect(shouldShowBackButton(route, true)).toBe(false);
          expect(shouldShowBackButton(route, false)).toBe(false);
        });
      });

      it('should return true for regular screens', () => {
        const regularRoutes = [
          'parent-messages',
          'screens/parent-messages',
          'student-detail',
          'teachers-detail',
          'account',
          'settings',
          'some-random-screen',
        ];

        regularRoutes.forEach(route => {
          expect(shouldShowBackButton(route, true)).toBe(true);
          expect(shouldShowBackButton(route, false)).toBe(true);
        });
      });

      it('should be case insensitive for dashboard detection', () => {
        const caseVariants = [
          'Parent-Dashboard',
          'TEACHER-DASHBOARD',
          'screens/Principal-Dashboard',
          'SCREENS/SUPER-ADMIN-DASHBOARD',
        ];

        caseVariants.forEach(route => {
          expect(shouldShowBackButton(route, true)).toBe(false);
        });
      });
    });

    describe('without navigation history (canGoBack = false)', () => {
      beforeEach(() => {
        mockRouter.canGoBack.mockReturnValue(false);
      });

      it('should return false for all routes when cannot go back', () => {
        const routes = [
          'parent-dashboard',
          'parent-messages', 
          'student-detail',
          'index',
          'landing',
          'account',
        ];

        routes.forEach(route => {
          expect(shouldShowBackButton(route, true)).toBe(false);
          expect(shouldShowBackButton(route, false)).toBe(false);
        });
      });
    });

    describe('edge cases', () => {
      beforeEach(() => {
        mockRouter.canGoBack.mockReturnValue(true);
      });

      it('should handle null/undefined route names', () => {
        expect(shouldShowBackButton(null as any, true)).toBe(true);
        expect(shouldShowBackButton(undefined as any, true)).toBe(true);
        expect(shouldShowBackButton('', true)).toBe(false); // Empty string is a root route
      });

      it('should handle router.canGoBack being undefined', () => {
        mockRouter.canGoBack.mockReturnValue(undefined as any);
        expect(shouldShowBackButton('parent-messages', true)).toBe(false);
      });
    });
  });

  describe('navigateBack', () => {
    it('should call router.back() when canGoBack is true', () => {
      mockRouter.canGoBack.mockReturnValue(true);
      
      navigateBack();
      
      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('should use fallback route when canGoBack is false', () => {
      mockRouter.canGoBack.mockReturnValue(false);
      
      navigateBack('/custom-fallback');
      
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/custom-fallback');
    });

    it('should use default fallback (/) when canGoBack is false and no fallback provided', () => {
      mockRouter.canGoBack.mockReturnValue(false);
      
      navigateBack();
      
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });

    it('should handle navigation errors gracefully', () => {
      mockRouter.canGoBack.mockReturnValue(true);
      mockRouter.back.mockImplementation(() => {
        throw new Error('Navigation failed');
      });
      
      // Should not throw, and should fallback to replace
      expect(() => navigateBack()).not.toThrow();
      expect(mockRouter.replace).toHaveBeenCalledWith('/');
    });
  });
});