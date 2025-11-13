/**
 * DashAITaskFacade
 * 
 * Facade for task and reminder management.
 * Delegates to DashTaskManager.
 */

import { DashTaskManager } from '../DashTaskManager';
import type { DashTask, DashReminder } from '../types';

export class DashAITaskFacade {
  constructor(private taskManager: DashTaskManager) {}

  /**
   * Create a task
   */
  public async createTask(
    title: string,
    description: string,
    type?: DashTask['type'],
    assignedTo?: string
  ): Promise<DashTask> {
    return this.taskManager.createTask(title, description, type, assignedTo);
  }

  /**
   * Get active tasks
   */
  public getActiveTasks(): DashTask[] {
    return this.taskManager.getActiveTasks();
  }

  /**
   * Create a reminder
   */
  public async createReminder(
    title: string,
    message: string,
    triggerAt: number,
    priority?: DashReminder['priority']
  ): Promise<DashReminder> {
    return this.taskManager.createReminder(title, message, triggerAt, priority);
  }

  /**
   * Get active reminders
   */
  public getActiveReminders(): DashReminder[] {
    return this.taskManager.getActiveReminders();
  }

  /**
   * Dispose task manager resources
   */
  public dispose(): void {
    this.taskManager.dispose();
  }
}
