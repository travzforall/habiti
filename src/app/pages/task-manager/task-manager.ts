import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BaserowService, TaskUpdate } from '../../services/baserow.service';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  agent: string;
  completed: boolean;
  approved: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase: string;
  notes?: string;
  lastModified?: Date;
}

export interface TaskCategory {
  name: string;
  description: string;
  tasks: TaskItem[];
  completed: number;
  total: number;
  approved: number;
}

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="task-manager-container">
      <div class="header">
        <h1>🛠️ Task Management & Approval System</h1>
        <p class="subtitle">Track progress and approve completed tasks</p>
        <div class="stats-bar">
          <div class="stat">
            <span class="label">Total Tasks:</span>
            <span class="value">{{ totalTasks }}</span>
          </div>
          <div class="stat">
            <span class="label">Completed:</span>
            <span class="value">{{ completedTasks }}</span>
          </div>
          <div class="stat">
            <span class="label">Approved:</span>
            <span class="value">{{ approvedTasks }}</span>
          </div>
          <div class="stat">
            <span class="label">Progress:</span>
            <span class="value">{{ progressPercentage }}%</span>
          </div>
        </div>
      </div>

      <div class="controls">
        <div class="filter-controls">
          <select [(ngModel)]="selectedCategory" (change)="filterTasks()">
            <option value="">All Categories</option>
            <option *ngFor="let category of categories" [value]="category.name">
              {{ category.name }} ({{ category.completed }}/{{ category.total }})
            </option>
          </select>
          
          <select [(ngModel)]="selectedAgent" (change)="filterTasks()">
            <option value="">All Agents</option>
            <option *ngFor="let agent of agents" [value]="agent">{{ agent }}</option>
          </select>
          
          <select [(ngModel)]="selectedStatus" (change)="filterTasks()">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="disapproved">Needs Work</option>
          </select>
        </div>
        
        <div class="action-controls">
          <button (click)="approveAll()" class="btn-approve">Approve All Completed</button>
          <button (click)="resetAll()" class="btn-reset">Reset All</button>
          <button (click)="downloadMarkdownReport()" class="btn-markdown">📋 Download Progress Report</button>
          <button (click)="testBaserowConnection()" class="btn-baserow">🔗 Test Baserow Connection</button>
          <button 
            (click)="exportAllTasksToBaserow()" 
            [disabled]="isExporting"
            class="btn-export-tasks"
          >
            {{ isExporting ? '⏳ Exporting...' : '🚀 Export All Tasks to DB' }}
          </button>
          <button (click)="exportData()" class="btn-export">Export JSON Data</button>
        </div>
        
        <div *ngIf="exportProgress" class="export-progress">
          {{ exportProgress }}
        </div>
      </div>

      <div class="task-categories">
        <div *ngFor="let category of filteredCategories" class="category-section">
          <div class="category-header" (click)="toggleCategory(category.name)">
            <h2>{{ category.name }}</h2>
            <div class="category-stats">
              <span class="progress">{{ category.completed }}/{{ category.total }}</span>
              <span class="approved">✅ {{ category.approved }}</span>
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  [style.width.%]="(category.completed / category.total) * 100">
                </div>
              </div>
            </div>
            <span class="toggle-icon">{{ expandedCategories.has(category.name) ? '▼' : '▶' }}</span>
          </div>
          
          <div *ngIf="expandedCategories.has(category.name)" class="category-content">
            <p class="category-description">{{ category.description }}</p>
            
            <div class="tasks-list">
              <div 
                *ngFor="let task of category.tasks" 
                class="task-item"
                [class.completed]="task.completed"
                [class.approved]="task.approved"
                [class.priority-high]="task.priority === 'high'"
                [class.priority-critical]="task.priority === 'critical'"
              >
                <div class="task-checkbox">
                  <input 
                    type="checkbox" 
                    [checked]="task.completed"
                    (change)="toggleTaskComplete(task)"
                    [id]="'task-' + task.id"
                  >
                  <label [for]="'task-' + task.id"></label>
                </div>
                
                <div class="task-content">
                  <div class="task-header">
                    <h3 class="task-title">{{ task.title }}</h3>
                    <div class="task-meta">
                      <span class="agent">{{ task.agent }}</span>
                      <span class="priority priority-{{ task.priority }}">{{ task.priority }}</span>
                      <span class="phase">{{ task.phase }}</span>
                    </div>
                  </div>
                  
                  <p *ngIf="task.description" class="task-description">{{ task.description }}</p>
                  
                  <div *ngIf="task.completed" class="task-approval">
                    <div class="approval-controls">
                      <button 
                        (click)="approveTask(task)"
                        [class.active]="task.approved"
                        class="btn-approve-task"
                      >
                        ✅ {{ task.approved ? 'Approved' : 'Approve' }}
                      </button>
                      <button 
                        (click)="disapproveTask(task)"
                        [class.active]="task.completed && !task.approved"
                        class="btn-disapprove-task"
                      >
                        ❌ {{ task.approved ? 'Disapprove' : 'Needs Work' }}
                      </button>
                    </div>
                    
                    <textarea 
                      [(ngModel)]="task.notes"
                      (change)="saveTaskNotes(task)"
                      placeholder="Add notes or feedback..."
                      class="task-notes"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .task-manager-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .header {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 30px;
      color: white;
      text-align: center;
    }

    .header h1 {
      margin: 0 0 10px 0;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .subtitle {
      margin: 0 0 20px 0;
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .stats-bar {
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }

    .stat .label {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .stat .value {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .controls {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
    }

    .filter-controls {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .filter-controls select {
      padding: 10px 15px;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.9);
      font-size: 1rem;
      min-width: 150px;
    }

    .action-controls {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .action-controls button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-approve {
      background: #4CAF50;
      color: white;
    }

    .btn-reset {
      background: #FF9800;
      color: white;
    }

    .btn-markdown {
      background: #9C27B0;
      color: white;
    }

    .btn-baserow {
      background: #00BCD4;
      color: white;
    }

    .btn-export-tasks {
      background: #4CAF50;
      color: white;
    }
    
    .btn-export-tasks:disabled {
      background: #999;
      cursor: not-allowed;
      opacity: 0.7;
    }

    .btn-export {
      background: #2196F3;
      color: white;
    }

    .action-controls button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    .export-progress {
      margin-top: 15px;
      padding: 10px 15px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-weight: 600;
      text-align: center;
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 0.8; }
      50% { opacity: 1; }
      100% { opacity: 0.8; }
    }

    .category-section {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      margin-bottom: 20px;
      overflow: hidden;
    }

    .category-header {
      padding: 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: white;
      transition: background 0.3s ease;
    }

    .category-header:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .category-header h2 {
      margin: 0;
      font-size: 1.4rem;
    }

    .category-stats {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .progress-bar {
      width: 100px;
      height: 8px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #4CAF50;
      transition: width 0.3s ease;
    }

    .category-content {
      padding: 0 20px 20px;
      color: white;
    }

    .category-description {
      margin-bottom: 20px;
      opacity: 0.9;
    }

    .task-item {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 10px;
      display: flex;
      gap: 15px;
      transition: all 0.3s ease;
      border-left: 4px solid transparent;
    }

    .task-item.completed {
      opacity: 0.8;
      border-left-color: #4CAF50;
    }

    .task-item.approved {
      border-left-color: #2196F3;
    }

    .task-item.priority-high {
      border-left-color: #FF9800;
    }

    .task-item.priority-critical {
      border-left-color: #F44336;
    }

    .task-checkbox {
      display: flex;
      align-items: flex-start;
      padding-top: 2px;
    }

    .task-checkbox input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
    }

    .task-content {
      flex: 1;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .task-title {
      margin: 0;
      font-size: 1.1rem;
      color: white;
    }

    .task-meta {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .agent, .priority, .phase {
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .agent {
      background: rgba(100, 200, 255, 0.3);
      color: #E3F2FD;
    }

    .priority-low { background: rgba(76, 175, 80, 0.3); color: #C8E6C9; }
    .priority-medium { background: rgba(255, 152, 0, 0.3); color: #FFE0B2; }
    .priority-high { background: rgba(255, 152, 0, 0.5); color: #FFE0B2; }
    .priority-critical { background: rgba(244, 67, 54, 0.5); color: #FFCDD2; }

    .phase {
      background: rgba(156, 39, 176, 0.3);
      color: #F3E5F5;
    }

    .task-description {
      margin: 8px 0;
      opacity: 0.9;
      color: white;
    }

    .task-approval {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .approval-controls {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .btn-approve-task, .btn-disapprove-task {
      padding: 8px 15px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-approve-task {
      background: #4CAF50;
      color: white;
    }

    .btn-disapprove-task {
      background: #F44336;
      color: white;
    }

    .btn-approve-task.active {
      background: #2196F3;
    }

    .btn-disapprove-task.active {
      background: #FF5722;
    }

    .task-notes {
      width: 100%;
      min-height: 60px;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      resize: vertical;
    }

    .task-notes::placeholder {
      color: rgba(255, 255, 255, 0.6);
    }

    .toggle-icon {
      font-size: 1.2rem;
      transition: transform 0.3s ease;
    }

    @media (max-width: 768px) {
      .stats-bar {
        gap: 20px;
      }
      
      .controls {
        flex-direction: column;
      }
      
      .task-header {
        flex-direction: column;
        gap: 10px;
      }
      
      .task-meta {
        flex-wrap: wrap;
      }
    }
  `]
})
export class TaskManagerComponent implements OnInit {
  categories: TaskCategory[] = [];
  filteredCategories: TaskCategory[] = [];
  expandedCategories = new Set<string>();
  
  selectedCategory = '';
  selectedAgent = '';
  selectedStatus = '';
  
  agents: string[] = [];
  
  // Stats
  totalTasks = 0;
  completedTasks = 0;
  approvedTasks = 0;
  progressPercentage = 0;

  constructor(private baserowService: BaserowService) {}

  ngOnInit() {
    this.loadTasks();
    this.calculateStats();
    this.filterTasks();
    // Expand all categories by default
    this.categories.forEach(cat => this.expandedCategories.add(cat.name));
  }

  loadTasks() {
    // Load tasks from localStorage or initialize with default data
    const savedData = localStorage.getItem('taskManagerData');
    if (savedData) {
      this.categories = JSON.parse(savedData);
    } else {
      this.initializeDefaultTasks();
    }
    
    // Extract unique agents
    const agentSet = new Set<string>();
    this.categories.forEach(cat => {
      cat.tasks.forEach(task => agentSet.add(task.agent));
    });
    this.agents = Array.from(agentSet).sort();
  }

  initializeDefaultTasks() {
    this.categories = [
      {
        name: 'Analytics Features',
        description: 'Data visualization, reporting, and insights system',
        tasks: [
          {
            id: 'analytics-1',
            title: 'Design analytics dashboard layout',
            description: 'Create visual hierarchy and chart component specifications',
            category: 'Analytics Features',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'analytics-2',
            title: 'Implement Chart.js components',
            description: 'Build responsive chart containers and interactive features',
            category: 'Analytics Features',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'analytics-3',
            title: 'Design analytics data models',
            description: 'Create data aggregation and calculation services',
            category: 'Analytics Features',
            agent: 'Backend-Architect',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'analytics-4',
            title: 'Build ML prediction algorithms',
            description: 'Implement habit success prediction and pattern recognition',
            category: 'Analytics Features',
            agent: 'AI-Engineer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 2'
          }
        ],
        completed: 0,
        total: 4,
        approved: 0
      },
      {
        name: 'Calendar Features',
        description: 'Calendar integration and daily planner functionality',
        tasks: [
          {
            id: 'calendar-1',
            title: 'Design calendar interface components',
            description: 'Create month/week/day views and event creation forms',
            category: 'Calendar Features',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'calendar-2',
            title: 'Build calendar grid components',
            description: 'Implement drag-and-drop and event management',
            category: 'Calendar Features',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'calendar-3',
            title: 'Create calendar data services',
            description: 'Build event CRUD APIs and recurring event logic',
            category: 'Calendar Features',
            agent: 'Backend-Architect',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          }
        ],
        completed: 0,
        total: 3,
        approved: 0
      },
      {
        name: 'Dashboard Features',
        description: 'Main dashboard interface and habit tracking',
        tasks: [
          {
            id: 'dashboard-1',
            title: 'Design dashboard layout',
            description: 'Create habit cards, stats grid, and sidebar components',
            category: 'Dashboard Features',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'critical',
            phase: 'Phase 1'
          },
          {
            id: 'dashboard-2',
            title: 'Build habit tracking components',
            description: 'Implement today\'s habits and weekly tracker table',
            category: 'Dashboard Features',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'critical',
            phase: 'Phase 1'
          },
          {
            id: 'dashboard-3',
            title: 'Add celebration animations',
            description: 'Create engaging habit completion interactions',
            category: 'Dashboard Features',
            agent: 'Whimsy-Injector',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 2'
          }
        ],
        completed: 0,
        total: 3,
        approved: 0
      },
      {
        name: 'Gamification System',
        description: 'Points, achievements, and game mechanics',
        tasks: [
          {
            id: 'gamification-1',
            title: 'Design gamification interfaces',
            description: 'Create avatar customization and achievement badge designs',
            category: 'Gamification System',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          },
          {
            id: 'gamification-2',
            title: 'Build points and XP tracking',
            description: 'Implement achievement checking and unlock mechanisms',
            category: 'Gamification System',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          },
          {
            id: 'gamification-3',
            title: 'Create celebration effects',
            description: 'Add confetti animations and achievement celebrations',
            category: 'Gamification System',
            agent: 'Whimsy-Injector',
            completed: false,
            approved: false,
            priority: 'low',
            phase: 'Phase 2'
          }
        ],
        completed: 0,
        total: 3,
        approved: 0
      },
      {
        name: 'Habits Management',
        description: 'Habit creation, tracking, and management features',
        tasks: [
          {
            id: 'habits-1',
            title: 'Design habit creation interface',
            description: 'Create form wizard and template library designs',
            category: 'Habits Management',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'habits-2',
            title: 'Build habit CRUD operations',
            description: 'Implement habit creation, tracking, and management',
            category: 'Habits Management',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          },
          {
            id: 'habits-3',
            title: 'Create habit data services',
            description: 'Build API endpoints and streak calculation services',
            category: 'Habits Management',
            agent: 'Backend-Architect',
            completed: false,
            approved: false,
            priority: 'high',
            phase: 'Phase 1'
          }
        ],
        completed: 0,
        total: 3,
        approved: 0
      },
      {
        name: 'Planning System',
        description: 'Multi-level planning (nightly, weekly, quarterly)',
        tasks: [
          {
            id: 'planning-1',
            title: 'Design planning interfaces',
            description: 'Create nightly planner modal and weekly dashboard',
            category: 'Planning System',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          },
          {
            id: 'planning-2',
            title: 'Build planning components',
            description: 'Implement guided planning forms and tracking',
            category: 'Planning System',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          }
        ],
        completed: 0,
        total: 2,
        approved: 0
      },
      {
        name: 'Pomodoro System',
        description: 'Focus timer and distraction blocking',
        tasks: [
          {
            id: 'pomodoro-1',
            title: 'Design timer interface',
            description: 'Create focus mode UI and timer controls',
            category: 'Pomodoro System',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          },
          {
            id: 'pomodoro-2',
            title: 'Build timer functionality',
            description: 'Implement Pomodoro timer and session management',
            category: 'Pomodoro System',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'medium',
            phase: 'Phase 1'
          }
        ],
        completed: 0,
        total: 2,
        approved: 0
      },
      {
        name: 'Project Management',
        description: 'Goals, tasks, and project organization system',
        tasks: [
          {
            id: 'project-1',
            title: 'Design project interfaces',
            description: 'Create project dashboard and Kanban board layouts',
            category: 'Project Management',
            agent: 'UI-Designer',
            completed: false,
            approved: false,
            priority: 'low',
            phase: 'Phase 1'
          },
          {
            id: 'project-2',
            title: 'Build project management',
            description: 'Implement goal creation and task tracking',
            category: 'Project Management',
            agent: 'Frontend-Developer',
            completed: false,
            approved: false,
            priority: 'low',
            phase: 'Phase 1'
          }
        ],
        completed: 0,
        total: 2,
        approved: 0
      }
    ];
    
    this.saveTasks();
  }

  saveTasks() {
    localStorage.setItem('taskManagerData', JSON.stringify(this.categories));
  }

  private saveTaskUpdateToBaserow(task: TaskItem, action: string, notes?: string) {
    const update: TaskUpdate = {
      task_id: task.id,
      task_title: task.title,
      category: task.category,
      agent: task.agent,
      action: action,
      notes: notes || task.notes || '',
      priority: task.priority,
      phase: task.phase,
      timestamp: new Date().toISOString(),
      status: task.approved ? 'approved' : (task.completed ? 'completed' : 'pending')
    };

    this.baserowService.createTaskUpdate(update).subscribe({
      next: (response) => {
        if (!response.skipped) {
          console.log('Task update saved to Baserow:', response);
        }
      },
      error: (error) => {
        console.error('Failed to save task update to Baserow:', error);
      }
    });
  }

  private saveProgressReportToBaserow() {
    const stats = {
      totalTasks: this.totalTasks,
      completedTasks: this.completedTasks,
      approvedTasks: this.approvedTasks,
      progressPercentage: this.progressPercentage
    };

    this.baserowService.createProgressReport(this.categories, stats).subscribe({
      next: (response) => {
        if (!response.skipped) {
          console.log('Progress report saved to Baserow:', response);
        }
      },
      error: (error) => {
        console.error('Failed to save progress report to Baserow:', error);
      }
    });
  }

  calculateStats() {
    this.totalTasks = this.categories.reduce((sum, cat) => sum + cat.total, 0);
    this.completedTasks = this.categories.reduce((sum, cat) => sum + cat.completed, 0);
    this.approvedTasks = this.categories.reduce((sum, cat) => sum + cat.approved, 0);
    this.progressPercentage = this.totalTasks > 0 ? Math.round((this.completedTasks / this.totalTasks) * 100) : 0;
    
    // Update category stats
    this.categories.forEach(category => {
      category.completed = category.tasks.filter(task => task.completed).length;
      category.approved = category.tasks.filter(task => task.approved).length;
      category.total = category.tasks.length;
    });
  }

  filterTasks() {
    this.filteredCategories = this.categories.map(category => ({
      ...category,
      tasks: category.tasks.filter(task => {
        const categoryMatch = !this.selectedCategory || category.name === this.selectedCategory;
        const agentMatch = !this.selectedAgent || task.agent === this.selectedAgent;
        let statusMatch = true;
        
        if (this.selectedStatus === 'pending') statusMatch = !task.completed;
        else if (this.selectedStatus === 'completed') statusMatch = task.completed && !task.approved;
        else if (this.selectedStatus === 'approved') statusMatch = task.approved;
        else if (this.selectedStatus === 'disapproved') statusMatch = task.completed && !task.approved;
        
        return categoryMatch && agentMatch && statusMatch;
      })
    })).filter(category => category.tasks.length > 0);
  }

  toggleCategory(categoryName: string) {
    if (this.expandedCategories.has(categoryName)) {
      this.expandedCategories.delete(categoryName);
    } else {
      this.expandedCategories.add(categoryName);
    }
  }

  toggleTaskComplete(task: TaskItem) {
    const wasCompleted = task.completed;
    task.completed = !task.completed;
    if (!task.completed) {
      task.approved = false;
    }
    task.lastModified = new Date();
    this.calculateStats();
    this.saveTasks();
    
    // Save update to Baserow
    const action = task.completed ? 'completed' : 'uncompleted';
    this.saveTaskUpdateToBaserow(task, action);
  }

  approveTask(task: TaskItem) {
    task.approved = true;
    task.lastModified = new Date();
    this.calculateStats();
    this.saveTasks();
    
    // Save update to Baserow
    this.saveTaskUpdateToBaserow(task, 'approved');
    this.downloadMarkdownReport();
  }

  disapproveTask(task: TaskItem) {
    task.approved = false;
    task.lastModified = new Date();
    this.calculateStats();
    this.saveTasks();
    
    // Save update to Baserow
    this.saveTaskUpdateToBaserow(task, 'disapproved');
    this.downloadMarkdownReport();
  }

  saveTaskNotes(task: TaskItem) {
    task.lastModified = new Date();
    this.saveTasks();
    
    // Save update to Baserow
    this.saveTaskUpdateToBaserow(task, 'note_added');
    this.downloadMarkdownReport();
  }

  approveAll() {
    this.categories.forEach(category => {
      category.tasks.forEach(task => {
        if (task.completed && !task.approved) {
          task.approved = true;
          task.lastModified = new Date();
          // Save each approval to Baserow
          this.saveTaskUpdateToBaserow(task, 'approved');
        }
      });
    });
    this.calculateStats();
    this.saveTasks();
    
    // Save progress report to Baserow
    this.saveProgressReportToBaserow();
  }

  resetAll() {
    if (confirm('Are you sure you want to reset all task progress? This cannot be undone.')) {
      this.categories.forEach(category => {
        category.tasks.forEach(task => {
          task.completed = false;
          task.approved = false;
          task.notes = '';
          task.lastModified = new Date();
          // Save reset action to Baserow
          this.saveTaskUpdateToBaserow(task, 'reset');
        });
      });
      this.calculateStats();
      this.saveTasks();
      
      // Save progress report to Baserow
      this.saveProgressReportToBaserow();
    }
  }

  generateMarkdownReport(): string {
    const now = new Date().toISOString();
    let markdown = `# 🛠️ Habiti Development Progress Report\n\n`;
    markdown += `**Last Updated:** ${now}\n\n`;
    markdown += `## 📊 Overall Progress\n\n`;
    markdown += `- **Total Tasks:** ${this.totalTasks}\n`;
    markdown += `- **Completed Tasks:** ${this.completedTasks}\n`;
    markdown += `- **Approved Tasks:** ${this.approvedTasks}\n`;
    markdown += `- **Progress:** ${this.progressPercentage}%\n\n`;
    
    markdown += `## 🎯 Next Claude Session Should Focus On:\n\n`;
    
    // Find highest priority pending tasks
    const pendingTasks = this.categories.flatMap(cat => cat.tasks)
      .filter(task => !task.completed)
      .sort((a, b) => {
        const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 5);
    
    if (pendingTasks.length > 0) {
      markdown += `### 🚀 Top Priority Pending Tasks:\n\n`;
      pendingTasks.forEach((task, index) => {
        markdown += `${index + 1}. **${task.title}** (${task.priority} priority)\n`;
        markdown += `   - Agent: ${task.agent}\n`;
        markdown += `   - Category: ${task.category}\n`;
        if (task.description) {
          markdown += `   - Description: ${task.description}\n`;
        }
        markdown += `\n`;
      });
    }
    
    // Find tasks needing attention (completed but not approved)
    const needsWork = this.categories.flatMap(cat => cat.tasks)
      .filter(task => task.completed && !task.approved);
    
    if (needsWork.length > 0) {
      markdown += `### ⚠️ Tasks Needing Attention:\n\n`;
      needsWork.forEach(task => {
        markdown += `- **${task.title}** (${task.category})\n`;
        if (task.notes) {
          markdown += `  - Feedback: ${task.notes}\n`;
        }
      });
      markdown += `\n`;
    }
    
    markdown += `## 📋 Detailed Task Status by Category\n\n`;
    
    this.categories.forEach(category => {
      const completedCount = category.tasks.filter(task => task.completed).length;
      const approvedCount = category.tasks.filter(task => task.approved).length;
      const progressPercent = Math.round((completedCount / category.total) * 100);
      
      markdown += `### ${category.name} (${completedCount}/${category.total} completed, ${approvedCount} approved)\n\n`;
      markdown += `**Progress:** ${progressPercent}% | **Description:** ${category.description}\n\n`;
      
      category.tasks.forEach(task => {
        let status = '';
        if (task.approved) {
          status = '✅ Approved';
        } else if (task.completed) {
          status = '⏳ Needs Review';
        } else {
          status = '📋 Pending';
        }
        
        markdown += `- [${task.completed ? 'x' : ' '}] **${task.title}** - ${status}\n`;
        markdown += `  - Agent: ${task.agent} | Priority: ${task.priority} | Phase: ${task.phase}\n`;
        
        if (task.description) {
          markdown += `  - Description: ${task.description}\n`;
        }
        
        if (task.notes) {
          markdown += `  - Notes: ${task.notes}\n`;
        }
        
        if (task.lastModified) {
          markdown += `  - Last Modified: ${new Date(task.lastModified).toISOString()}\n`;
        }
        
        markdown += `\n`;
      });
      
      markdown += `\n`;
    });
    
    markdown += `---\n\n`;
    markdown += `*This report was automatically generated from the Habiti Task Manager at ${now}*\n`;
    
    return markdown;
  }

  downloadMarkdownReport() {
    const markdown = this.generateMarkdownReport();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habiti-progress-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  testBaserowConnection() {
    console.log('Testing Baserow connection...');
    
    this.baserowService.testConnection().subscribe({
      next: (response) => {
        console.log('Baserow connection successful:', response);
        alert('✅ Baserow connection successful! Ready to sync task updates.');
      },
      error: (error) => {
        console.error('Baserow connection failed:', error);
        if (error.message === 'Configuration incomplete') {
          alert('❌ Baserow configuration is incomplete. Please check your environment variables:\n\n' +
                '- BASEROW_API_URL\n' +
                '- BASEROW_TOKEN\n' +
                '- BASEROW_TABLE_ID');
        } else {
          alert('❌ Baserow connection failed. Check console for details.\n\n' +
                'Error: ' + (error.error?.error || error.message || 'Unknown error'));
        }
      }
    });
  }

  isExporting = false;
  exportProgress = '';

  exportAllTasksToBaserow() {
    console.log('Exporting all tasks to Baserow...');
    
    // Flatten all tasks from all categories
    const allTasks = this.categories.flatMap(category => category.tasks);
    
    if (allTasks.length === 0) {
      alert('⚠️ No tasks to export.');
      return;
    }

    const confirmMessage = `🚀 Export ${allTasks.length} tasks to Baserow database?\n\n` +
                          `This will:\n` +
                          `1. Create categories (${this.categories.length} total)\n` +
                          `2. Create agents (${this.agents.length} total)\n` +
                          `3. Create project entry\n` +
                          `4. Create tasks in batches (${allTasks.length} total)\n\n` +
                          `Categories to export:\n` +
                          this.categories.map(cat => `• ${cat.name}: ${cat.tasks.length} tasks`).join('\n');

    if (!confirm(confirmMessage)) {
      return;
    }

    this.isExporting = true;
    this.exportProgress = '📦 Starting export process...';

    // Show progress in real-time
    const updateProgress = (message: string) => {
      this.exportProgress = message;
      console.log(message);
    };

    updateProgress('📁 Creating categories...');

    this.baserowService.exportAllTasks(allTasks).subscribe({
      next: (result) => {
        console.log('Export completed:', result);
        this.isExporting = false;
        
        if (result.success) {
          const summary = result.summary;
          alert(`✅ Export completed successfully!\n\n` +
                `📊 Summary:\n` +
                `• Tasks created: ${summary.tasksCreated}\n` +
                `• Categories created: ${summary.categoriesCreated}\n` +
                `• Agents created: ${summary.agentsCreated}\n` +
                `• Projects created: ${summary.projectsCreated}\n\n` +
                `All data is now available in Baserow for future sessions.`);
          
          this.exportProgress = '✅ Export completed successfully!';
          setTimeout(() => this.exportProgress = '', 5000);
        }
      },
      error: (error) => {
        console.error('Export failed:', error);
        this.isExporting = false;
        this.exportProgress = '❌ Export failed!';
        
        alert('❌ Export failed. Check browser console for details.\n\n' +
              'Error: ' + (error.message || 'Unknown error') + '\n\n' +
              'Make sure:\n' +
              '• Your Baserow API token is configured\n' +
              '• You have network access to db.jollycares.com\n' +
              '• The table IDs are correct');
        
        setTimeout(() => this.exportProgress = '', 5000);
      }
    });
  }

  exportData() {
    const data = {
      exportDate: new Date().toISOString(),
      categories: this.categories,
      stats: {
        totalTasks: this.totalTasks,
        completedTasks: this.completedTasks,
        approvedTasks: this.approvedTasks,
        progressPercentage: this.progressPercentage
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-manager-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}