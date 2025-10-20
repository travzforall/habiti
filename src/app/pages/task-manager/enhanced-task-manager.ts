import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { BaserowService } from '../../services/baserow.service';
import { MarkdownSyncService } from '../../services/markdown-sync.service';
import { ApprovalWorkflowService, FeatureGroup, ApprovalTask } from '../../services/approval-workflow.service';

@Component({
  selector: 'app-enhanced-task-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="enhanced-task-manager">
      <!-- Header with sync status -->
      <div class="header-section">
        <div class="header-content">
          <h1>🛠️ Enhanced Task Manager & Approval System</h1>
          <p class="subtitle">MD ↔ Database sync with approval workflow</p>
          
          <div class="sync-status">
            <div class="status-indicator" [class.active]="isWatching">
              {{ isWatching ? '📡 Live Sync Active' : '⏸️ Sync Paused' }}
            </div>
            <div class="last-sync">Last sync: {{ lastSyncTime | date:'short' }}</div>
          </div>
        </div>

        <div class="control-panel">
          <button 
            (click)="startSync()" 
            class="btn-success"
            [disabled]="isWatching || isLoading"
          >
            {{ isLoading ? '⏳ Starting...' : '▶️ Start Sync' }}
          </button>
          
          <button 
            (click)="stopSync()" 
            class="btn-warning"
            [disabled]="!isWatching"
          >
            ⏸️ Stop Sync
          </button>
          
          <button (click)="forceSyncAll()" class="btn-info" [disabled]="isLoading">
            {{ isLoading ? '⏳ Syncing...' : '🔄 Force Sync All' }}
          </button>

          <button (click)="openQueueManager()" class="btn-secondary">
            🎯 Queue Manager
          </button>
          
          <button (click)="downloadFullReport()" class="btn-primary">
            📋 Download Full Report
          </button>
        </div>
      </div>

      <!-- Stats Dashboard -->
      <div class="stats-dashboard">
        <div class="stat-card">
          <div class="stat-label">Feature Groups</div>
          <div class="stat-value">{{ approvalStats.total }}</div>
          <div class="stat-detail">{{ approvalStats.approved }} approved</div>
        </div>
        
        <div class="stat-card pending">
          <div class="stat-label">Pending Approvals</div>
          <div class="stat-value">{{ approvalStats.pending }}</div>
          <div class="stat-detail">{{ pendingTasks.length }} tasks</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">File Changes</div>
          <div class="stat-value">{{ recentChanges.length }}</div>
          <div class="stat-detail">Last 24h</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-label">Total Tasks</div>
          <div class="stat-value">{{ totalTasks }}</div>
          <div class="stat-detail">From MD files</div>
        </div>
      </div>

      <!-- Recent File Changes -->
      <div class="recent-changes" *ngIf="recentChanges.length > 0">
        <h3>📁 Recent File Changes</h3>
        <div class="changes-list">
          <div 
            *ngFor="let change of recentChanges" 
            class="change-item"
            [class]="change.changeType"
          >
            <div class="change-info">
              <strong>{{ change.fileName }}</strong>
              <span class="change-type">{{ change.changeType }}</span>
            </div>
            <div class="change-details">
              <span class="tasks-count">{{ change.tasksChanged }} tasks</span>
              <span class="timestamp">{{ change.timestamp | date:'short' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Groups Approval Section -->
      <div class="feature-groups-section">
        <h2>🎯 Feature Groups Approval</h2>
        <p class="section-description">
          Each feature group represents a category from the markdown files. 
          Approve completed groups to merge changes to main branch.
        </p>

        <div class="feature-groups-grid">
          <div 
            *ngFor="let group of featureGroups" 
            class="feature-group-card"
            [class.approved]="group.approved"
            [class.has-pending]="hasPendingTasks(group)"
          >
            <!-- Group Header -->
            <div class="group-header" (click)="toggleGroup(group.id)">
              <div class="group-info">
                <h3>{{ group.name }}</h3>
                <p>{{ group.description }}</p>
              </div>
              
              <div class="group-stats">
                <div class="progress-circle">
                  <span class="progress-text">
                    {{ group.completedTasks }}/{{ group.totalTasks }}
                  </span>
                </div>
                
                <div class="approval-status">
                  <span 
                    class="status-badge" 
                    [class]="group.approved ? 'approved' : (group.completedTasks > 0 ? 'pending' : 'waiting')"
                  >
                    {{ group.approved ? '✅ Approved' : (group.completedTasks > 0 ? '⏳ Pending' : '⏸️ Waiting') }}
                  </span>
                </div>
              </div>

              <div class="expand-icon">
                {{ expandedGroups.has(group.id) ? '▼' : '▶' }}
              </div>
            </div>

            <!-- Group Content -->
            <div 
              *ngIf="expandedGroups.has(group.id)" 
              class="group-content"
            >
              <!-- Approval Controls -->
              <div class="approval-controls" *ngIf="group.completedTasks > 0 && !group.approved">
                <div class="approval-actions">
                  <button 
                    (click)="approveGroup(group.id)"
                    class="btn-approve-group"
                    [disabled]="isLoading"
                  >
                    ✅ Approve Group ({{ group.completedTasks }} tasks)
                  </button>
                  
                  <button 
                    (click)="disapproveGroup(group.id)"
                    class="btn-disapprove-group"
                    [disabled]="isLoading"
                  >
                    ❌ Needs Work
                  </button>
                </div>
                
                <textarea 
                  [(ngModel)]="groupNotes[group.id]"
                  placeholder="Add approval notes or feedback..."
                  class="group-notes"
                  rows="2"
                ></textarea>
              </div>

              <!-- Approved Group Info -->
              <div class="approved-info" *ngIf="group.approved">
                <div class="approval-details">
                  <span class="approver">✅ Approved by {{ group.approver }}</span>
                  <span class="approval-date">{{ group.approvalDate | date:'medium' }}</span>
                </div>
                <div class="approval-notes" *ngIf="group.notes">
                  <strong>Notes:</strong> {{ group.notes }}
                </div>
              </div>

              <!-- Tasks List -->
              <div class="tasks-grid">
                <div 
                  *ngFor="let task of group.tasks" 
                  class="task-card"
                  [class.completed]="task.completed"
                  [class.approved]="task.approved"
                  [class.needs-approval]="task.needsApproval"
                  [class.has-conflicts]="task.conflicts.length > 0"
                >
                  <div class="task-header">
                    <div class="task-checkbox">
                      <input 
                        type="checkbox" 
                        [checked]="task.completed"
                        (change)="toggleTaskCompletion(task)"
                        [id]="'task-' + task.id"
                      >
                      <label [for]="'task-' + task.id"></label>
                    </div>
                    
                    <div class="task-info">
                      <h4>{{ task.title }}</h4>
                      <div class="task-meta">
                        <span class="agent">{{ task.agent }}</span>
                        <span class="priority" [class]="'priority-' + task.priority">
                          {{ task.priority }}
                        </span>
                        <span class="source">{{ task.source }}</span>
                      </div>
                    </div>

                    <div class="task-status">
                      <span 
                        class="status-indicator"
                        [class]="getTaskStatusClass(task)"
                      >
                        {{ getTaskStatusText(task) }}
                      </span>
                    </div>
                  </div>

                  <!-- Task Description -->
                  <div class="task-description" *ngIf="task.description !== task.title">
                    {{ task.description }}
                  </div>

                  <!-- Conflicts Warning -->
                  <div class="conflicts-warning" *ngIf="task.conflicts.length > 0">
                    <strong>⚠️ Conflicts Detected:</strong>
                    <ul>
                      <li *ngFor="let conflict of task.conflicts">{{ conflict }}</li>
                    </ul>
                  </div>

                  <!-- Individual Task Approval -->
                  <div class="task-approval" *ngIf="task.completed && !task.approved">
                    <div class="approval-buttons">
                      <button 
                        (click)="approveTask(task.id)"
                        class="btn-approve-task"
                      >
                        ✅ Approve
                      </button>
                      
                      <button 
                        (click)="disapproveTask(task.id)"
                        class="btn-disapprove-task"
                      >
                        ❌ Needs Work
                      </button>
                    </div>
                    
                    <textarea 
                      [(ngModel)]="taskNotes[task.id]"
                      placeholder="Add task-specific notes..."
                      class="task-notes-input"
                      rows="1"
                    ></textarea>
                  </div>

                  <!-- Task Notes Display -->
                  <div class="task-notes-display" *ngIf="task.notes">
                    <strong>Notes:</strong> {{ task.notes }}
                  </div>

                  <!-- File Reference -->
                  <div class="file-reference" *ngIf="task.mdFile">
                    <small>
                      📄 {{ task.mdFile }}
                      <span *ngIf="task.lineNumber">(line {{ task.lineNumber }})</span>
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Approvals Quick View -->
      <div class="quick-approvals" *ngIf="pendingTasks.length > 0">
        <h3>⚡ Quick Approve Pending Tasks</h3>
        <div class="pending-tasks-list">
          <div 
            *ngFor="let task of pendingTasks" 
            class="pending-task-item"
          >
            <div class="task-summary">
              <strong>{{ task.title }}</strong>
              <span class="category">({{ task.category }})</span>
              <span class="agent">by {{ task.agent }}</span>
            </div>
            
            <div class="quick-actions">
              <button 
                (click)="approveTask(task.id, 'Quick approved')"
                class="btn-quick-approve"
              >
                ✅
              </button>
              
              <button 
                (click)="disapproveTask(task.id, 'Needs review')"
                class="btn-quick-disapprove"
              >
                ❌
              </button>
            </div>
          </div>
        </div>
        
        <div class="bulk-actions">
          <button 
            (click)="approveAllPending()"
            class="btn-bulk-approve"
            [disabled]="isLoading"
          >
            ✅ Approve All ({{ pendingTasks.length }})
          </button>
        </div>
      </div>

      <!-- Git Commits Preview -->
      <div class="git-commits-section" *ngIf="gitCommits.length > 0">
        <h3>📝 Recent Commits</h3>
        <div class="commits-list">
          <div 
            *ngFor="let commit of gitCommits" 
            class="commit-item"
          >
            <div class="commit-info">
              <code class="commit-hash">{{ commit.hash.substring(0, 8) }}</code>
              <span class="commit-message">{{ commit.message.split('\n')[0] }}</span>
            </div>
            <div class="commit-meta">
              <span class="author">{{ commit.author }}</span>
              <span class="date">{{ commit.date | date:'short' }}</span>
              <span class="files">{{ commit.filesChanged.length }} files</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .enhanced-task-manager {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .header-section {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 30px;
      margin-bottom: 30px;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-content h1 {
      margin: 0 0 10px 0;
      font-size: 2.2rem;
      font-weight: 700;
    }

    .subtitle {
      margin: 0 0 15px 0;
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .sync-status {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .status-indicator {
      padding: 8px 16px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.2);
      font-weight: 600;
      font-size: 0.9rem;
    }

    .status-indicator.active {
      background: rgba(76, 175, 80, 0.3);
      color: #C8E6C9;
    }

    .control-panel {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .control-panel button {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .btn-success { background: #4CAF50; color: white; }
    .btn-warning { background: #FF9800; color: white; }
    .btn-info { background: #00BCD4; color: white; }
    .btn-primary { background: #2196F3; color: white; }

    .stats-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      color: white;
      border-left: 4px solid #4CAF50;
    }

    .stat-card.pending {
      border-left-color: #FF9800;
    }

    .stat-label {
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .stat-detail {
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .recent-changes {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      color: white;
    }

    .recent-changes h3 {
      margin: 0 0 15px 0;
      color: white;
    }

    .changes-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .change-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      border-left: 3px solid #4CAF50;
    }

    .change-item.modified {
      border-left-color: #FF9800;
    }

    .feature-groups-section {
      color: white;
      margin-bottom: 40px;
    }

    .feature-groups-section h2 {
      margin-bottom: 10px;
    }

    .section-description {
      opacity: 0.9;
      margin-bottom: 25px;
    }

    .feature-groups-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .feature-group-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      border-left: 4px solid #ddd;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .feature-group-card.approved {
      border-left-color: #4CAF50;
      opacity: 0.8;
    }

    .feature-group-card.has-pending {
      border-left-color: #FF9800;
    }

    .group-header {
      padding: 20px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: background 0.3s ease;
    }

    .group-header:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .group-info h3 {
      margin: 0 0 5px 0;
      color: white;
    }

    .group-info p {
      margin: 0;
      opacity: 0.8;
      font-size: 0.9rem;
    }

    .group-stats {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .progress-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: conic-gradient(#4CAF50 var(--progress, 0%), rgba(255,255,255,0.2) 0%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: bold;
    }

    .status-badge {
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-badge.approved {
      background: rgba(76, 175, 80, 0.3);
      color: #C8E6C9;
    }

    .status-badge.pending {
      background: rgba(255, 152, 0, 0.3);
      color: #FFE0B2;
    }

    .status-badge.waiting {
      background: rgba(158, 158, 158, 0.3);
      color: #E0E0E0;
    }

    .group-content {
      padding: 0 20px 20px;
    }

    .approval-controls {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 20px;
    }

    .approval-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .btn-approve-group, .btn-disapprove-group {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .btn-approve-group {
      background: #4CAF50;
      color: white;
    }

    .btn-disapprove-group {
      background: #F44336;
      color: white;
    }

    .group-notes {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      resize: vertical;
    }

    .group-notes::placeholder {
      color: rgba(255, 255, 255, 0.6);
    }

    .tasks-grid {
      display: grid;
      gap: 15px;
    }

    .task-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 15px;
      border-left: 3px solid transparent;
      transition: all 0.3s ease;
    }

    .task-card.completed {
      border-left-color: #4CAF50;
      opacity: 0.8;
    }

    .task-card.approved {
      border-left-color: #2196F3;
    }

    .task-card.needs-approval {
      border-left-color: #FF9800;
      background: rgba(255, 152, 0, 0.1);
    }

    .task-card.has-conflicts {
      border-left-color: #F44336;
      background: rgba(244, 67, 54, 0.1);
    }

    .task-header {
      display: flex;
      gap: 15px;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .task-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .task-info {
      flex: 1;
    }

    .task-info h4 {
      margin: 0 0 5px 0;
      color: white;
      font-size: 1rem;
    }

    .task-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .task-meta span {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
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

    .source {
      background: rgba(156, 39, 176, 0.3);
      color: #F3E5F5;
    }

    .task-status .status-indicator {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .status-completed { background: rgba(76, 175, 80, 0.3); color: #C8E6C9; }
    .status-approved { background: rgba(33, 150, 243, 0.3); color: #BBDEFB; }
    .status-pending { background: rgba(255, 152, 0, 0.3); color: #FFE0B2; }
    .status-conflict { background: rgba(244, 67, 54, 0.3); color: #FFCDD2; }

    .task-description {
      margin: 10px 0;
      opacity: 0.9;
      font-size: 0.9rem;
      color: white;
    }

    .conflicts-warning {
      background: rgba(244, 67, 54, 0.2);
      border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: 6px;
      padding: 10px;
      margin: 10px 0;
      color: #FFCDD2;
    }

    .conflicts-warning ul {
      margin: 5px 0 0 20px;
    }

    .task-approval {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .approval-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .btn-approve-task, .btn-disapprove-task {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-approve-task {
      background: #4CAF50;
      color: white;
    }

    .btn-disapprove-task {
      background: #F44336;
      color: white;
    }

    .task-notes-input {
      width: 100%;
      padding: 6px;
      border: none;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 0.8rem;
    }

    .task-notes-display {
      margin-top: 10px;
      padding: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.9);
    }

    .file-reference {
      margin-top: 8px;
      opacity: 0.7;
      font-family: monospace;
    }

    .quick-approvals {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      color: white;
    }

    .pending-tasks-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 15px;
    }

    .pending-task-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .task-summary {
      flex: 1;
    }

    .task-summary .category, .task-summary .agent {
      opacity: 0.8;
      font-size: 0.9rem;
      margin-left: 10px;
    }

    .quick-actions {
      display: flex;
      gap: 5px;
    }

    .btn-quick-approve, .btn-quick-disapprove {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }

    .btn-quick-approve {
      background: #4CAF50;
      color: white;
    }

    .btn-quick-disapprove {
      background: #F44336;
      color: white;
    }

    .bulk-actions {
      text-align: center;
    }

    .btn-bulk-approve {
      padding: 12px 24px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .git-commits-section {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 20px;
      color: white;
    }

    .commits-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .commit-item {
      padding: 12px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .commit-hash {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.8rem;
      margin-right: 10px;
    }

    .commit-meta {
      display: flex;
      gap: 15px;
      font-size: 0.8rem;
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .header-section {
        flex-direction: column;
      }
      
      .stats-dashboard {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .task-header {
        flex-direction: column;
        gap: 10px;
      }
      
      .control-panel {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class EnhancedTaskManagerComponent implements OnInit, OnDestroy {
  featureGroups: FeatureGroup[] = [];
  pendingTasks: ApprovalTask[] = [];
  gitCommits: any[] = [];
  recentChanges: any[] = [];
  
  expandedGroups = new Set<string>();
  groupNotes: { [groupId: string]: string } = {};
  taskNotes: { [taskId: string]: string } = {};
  
  isWatching = false;
  isLoading = false;
  lastSyncTime = new Date();
  
  approvalStats = { total: 0, approved: 0, pending: 0 };
  totalTasks = 0;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private baserowService: BaserowService,
    private markdownSync: MarkdownSyncService,
    private approvalWorkflow: ApprovalWorkflowService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadInitialData();
    
    // Expand all groups by default
    setTimeout(() => {
      this.featureGroups.forEach(group => {
        this.expandedGroups.add(group.id);
      });
    }, 500);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.markdownSync.stopWatching();
  }

  private initializeSubscriptions(): void {
    // Subscribe to feature groups
    this.subscriptions.push(
      this.approvalWorkflow.featureGroups$.subscribe(groups => {
        this.featureGroups = groups;
        this.updateStats();
      })
    );

    // Subscribe to pending approvals
    this.subscriptions.push(
      this.approvalWorkflow.pendingApprovals$.subscribe(pending => {
        this.pendingTasks = pending;
      })
    );

    // Subscribe to git commits
    this.subscriptions.push(
      this.approvalWorkflow.gitCommits$.subscribe(commits => {
        this.gitCommits = commits;
      })
    );

    // Subscribe to file changes
    this.subscriptions.push(
      this.markdownSync.fileChanges$.subscribe(changes => {
        this.recentChanges = changes;
        if (changes.length > 0) {
          this.lastSyncTime = new Date();
        }
      })
    );

    // Subscribe to watching status
    this.subscriptions.push(
      this.markdownSync.isWatching$.subscribe(watching => {
        this.isWatching = watching;
      })
    );

    // Subscribe to tasks for total count
    this.subscriptions.push(
      this.markdownSync.tasks$.subscribe(tasks => {
        this.totalTasks = tasks.length;
      })
    );
  }

  private loadInitialData(): void {
    this.isLoading = true;
    
    // Force sync all data
    this.approvalWorkflow.forceSyncAll().finally(() => {
      this.isLoading = false;
      this.lastSyncTime = new Date();
    });
  }

  private updateStats(): void {
    this.approvalStats = this.approvalWorkflow.getApprovalStats();
  }

  // UI Event Handlers
  async startSync(): Promise<void> {
    this.isLoading = true;
    try {
      await this.markdownSync.startSync();
      this.lastSyncTime = new Date();
    } finally {
      this.isLoading = false;
    }
  }

  stopSync(): void {
    this.markdownSync.stopWatching();
  }

  openQueueManager(): void {
    this.router.navigate(['/secret-task-manager-queue']);
  }

  async forceSyncAll(): Promise<void> {
    this.isLoading = true;
    try {
      await this.approvalWorkflow.forceSyncAll();
      this.lastSyncTime = new Date();
    } finally {
      this.isLoading = false;
    }
  }

  toggleGroup(groupId: string): void {
    if (this.expandedGroups.has(groupId)) {
      this.expandedGroups.delete(groupId);
    } else {
      this.expandedGroups.add(groupId);
    }
  }

  async approveGroup(groupId: string): Promise<void> {
    if (this.isLoading) return;
    
    this.isLoading = true;
    try {
      const notes = this.groupNotes[groupId] || '';
      await this.approvalWorkflow.approveFeatureGroup(groupId, notes);
      delete this.groupNotes[groupId]; // Clear notes after approval
    } finally {
      this.isLoading = false;
    }
  }

  async disapproveGroup(groupId: string): Promise<void> {
    if (this.isLoading) return;
    
    const notes = this.groupNotes[groupId];
    if (!notes || notes.trim().length === 0) {
      alert('Please provide feedback notes when disapproving a group.');
      return;
    }

    this.isLoading = true;
    try {
      await this.approvalWorkflow.disapproveFeatureGroup(groupId, notes);
      delete this.groupNotes[groupId];
    } finally {
      this.isLoading = false;
    }
  }

  async approveTask(taskId: string, notes?: string): Promise<void> {
    const taskNotes = notes || this.taskNotes[taskId] || '';
    await this.approvalWorkflow.approveTask(taskId, taskNotes);
    delete this.taskNotes[taskId];
  }

  async disapproveTask(taskId: string, notes?: string): Promise<void> {
    const taskNotes = notes || this.taskNotes[taskId];
    if (!taskNotes || taskNotes.trim().length === 0) {
      alert('Please provide feedback when disapproving a task.');
      return;
    }
    
    // For now, just add notes - full disapproval logic would be more complex
    const groups = this.featureGroups;
    for (const group of groups) {
      const task = group.tasks.find(t => t.id === taskId);
      if (task) {
        task.approved = false;
        task.needsApproval = true;
        task.notes = taskNotes;
        break;
      }
    }
    delete this.taskNotes[taskId];
  }

  async approveAllPending(): Promise<void> {
    if (this.isLoading) return;
    
    this.isLoading = true;
    try {
      const approvalPromises = this.pendingTasks.map(task => 
        this.approvalWorkflow.approveTask(task.id, 'Bulk approved')
      );
      await Promise.all(approvalPromises);
    } finally {
      this.isLoading = false;
    }
  }

  toggleTaskCompletion(task: ApprovalTask): void {
    task.completed = !task.completed;
    if (!task.completed) {
      task.approved = false;
      task.needsApproval = false;
    } else {
      task.needsApproval = true;
    }
    
    // Update the feature group stats
    const group = this.featureGroups.find(g => g.tasks.includes(task));
    if (group) {
      group.completedTasks = group.tasks.filter(t => t.completed).length;
      group.approvedTasks = group.tasks.filter(t => t.approved).length;
    }
  }

  // Helper methods
  hasPendingTasks(group: FeatureGroup): boolean {
    return group.tasks.some(task => task.needsApproval || (task.completed && !task.approved));
  }

  getTaskStatusClass(task: ApprovalTask): string {
    if (task.conflicts.length > 0) return 'status-conflict';
    if (task.approved) return 'status-approved';
    if (task.completed) return 'status-completed';
    return 'status-pending';
  }

  getTaskStatusText(task: ApprovalTask): string {
    if (task.conflicts.length > 0) return '⚠️ Conflict';
    if (task.approved) return '✅ Approved';
    if (task.completed) return '⏳ Pending';
    return '📋 Todo';
  }

  downloadFullReport(): void {
    const report = this.generateFullReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habiti-full-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private generateFullReport(): string {
    const now = new Date().toISOString();
    let report = `# 🛠️ Habiti Enhanced Development Report\n\n`;
    report += `**Generated:** ${now}\n`;
    report += `**Source:** Enhanced Task Manager with MD Sync\n\n`;
    
    report += `## 📊 Summary Statistics\n\n`;
    report += `- **Total Feature Groups:** ${this.approvalStats.total}\n`;
    report += `- **Approved Groups:** ${this.approvalStats.approved}\n`;
    report += `- **Pending Approval:** ${this.approvalStats.pending}\n`;
    report += `- **Total Tasks:** ${this.totalTasks}\n`;
    report += `- **Sync Status:** ${this.isWatching ? 'Active' : 'Paused'}\n`;
    report += `- **Last Sync:** ${this.lastSyncTime.toISOString()}\n\n`;

    if (this.recentChanges.length > 0) {
      report += `## 📁 Recent File Changes\n\n`;
      this.recentChanges.forEach(change => {
        report += `- **${change.fileName}**: ${change.changeType} (${change.tasksChanged} tasks) - ${change.timestamp.toISOString()}\n`;
      });
      report += `\n`;
    }

    report += `## 🎯 Feature Groups Detail\n\n`;
    this.featureGroups.forEach(group => {
      const progressPercent = Math.round((group.completedTasks / group.totalTasks) * 100);
      const approvalStatus = group.approved ? '✅ Approved' : 
        (group.completedTasks > 0 ? '⏳ Pending Approval' : '⏸️ Waiting');

      report += `### ${group.name}\n\n`;
      report += `**Status:** ${approvalStatus}\n`;
      report += `**Progress:** ${group.completedTasks}/${group.totalTasks} (${progressPercent}%)\n`;
      report += `**Description:** ${group.description}\n`;
      
      if (group.approved && group.approvalDate) {
        report += `**Approved:** ${group.approvalDate.toISOString()} by ${group.approver}\n`;
      }
      
      if (group.notes) {
        report += `**Notes:** ${group.notes}\n`;
      }
      
      report += `\n**Tasks:**\n\n`;
      
      group.tasks.forEach(task => {
        const status = task.approved ? '✅' : (task.completed ? '⏳' : '📋');
        const conflicts = task.conflicts.length > 0 ? ' ⚠️' : '';
        
        report += `- [${task.completed ? 'x' : ' '}] ${status} **${task.title}**${conflicts}\n`;
        report += `  - Agent: ${task.agent}\n`;
        report += `  - Priority: ${task.priority}\n`;
        report += `  - Source: ${task.source}${task.mdFile ? ` (${task.mdFile}:${task.lineNumber})` : ''}\n`;
        
        if (task.conflicts.length > 0) {
          report += `  - Conflicts: ${task.conflicts.join('; ')}\n`;
        }
        
        if (task.notes) {
          report += `  - Notes: ${task.notes}\n`;
        }
        
        report += `\n`;
      });
      
      report += `\n`;
    });

    if (this.gitCommits.length > 0) {
      report += `## 📝 Recent Commits\n\n`;
      this.gitCommits.forEach(commit => {
        report += `- \`${commit.hash.substring(0, 8)}\` ${commit.message.split('\n')[0]}\n`;
        report += `  - Author: ${commit.author}\n`;
        report += `  - Date: ${commit.date.toISOString()}\n`;
        report += `  - Files: ${commit.filesChanged.join(', ')}\n\n`;
      });
    }

    report += `---\n\n`;
    report += `*This enhanced report was generated from markdown files with live sync capabilities*\n`;
    report += `*Task Manager URL: http://localhost:4200/secret-task-manager-x9z2k*\n`;
    
    return report;
  }
}