import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  filesChanged: string[];
  additions: number;
  deletions: number;
  branch: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  hasChanges: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  lastCommit?: GitCommit;
}

@Injectable({
  providedIn: 'root'
})
export class GitIntegrationService {
  private gitStatusSubject = new BehaviorSubject<GitStatus | null>(null);
  private commitsSubject = new BehaviorSubject<GitCommit[]>([]);
  private branchesSubject = new BehaviorSubject<GitBranch[]>([]);
  private isRepositorySubject = new BehaviorSubject<boolean>(false);

  public gitStatus$ = this.gitStatusSubject.asObservable();
  public commits$ = this.commitsSubject.asObservable();
  public branches$ = this.branchesSubject.asObservable();
  public isRepository$ = this.isRepositorySubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeGitCheck();
  }

  private async initializeGitCheck(): Promise<void> {
    try {
      // Check if we're in a git repository
      const isRepo = await this.checkIfGitRepository();
      this.isRepositorySubject.next(isRepo);
      
      if (isRepo) {
        await this.refreshAll();
      }
    } catch (error) {
      console.warn('Git not available or not in a repository:', error);
      this.isRepositorySubject.next(false);
    }
  }

  // Check if current directory is a git repository
  private async checkIfGitRepository(): Promise<boolean> {
    try {
      // This would need to be implemented with actual git commands
      // For demo purposes, we'll simulate this
      return true; // Assume we're in a git repo for demo
    } catch (error) {
      return false;
    }
  }

  // Get current git status
  public async getGitStatus(): Promise<GitStatus | null> {
    try {
      // Simulate git status command
      // In a real implementation, this would run: git status --porcelain -b
      const mockStatus: GitStatus = {
        branch: 'feature/task-approval-workflow',
        ahead: 0,
        behind: 0,
        staged: [],
        modified: ['tasks/dashboard.md', 'tasks/analytics.md'],
        untracked: ['src/app/services/markdown-sync.service.ts'],
        hasChanges: true
      };

      this.gitStatusSubject.next(mockStatus);
      return mockStatus;
    } catch (error) {
      console.error('Failed to get git status:', error);
      return null;
    }
  }

  // Get recent commits
  public async getRecentCommits(limit: number = 10): Promise<GitCommit[]> {
    try {
      // Simulate git log command
      // In real implementation: git log --oneline --format=... -n ${limit}
      const mockCommits: GitCommit[] = [
        {
          hash: 'a1b2c3d4e5f6',
          message: 'feat: implement markdown sync service',
          author: 'Task Manager',
          email: 'task@habiti.app',
          date: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
          filesChanged: ['src/app/services/markdown-sync.service.ts'],
          additions: 245,
          deletions: 0,
          branch: 'feature/task-approval-workflow'
        },
        {
          hash: 'f6e5d4c3b2a1',
          message: 'feat: add approval workflow service',
          author: 'Claude Code',
          email: 'claude@anthropic.com',
          date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          filesChanged: ['src/app/services/approval-workflow.service.ts'],
          additions: 483,
          deletions: 12,
          branch: 'feature/task-approval-workflow'
        }
      ];

      this.commitsSubject.next(mockCommits);
      return mockCommits;
    } catch (error) {
      console.error('Failed to get recent commits:', error);
      return [];
    }
  }

  // Get all branches
  public async getBranches(): Promise<GitBranch[]> {
    try {
      // Simulate git branch -a command
      const mockBranches: GitBranch[] = [
        {
          name: 'main',
          current: false,
          remote: 'origin/main',
          lastCommit: {
            hash: 'main123456',
            message: 'chore: update dependencies',
            author: 'Developer',
            email: 'dev@habiti.app',
            date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
            filesChanged: ['package.json', 'package-lock.json'],
            additions: 15,
            deletions: 8,
            branch: 'main'
          }
        },
        {
          name: 'feature/task-approval-workflow',
          current: true,
          remote: undefined,
          lastCommit: {
            hash: 'a1b2c3d4e5f6',
            message: 'feat: implement markdown sync service',
            author: 'Task Manager',
            email: 'task@habiti.app',
            date: new Date(Date.now() - 1000 * 60 * 30),
            filesChanged: ['src/app/services/markdown-sync.service.ts'],
            additions: 245,
            deletions: 0,
            branch: 'feature/task-approval-workflow'
          }
        }
      ];

      this.branchesSubject.next(mockBranches);
      return mockBranches;
    } catch (error) {
      console.error('Failed to get branches:', error);
      return [];
    }
  }

  // Create and commit changes
  public async createCommit(message: string, files: string[] = []): Promise<GitCommit | null> {
    try {
      // Stage files if specified
      if (files.length > 0) {
        await this.stageFiles(files);
      } else {
        await this.stageAllChanges();
      }

      // Create commit
      const commitHash = await this.executeCommit(message);
      
      if (commitHash) {
        const newCommit: GitCommit = {
          hash: commitHash,
          message: message,
          author: 'Task Manager',
          email: 'task@habiti.app',
          date: new Date(),
          filesChanged: files.length > 0 ? files : await this.getStagedFiles(),
          additions: 0, // Would be calculated by git
          deletions: 0,  // Would be calculated by git
          branch: await this.getCurrentBranch()
        };

        // Update commits list
        const currentCommits = this.commitsSubject.value;
        this.commitsSubject.next([newCommit, ...currentCommits.slice(0, 9)]);

        // Refresh git status
        await this.getGitStatus();

        return newCommit;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to create commit:', error);
      throw error;
    }
  }

  // Stage specific files
  private async stageFiles(files: string[]): Promise<void> {
    try {
      // Simulate git add command for each file
      console.log('Staging files:', files);
      // In real implementation: git add ${files.join(' ')}
    } catch (error) {
      console.error('Failed to stage files:', error);
      throw error;
    }
  }

  // Stage all changes
  private async stageAllChanges(): Promise<void> {
    try {
      // Simulate git add .
      console.log('Staging all changes');
      // In real implementation: git add .
    } catch (error) {
      console.error('Failed to stage all changes:', error);
      throw error;
    }
  }

  // Execute git commit
  private async executeCommit(message: string): Promise<string | null> {
    try {
      // Simulate git commit command
      console.log('Creating commit with message:', message);
      // In real implementation: git commit -m "${message}"
      
      // Generate mock commit hash
      return 'c' + Math.random().toString(36).substring(2, 12);
    } catch (error) {
      console.error('Failed to execute commit:', error);
      return null;
    }
  }

  // Get currently staged files
  private async getStagedFiles(): Promise<string[]> {
    try {
      // Simulate git diff --cached --name-only
      const status = this.gitStatusSubject.value;
      return status?.staged || [];
    } catch (error) {
      console.error('Failed to get staged files:', error);
      return [];
    }
  }

  // Get current branch name
  private async getCurrentBranch(): Promise<string> {
    try {
      const branches = this.branchesSubject.value;
      const currentBranch = branches.find(b => b.current);
      return currentBranch?.name || 'main';
    } catch (error) {
      console.error('Failed to get current branch:', error);
      return 'main';
    }
  }

  // Create new branch
  public async createBranch(branchName: string, fromBranch?: string): Promise<boolean> {
    try {
      // Simulate git checkout -b branchName [fromBranch]
      console.log(`Creating new branch: ${branchName}${fromBranch ? ` from ${fromBranch}` : ''}`);
      
      const newBranch: GitBranch = {
        name: branchName,
        current: true,
        remote: undefined,
        lastCommit: undefined
      };

      // Update branches list
      const currentBranches = this.branchesSubject.value.map(b => ({ ...b, current: false }));
      this.branchesSubject.next([...currentBranches, newBranch]);

      return true;
    } catch (error) {
      console.error('Failed to create branch:', error);
      return false;
    }
  }

  // Switch to branch
  public async checkoutBranch(branchName: string): Promise<boolean> {
    try {
      // Simulate git checkout branchName
      console.log(`Switching to branch: ${branchName}`);
      
      const branches = this.branchesSubject.value.map(b => ({
        ...b,
        current: b.name === branchName
      }));
      
      this.branchesSubject.next(branches);
      
      // Refresh status after branch switch
      await this.getGitStatus();
      
      return true;
    } catch (error) {
      console.error('Failed to checkout branch:', error);
      return false;
    }
  }

  // Push changes to remote
  public async pushToRemote(branchName?: string, force: boolean = false): Promise<boolean> {
    try {
      const branch = branchName || await this.getCurrentBranch();
      const pushCommand = `git push${force ? ' --force' : ''} origin ${branch}`;
      
      console.log('Pushing to remote:', pushCommand);
      // In real implementation: execute the push command
      
      return true;
    } catch (error) {
      console.error('Failed to push to remote:', error);
      return false;
    }
  }

  // Pull changes from remote
  public async pullFromRemote(branchName?: string): Promise<boolean> {
    try {
      const branch = branchName || await this.getCurrentBranch();
      
      console.log(`Pulling from remote: git pull origin ${branch}`);
      // In real implementation: git pull origin ${branch}
      
      // Refresh everything after pull
      await this.refreshAll();
      
      return true;
    } catch (error) {
      console.error('Failed to pull from remote:', error);
      return false;
    }
  }

  // Create approval commit with standard format
  public async createApprovalCommit(
    featureGroupName: string, 
    approvedTasks: Array<{ title: string; agent: string }>,
    notes?: string
  ): Promise<GitCommit | null> {
    const taskList = approvedTasks
      .map(task => `- ${task.title} (${task.agent})`)
      .join('\n');

    const commitMessage = `feat: implement ${featureGroupName} features

Approved ${approvedTasks.length} tasks:
${taskList}

✅ Approved via Task Manager${notes ? `\nNotes: ${notes}` : ''}

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;

    // Get list of changed markdown files
    const status = await this.getGitStatus();
    const changedFiles = status?.modified.filter(f => f.endsWith('.md')) || [];

    return await this.createCommit(commitMessage, changedFiles);
  }

  // Merge approved changes to main
  public async mergeToMain(featureGroupName: string): Promise<boolean> {
    try {
      const currentBranch = await this.getCurrentBranch();
      
      // Switch to main
      await this.checkoutBranch('main');
      
      // Pull latest from main
      await this.pullFromRemote('main');
      
      // Merge feature branch
      console.log(`Merging ${currentBranch} into main`);
      // In real implementation: git merge ${currentBranch}
      
      // Create merge commit
      const mergeMessage = `Merge ${currentBranch}: ${featureGroupName} implementation complete

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>`;

      await this.createCommit(mergeMessage);
      
      // Push to remote
      await this.pushToRemote('main');
      
      return true;
    } catch (error) {
      console.error('Failed to merge to main:', error);
      return false;
    }
  }

  // Refresh all git data
  public async refreshAll(): Promise<void> {
    try {
      await Promise.all([
        this.getGitStatus(),
        this.getRecentCommits(),
        this.getBranches()
      ]);
    } catch (error) {
      console.error('Failed to refresh git data:', error);
    }
  }

  // Get file diff
  public async getFileDiff(filePath: string): Promise<string> {
    try {
      // Simulate git diff fileName
      console.log(`Getting diff for: ${filePath}`);
      // In real implementation: git diff ${filePath}
      
      return `Mock diff for ${filePath}\n+Added new task\n-Removed old task`;
    } catch (error) {
      console.error('Failed to get file diff:', error);
      return '';
    }
  }

  // Reset file changes
  public async resetFile(filePath: string): Promise<boolean> {
    try {
      // Simulate git checkout -- fileName
      console.log(`Resetting file: ${filePath}`);
      // In real implementation: git checkout -- ${filePath}
      
      await this.getGitStatus(); // Refresh status
      return true;
    } catch (error) {
      console.error('Failed to reset file:', error);
      return false;
    }
  }

  // Get commit history for a file
  public async getFileHistory(filePath: string, limit: number = 5): Promise<GitCommit[]> {
    try {
      // Simulate git log --follow -p fileName
      console.log(`Getting history for: ${filePath}`);
      
      const mockHistory: GitCommit[] = [
        {
          hash: 'abc123def456',
          message: `Update ${filePath}`,
          author: 'Task Manager',
          email: 'task@habiti.app',
          date: new Date(Date.now() - 1000 * 60 * 60 * 2),
          filesChanged: [filePath],
          additions: 5,
          deletions: 2,
          branch: await this.getCurrentBranch()
        }
      ];

      return mockHistory.slice(0, limit);
    } catch (error) {
      console.error('Failed to get file history:', error);
      return [];
    }
  }

  // Utilities
  public isGitRepository(): boolean {
    return this.isRepositorySubject.value;
  }

  public getCurrentCommits(): GitCommit[] {
    return this.commitsSubject.value;
  }

  public getCurrentStatus(): GitStatus | null {
    return this.gitStatusSubject.value;
  }

  public getCurrentBranches(): GitBranch[] {
    return this.branchesSubject.value;
  }
}