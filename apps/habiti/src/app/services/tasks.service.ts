import { Injectable, computed, inject, signal } from '@angular/core';
import { Task } from '../models/project.model';
import { UserStorage } from '@habiti/storage';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';
import { SyncBus } from '@habiti/sync';
import { TaskRow, fromTask, toTask } from '../models/task-row.models';

@Injectable({
  providedIn: 'root'
})
export class TasksService {
  private readonly STORAGE_KEY = 'habiti_standalone_tasks';
  private storage = inject(UserStorage);
  private auth = inject(AuthService);
  private baserow = inject(BaserowService);
  private syncBus = inject(SyncBus);

  private get tableId(): number {
    return this.baserow.tables.userTasks;
  }

  private userId(): string | null {
    const id = this.auth.currentUserValue?.id;
    return id !== undefined && id !== null ? String(id) : null;
  }

  /**
   * Loads this account's tasks from Baserow.
   *
   * The local cache is the fallback, not the source: it keeps the list on
   * screen while the request is in flight and if it fails, so a flaky network
   * shows stale tasks rather than an empty page.
   */
  private loadFromServer(): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    this.baserow
      .listAllRows<TaskRow>(this.tableId, {
        filters: [{ field: 'user_id', op: 'equal', value: userId }]
      })
      .subscribe({
        next: rows => {
          this._standaloneTasks.set((rows ?? []).map(toTask));
          this.saveTasks();
        },
        error: err => console.warn('TasksService: could not load tasks.', err)
      });
  }

  /** Mirrors one task to Baserow. Failure never blocks the UI. */
  private persist(task: Task): void {
    const userId = this.userId();
    if (!userId || !this.tableId) return;

    const data = fromTask(task, userId);
    const rowId = Number(task.id);

    // A numeric id means the row already exists; a generated local id does not.
    const request = Number.isFinite(rowId)
      ? this.baserow.updateRow<TaskRow>(this.tableId, rowId, data)
      : this.baserow.createRow<TaskRow>(this.tableId, data);

    request.subscribe({
      next: row => {
        if (row && !Number.isFinite(rowId)) {
          // Adopt the server id so the next edit updates rather than duplicates.
          this._standaloneTasks.update(list =>
            list.map(t => (t.id === task.id ? { ...t, id: String(row.id) } : t))
          );
          this.saveTasks();
        }
        this.syncBus.touched('tasks');
      },
      error: err => console.warn('TasksService: task not persisted.', err)
    });
  }

  private remove(taskId: string): void {
    const rowId = Number(taskId);
    if (!this.tableId || !Number.isFinite(rowId)) return;
    this.baserow.deleteRow(this.tableId, rowId).subscribe({
      next: () => this.syncBus.touched('tasks'),
      error: err => console.warn('TasksService: task not deleted on the server.', err)
    });
  }
  
  // Reactive signals for state management
  private _standaloneTasks = signal<Task[]>([]);
  
  // Public computed properties
  public readonly standaloneTasks = this._standaloneTasks.asReadonly();
  
  public readonly todaysTasks = computed(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    
    return this._standaloneTasks().filter(task => {
      if (task.completed) return false; // Don't show completed tasks
      
      // Show tasks due today or overdue
      if (task.dueDate) {
        return task.dueDate.toDateString() <= todayStr;
      }
      
      // Show tasks without due date as today's tasks
      return true;
    });
  });
  
  public readonly overdueTasks = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    return this._standaloneTasks().filter(task => 
      !task.completed && task.dueDate && task.dueDate < today
    );
  });
  
  public readonly upcomingTasks = computed(() => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return this._standaloneTasks().filter(task => 
      !task.completed && task.dueDate && task.dueDate > today && task.dueDate <= nextWeek
    );
  });

  constructor() {
    this.loadTasks();
  }

  // Task CRUD operations
  createTask(taskData: Partial<Task>): Task {
    const task: Task = {
      id: this.generateId(),
      projectId: 'standalone', // Special projectId for standalone tasks
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      completed: false,
      priority: taskData.priority || 'medium',
      dueDate: taskData.dueDate,
      createdAt: new Date(),
      assignee: taskData.assignee,
      tags: taskData.tags || [],
      estimatedHours: taskData.estimatedHours,
      dependencies: taskData.dependencies || [],
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      comments: taskData.comments || []
    };

    this._standaloneTasks.update(tasks => [...tasks, task]);
    this.saveTasks();
    this.persist(task);
    return task;
  }

  updateTask(taskId: string, updates: Partial<Task>): void {
    this._standaloneTasks.update(tasks => 
      tasks.map(task => {
        if (task.id === taskId) {
          const updatedTask = { ...task, ...updates };
          if (updates.completed !== undefined && updates.completed !== task.completed) {
            updatedTask.completedAt = updates.completed ? new Date() : undefined;
          }
          return updatedTask;
        }
        return task;
      })
    );
    this.saveTasks();

    const updated = this._standaloneTasks().find(t => t.id === taskId);
    if (updated) this.persist(updated);
  }

  deleteTask(taskId: string): void {
    this._standaloneTasks.update(tasks => tasks.filter(task => task.id !== taskId));
    this.saveTasks();
    this.remove(taskId);
  }

  toggleTask(taskId: string): void {
    const task = this._standaloneTasks().find(t => t.id === taskId);
    if (!task) return;

    this.updateTask(taskId, { 
      completed: !task.completed,
      completedAt: !task.completed ? new Date() : undefined
    });
  }

  getTask(taskId: string): Task | undefined {
    return this._standaloneTasks().find(t => t.id === taskId);
  }

  // Filtering methods
  getTasksByPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): Task[] {
    return this._standaloneTasks().filter(task => task.priority === priority);
  }

  getTasksByTag(tag: string): Task[] {
    return this._standaloneTasks().filter(task => task.tags?.includes(tag));
  }

  getCompletedTasks(): Task[] {
    return this._standaloneTasks().filter(task => task.completed);
  }

  getPendingTasks(): Task[] {
    return this._standaloneTasks().filter(task => !task.completed);
  }

  // Stats methods
  getTaskStats() {
    const tasks = this._standaloneTasks();
    const completed = tasks.filter(t => t.completed).length;
    const overdue = this.overdueTasks().length;
    const upcoming = this.upcomingTasks().length;
    
    return {
      total: tasks.length,
      completed,
      pending: tasks.length - completed,
      overdue,
      upcoming,
      completionRate: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
    };
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /** Re-reads this account's tasks. Called when the signed-in user changes. */
  reload(): void {
    this._standaloneTasks.set([]);
    this.loadTasks();
    this.loadFromServer();
  }

  private loadTasks(): void {
    try {
      const stored = this.storage.readRaw(this.STORAGE_KEY);
      if (stored) {
        const tasks = JSON.parse(stored);
        // Convert date strings back to Date objects
        const processedTasks = tasks.map((task: any) => ({
          ...task,
          createdAt: new Date(task.createdAt),
          dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined
        }));
        this._standaloneTasks.set(processedTasks);
      }
    } catch (error) {
      console.error('Error loading standalone tasks:', error);
      this._standaloneTasks.set([]);
    }
  }

  private saveTasks(): void {
    try {
      this.storage.writeRaw(this.STORAGE_KEY, JSON.stringify(this._standaloneTasks()));
    } catch (error) {
      console.error('Error saving standalone tasks:', error);
    }
  }

  // Sample data for demonstration
  createSampleTasks(): void {
    const sampleTasks = [
      {
        title: 'Review team meeting notes',
        description: 'Go through the notes from yesterday\'s team standup',
        priority: 'medium' as const,
        dueDate: new Date(), // Due today
        tags: ['work', 'review']
      },
      {
        title: 'Update project documentation',
        description: 'Add the new API endpoints to the documentation',
        priority: 'high' as const,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        tags: ['documentation', 'api'],
        estimatedHours: 2
      },
      {
        title: 'Call insurance company',
        description: 'Follow up on the claim status',
        priority: 'urgent' as const,
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Overdue
        tags: ['personal', 'insurance']
      },
      {
        title: 'Grocery shopping',
        description: 'Buy ingredients for weekend cooking',
        priority: 'low' as const,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
        tags: ['personal', 'shopping']
      },
      {
        title: 'Prepare presentation slides',
        description: 'Create slides for the client presentation next week',
        priority: 'high' as const,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
        tags: ['work', 'presentation'],
        estimatedHours: 4
      }
    ];

    sampleTasks.forEach(taskData => this.createTask(taskData));
  }
}