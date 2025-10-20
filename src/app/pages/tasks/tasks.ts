import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TasksService } from '../../services/tasks.service';
import { Task } from '../../models/project.model';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './tasks.html',
  styleUrl: './tasks.scss'
})
export class TasksComponent implements OnInit {
  private tasksService = inject(TasksService);
  
  protected readonly standaloneTasks = this.tasksService.standaloneTasks;
  protected readonly todaysTasks = this.tasksService.todaysTasks;
  protected readonly overdueTasks = this.tasksService.overdueTasks;
  protected readonly upcomingTasks = this.tasksService.upcomingTasks;
  
  // UI state
  showCreateTask = false;
  currentView: 'all' | 'today' | 'overdue' | 'upcoming' = 'all';
  
  // Form data
  newTask: Partial<Task> = {};
  
  // Filter and sort options
  filterPriority: string = 'all';
  filterCompleted: string = 'pending'; // all, pending, completed
  sortBy: 'title' | 'dueDate' | 'priority' | 'created' = 'dueDate';
  sortDirection: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    // Create sample data if no tasks exist
    if (this.standaloneTasks().length === 0) {
      this.tasksService.createSampleTasks();
    }
  }

  // Task management
  createTask(): void {
    if (!this.newTask.title?.trim()) return;
    
    this.tasksService.createTask({
      ...this.newTask,
      dueDate: this.newTask.dueDate ? new Date(this.newTask.dueDate) : undefined
    });
    
    this.resetCreateTaskForm();
  }

  toggleTask(taskId: string): void {
    this.tasksService.toggleTask(taskId);
  }

  deleteTask(taskId: string): void {
    if (confirm('Are you sure you want to delete this task?')) {
      this.tasksService.deleteTask(taskId);
    }
  }

  editTask(task: Task): void {
    // For now, just allow editing in place - could expand to modal later
    const newTitle = prompt('Edit task title:', task.title);
    if (newTitle && newTitle.trim() && newTitle !== task.title) {
      this.tasksService.updateTask(task.id, { title: newTitle.trim() });
    }
  }

  // View filtering
  getFilteredTasks(): Task[] {
    let tasks: Task[] = [];
    
    switch (this.currentView) {
      case 'today':
        tasks = this.todaysTasks();
        break;
      case 'overdue':
        tasks = this.overdueTasks();
        break;
      case 'upcoming':
        tasks = this.upcomingTasks();
        break;
      default:
        tasks = this.standaloneTasks();
    }
    
    // Apply additional filters
    if (this.filterPriority !== 'all') {
      tasks = tasks.filter(t => t.priority === this.filterPriority);
    }
    
    if (this.filterCompleted === 'completed') {
      tasks = tasks.filter(t => t.completed);
    } else if (this.filterCompleted === 'pending') {
      tasks = tasks.filter(t => !t.completed);
    }
    
    // Sort tasks
    tasks.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'dueDate':
          const dateA = a.dueDate?.getTime() || Number.MAX_VALUE;
          const dateB = b.dueDate?.getTime() || Number.MAX_VALUE;
          comparison = dateA - dateB;
          break;
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return tasks;
  }

  getTaskStats() {
    return this.tasksService.getTaskStats();
  }

  // Utility methods
  getPriorityColor(priority: string): string {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[priority as keyof typeof colors] || '#6b7280';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  isOverdue(date: Date | undefined): boolean {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isDueToday(date: Date | undefined): boolean {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  getDaysUntilDue(date: Date | undefined): number {
    if (!date) return 0;
    const diffTime = date.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getViewCounts() {
    return {
      all: this.standaloneTasks().length,
      today: this.todaysTasks().length,
      overdue: this.overdueTasks().length,
      upcoming: this.upcomingTasks().length
    };
  }

  // Form methods
  resetCreateTaskForm(): void {
    this.newTask = {};
    this.showCreateTask = false;
  }
}