/**
 * DashAINavigationFacade
 * 
 * Facade for navigation and routing.
 * Delegates to DashAINavigator.
 */

import { DashAINavigator } from '../DashAINavigator';

export class DashAINavigationFacade {
  constructor(private navigator: DashAINavigator) {}

  /**
   * Navigate to a screen
   */
  public async navigateToScreen(
    route: string,
    params?: Record<string, any>
  ): Promise<{ success: boolean; screen?: string; error?: string }> {
    return this.navigator.navigateToScreen(route, params);
  }

  /**
   * Navigate using voice command
   */
  public async navigateByVoice(
    command: string
  ): Promise<{ success: boolean; screen?: string; error?: string }> {
    return this.navigator.navigateByVoice(command);
  }

  /**
   * Open lesson generator with parameters
   */
  public openLessonGenerator(params: Record<string, string>): void {
    this.navigator.openLessonGenerator(params);
  }

  /**
   * Open worksheet demo with parameters
   */
  public openWorksheetDemo(params: Record<string, string>): void {
    this.navigator.openWorksheetDemo(params);
  }
}
