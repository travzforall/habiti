import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TaskUpdate {
  id?: number;
  task_id: string;
  task_title: string;
  category: string;
  agent: string;
  action: string; // 'approved', 'disapproved', 'note_added', 'completed', 'reset'
  notes?: string;
  priority: string;
  phase: string;
  timestamp: string;
  status: string; // 'pending', 'completed', 'approved'
}

@Injectable({
  providedIn: 'root'
})
export class BaserowService {
  private baseApiUrl = environment.baserow.apiUrl;
  private token = environment.baserow.token;
  public taskUpdatesTableId = environment.baserow.tables.taskUpdates;
  public tasksTableId = environment.baserow.tables.tasks;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Token ${this.token}`,
      'Content-Type': 'application/json'
    });
  }

  // Create a new task update entry
  createTaskUpdate(update: TaskUpdate): Observable<any> {
    if (!this.baseApiUrl || !this.token || !this.taskUpdatesTableId) {
      console.warn('Baserow configuration incomplete. Update will not be saved.');
      return new Observable(observer => {
        observer.next({ skipped: true });
        observer.complete();
      });
    }

    const url = `${this.baseApiUrl}/${this.taskUpdatesTableId}/?user_field_names=true`;
    
    return this.http.post(url, update, { headers: this.getHeaders() });
  }

  // Get all task updates, optionally filtered by task_id
  getTaskUpdates(taskId?: string): Observable<any> {
    if (!this.baseApiUrl || !this.token || !this.taskUpdatesTableId) {
      console.warn('Baserow configuration incomplete.');
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }

    let url = `${this.baseApiUrl}/${this.taskUpdatesTableId}/?user_field_names=true`;
    
    // Add filter if taskId is provided
    if (taskId) {
      url += `&filter__field_task_id__equal=${taskId}`;
    }
    
    // Sort by timestamp descending to get latest updates first
    url += '&order_by=-timestamp';
    
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get latest update for each task (summary view)
  getLatestTaskUpdates(): Observable<any> {
    if (!this.baseApiUrl || !this.token || !this.taskUpdatesTableId) {
      console.warn('Baserow configuration incomplete.');
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }

    const url = `${this.baseApiUrl}/${this.taskUpdatesTableId}/?user_field_names=true&order_by=-timestamp`;
    
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Create a comprehensive progress report entry
  createProgressReport(categories: any[], stats: any): Observable<any> {
    const report: TaskUpdate = {
      task_id: 'PROGRESS_REPORT',
      task_title: '📊 Overall Progress Report',
      category: 'System',
      agent: 'TaskManager',
      action: 'progress_report',
      notes: this.generateProgressSummary(categories, stats),
      priority: 'medium',
      phase: 'Ongoing',
      timestamp: new Date().toISOString(),
      status: 'completed'
    };

    return this.createTaskUpdate(report);
  }

  private generateProgressSummary(categories: any[], stats: any): string {
    let summary = `Progress Summary:\n`;
    summary += `Total Tasks: ${stats.totalTasks}, Completed: ${stats.completedTasks}, Approved: ${stats.approvedTasks}\n`;
    summary += `Progress: ${stats.progressPercentage}%\n\n`;
    
    summary += `Category Status:\n`;
    categories.forEach(cat => {
      const completed = cat.tasks.filter((t: any) => t.completed).length;
      const approved = cat.tasks.filter((t: any) => t.approved).length;
      summary += `- ${cat.name}: ${completed}/${cat.total} completed, ${approved} approved\n`;
    });

    // Find high priority pending tasks
    const pendingTasks = categories.flatMap(cat => cat.tasks)
      .filter(task => !task.completed)
      .filter(task => task.priority === 'high' || task.priority === 'critical')
      .slice(0, 3);

    if (pendingTasks.length > 0) {
      summary += `\nTop Priority Pending:\n`;
      pendingTasks.forEach(task => {
        summary += `- ${task.title} (${task.priority}, ${task.agent})\n`;
      });
    }

    return summary;
  }

  // Test connection to Baserow
  testConnection(): Observable<any> {
    if (!this.baseApiUrl || !this.token || !this.taskUpdatesTableId) {
      return new Observable(observer => {
        observer.error({ message: 'Configuration incomplete' });
      });
    }

    const url = `${this.baseApiUrl}/${this.taskUpdatesTableId}/?user_field_names=true&size=1`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Table IDs
  private tables = {
    tasks: 508,
    categories: 504,
    agents: 506,
    projects: 507,
    milestones: 511,
    comments: 510,
    sessions: 512,
    tasksUpdates: 509,
    // Habit tables
    habitCategories: 517,
    habitSubcategories: 518,
    habitGroups: 519,
    habits: 521,
    entries: 522,
    achievements: 520,
    userAchievements: 525,
    gameState: 524,
    nightlyPlans: 526,
    analyticsSummary: 527
  };

  // Option mappings for select fields
  private optionMappings = {
    priority: {
      low: 2050,
      medium: 2048,
      high: 2047,
      critical: 2049
    },
    status: {
      pending: 2051,
      approved: 2052,
      in_progress: 2053,
      completed: 2054,
      blocked: 2055
    },
    tags: {
      bug: 2056,
      feature: 2057,
      improvement: 2058,
      docs: 2059
    },
    specialization: {
      frontend: 2031,
      backend: 2032,
      design: 2033,
      ai: 2034,
      devops: 2035
    },
    agentStatus: {
      active: 2036,
      busy: 2037,
      offline: 2038
    },
    categoryStatus: {
      active: 2028,
      archived: 2029,
      planned: 2030
    },
    projectStatus: {
      planning: 2039,
      active: 2040,
      on_hold: 2041,
      completed: 2042
    },
    projectPriority: {
      low: 2046,
      medium: 2044,
      high: 2043,
      critical: 2045
    }
  };

  // Track created items for linking
  private createdItems = new Map<string, number>();

  // Batch upload to Baserow
  private batchUpload(tableId: number, items: any[]): Observable<any> {
    const url = `${this.baseApiUrl}/${tableId}/batch/?user_field_names=true`;
    const payload = { items };
    
    return this.http.post(url, payload, { headers: this.getHeaders() });
  }

  // Export all tasks with proper batch processing
  exportAllTasks(tasks: any[]): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      console.warn('Baserow configuration incomplete.');
      return new Observable(observer => {
        observer.error({ message: 'Baserow configuration incomplete' });
      });
    }

    return new Observable(observer => {
      // Step 1: Extract unique categories, agents, and projects
      const categories = new Set<string>();
      const agents = new Set<string>();
      const projects = new Set<string>(['Habiti']); // Default project

      tasks.forEach(task => {
        if (task.category) categories.add(task.category);
        if (task.agent) agents.add(task.agent);
      });

      // Step 2: Create categories first
      this.createCategories(Array.from(categories)).subscribe({
        next: (catResults) => {
          console.log('Categories created:', catResults);
          
          // Step 3: Create agents
          this.createAgents(Array.from(agents)).subscribe({
            next: (agentResults) => {
              console.log('Agents created:', agentResults);
              
              // Step 4: Create project
              this.createProjects(Array.from(projects)).subscribe({
                next: (projResults) => {
                  console.log('Projects created:', projResults);
                  
                  // Step 5: Create tasks with references
                  this.createTasks(tasks).subscribe({
                    next: (taskResults) => {
                      observer.next({
                        success: true,
                        summary: {
                          tasksCreated: taskResults.created || tasks.length,
                          categoriesCreated: categories.size,
                          agentsCreated: agents.size,
                          projectsCreated: projects.size
                        }
                      });
                      observer.complete();
                    },
                    error: (error) => observer.error(error)
                  });
                },
                error: (error) => observer.error(error)
              });
            },
            error: (error) => observer.error(error)
          });
        },
        error: (error) => observer.error(error)
      });
    });
  }

  // Create categories in bulk
  private createCategories(categories: string[]): Observable<any> {
    if (!categories.length) return new Observable(obs => { obs.next([]); obs.complete(); });

    const items = categories.map(cat => ({
      name: cat,
      description: `Category for ${cat}`,
      status: this.optionMappings.categoryStatus.active,
      color: this.getCategoryColor(cat)
    }));

    return new Observable(observer => {
      this.batchUpload(this.tables.categories, items).subscribe({
        next: (response) => {
          if (response.items) {
            response.items.forEach((item: any, i: number) => {
              this.createdItems.set(`cat_${categories[i]}`, item.id);
            });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  // Create agents in bulk
  private createAgents(agents: string[]): Observable<any> {
    if (!agents.length) return new Observable(obs => { obs.next([]); obs.complete(); });

    const items = agents.map(agent => ({
      name: agent,
      description: this.getAgentDescription(agent),
      status: this.optionMappings.agentStatus.active,
      specialization: this.getAgentSpecialization(agent)
    }));

    return new Observable(observer => {
      this.batchUpload(this.tables.agents, items).subscribe({
        next: (response) => {
          if (response.items) {
            response.items.forEach((item: any, i: number) => {
              this.createdItems.set(`agent_${agents[i]}`, item.id);
            });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  // Create projects in bulk
  private createProjects(projects: string[]): Observable<any> {
    if (!projects.length) return new Observable(obs => { obs.next([]); obs.complete(); });

    const items = projects.map(proj => ({
      name: proj,
      description: `Main ${proj} application project`,
      status: this.optionMappings.projectStatus.active,
      priority: this.optionMappings.projectPriority.high
    }));

    return new Observable(observer => {
      this.batchUpload(this.tables.projects, items).subscribe({
        next: (response) => {
          if (response.items) {
            response.items.forEach((item: any, i: number) => {
              this.createdItems.set(`proj_${projects[i]}`, item.id);
            });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => observer.error(error)
      });
    });
  }

  // Create tasks with proper references
  private createTasks(tasks: any[], batchSize: number = 50): Observable<any> {
    const batches: any[][] = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }

    let created = 0;
    const results: any[] = [];

    return new Observable(observer => {
      const processBatch = (index: number) => {
        if (index >= batches.length) {
          observer.next({ created, results });
          observer.complete();
          return;
        }

        const batch = batches[index];
        const items = batch.map(task => {
          const taskData: any = {
            title: task.title,
            description: task.description || '',
            priority: (this.optionMappings.priority as any)[task.priority] || this.optionMappings.priority.medium,
            status: task.completed ? 
              (task.approved ? this.optionMappings.status.approved : this.optionMappings.status.completed) :
              this.optionMappings.status.pending,
            phase: task.phase || 'Planning',
            task_id: task.id
          };

          // Add category reference
          const catId = this.createdItems.get(`cat_${task.category}`);
          if (catId) taskData.category_id = [catId];

          // Add agent reference  
          const agentId = this.createdItems.get(`agent_${task.agent}`);
          if (agentId) taskData.assigned_agent_id = [agentId];

          // Add project reference
          const projId = this.createdItems.get('proj_Habiti');
          if (projId) taskData.project_id = [projId];

          // Add tags based on task properties
          const tags: number[] = [];
          if (task.priority === 'critical' || task.priority === 'high') {
            tags.push(this.optionMappings.tags.feature);
          }
          if (task.description?.toLowerCase().includes('fix')) {
            tags.push(this.optionMappings.tags.bug);
          }
          if (tags.length > 0) taskData.tags = tags;

          return taskData;
        });

        this.batchUpload(this.tables.tasks, items).subscribe({
          next: (response) => {
            created += batch.length;
            results.push(response);
            console.log(`Batch ${index + 1}/${batches.length} uploaded`);
            
            // Process next batch with small delay
            setTimeout(() => processBatch(index + 1), 500);
          },
          error: (error) => {
            console.error(`Batch ${index + 1} failed:`, error);
            // Continue with next batch even if one fails
            setTimeout(() => processBatch(index + 1), 500);
          }
        });
      };

      processBatch(0);
    });
  }

  // Helper functions
  private getCategoryColor(name: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#6C5CE7', '#A8E6CF', '#FFD93D'
    ];
    return colors[Math.abs(name.charCodeAt(0)) % colors.length];
  }

  private getAgentDescription(agent: string): string {
    const descriptions: { [key: string]: string } = {
      'UI-Designer': 'Designs user interfaces and user experiences',
      'Frontend-Developer': 'Develops client-side applications',
      'Backend-Architect': 'Designs server-side architecture',
      'DevOps-Automator': 'Manages deployment and infrastructure',
      'AI-Engineer': 'Implements AI and ML features',
      'Whimsy-Injector': 'Adds delightful interactions',
      'Performance-Benchmarker': 'Optimizes application performance',
      'Mobile-App-Builder': 'Develops mobile applications',
      'Rapid-Prototyper': 'Creates quick prototypes and MVPs'
    };
    return descriptions[agent] || 'Team member';
  }

  private getAgentSpecialization(agent: string): number[] {
    const specs: { [key: string]: number[] } = {
      'UI-Designer': [this.optionMappings.specialization.design],
      'Frontend-Developer': [this.optionMappings.specialization.frontend],
      'Backend-Architect': [this.optionMappings.specialization.backend],
      'DevOps-Automator': [this.optionMappings.specialization.devops],
      'AI-Engineer': [this.optionMappings.specialization.ai],
      'Whimsy-Injector': [this.optionMappings.specialization.frontend, this.optionMappings.specialization.design],
      'Performance-Benchmarker': [this.optionMappings.specialization.backend],
      'Mobile-App-Builder': [this.optionMappings.specialization.frontend],
      'Rapid-Prototyper': [this.optionMappings.specialization.frontend]
    };
    return specs[agent] || [this.optionMappings.specialization.frontend];
  }

  // Habit-related methods
  
  // Get all habit categories
  getHabitCategories(): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.habitCategories}/?user_field_names=true&order_by=display_order`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get habit subcategories
  getHabitSubcategories(categoryId?: number): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    let url = `${this.baseApiUrl}/${this.tables.habitSubcategories}/?user_field_names=true&order_by=display_order`;
    if (categoryId) {
      url += `&filter__field_category_id__contains=${categoryId}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get habit groups
  getHabitGroups(subcategoryId?: number): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    let url = `${this.baseApiUrl}/${this.tables.habitGroups}/?user_field_names=true&order_by=display_order`;
    if (subcategoryId) {
      url += `&filter__field_subcategory_id__contains=${subcategoryId}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get habits
  getHabits(userId?: string, isActive?: boolean): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    let url = `${this.baseApiUrl}/${this.tables.habits}/?user_field_names=true`;
    
    const filters = [];
    if (userId) {
      filters.push(`filter__field_user_id__equal=${userId}`);
    }
    if (isActive !== undefined) {
      filters.push(`filter__field_is_active__equal=${isActive}`);
    }
    
    if (filters.length > 0) {
      url += '&' + filters.join('&');
    }
    
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Create a new habit
  createHabit(habitData: any): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.error({ message: 'Baserow configuration incomplete' });
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.habits}/?user_field_names=true`;
    return this.http.post(url, habitData, { headers: this.getHeaders() });
  }

  // Update a habit
  updateHabit(habitId: number, updates: any): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.error({ message: 'Baserow configuration incomplete' });
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.habits}/${habitId}/?user_field_names=true`;
    return this.http.patch(url, updates, { headers: this.getHeaders() });
  }

  // Get habit entries
  getHabitEntries(habitId?: number, userId?: string, dateFrom?: string, dateTo?: string): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    let url = `${this.baseApiUrl}/${this.tables.entries}/?user_field_names=true&order_by=-date`;
    
    const filters = [];
    if (habitId) {
      filters.push(`filter__field_habit_id__contains=${habitId}`);
    }
    if (userId) {
      filters.push(`filter__field_user_id__equal=${userId}`);
    }
    if (dateFrom) {
      filters.push(`filter__field_date__date_after=${dateFrom}`);
    }
    if (dateTo) {
      filters.push(`filter__field_date__date_before=${dateTo}`);
    }
    
    if (filters.length > 0) {
      url += '&' + filters.join('&');
    }
    
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Create habit entry
  createHabitEntry(entryData: any): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.error({ message: 'Baserow configuration incomplete' });
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.entries}/?user_field_names=true`;
    return this.http.post(url, entryData, { headers: this.getHeaders() });
  }

  // Get achievements
  getAchievements(isActive?: boolean): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    let url = `${this.baseApiUrl}/${this.tables.achievements}/?user_field_names=true`;
    if (isActive !== undefined) {
      url += `&filter__field_is_active__equal=${isActive}`;
    }
    
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get user achievements
  getUserAchievements(userId: string): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.userAchievements}/?user_field_names=true&filter__field_user_id__equal=${userId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Get game state
  getGameState(userId: string): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.next({ results: [] });
        observer.complete();
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.gameState}/?user_field_names=true&filter__field_user_id__equal=${userId}`;
    return this.http.get(url, { headers: this.getHeaders() });
  }

  // Update game state
  updateGameState(gameStateId: number, updates: any): Observable<any> {
    if (!this.baseApiUrl || !this.token) {
      return new Observable(observer => {
        observer.error({ message: 'Baserow configuration incomplete' });
      });
    }
    
    const url = `${this.baseApiUrl}/${this.tables.gameState}/${gameStateId}/?user_field_names=true`;
    return this.http.patch(url, updates, { headers: this.getHeaders() });
  }
}