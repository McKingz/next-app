/**
 * DashTaskManager
 * 
 * Manages tasks, reminders, and automation workflows for Dash AI:
 * - Create and manage DashTask instances
 * - Schedule reminders with recurrence patterns
 * - Track task progress and completion
 * - Execute automated workflows
 * 
 * Design principles:
 * - Lightweight: focuses on task orchestration, not execution
 * - Persistent: saves tasks/reminders to storage
 * - Event-driven: notifies listeners of task state changes
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DashTask, DashReminder } from './types';

/**
 * Task manager configuration
 */
export interface TaskManagerConfig {
  /** Storage key for active tasks */
  tasksKey?: string;
  /** Storage key for active reminders */
  remindersKey?: string;
  /** User ID for task ownership */
  userId?: string;
}

/**
 * Task event listener
 */
export type TaskEventListener = (event: {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'reminder_triggered';
  taskId?: string;
  reminderId?: string;
  data?: any;
}) => void;

/**
 * DashTaskManager
 * Manages tasks, reminders, and automation
 */
export class DashTaskManager {
  private config: TaskManagerConfig;
  private activeTasks: Map<string, DashTask> = new Map();
  private activeReminders: Map<string, DashReminder> = new Map();
  private listeners: Set<TaskEventListener> = new Set();
  private checkTimer: NodeJS.Timeout | null = null;

  constructor(config: TaskManagerConfig = {}) {
    this.config = {
      tasksKey: config.tasksKey || 'dash_active_tasks',
      remindersKey: config.remindersKey || 'dash_active_reminders',
      userId: config.userId || 'anonymous',
    };
  }

  /**
   * Initialize and load tasks/reminders
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadTasks();
      await this.loadReminders();

      // Start periodic reminder check (every minute)
      this.checkTimer = setInterval(() => {
        this.checkReminders();
      }, 60000) as any;

      console.log(
        `[DashTask] Initialized with ${this.activeTasks.size} tasks, ${this.activeReminders.size} reminders`
      );
    } catch (error) {
      console.error('[DashTask] Initialization failed:', error);
    }
  }

  /**
   * Load tasks from storage
   */
  private async loadTasks(): Promise<void> {
    try {
      const tasksData = await AsyncStorage.getItem(this.config.tasksKey!);
      if (tasksData) {
        const tasksArray: DashTask[] = JSON.parse(tasksData);
        this.activeTasks = new Map(tasksArray.map((task) => [task.id, task]));
      }
    } catch (error) {
      console.error('[DashTask] Failed to load tasks:', error);
    }
  }

  /**
   * Load reminders from storage
   */
  private async loadReminders(): Promise<void> {
    try {
      const remindersData = await AsyncStorage.getItem(this.config.remindersKey!);
      if (remindersData) {
        const remindersArray: DashReminder[] = JSON.parse(remindersData);
        this.activeReminders = new Map(
          remindersArray.map((reminder) => [reminder.id, reminder])
        );
      }
    } catch (error) {
      console.error('[DashTask] Failed to load reminders:', error);
    }
  }

  /**
   * Save tasks to storage
   */
  private async saveTasks(): Promise<void> {
    try {
      const tasksArray = Array.from(this.activeTasks.values());
      await AsyncStorage.setItem(this.config.tasksKey!, JSON.stringify(tasksArray));
    } catch (error) {
      console.error('[DashTask] Failed to save tasks:', error);
    }
  }

  /**
   * Save reminders to storage
   */
  private async saveReminders(): Promise<void> {
    try {
      const remindersArray = Array.from(this.activeReminders.values());
      await AsyncStorage.setItem(
        this.config.remindersKey!,
        JSON.stringify(remindersArray)
      );
    } catch (error) {
      console.error('[DashTask] Failed to save reminders:', error);
    }
  }

  /**
   * Create a new task
   */
  public async createTask(
    title: string,
    description: string,
    type: DashTask['type'] = 'one_time',
    assignedTo: string = 'user'
  ): Promise<DashTask> {
    const task: DashTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      type,
      status: 'pending',
      priority: 'medium',
      assignedTo,
      createdBy: 'dash',
      createdAt: Date.now(),
      steps: [],
      context: {
        conversationId: '',
        userRole: this.config.userId || 'user',
        relatedEntities: [],
      },
      progress: {
        currentStep: 0,
        completedSteps: [],
      },
    };

    this.activeTasks.set(task.id, task);
    await this.saveTasks();

    this.notifyListeners({
      type: 'task_created',
      taskId: task.id,
      data: task,
    });

    console.log(`[DashTask] Created task: ${task.title}`);
    return task;
  }

  /**
   * Update task status
   */
  public async updateTaskStatus(
    taskId: string,
    status: DashTask['status']
  ): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = status;
      await this.saveTasks();

      const eventType =
        status === 'completed' ? 'task_completed' : 'task_updated';
      this.notifyListeners({
        type: eventType,
        taskId,
        data: task,
      });

      console.log(`[DashTask] Updated task ${taskId} status: ${status}`);
    }
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): DashTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  public getActiveTasks(): DashTask[] {
    return Array.from(this.activeTasks.values()).filter(
      (task) => task.status !== 'completed' && task.status !== 'failed'
    );
  }

  /**
   * Create a reminder
   */
  public async createReminder(
    title: string,
    message: string,
    triggerAt: number,
    priority: DashReminder['priority'] = 'medium'
  ): Promise<DashReminder> {
    const reminder: DashReminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      type: 'one_time',
      triggerAt,
      userId: this.config.userId || 'anonymous',
      priority,
      status: 'active',
    };

    this.activeReminders.set(reminder.id, reminder);
    await this.saveReminders();

    console.log(`[DashTask] Created reminder: ${reminder.title}`);
    return reminder;
  }

  /**
   * Check and trigger due reminders
   */
  private checkReminders(): void {
    const now = Date.now();

    for (const [id, reminder] of this.activeReminders.entries()) {
      if (reminder.status === 'active' && reminder.triggerAt <= now) {
        console.log(`[DashTask] Triggering reminder: ${reminder.title}`);

        // Update reminder status
        reminder.status = 'triggered';
        this.saveReminders();

        // Notify listeners
        this.notifyListeners({
          type: 'reminder_triggered',
          reminderId: id,
          data: reminder,
        });

        // Remove one-time reminders after triggering
        if (reminder.type === 'one_time') {
          this.activeReminders.delete(id);
          this.saveReminders();
        }
      }
    }
  }

  /**
   * Get active reminders
   */
  public getActiveReminders(): DashReminder[] {
    return Array.from(this.activeReminders.values()).filter(
      (reminder) => reminder.status === 'active'
    );
  }

  /**
   * Add event listener
   */
  public addEventListener(listener: TaskEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: TaskEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: Parameters<TaskEventListener>[0]): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[DashTask] Listener error:', error);
      }
    }
  }

  /**
   * Dispose and clean up resources
   */
  public dispose(): void {
    console.log('[DashTask] Disposing DashTaskManager...');

    // Stop reminder check timer
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    // Clear listeners
    this.listeners.clear();

    console.log('[DashTask] Disposal complete');
  }
}

export default DashTaskManager;
