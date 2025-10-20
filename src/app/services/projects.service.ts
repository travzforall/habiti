import { Injectable, signal, computed } from '@angular/core';
import { Project, Task, Milestone, Goal, ProjectStats } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private readonly STORAGE_KEY = 'habiti_projects';
  
  // Reactive signals for state management
  private _projects = signal<Project[]>([]);
  private _selectedProjectId = signal<string | null>(null);
  
  // Public computed properties
  public readonly projects = this._projects.asReadonly();
  public readonly selectedProject = computed(() => {
    const projectId = this._selectedProjectId();
    return projectId ? this._projects().find(p => p.id === projectId) || null : null;
  });
  
  public readonly activeProjects = computed(() => 
    this._projects().filter(p => p.status === 'active')
  );
  
  public readonly completedProjects = computed(() => 
    this._projects().filter(p => p.status === 'completed')
  );

  constructor() {
    this.loadProjects();
  }

  // Project CRUD operations
  createProject(projectData: Partial<Project>): Project {
    const project: Project = {
      id: this.generateId(),
      title: projectData.title || 'New Project',
      description: projectData.description || '',
      status: projectData.status || 'planning',
      priority: projectData.priority || 'medium',
      startDate: projectData.startDate,
      dueDate: projectData.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: projectData.owner,
      team: projectData.team || [],
      tasks: [],
      milestones: [],
      goals: [],
      tags: projectData.tags || [],
      color: projectData.color || '#3b82f6',
      icon: projectData.icon || '📋',
      progress: 0,
      budget: projectData.budget
    };

    this._projects.update(projects => [...projects, project]);
    this.saveProjects();
    return project;
  }

  updateProject(projectId: string, updates: Partial<Project>): void {
    this._projects.update(projects => 
      projects.map(project => 
        project.id === projectId 
          ? { ...project, ...updates, updatedAt: new Date() }
          : project
      )
    );
    this.saveProjects();
  }

  deleteProject(projectId: string): void {
    this._projects.update(projects => projects.filter(p => p.id !== projectId));
    if (this._selectedProjectId() === projectId) {
      this._selectedProjectId.set(null);
    }
    this.saveProjects();
  }

  selectProject(projectId: string): void {
    this._selectedProjectId.set(projectId);
  }

  // Task CRUD operations
  createTask(projectId: string, taskData: Partial<Task>): Task {
    const task: Task = {
      id: this.generateId(),
      projectId,
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

    this.updateProject(projectId, {
      tasks: [...(this.getProject(projectId)?.tasks || []), task]
    });
    
    this.updateProjectProgress(projectId);
    return task;
  }

  updateTask(projectId: string, taskId: string, updates: Partial<Task>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedTasks = project.tasks.map(task => {
      if (task.id === taskId) {
        const updatedTask = { ...task, ...updates };
        if (updates.completed !== undefined && updates.completed !== task.completed) {
          updatedTask.completedAt = updates.completed ? new Date() : undefined;
        }
        return updatedTask;
      }
      return task;
    });

    this.updateProject(projectId, { tasks: updatedTasks });
    this.updateProjectProgress(projectId);
  }

  deleteTask(projectId: string, taskId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedTasks = project.tasks.filter(task => task.id !== taskId);
    this.updateProject(projectId, { tasks: updatedTasks });
    this.updateProjectProgress(projectId);
  }

  toggleTask(projectId: string, taskId: string): void {
    const project = this.getProject(projectId);
    const task = project?.tasks.find(t => t.id === taskId);
    if (!task) return;

    this.updateTask(projectId, taskId, { 
      completed: !task.completed,
      completedAt: !task.completed ? new Date() : undefined
    });
  }

  // Milestone CRUD operations
  createMilestone(projectId: string, milestoneData: Partial<Milestone>): Milestone {
    const milestone: Milestone = {
      id: this.generateId(),
      projectId,
      title: milestoneData.title || 'New Milestone',
      description: milestoneData.description || '',
      targetDate: milestoneData.targetDate || new Date(),
      completed: false,
      tasks: milestoneData.tasks || [],
      progress: 0
    };

    const project = this.getProject(projectId);
    if (project) {
      this.updateProject(projectId, {
        milestones: [...project.milestones, milestone]
      });
    }
    
    return milestone;
  }

  updateMilestone(projectId: string, milestoneId: string, updates: Partial<Milestone>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedMilestones = project.milestones.map(milestone => {
      if (milestone.id === milestoneId) {
        const updatedMilestone = { ...milestone, ...updates };
        if (updates.completed !== undefined && updates.completed !== milestone.completed) {
          updatedMilestone.completedAt = updates.completed ? new Date() : undefined;
        }
        return updatedMilestone;
      }
      return milestone;
    });

    this.updateProject(projectId, { milestones: updatedMilestones });
  }

  deleteMilestone(projectId: string, milestoneId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedMilestones = project.milestones.filter(m => m.id !== milestoneId);
    this.updateProject(projectId, { milestones: updatedMilestones });
  }

  // Goal CRUD operations
  createGoal(projectId: string, goalData: Partial<Goal>): Goal {
    const goal: Goal = {
      id: this.generateId(),
      projectId,
      title: goalData.title || 'New Goal',
      description: goalData.description || '',
      targetValue: goalData.targetValue,
      currentValue: goalData.currentValue || 0,
      unit: goalData.unit || 'tasks',
      deadline: goalData.deadline,
      achieved: false,
      category: goalData.category || 'other'
    };

    const project = this.getProject(projectId);
    if (project) {
      this.updateProject(projectId, {
        goals: [...project.goals, goal]
      });
    }
    
    return goal;
  }

  updateGoal(projectId: string, goalId: string, updates: Partial<Goal>): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedGoals = project.goals.map(goal => {
      if (goal.id === goalId) {
        const updatedGoal = { ...goal, ...updates };
        if (updates.achieved !== undefined && updates.achieved !== goal.achieved) {
          updatedGoal.achievedAt = updates.achieved ? new Date() : undefined;
        }
        return updatedGoal;
      }
      return goal;
    });

    this.updateProject(projectId, { goals: updatedGoals });
  }

  deleteGoal(projectId: string, goalId: string): void {
    const project = this.getProject(projectId);
    if (!project) return;

    const updatedGoals = project.goals.filter(g => g.id !== goalId);
    this.updateProject(projectId, { goals: updatedGoals });
  }

  // Utility methods
  getProject(projectId: string): Project | undefined {
    return this._projects().find(p => p.id === projectId);
  }

  getProjectStats(projectId: string): ProjectStats | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    const now = new Date();
    const completedTasks = project.tasks.filter(t => t.completed).length;
    const overdueTasks = project.tasks.filter(t => 
      !t.completed && t.dueDate && t.dueDate < now
    ).length;
    const upcomingTasks = project.tasks.filter(t => 
      !t.completed && t.dueDate && t.dueDate > now && 
      t.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    ).length;

    const completedMilestones = project.milestones.filter(m => m.completed).length;
    const achievedGoals = project.goals.filter(g => g.achieved).length;

    // Calculate average completion time for completed tasks
    const completedTasksWithTime = project.tasks.filter(t => 
      t.completed && t.completedAt && t.actualHours
    );
    const averageTaskCompletionTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((sum, t) => sum + (t.actualHours || 0), 0) / completedTasksWithTime.length
      : 0;

    // Simple productivity score based on completion rate and meeting deadlines
    const onTimeCompletions = project.tasks.filter(t => 
      t.completed && t.dueDate && t.completedAt && t.completedAt <= t.dueDate
    ).length;
    const productivity = project.tasks.length > 0 
      ? Math.round(((completedTasks + onTimeCompletions) / (project.tasks.length * 2)) * 100)
      : 0;

    return {
      totalTasks: project.tasks.length,
      completedTasks,
      overdueTasks,
      upcomingTasks,
      totalMilestones: project.milestones.length,
      completedMilestones,
      totalGoals: project.goals.length,
      achievedGoals,
      averageTaskCompletionTime,
      productivity: Math.min(100, productivity)
    };
  }

  private updateProjectProgress(projectId: string): void {
    const project = this.getProject(projectId);
    if (!project || project.tasks.length === 0) return;

    const completedTasks = project.tasks.filter(t => t.completed).length;
    const progress = Math.round((completedTasks / project.tasks.length) * 100);
    
    this.updateProject(projectId, { progress });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadProjects(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const projects = JSON.parse(stored);
        // Convert date strings back to Date objects
        const processedProjects = projects.map((project: any) => ({
          ...project,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt),
          startDate: project.startDate ? new Date(project.startDate) : undefined,
          dueDate: project.dueDate ? new Date(project.dueDate) : undefined,
          completedAt: project.completedAt ? new Date(project.completedAt) : undefined,
          tasks: project.tasks.map((task: any) => ({
            ...task,
            createdAt: new Date(task.createdAt),
            dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
            completedAt: task.completedAt ? new Date(task.completedAt) : undefined
          })),
          milestones: project.milestones.map((milestone: any) => ({
            ...milestone,
            targetDate: new Date(milestone.targetDate),
            completedAt: milestone.completedAt ? new Date(milestone.completedAt) : undefined
          })),
          goals: project.goals.map((goal: any) => ({
            ...goal,
            deadline: goal.deadline ? new Date(goal.deadline) : undefined,
            achievedAt: goal.achievedAt ? new Date(goal.achievedAt) : undefined
          }))
        }));
        this._projects.set(processedProjects);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      this._projects.set([]);
    }
  }

  private saveProjects(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._projects()));
    } catch (error) {
      console.error('Error saving projects:', error);
    }
  }

  // Sample data for demonstration
  createSampleData(): void {
    const sampleProject = this.createProject({
      title: 'Habiti App Enhancement',
      description: 'Improve the habit tracking application with new features',
      status: 'active',
      priority: 'high',
      startDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      color: '#8b5cf6',
      icon: '🚀',
      tags: ['development', 'enhancement']
    });

    // Add sample tasks
    this.createTask(sampleProject.id, {
      title: 'Implement project planner',
      description: 'Create a comprehensive project planning system',
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      estimatedHours: 8
    });

    this.createTask(sampleProject.id, {
      title: 'Add task management',
      description: 'Create task creation, editing, and tracking functionality',
      priority: 'high',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      estimatedHours: 6
    });

    this.createTask(sampleProject.id, {
      title: 'Design milestone tracking',
      description: 'Implement milestone creation and progress tracking',
      priority: 'medium',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      estimatedHours: 4
    });

    // Add sample milestone
    this.createMilestone(sampleProject.id, {
      title: 'MVP Release',
      description: 'Complete minimum viable product version',
      targetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    });

    // Add sample goals
    this.createGoal(sampleProject.id, {
      title: 'Complete 80% of tasks on time',
      description: 'Achieve high productivity by meeting deadlines',
      targetValue: 80,
      currentValue: 0,
      unit: '%',
      category: 'productivity'
    });
  }
}