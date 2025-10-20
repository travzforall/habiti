import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { BaserowService } from './baserow.service';
import { MarkdownSyncService, MarkdownTask } from './markdown-sync.service';
import { HttpClient } from '@angular/common/http';

export interface FeatureGroup {
  id: string;
  name: string;
  description: string;
  tasks: ApprovalTask[];
  completedTasks: number;
  approvedTasks: number;
  totalTasks: number;
  approved: boolean;
  notes: string;
  approvalDate?: Date;
  approver?: string;
}

export interface ApprovalTask {
  id: string;
  title: string;
  description: string;
  category: string;
  agent: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase: string;
  completed: boolean;
  approved: boolean;
  notes: string;
  lastModified: Date;
  source: 'md' | 'app' | 'db';
  needsApproval: boolean;
  conflicts: string[];
  mdFile?: string;
  lineNumber?: number;
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ApprovalWorkflowService {
  private featureGroupsSubject = new BehaviorSubject<FeatureGroup[]>([]);
  private pendingApprovalsSubject = new BehaviorSubject<ApprovalTask[]>([]);
  private gitCommitsSubject = new BehaviorSubject<GitCommitInfo[]>([]);

  public featureGroups$ = this.featureGroupsSubject.asObservable();
  public pendingApprovals$ = this.pendingApprovalsSubject.asObservable();
  public gitCommits$ = this.gitCommitsSubject.asObservable();

  constructor(
    private baserowService: BaserowService,
    private markdownSync: MarkdownSyncService,
    private http: HttpClient
  ) {
    this.initializeWorkflow();
  }

  private async initializeWorkflow(): Promise<void> {
    // Load existing approvals from localStorage
    this.loadApprovalState();
    
    // Subscribe to markdown changes
    this.markdownSync.tasks$.subscribe(tasks => {
      this.processTaskChanges(tasks);
    });

    // Start file watching
    this.markdownSync.startWatching();
  }

  // Process incoming task changes from markdown files
  private processTaskChanges(markdownTasks: MarkdownTask[]): void {
    const currentGroups = this.featureGroupsSubject.value;
    const newGroups: FeatureGroup[] = [];

    // Group tasks by category
    const tasksByCategory = this.groupTasksByCategory(markdownTasks);

    Object.entries(tasksByCategory).forEach(([category, tasks]) => {
      const existingGroup = currentGroups.find(g => g.name === category);
      
      const approvalTasks: ApprovalTask[] = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        agent: task.agent,
        priority: task.priority,
        phase: task.phase,
        completed: task.completed,
        approved: existingGroup?.approved ? true : false, // Preserve approval state
        notes: task.notes || '',
        lastModified: task.lastModified,
        source: task.source,
        needsApproval: this.determineNeedsApproval(task, existingGroup),
        conflicts: this.detectConflicts(task, existingGroup),
        mdFile: task.mdFile,
        lineNumber: task.lineNumber
      }));

      const featureGroup: FeatureGroup = {
        id: this.generateGroupId(category),
        name: category,
        description: this.generateGroupDescription(category),
        tasks: approvalTasks,
        completedTasks: approvalTasks.filter(t => t.completed).length,
        approvedTasks: approvalTasks.filter(t => t.approved).length,
        totalTasks: approvalTasks.length,
        approved: existingGroup?.approved || false,
        notes: existingGroup?.notes || '',
        approvalDate: existingGroup?.approvalDate,
        approver: existingGroup?.approver
      };

      newGroups.push(featureGroup);
    });

    this.featureGroupsSubject.next(newGroups);
    this.updatePendingApprovals();
    this.saveApprovalState();
  }

  // Determine if a task needs approval
  private determineNeedsApproval(task: MarkdownTask, existingGroup?: FeatureGroup): boolean {
    if (!task.completed) return false;
    
    // If task is new or changed
    const existingTask = existingGroup?.tasks.find(t => t.id === task.id);
    if (!existingTask) return true;
    
    // If task content changed
    if (existingTask.title !== task.title || existingTask.description !== task.description) {
      return true;
    }
    
    return false;
  }

  // Detect conflicts between MD and existing data
  private detectConflicts(task: MarkdownTask, existingGroup?: FeatureGroup): string[] {
    const conflicts: string[] = [];
    
    const existingTask = existingGroup?.tasks.find(t => t.id === task.id);
    if (!existingTask) return conflicts;

    if (existingTask.title !== task.title) {
      conflicts.push(`Title changed: "${existingTask.title}" -> "${task.title}"`);
    }
    
    if (existingTask.agent !== task.agent) {
      conflicts.push(`Agent changed: ${existingTask.agent} -> ${task.agent}`);
    }
    
    if (existingTask.priority !== task.priority) {
      conflicts.push(`Priority changed: ${existingTask.priority} -> ${task.priority}`);
    }

    return conflicts;
  }

  // Group tasks by category
  private groupTasksByCategory(tasks: MarkdownTask[]): { [category: string]: MarkdownTask[] } {
    return tasks.reduce((groups, task) => {
      if (!groups[task.category]) {
        groups[task.category] = [];
      }
      groups[task.category].push(task);
      return groups;
    }, {} as { [category: string]: MarkdownTask[] });
  }

  // Update pending approvals list
  private updatePendingApprovals(): void {
    const allTasks = this.featureGroupsSubject.value.flatMap(group => group.tasks);
    const pending = allTasks.filter(task => task.needsApproval || (task.completed && !task.approved));
    this.pendingApprovalsSubject.next(pending);
  }

  // Approve a feature group
  public async approveFeatureGroup(groupId: string, notes?: string): Promise<void> {
    const groups = this.featureGroupsSubject.value;
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      throw new Error(`Feature group ${groupId} not found`);
    }

    const group = groups[groupIndex];
    
    // Mark all completed tasks as approved
    group.tasks.forEach(task => {
      if (task.completed && !task.approved) {
        task.approved = true;
        task.needsApproval = false;
      }
    });

    // Update group approval
    group.approved = true;
    group.notes = notes || '';
    group.approvalDate = new Date();
    group.approver = 'Task Manager'; // Could be dynamic
    group.approvedTasks = group.tasks.filter(t => t.approved).length;

    // Update subjects
    groups[groupIndex] = group;
    this.featureGroupsSubject.next([...groups]);
    this.updatePendingApprovals();
    
    // Sync to database
    await this.syncApprovalToDatabase(group);
    
    // Create git commit if all tasks approved
    if (group.completedTasks === group.approvedTasks) {
      await this.createApprovalCommit(group);
    }
    
    this.saveApprovalState();
  }

  // Disapprove a feature group
  public async disapproveFeatureGroup(groupId: string, notes: string): Promise<void> {
    const groups = this.featureGroupsSubject.value;
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) {
      throw new Error(`Feature group ${groupId} not found`);
    }

    const group = groups[groupIndex];
    
    // Mark all tasks as needing work
    group.tasks.forEach(task => {
      if (task.completed) {
        task.approved = false;
        task.needsApproval = true;
        task.notes = notes;
      }
    });

    // Update group
    group.approved = false;
    group.notes = notes;
    group.approvedTasks = 0;

    groups[groupIndex] = group;
    this.featureGroupsSubject.next([...groups]);
    this.updatePendingApprovals();
    
    // Sync to database
    await this.syncApprovalToDatabase(group);
    
    this.saveApprovalState();
  }

  // Approve individual task
  public async approveTask(taskId: string, notes?: string): Promise<void> {
    const groups = this.featureGroupsSubject.value;
    
    for (const group of groups) {
      const taskIndex = group.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const task = group.tasks[taskIndex];
        task.approved = true;
        task.needsApproval = false;
        if (notes) task.notes = notes;
        
        group.approvedTasks = group.tasks.filter(t => t.approved).length;
        
        this.featureGroupsSubject.next([...groups]);
        this.updatePendingApprovals();
        
        // Sync individual task to database
        await this.syncTaskToDatabase(task);
        
        this.saveApprovalState();
        break;
      }
    }
  }

  // Sync approval to database
  private async syncApprovalToDatabase(group: FeatureGroup): Promise<void> {
    try {
      // Update all tasks in the group
      const updatePromises = group.tasks
        .filter(task => task.completed)
        .map(task => this.syncTaskToDatabase(task));
      
      await Promise.all(updatePromises);
      
      // Create approval record
      const approvalRecord = {
        task_id: `GROUP_${group.id}`,
        task_title: `Feature Group: ${group.name}`,
        category: group.name,
        agent: 'Task Manager',
        action: group.approved ? 'approved' : 'disapproved',
        notes: group.notes,
        priority: 'medium',
        phase: 'Approval',
        timestamp: new Date().toISOString(),
        status: group.approved ? 'approved' : 'needs_work'
      };

      this.baserowService.createTaskUpdate(approvalRecord).subscribe({
        next: (result) => console.log('Approval synced to database:', result),
        error: (error) => console.error('Failed to sync approval:', error)
      });
      
    } catch (error) {
      console.error('Failed to sync approval to database:', error);
    }
  }

  // Sync individual task to database  
  private async syncTaskToDatabase(task: ApprovalTask): Promise<void> {
    const taskUpdate = {
      task_id: task.id,
      task_title: task.title,
      category: task.category,
      agent: task.agent,
      action: task.approved ? 'approved' : (task.completed ? 'completed' : 'updated'),
      notes: task.notes,
      priority: task.priority,
      phase: task.phase,
      timestamp: new Date().toISOString(),
      status: task.approved ? 'approved' : (task.completed ? 'completed' : 'pending')
    };

    this.baserowService.createTaskUpdate(taskUpdate).subscribe({
      next: (result) => console.log(`Task ${task.id} synced to database`),
      error: (error) => console.error(`Failed to sync task ${task.id}:`, error)
    });
  }

  // Create git commit for approved changes
  private async createApprovalCommit(group: FeatureGroup): Promise<void> {
    try {
      const commitMessage = `feat: implement ${group.name} features

Approved ${group.approvedTasks}/${group.totalTasks} tasks:
${group.tasks
  .filter(t => t.approved)
  .map(t => `- ${t.title} (${t.agent})`)
  .join('\n')}

✅ Approved via Task Manager
${group.notes ? `\nNotes: ${group.notes}` : ''}

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;

      // This would need to be implemented with actual git commands
      // For now, just log what would be committed
      console.log('🔄 Would create commit:', commitMessage);
      
      const commitInfo: GitCommitInfo = {
        hash: 'pending_' + Date.now(),
        message: commitMessage,
        author: 'Task Manager',
        date: new Date(),
        filesChanged: [...new Set(group.tasks.map(t => t.mdFile).filter(Boolean))] as string[]
      };

      const commits = this.gitCommitsSubject.value;
      this.gitCommitsSubject.next([commitInfo, ...commits.slice(0, 9)]); // Keep last 10 commits
      
    } catch (error) {
      console.error('Failed to create approval commit:', error);
    }
  }

  // Helper methods
  private generateGroupId(category: string): string {
    return category.toLowerCase().replace(/\s+/g, '_');
  }

  private generateGroupDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'Analytics Features': 'Data visualization, reporting, and insights system',
      'Calendar Features': 'Calendar integration and scheduling functionality',
      'Dashboard Features': 'Main dashboard interface and habit tracking',
      'Gamification System': 'Points, achievements, and game mechanics',
      'Habits Management': 'Habit creation, tracking, and management',
      'Planning System': 'Multi-level planning and organization tools',
      'Pomodoro System': 'Focus timer and productivity features',
      'Project Management': 'Goals, tasks, and project organization'
    };
    
    return descriptions[category] || `Features related to ${category}`;
  }

  // Persistence
  private saveApprovalState(): void {
    const state = {
      featureGroups: this.featureGroupsSubject.value,
      lastUpdated: new Date().toISOString()
    };
    
    localStorage.setItem('approvalWorkflowState', JSON.stringify(state));
  }

  private loadApprovalState(): void {
    const saved = localStorage.getItem('approvalWorkflowState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        this.featureGroupsSubject.next(state.featureGroups || []);
        this.updatePendingApprovals();
      } catch (error) {
        console.warn('Failed to load approval state:', error);
      }
    }
  }

  // Public getters
  public getFeatureGroups(): FeatureGroup[] {
    return this.featureGroupsSubject.value;
  }

  public getPendingApprovals(): ApprovalTask[] {
    return this.pendingApprovalsSubject.value;
  }

  public getApprovalStats(): { total: number, approved: number, pending: number } {
    const groups = this.featureGroupsSubject.value;
    return {
      total: groups.length,
      approved: groups.filter(g => g.approved).length,
      pending: groups.filter(g => !g.approved && g.completedTasks > 0).length
    };
  }

  // Force sync all data
  public async forceSyncAll(): Promise<void> {
    console.log('🔄 Force syncing all approval data...');
    
    // Reload markdown tasks
    await this.markdownSync.forceSyncAll();
    
    // Reprocess everything
    const tasks = this.markdownSync.getCurrentTasks();
    this.processTaskChanges(tasks);
    
    console.log('✅ Force sync complete');
  }
}