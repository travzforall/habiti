import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../services/projects.service';
import { Project, Task, Milestone, Goal } from '../../models/project.model';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss'
})
export class ProjectsComponent implements OnInit {
  private projectsService = inject(ProjectsService);
  private router = inject(Router);
  
  // Make Math available in template
  protected readonly Math = Math;
  
  protected readonly projects = this.projectsService.projects;
  protected readonly selectedProject = this.projectsService.selectedProject;
  protected readonly activeProjects = this.projectsService.activeProjects;
  
  // UI state
  showCreateProject = false;
  showCreateTask = false;
  showCreateMilestone = false;
  showCreateGoal = false;
  currentView: 'list' | 'board' | 'timeline' = 'list';
  
  // Form data
  newProject: Partial<Project> = {};
  newTask: Partial<Task> = {};
  newMilestone: Partial<Milestone> = {};
  newGoal: Partial<Goal> = {};
  
  // Filter and sort options
  filterStatus: string = 'all';
  filterPriority: string = 'all';
  sortBy: 'title' | 'dueDate' | 'priority' | 'progress' = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    // Create sample data if no projects exist
    if (this.projects().length === 0) {
      this.projectsService.createSampleData();
    }
  }

  // Project management
  createProject(): void {
    if (!this.newProject.title?.trim()) return;
    
    const project = this.projectsService.createProject({
      ...this.newProject,
      dueDate: this.newProject.dueDate ? new Date(this.newProject.dueDate) : undefined,
      startDate: this.newProject.startDate ? new Date(this.newProject.startDate) : undefined
    });
    
    this.resetCreateProjectForm();
    this.projectsService.selectProject(project.id);
  }

  selectProject(projectId: string): void {
    this.projectsService.selectProject(projectId);
  }

  deleteProject(projectId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      this.projectsService.deleteProject(projectId);
    }
  }

  duplicateProject(project: Project, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    const duplicatedProject = this.projectsService.createProject({
      ...project,
      title: `${project.title} (Copy)`,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined
    });
    
    // Copy tasks
    project.tasks.forEach(task => {
      this.projectsService.createTask(duplicatedProject.id, {
        ...task,
        id: undefined,
        projectId: duplicatedProject.id,
        completed: false,
        completedAt: undefined,
        createdAt: undefined
      });
    });
    
    // Copy milestones
    project.milestones.forEach(milestone => {
      this.projectsService.createMilestone(duplicatedProject.id, {
        ...milestone,
        id: undefined,
        projectId: duplicatedProject.id,
        completed: false,
        completedAt: undefined
      });
    });
    
    // Copy goals
    project.goals.forEach(goal => {
      this.projectsService.createGoal(duplicatedProject.id, {
        ...goal,
        id: undefined,
        projectId: duplicatedProject.id,
        achieved: false,
        achievedAt: undefined,
        currentValue: 0
      });
    });
  }

  // Task management
  createTask(): void {
    const project = this.selectedProject();
    if (!project || !this.newTask.title?.trim()) return;
    
    this.projectsService.createTask(project.id, {
      ...this.newTask,
      dueDate: this.newTask.dueDate ? new Date(this.newTask.dueDate) : undefined
    });
    
    this.resetCreateTaskForm();
  }

  toggleTask(taskId: string): void {
    const project = this.selectedProject();
    if (!project) return;
    
    this.projectsService.toggleTask(project.id, taskId);
  }

  deleteTask(taskId: string): void {
    const project = this.selectedProject();
    if (!project) return;
    
    if (confirm('Are you sure you want to delete this task?')) {
      this.projectsService.deleteTask(project.id, taskId);
    }
  }

  // Milestone management
  createMilestone(): void {
    const project = this.selectedProject();
    if (!project || !this.newMilestone.title?.trim()) return;
    
    this.projectsService.createMilestone(project.id, {
      ...this.newMilestone,
      targetDate: this.newMilestone.targetDate ? new Date(this.newMilestone.targetDate) : new Date()
    });
    
    this.resetCreateMilestoneForm();
  }

  toggleMilestone(milestoneId: string): void {
    const project = this.selectedProject();
    const milestone = project?.milestones.find(m => m.id === milestoneId);
    if (!project || !milestone) return;
    
    this.projectsService.updateMilestone(project.id, milestoneId, {
      completed: !milestone.completed
    });
  }

  deleteMilestone(milestoneId: string): void {
    const project = this.selectedProject();
    if (!project) return;
    
    if (confirm('Are you sure you want to delete this milestone?')) {
      this.projectsService.deleteMilestone(project.id, milestoneId);
    }
  }

  // Goal management
  createGoal(): void {
    const project = this.selectedProject();
    if (!project || !this.newGoal.title?.trim()) return;
    
    this.projectsService.createGoal(project.id, {
      ...this.newGoal,
      deadline: this.newGoal.deadline ? new Date(this.newGoal.deadline) : undefined
    });
    
    this.resetCreateGoalForm();
  }

  toggleGoal(goalId: string): void {
    const project = this.selectedProject();
    const goal = project?.goals.find(g => g.id === goalId);
    if (!project || !goal) return;
    
    this.projectsService.updateGoal(project.id, goalId, {
      achieved: !goal.achieved
    });
  }

  deleteGoal(goalId: string): void {
    const project = this.selectedProject();
    if (!project) return;
    
    if (confirm('Are you sure you want to delete this goal?')) {
      this.projectsService.deleteGoal(project.id, goalId);
    }
  }

  // Utility methods
  getFilteredProjects(): Project[] {
    let filtered = this.projects();
    
    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }
    
    if (this.filterPriority !== 'all') {
      filtered = filtered.filter(p => p.priority === this.filterPriority);
    }
    
    // Sort projects
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'dueDate':
          const dateA = a.dueDate?.getTime() || 0;
          const dateB = b.dueDate?.getTime() || 0;
          comparison = dateA - dateB;
          break;
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }

  getProjectStats(project: Project) {
    return this.projectsService.getProjectStats(project.id);
  }

  getPriorityColor(priority: string): string {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      urgent: '#dc2626'
    };
    return colors[priority as keyof typeof colors] || '#6b7280';
  }

  getStatusColor(status: string): string {
    const colors = {
      planning: '#6b7280',
      active: '#3b82f6',
      'on-hold': '#f59e0b',
      completed: '#10b981',
      cancelled: '#ef4444'
    };
    return colors[status as keyof typeof colors] || '#6b7280';
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
    return date < new Date();
  }

  getDaysUntilDue(date: Date | undefined): number {
    if (!date) return 0;
    const diffTime = date.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Form reset methods
  resetCreateProjectForm(): void {
    this.newProject = {};
    this.showCreateProject = false;
  }

  resetCreateTaskForm(): void {
    this.newTask = {};
    this.showCreateTask = false;
  }

  resetCreateMilestoneForm(): void {
    this.newMilestone = {};
    this.showCreateMilestone = false;
  }

  resetCreateGoalForm(): void {
    this.newGoal = {};
    this.showCreateGoal = false;
  }

  // Helper methods for template
  getCompletedTasksCount(project: Project): number {
    return project.tasks.filter(task => task.completed).length;
  }

  getCompletedMilestonesCount(project: Project): number {
    return project.milestones.filter(milestone => milestone.completed).length;
  }

  getAchievedGoalsCount(project: Project): number {
    return project.goals.filter(goal => goal.achieved).length;
  }

  getGoalProgressPercentage(goal: Goal): number {
    if (!goal.targetValue || goal.targetValue === 0) return 0;
    return Math.min(100, ((goal.currentValue || 0) / goal.targetValue) * 100);
  }

  getAbsoluteDaysOverdue(project: Project): number {
    if (!project.dueDate) return 0;
    return Math.abs(this.getDaysUntilDue(project.dueDate));
  }

  // Navigation methods
  goBack(): void {
    this.projectsService.selectProject('');
  }
}