import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest } from 'rxjs';

import { QueueManagerService, TaskQueue, AgentSlot } from '../../services/queue-manager.service';
import { MarkdownSyncService, MarkdownTask } from '../../services/markdown-sync.service';

@Component({
  selector: 'app-queue-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <!-- Header -->
      <header class="border-b border-purple-500/20 bg-black/20 backdrop-blur-sm">
        <div class="container mx-auto px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                🎯 Task Queue Manager
              </h1>
              <p class="text-purple-200 mt-1">Gantt Board & Concurrent Agent Execution</p>
            </div>
            
            <div class="flex items-center gap-4">
              <div class="text-right">
                <div class="text-sm text-purple-300">Status</div>
                <div class="font-bold" [class]="isRunning ? 'text-green-400' : 'text-orange-400'">
                  {{ isRunning ? '🟢 Running' : '⚪ Paused' }}
                </div>
              </div>
              
              <button
                (click)="toggleExecution()"
                [class]="isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
                class="px-6 py-2 rounded-lg font-bold transition-all duration-300 transform hover:scale-105"
              >
                {{ isRunning ? '⏸️ Pause All' : '▶️ Start Execution' }}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="container mx-auto px-6 py-8">
        <!-- Control Panel -->
        <div class="bg-black/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-purple-500/20">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <!-- Agent Concurrency Control -->
            <div class="text-center">
              <label class="block text-sm text-purple-300 mb-2">Max Concurrent Agents</label>
              <div class="flex items-center justify-center gap-2">
                <button 
                  (click)="decreaseConcurrency()" 
                  class="w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center"
                >-</button>
                <span class="text-2xl font-bold w-12 text-center">{{ maxConcurrentAgents }}</span>
                <button 
                  (click)="increaseConcurrency()" 
                  class="w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center"
                >+</button>
              </div>
            </div>

            <!-- Stats -->
            <div class="text-center">
              <div class="text-sm text-purple-300">Total Tasks</div>
              <div class="text-2xl font-bold">{{ stats.totalTasks }}</div>
            </div>
            
            <div class="text-center">
              <div class="text-sm text-purple-300">Completed</div>
              <div class="text-2xl font-bold text-green-400">{{ stats.completedTasks }}</div>
            </div>
            
            <div class="text-center">
              <div class="text-sm text-purple-300">Progress</div>
              <div class="text-2xl font-bold text-blue-400">{{ stats.progressPercentage.toFixed(1) }}%</div>
            </div>
          </div>

          <!-- Overall Progress Bar -->
          <div class="mt-4">
            <div class="bg-slate-800 rounded-full h-4 overflow-hidden">
              <div 
                class="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500 ease-out"
                [style.width.%]="stats.progressPercentage"
              ></div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-4 mt-6 justify-center">
            <button
              (click)="initializeTasks()"
              class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all duration-300"
              [disabled]="!tasksLoaded"
            >
              🔄 Refresh Queues
            </button>
            
            <button
              (click)="exportToClaudeScript()"
              class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-all duration-300"
              [disabled]="queues.length === 0"
            >
              📜 Generate Claude Script
            </button>
          </div>
        </div>

        <!-- Agent Slots Display -->
        <div class="bg-black/30 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-purple-500/20">
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            🤖 Agent Slots
          </h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              *ngFor="let slot of agentSlots"
              class="bg-slate-800/50 rounded-lg p-4 border"
              [class]="getSlotBorderClass(slot)"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-bold">{{ slot.agent }}</div>
                <div class="text-sm" [class]="getSlotStatusClass(slot)">
                  {{ getSlotStatusText(slot) }}
                </div>
              </div>
              
              <div class="text-sm text-gray-400">
                <div>Completed: {{ slot.tasksCompleted }}</div>
                <div>Efficiency: {{ slot.efficiency.toFixed(1) }}/hr</div>
                <div *ngIf="slot.currentQueue" class="text-blue-400">
                  Queue: {{ getQueueName(slot.currentQueue) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Gantt Chart / Queue Board -->
        <div class="bg-black/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
            📊 Task Queues - Gantt View
          </h2>

          <div *ngIf="queues.length === 0" class="text-center py-12 text-gray-400">
            <div class="text-6xl mb-4">📋</div>
            <div class="text-xl mb-2">No Task Queues</div>
            <p class="mb-4">Load tasks from markdown files to create queues</p>
            <button
              (click)="loadTasksAndCreateQueues()"
              class="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg transition-all duration-300"
            >
              📁 Load Tasks & Create Queues
            </button>
          </div>

          <!-- Queue Cards -->
          <div *ngIf="queues.length > 0" class="space-y-4">
            <div 
              *ngFor="let queue of queues; trackBy: trackQueue"
              class="bg-slate-800/50 rounded-lg border transition-all duration-300"
              [class]="getQueueBorderClass(queue)"
            >
              <!-- Queue Header -->
              <div class="p-4 border-b border-slate-700">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="text-2xl">{{ getQueueIcon(queue) }}</div>
                    <div>
                      <h3 class="font-bold text-lg">{{ queue.name }}</h3>
                      <div class="text-sm text-gray-400">
                        {{ queue.remainingTasks.length }} remaining • 
                        {{ queue.completedTasks.length }} completed
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3">
                    <div class="text-right">
                      <div class="text-sm text-gray-400">Progress</div>
                      <div class="font-bold">{{ queue.progress.toFixed(0) }}%</div>
                    </div>
                    
                    <button
                      *ngIf="queue.status === 'running'"
                      (click)="pauseQueue(queue.id)"
                      class="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
                    >
                      ⏸️ Pause
                    </button>
                    
                    <button
                      *ngIf="queue.status === 'paused'"
                      (click)="resumeQueue(queue.id)"
                      class="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                    >
                      ▶️ Resume
                    </button>

                    <button
                      *ngIf="queue.status === 'running'"
                      (click)="simulateTaskCompletion(queue.id)"
                      class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                    >
                      ✅ Complete Task
                    </button>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="mt-3">
                  <div class="bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      class="h-full transition-all duration-500 ease-out"
                      [class]="getProgressBarClass(queue)"
                      [style.width.%]="queue.progress"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Current Task (if running) -->
              <div *ngIf="queue.currentTask" class="p-4 bg-blue-900/30 border-b border-slate-700">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-blue-400 font-bold">🔄 Currently Working On:</span>
                  <span class="bg-blue-900 px-2 py-1 rounded text-xs">
                    {{ queue.currentTask.priority.toUpperCase() }}
                  </span>
                </div>
                <div class="font-medium">{{ queue.currentTask.title }}</div>
                <div class="text-sm text-gray-400 mt-1">{{ queue.currentTask.description }}</div>
                <div *ngIf="queue.estimatedCompletion" class="text-xs text-blue-300 mt-2">
                  ETA: {{ queue.estimatedCompletion | date:'short' }}
                </div>
              </div>

              <!-- Task List (Collapsible) -->
              <div class="p-4">
                <button 
                  (click)="toggleQueueExpansion(queue.id)"
                  class="w-full text-left flex items-center justify-between mb-3"
                >
                  <span class="font-medium">
                    Upcoming Tasks ({{ queue.remainingTasks.length }})
                  </span>
                  <span>{{ isQueueExpanded(queue.id) ? '🔽' : '▶️' }}</span>
                </button>

                <div *ngIf="isQueueExpanded(queue.id)" class="space-y-2 max-h-64 overflow-y-auto">
                  <div 
                    *ngFor="let task of queue.remainingTasks.slice(0, 10); let i = index"
                    class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
                    [class]="i === 0 ? 'border-l-4 border-blue-500' : ''"
                  >
                    <div class="text-2xl">{{ i + 1 }}</div>
                    <div class="flex-1">
                      <div class="font-medium">{{ task.title }}</div>
                      <div class="text-sm text-gray-400">
                        {{ task.priority.toUpperCase() }} • 
                        {{ task.estimatedHours || 1 }}h estimated
                      </div>
                    </div>
                    <div class="text-xs bg-purple-900 px-2 py-1 rounded">
                      {{ task.category }}
                    </div>
                  </div>
                  
                  <div *ngIf="queue.remainingTasks.length > 10" class="text-center text-gray-400 text-sm py-2">
                    ... and {{ queue.remainingTasks.length - 10 }} more tasks
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class QueueManagerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  queues: TaskQueue[] = [];
  agentSlots: AgentSlot[] = [];
  isRunning = false;
  maxConcurrentAgents = 3;
  tasksLoaded = false;
  stats: any = {
    totalTasks: 0,
    completedTasks: 0,
    progressPercentage: 0
  };

  private expandedQueues = new Set<string>();

  constructor(
    private queueManager: QueueManagerService,
    private markdownSync: MarkdownSyncService
  ) {}

  ngOnInit() {
    // Subscribe to queue updates
    combineLatest([
      this.queueManager.queues$,
      this.queueManager.agentSlots$,
      this.queueManager.isRunning$
    ]).pipe(takeUntil(this.destroy$))
    .subscribe(([queues, slots, running]) => {
      this.queues = queues;
      this.agentSlots = slots;
      this.isRunning = running;
      this.stats = this.queueManager.getExecutionStats();
    });

    // Check if tasks are already loaded
    this.markdownSync.tasks$.pipe(takeUntil(this.destroy$))
    .subscribe(tasks => {
      this.tasksLoaded = tasks.length > 0;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Load tasks and create queues
  async loadTasksAndCreateQueues() {
    try {
      await this.markdownSync.startSync();
      const tasks = this.markdownSync.getCurrentTasks();
      this.queueManager.createQueuesFromTasks(tasks);
      console.log('✅ Tasks loaded and queues created');
    } catch (error) {
      console.error('❌ Failed to load tasks:', error);
    }
  }

  // Initialize tasks (refresh)
  async initializeTasks() {
    const tasks = this.markdownSync.getCurrentTasks();
    if (tasks.length > 0) {
      this.queueManager.createQueuesFromTasks(tasks);
    } else {
      await this.loadTasksAndCreateQueues();
    }
  }

  // Toggle execution
  toggleExecution() {
    if (this.isRunning) {
      this.queueManager.stopExecution();
    } else {
      this.queueManager.startExecution();
    }
  }

  // Concurrency controls
  increaseConcurrency() {
    this.maxConcurrentAgents = Math.min(9, this.maxConcurrentAgents + 1);
    this.queueManager.setMaxConcurrentAgents(this.maxConcurrentAgents);
  }

  decreaseConcurrency() {
    this.maxConcurrentAgents = Math.max(1, this.maxConcurrentAgents - 1);
    this.queueManager.setMaxConcurrentAgents(this.maxConcurrentAgents);
  }

  // Queue controls
  pauseQueue(queueId: string) {
    this.queueManager.pauseQueue(queueId);
  }

  resumeQueue(queueId: string) {
    this.queueManager.resumeQueue(queueId);
  }

  simulateTaskCompletion(queueId: string) {
    this.queueManager.simulateTaskCompletion(queueId);
  }

  // UI helpers
  toggleQueueExpansion(queueId: string) {
    if (this.expandedQueues.has(queueId)) {
      this.expandedQueues.delete(queueId);
    } else {
      this.expandedQueues.add(queueId);
    }
  }

  isQueueExpanded(queueId: string): boolean {
    return this.expandedQueues.has(queueId);
  }

  trackQueue(index: number, queue: TaskQueue): string {
    return queue.id;
  }

  getQueueIcon(queue: TaskQueue): string {
    const icons: { [key: string]: string } = {
      idle: '⚪',
      running: '🔄',
      paused: '⏸️',
      completed: '✅',
      error: '❌'
    };
    return icons[queue.status] || '⚪';
  }

  getQueueBorderClass(queue: TaskQueue): string {
    const classes: { [key: string]: string } = {
      idle: 'border-gray-600',
      running: 'border-blue-500 shadow-lg shadow-blue-500/20',
      paused: 'border-yellow-500 shadow-lg shadow-yellow-500/20',
      completed: 'border-green-500 shadow-lg shadow-green-500/20',
      error: 'border-red-500 shadow-lg shadow-red-500/20'
    };
    return classes[queue.status] || 'border-gray-600';
  }

  getProgressBarClass(queue: TaskQueue): string {
    const classes: { [key: string]: string } = {
      idle: 'bg-gray-500',
      running: 'bg-gradient-to-r from-blue-500 to-purple-500',
      paused: 'bg-yellow-500',
      completed: 'bg-green-500',
      error: 'bg-red-500'
    };
    return classes[queue.status] || 'bg-gray-500';
  }

  getSlotBorderClass(slot: AgentSlot): string {
    const classes: { [key: string]: string } = {
      available: 'border-green-500',
      busy: 'border-blue-500',
      offline: 'border-gray-500'
    };
    return classes[slot.status] || 'border-gray-500';
  }

  getSlotStatusClass(slot: AgentSlot): string {
    const classes: { [key: string]: string } = {
      available: 'text-green-400',
      busy: 'text-blue-400',
      offline: 'text-gray-400'
    };
    return classes[slot.status] || 'text-gray-400';
  }

  getSlotStatusText(slot: AgentSlot): string {
    const texts: { [key: string]: string } = {
      available: '🟢 Available',
      busy: '🔵 Busy',
      offline: '⚪ Offline'
    };
    return texts[slot.status] || 'Unknown';
  }

  getQueueName(queueId: string): string {
    const queue = this.queues.find(q => q.id === queueId);
    return queue ? queue.name : 'Unknown';
  }

  // Export to Claude script
  exportToClaudeScript() {
    const script = this.generateClaudeScript();
    this.downloadScript(script);
  }

  private generateClaudeScript(): string {
    const priorityQueues = this.queues
      .filter(q => q.remainingTasks.length > 0)
      .sort((a, b) => {
        const aScore = a.remainingTasks.reduce((sum, task) => {
          const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
          return sum + (priorityScores[task.priority] || 2);
        }, 0);
        const bScore = b.remainingTasks.reduce((sum, task) => {
          const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
          return sum + (priorityScores[task.priority] || 2);
        }, 0);
        return bScore - aScore;
      });

    let script = `# 🤖 Claude Task Execution Script
# Generated on ${new Date().toISOString()}
# Total Queues: ${priorityQueues.length}
# Max Concurrent Agents: ${this.maxConcurrentAgents}

## Execution Plan

`;

    priorityQueues.forEach((queue, index) => {
      script += `### Queue ${index + 1}: ${queue.name}
**Agent**: ${queue.agent}
**Tasks Remaining**: ${queue.remainingTasks.length}
**Priority Score**: ${this.calculateQueuePriority(queue)}

#### Task List:
`;
      
      queue.remainingTasks.slice(0, 10).forEach((task, taskIndex) => {
        script += `${taskIndex + 1}. **${task.title}** (${task.priority.toUpperCase()})
   - Description: ${task.description}
   - Category: ${task.category}
   - Estimated: ${task.estimatedHours || 1}h
   - File: ${task.mdFile}:${task.lineNumber}

`;
      });

      if (queue.remainingTasks.length > 10) {
        script += `   ... and ${queue.remainingTasks.length - 10} more tasks\n\n`;
      }
    });

    script += `## Execution Commands

To start automated execution:
\`\`\`bash
# Navigate to project directory
cd /Users/travz/Documents/Work/habiti/habiti

# Start development server
npm start

# Open queue manager
open http://localhost:4200/secret-task-manager-queue
\`\`\`

## Task Completion Protocol

1. Mark completed tasks with [x] in markdown files
2. System will auto-detect changes within 2 seconds
3. Use approval interface for human oversight
4. Git commits generated automatically on approval

## Priority Execution Order:
${priorityQueues.map((q, i) => `${i + 1}. ${q.name} (${q.remainingTasks.length} tasks)`).join('\n')}
`;

    return script;
  }

  private calculateQueuePriority(queue: TaskQueue): number {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    return queue.remainingTasks.reduce((sum, task) => {
      return sum + (priorityScores[task.priority] || 2);
    }, 0);
  }

  private downloadScript(content: string) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-execution-script-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log('📜 Claude execution script downloaded');
  }
}