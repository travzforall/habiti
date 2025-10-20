import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BaserowService } from './baserow.service';

export interface MarkdownTask {
  id: string;
  title: string;
  description: string;
  category: string;
  agent: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  phase: string;
  completed: boolean;
  approved: boolean;
  notes?: string;
  estimatedHours?: number;
  tags: string[];
  lastModified: Date;
  source: 'md' | 'app';
  mdFile: string;
  lineNumber?: number;
}

export interface FileChangeEvent {
  fileName: string;
  fullPath: string;
  changeType: 'modified' | 'created' | 'deleted';
  timestamp: Date;
  tasksChanged: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarkdownSyncService {
  private tasksSubject = new BehaviorSubject<MarkdownTask[]>([]);
  private fileChangesSubject = new BehaviorSubject<FileChangeEvent[]>([]);
  private isWatchingSubject = new BehaviorSubject<boolean>(false);
  
  public tasks$ = this.tasksSubject.asObservable();
  public fileChanges$ = this.fileChangesSubject.asObservable();
  public isWatching$ = this.isWatchingSubject.asObservable();

  private watchInterval: any;
  private lastFileHashes: Map<string, string> = new Map();
  private syncEnabled = true;

  constructor(
    private http: HttpClient,
    private baserowService: BaserowService
  ) {
    // Remove auto-loading - now requires manual start
  }

  // Manual start method that loads tasks and begins watching
  async startSync(): Promise<void> {
    console.log('🚀 Starting markdown sync system...');
    await this.loadInitialTasks();
    this.startWatching();
    console.log('✅ Markdown sync system ready');
  }

  // Start watching for file changes
  startWatching(): void {
    if (this.isWatchingSubject.value) return;

    this.isWatchingSubject.next(true);
    
    // Use polling to watch for file changes every 2 seconds
    this.watchInterval = interval(2000).subscribe(() => {
      this.checkForFileChanges();
    });

    console.log('📁 Started watching markdown files for changes (polling mode)...');
  }

  // Stop watching for file changes
  stopWatching(): void {
    if (this.watchInterval) {
      this.watchInterval.unsubscribe();
      this.watchInterval = null;
    }
    
    this.isWatchingSubject.next(false);
    console.log('📁 Stopped watching markdown files');
  }

  // Toggle sync functionality
  toggleSync(enabled: boolean): void {
    this.syncEnabled = enabled;
    console.log(`📁 Markdown sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Load all markdown files and parse tasks
  private async loadInitialTasks(): Promise<void> {
    const taskFiles = [
      'analytics.md',
      'calendar.md', 
      'dashboard.md',
      'gamification.md',
      'habits.md',
      'planner.md',
      'pomodoro.md',
      'project-management.md',
      'calendar-features.md',
      'misc.md'
    ];

    const allTasks: MarkdownTask[] = [];

    for (const fileName of taskFiles) {
      try {
        const tasks = await this.parseMarkdownFile(fileName);
        allTasks.push(...tasks);
        
        // Calculate initial file hash for change detection
        const content = await this.fetchFileContent(fileName);
        this.lastFileHashes.set(fileName, await this.calculateHash(content));
      } catch (error) {
        console.warn(`Failed to load ${fileName}:`, error);
      }
    }

    this.tasksSubject.next(allTasks);
    console.log(`📄 Loaded ${allTasks.length} tasks from ${taskFiles.length} markdown files`);
  }

  // Check for file changes
  private async checkForFileChanges(): Promise<void> {
    if (!this.syncEnabled) return;

    const taskFiles = Array.from(this.lastFileHashes.keys());
    const changes: FileChangeEvent[] = [];

    for (const fileName of taskFiles) {
      try {
        const content = await this.fetchFileContent(fileName);
        const currentHash = await this.calculateHash(content);
        const lastHash = this.lastFileHashes.get(fileName);

        if (currentHash !== lastHash) {
          console.log(`📝 Detected changes in ${fileName}`);
          
          const newTasks = await this.parseMarkdownFile(fileName);
          const changeEvent: FileChangeEvent = {
            fileName,
            fullPath: `/tasks/${fileName}`,
            changeType: 'modified',
            timestamp: new Date(),
            tasksChanged: newTasks.length
          };

          changes.push(changeEvent);
          this.lastFileHashes.set(fileName, currentHash);
          
          // Update tasks in memory
          await this.updateTasksFromFile(fileName, newTasks);
        }
      } catch (error) {
        console.error(`Error checking ${fileName}:`, error);
      }
    }

    if (changes.length > 0) {
      const currentChanges = this.fileChangesSubject.value;
      this.fileChangesSubject.next([...changes, ...currentChanges.slice(0, 9)]); // Keep last 10 changes
      
      // Sync changes to database
      await this.syncChangesToDatabase(changes);
    }
  }

  // Fetch file content from Angular assets
  private async fetchFileContent(fileName: string): Promise<string> {
    try {
      const response = await fetch(`/assets/tasks/${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${fileName}: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      throw new Error(`Unable to access markdown file: ${fileName}. 
        
Make sure the file exists in src/assets/tasks/ directory.
Current working directory should have: src/assets/tasks/${fileName}`);
    }
  }

  // Calculate file hash for change detection
  private async calculateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Parse markdown file into tasks
  private async parseMarkdownFile(fileName: string): Promise<MarkdownTask[]> {
    const content = await this.fetchFileContent(fileName);
    const lines = content.split('\n');
    const tasks: MarkdownTask[] = [];
    
    let currentAgent = '';
    let currentCategory = this.extractCategoryFromFilename(fileName);
    let currentLineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentLineNumber = i + 1;

      // Parse agent sections (### 🎨 **UI-Designer**)
      if (line.startsWith('### ')) {
        const agentMatch = line.match(/\*\*([^*]+)\*\*/);
        if (agentMatch) {
          currentAgent = agentMatch[1].trim();
        }
      }

      // Parse task items (- [ ] or - [x])
      if (line.match(/^- \[[ x]\]/)) {
        const completed = line.includes('[x]');
        const taskText = line.replace(/^- \[[ x]\]\s*/, '').trim();
        
        if (taskText) {
          const task = this.parseTaskLine(taskText, {
            category: currentCategory,
            agent: currentAgent,
            mdFile: fileName,
            lineNumber: currentLineNumber,
            completed
          });
          
          tasks.push(task);
        }
      }
      
      // Parse bullet point tasks without checkboxes
      else if (line.startsWith('- ') && !line.includes('[')) {
        const taskText = line.substring(2).trim();
        
        if (taskText && currentAgent && this.looksLikeTask(taskText)) {
          const task = this.parseTaskLine(taskText, {
            category: currentCategory,
            agent: currentAgent,
            mdFile: fileName,
            lineNumber: currentLineNumber,
            completed: false
          });
          
          tasks.push(task);
        }
      }
    }

    return tasks;
  }

  // Parse individual task line
  private parseTaskLine(taskText: string, context: any): MarkdownTask {
    // Extract priority
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (taskText.toLowerCase().includes('critical')) priority = 'critical';
    else if (taskText.toLowerCase().includes('high priority') || taskText.toLowerCase().includes('urgent')) priority = 'high';
    else if (taskText.toLowerCase().includes('low priority')) priority = 'low';

    // Extract estimated hours
    let estimatedHours: number | undefined;
    const hoursMatch = taskText.match(/~(\d+(?:\.\d+)?)\s*h/i);
    const minsMatch = taskText.match(/~(\d+)\s*min/i);
    if (hoursMatch) {
      estimatedHours = parseFloat(hoursMatch[1]);
    } else if (minsMatch) {
      estimatedHours = parseInt(minsMatch[1]) / 60;
    }

    // Extract tags
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
    const cleanText = taskText
      .replace(/~\d+(?:\.\d+)?\s*h/gi, '')
      .replace(/~\d+\s*min/gi, '')
      .replace(/\(.*?\)/g, '') // Remove parenthetical notes
      .replace(/\s+/g, ' ')
      .trim();

    // Generate unique ID
    const id = this.generateTaskId(cleanText, context.category, context.agent);

    return {
      id,
      title: this.extractTitle(cleanText),
      description: cleanText,
      category: context.category,
      agent: context.agent,
      priority,
      phase: this.determinePhase(context.agent),
      completed: context.completed || false,
      approved: false, // Never auto-approve
      estimatedHours,
      tags: tags.length > 0 ? tags : ['feature'],
      lastModified: new Date(),
      source: 'md',
      mdFile: context.mdFile,
      lineNumber: context.lineNumber
    };
  }

  // Helper methods
  private extractCategoryFromFilename(fileName: string): string {
    return fileName
      .replace('.md', '')
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private looksLikeTask(text: string): boolean {
    const taskKeywords = ['implement', 'build', 'create', 'design', 'develop', 'add', 'fix', 'optimize', 'test'];
    const lowerText = text.toLowerCase();
    return taskKeywords.some(keyword => lowerText.includes(keyword)) && text.length > 10;
  }

  private extractTitle(text: string): string {
    // Take first sentence or first 60 characters
    const sentences = text.split(/[.!?]/);
    const firstSentence = sentences[0].trim();
    return firstSentence.length > 60 ? firstSentence.substring(0, 57) + '...' : firstSentence;
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
      'Whimsy-Injector': 'Enhancement',
      'Analytics-Reporter': 'Analysis'
    };
    return phaseMap[agent] || 'Planning';
  }

  private generateTaskId(text: string, category: string, agent: string): string {
    const hash = text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
    const catPrefix = category.toLowerCase().replace(/\s+/g, '').substring(0, 3);
    const agentPrefix = agent.toLowerCase().replace(/[^a-z]/g, '').substring(0, 2);
    return `${catPrefix}-${agentPrefix}-${hash}`;
  }

  // Update tasks from a specific file
  private async updateTasksFromFile(fileName: string, newTasks: MarkdownTask[]): Promise<void> {
    const currentTasks = this.tasksSubject.value;
    
    // Remove tasks from this file
    const tasksFromOtherFiles = currentTasks.filter(task => task.mdFile !== fileName);
    
    // Add new tasks
    const updatedTasks = [...tasksFromOtherFiles, ...newTasks];
    
    this.tasksSubject.next(updatedTasks);
    console.log(`📄 Updated ${newTasks.length} tasks from ${fileName}`);
  }

  // Sync changes to database
  private async syncChangesToDatabase(changes: FileChangeEvent[]): Promise<void> {
    if (!this.syncEnabled) return;

    for (const change of changes) {
      try {
        const tasks = this.tasksSubject.value.filter(t => t.mdFile === change.fileName);
        
        // Here we would sync to Baserow, but only create records, not update status
        // The approval workflow will handle status updates
        console.log(`🔄 Syncing ${tasks.length} tasks from ${change.fileName} to database`);
        
        // For now, log what we would sync
        tasks.forEach(task => {
          console.log(`  - ${task.title} (${task.agent})`);
        });
        
      } catch (error) {
        console.error(`Failed to sync ${change.fileName} to database:`, error);
      }
    }
  }

  // Public methods for external use
  public getCurrentTasks(): MarkdownTask[] {
    return this.tasksSubject.value;
  }

  public getTasksByCategory(category: string): MarkdownTask[] {
    return this.tasksSubject.value.filter(task => task.category === category);
  }

  public getTasksByAgent(agent: string): MarkdownTask[] {
    return this.tasksSubject.value.filter(task => task.agent === agent);
  }

  public getRecentChanges(limit: number = 5): FileChangeEvent[] {
    return this.fileChangesSubject.value.slice(0, limit);
  }

  // Export tasks for approval workflow
  public exportTasksForApproval(): any[] {
    return this.tasksSubject.value.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      agent: task.agent,
      priority: task.priority,
      phase: task.phase,
      completed: task.completed,
      approved: task.approved,
      notes: task.notes,
      lastModified: task.lastModified,
      source: 'markdown',
      mdFile: task.mdFile,
      lineNumber: task.lineNumber
    }));
  }

  // Manual sync trigger
  public async forceSyncAll(): Promise<void> {
    console.log('🔄 Force syncing all markdown files...');
    await this.loadInitialTasks();
    
    const allTasks = this.getCurrentTasks();
    console.log(`📊 Force sync complete: ${allTasks.length} tasks loaded`);
  }
}