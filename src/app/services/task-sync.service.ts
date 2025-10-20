import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

interface ParsedTask {
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  assignedAgent?: string;
  estimatedHours?: number;
  projectName?: string;
  phase?: string;
}

interface BaserowTask {
  title: string;
  description: string;
  status: number;
  priority?: number;
  category_id?: number[];
  assigned_agent_id?: number[];
  project_id?: number[];
  tags?: number[];
  estimated_hours?: string;
  phase?: string;
  task_id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TaskSyncService {
  private baserowApiUrl = 'YOUR_BASEROW_API_URL';
  private apiToken = 'YOUR_BASEROW_API_TOKEN';
  private tasksTableId = 508;
  private categoriesTableId = 504;
  private agentsTableId = 506;
  private projectsTableId = 507;

  private priorityMap = {
    low: 2050,
    medium: 2048,
    high: 2047,
    critical: 2049
  };

  private statusMap = {
    pending: 2051,
    approved: 2052,
    in_progress: 2053,
    completed: 2054,
    blocked: 2055
  };

  private tagMap = {
    bug: 2056,
    feature: 2057,
    improvement: 2058,
    docs: 2059
  };

  constructor(private http: HttpClient) {}

  parseMarkdownFile(content: string, fileName: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const lines = content.split('\n');
    
    let currentCategory = '';
    let currentAgent = '';
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse agent sections (e.g., ### 🎨 **UI-Designer**)
      if (line.startsWith('### ')) {
        const agentMatch = line.match(/\*\*([^*]+)\*\*/);
        if (agentMatch) {
          currentAgent = agentMatch[1].trim();
        }
      }
      
      // Parse main category from filename
      const categoryFromFile = fileName.replace('.md', '').replace(/-/g, ' ');
      currentCategory = this.titleCase(categoryFromFile);
      
      // Parse task items (lines starting with -)
      if (line.startsWith('- ')) {
        const taskText = line.substring(2).trim();
        
        // Extract priority if mentioned
        let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
        if (taskText.toLowerCase().includes('critical')) priority = 'critical';
        else if (taskText.toLowerCase().includes('high priority')) priority = 'high';
        else if (taskText.toLowerCase().includes('low priority')) priority = 'low';
        
        // Extract estimated hours if mentioned (e.g., ~2h, ~30min)
        let estimatedHours: number | undefined;
        const hoursMatch = taskText.match(/~(\d+(?:\.\d+)?)\s*h/i);
        const minsMatch = taskText.match(/~(\d+)\s*min/i);
        if (hoursMatch) {
          estimatedHours = parseFloat(hoursMatch[1]);
        } else if (minsMatch) {
          estimatedHours = parseInt(minsMatch[1]) / 60;
        }
        
        // Determine tags based on content
        const tags: string[] = [];
        if (taskText.toLowerCase().includes('ui') || taskText.toLowerCase().includes('interface')) {
          tags.push('feature');
        }
        if (taskText.toLowerCase().includes('fix') || taskText.toLowerCase().includes('bug')) {
          tags.push('bug');
        }
        if (taskText.toLowerCase().includes('optimize') || taskText.toLowerCase().includes('improve')) {
          tags.push('improvement');
        }
        if (taskText.toLowerCase().includes('document') || taskText.toLowerCase().includes('docs')) {
          tags.push('docs');
        }
        
        // Clean task text
        const cleanTaskText = taskText
          .replace(/~\d+(?:\.\d+)?\s*h/gi, '')
          .replace(/~\d+\s*min/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        tasks.push({
          title: this.extractTaskTitle(cleanTaskText),
          description: cleanTaskText,
          category: currentCategory,
          priority,
          tags: tags.length > 0 ? tags : ['feature'],
          assignedAgent: currentAgent || undefined,
          estimatedHours,
          projectName: 'Habiti App',
          phase: this.determinePhase(currentAgent)
        });
      }
    }
    
    return tasks;
  }

  private extractTaskTitle(taskText: string): string {
    // Take first 50 chars or until first period/dash
    const endIndex = Math.min(
      taskText.indexOf('.') > 0 ? taskText.indexOf('.') : taskText.length,
      taskText.indexOf(' - ') > 0 ? taskText.indexOf(' - ') : taskText.length,
      50
    );
    return taskText.substring(0, endIndex).trim();
  }

  private determinePhase(agent: string): string {
    const phaseMap: { [key: string]: string } = {
      'UI-Designer': 'Design',
      'Frontend-Developer': 'Development',
      'Backend-Architect': 'Development',
      'DevOps-Automator': 'Deployment',
      'AI-Engineer': 'Development',
      'Performance-Benchmarker': 'Testing',
      'Mobile-App-Builder': 'Development',
      'Rapid-Prototyper': 'Prototyping'
    };
    return phaseMap[agent] || 'Planning';
  }

  private titleCase(str: string): string {
    return str.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  async syncAllTasks(): Promise<void> {
    const taskFiles = [
      'pomodoro.md',
      'calendar.md',
      'dashboard.md',
      'gamification.md',
      'analytics.md',
      'project-management.md',
      'habits.md',
      'calendar-features.md',
      'planner.md',
      'misc.md'
    ];

    // First, ensure categories exist
    await this.ensureCategoriesExist();
    
    // Then sync each file
    for (const file of taskFiles) {
      await this.syncTaskFile(file);
    }
  }

  private async syncTaskFile(fileName: string): Promise<void> {
    try {
      // Read the markdown file from assets
      const response = await fetch(`/assets/tasks/${fileName}`);
      const content = await response.text();
      
      // Parse tasks from markdown
      const parsedTasks = this.parseMarkdownFile(content, fileName);
      
      // Convert to Baserow format and create tasks
      for (const task of parsedTasks) {
        await this.createTaskInBaserow(task);
      }
      
      console.log(`Synced ${parsedTasks.length} tasks from ${fileName}`);
    } catch (error) {
      console.error(`Error syncing ${fileName}:`, error);
    }
  }

  private async createTaskInBaserow(task: ParsedTask): Promise<void> {
    const baserowTask: BaserowTask = {
      title: task.title,
      description: task.description,
      status: this.statusMap.pending,
      priority: task.priority ? this.priorityMap[task.priority] : undefined,
      estimated_hours: task.estimatedHours?.toString(),
      phase: task.phase,
      task_id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    // Convert tags to IDs
    if (task.tags && task.tags.length > 0) {
      baserowTask.tags = task.tags
        .map(tag => this.tagMap[tag as keyof typeof this.tagMap])
        .filter(id => id !== undefined);
    }

    // Here you would make the actual API call to Baserow
    // For now, this is a placeholder
    console.log('Creating task in Baserow:', baserowTask);
    
    // Example API call (uncomment when ready):
    // const headers = {
    //   'Authorization': `Token ${this.apiToken}`,
    //   'Content-Type': 'application/json'
    // };
    // 
    // return this.http.post(
    //   `${this.baserowApiUrl}/api/database/rows/table/${this.tasksTableId}/`,
    //   { row: baserowTask },
    //   { headers }
    // ).toPromise();
  }

  private async ensureCategoriesExist(): Promise<void> {
    const categories = [
      'Pomodoro',
      'Calendar',
      'Dashboard',
      'Gamification',
      'Analytics',
      'Project Management',
      'Habits',
      'Planner',
      'Misc'
    ];

    for (const categoryName of categories) {
      await this.createCategoryIfNotExists(categoryName);
    }
  }

  private async createCategoryIfNotExists(name: string): Promise<void> {
    // Check if category exists and create if not
    // This is a placeholder - implement actual Baserow API calls
    console.log(`Ensuring category exists: ${name}`);
    
    // Example:
    // const category = {
    //   name,
    //   description: `Tasks related to ${name}`,
    //   status: 2028, // active
    //   color: this.getColorForCategory(name)
    // };
    // 
    // await this.createInBaserow(this.categoriesTableId, category);
  }

  private getColorForCategory(name: string): string {
    const colors: { [key: string]: string } = {
      'Pomodoro': '#FF6B6B',
      'Calendar': '#4ECDC4',
      'Dashboard': '#45B7D1',
      'Gamification': '#FFA07A',
      'Analytics': '#98D8C8',
      'Project Management': '#6C5CE7',
      'Habits': '#A8E6CF',
      'Planner': '#FFD93D',
      'Misc': '#95A5A6'
    };
    return colors[name] || '#3498DB';
  }
}