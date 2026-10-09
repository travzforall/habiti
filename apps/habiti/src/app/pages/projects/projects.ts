import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../services/projects.service';
import { parseDateOnly } from '../../models/task-row.models';
import { PROJECT_TYPE_ORDER, PROJECT_TYPES, projectTypeMeta } from '../../config/project-types';
import { Project } from '../../models/project.model';
import { FamilySummary, ProjectMoney, summariseFamily, summariseRoots } from '../../config/project-rollup';
import { ProjectBudgetService } from '../../services/project-budget.service';
import { formatMoney } from '../../config/currency';
import { CurrencyService } from '../../services/currency.service';
import { UiPreferencesService } from '../../services/ui-preferences.service';

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
  protected readonly activeProjects = this.projectsService.activeProjects;
  
  // --- how the page is shown -------------------------------------------------

  /**
   * "cards" is every project as its own card; "roots" groups by top-level
   * project and summarises the family.
   *
   * The second exists because the first stopped answering the question. Once
   * "Downstairs A" holds ten sub-projects, a grid of eleven cards each showing
   * 0% says nothing: the work moved down a level and the totals did not follow.
   */
  private preferences = inject(UiPreferencesService);

  private static readonly VIEWS = ['cards', 'roots'] as const;

  /** Remembered, because a reload putting the page back is a small rudeness. */
  protected readonly view = signal<'cards' | 'roots'>(
    this.preferences.read('projectsView', ProjectsComponent.VIEWS, 'cards')
  );

  protected setView(value: 'cards' | 'roots'): void {
    this.view.set(value);
    this.preferences.write('projectsView', value);
  }

  // --- dragging sub-projects into order --------------------------------------

  /** The row being dragged: its parent, and where it started. */
  private dragging: { parentId: string; from: number } | null = null;

  protected readonly dragOver = signal<string | null>(null);

  protected onDragStart(parentId: string, index: number): void {
    this.dragging = { parentId, from: index };
  }

  /**
   * Allowing the drop is what makes a row a valid target — without
   * preventDefault the browser refuses every drop and nothing can be moved.
   *
   * Only within the same parent: dragging a sub-project into a different family
   * is a reparent, which has its own rules about depth and loops, and doing it
   * by accident on the way past would be a nasty surprise.
   */
  protected onDragOver(event: DragEvent, parentId: string, childId: string): void {
    if (!this.dragging || this.dragging.parentId !== parentId) return;
    event.preventDefault();
    this.dragOver.set(childId);
  }

  protected onDrop(event: DragEvent, parentId: string, index: number): void {
    event.preventDefault();
    this.dragOver.set(null);

    const dragging = this.dragging;
    this.dragging = null;
    if (!dragging || dragging.parentId !== parentId) return;

    this.projectsService.reorderSubProjects(parentId, dragging.from, index);
  }

  protected onDragEnd(): void {
    this.dragging = null;
    this.dragOver.set(null);
  }

  /**
   * The same move by button.
   *
   * Drag and drop cannot be done with a keyboard, and is awkward on a phone —
   * a list that can only be reordered by dragging is a list some people cannot
   * reorder at all.
   */
  protected nudge(parentId: string, index: number, direction: -1 | 1): void {
    this.projectsService.reorderSubProjects(parentId, index, index + direction);
  }

  private budgetService = inject(ProjectBudgetService);
  private currency = inject(CurrencyService);

  private readonly moneyByProject = computed(
    () =>
      new Map<string, ProjectMoney>(
        this.projects().map(project => {
          const summary = this.budgetService.summaryFor(
            project.id,
            undefined,
            this.currency.table()
          );
          return [project.id, { spent: summary.spent, committed: summary.committed }];
        })
      )
  );

  /**
   * Every project rolled up with whatever sits under it.
   *
   * Built once for the whole page rather than per row: a sub-project's own line
   * has to include ITS children, so the same calculation is needed at every
   * level, and doing it in the template would redo the work on each change
   * detection pass.
   */
  private readonly families = computed(() => {
    const all = this.projects();
    const money = this.moneyByProject();
    return new Map(all.map(project => [project.id, summariseFamily(project, all, money)]));
  });

  /** Every root with its family rolled up — the whole grouped view in one go. */
  protected readonly roots = computed<FamilySummary<Project>[]>(() => {
    const families = this.families();
    return summariseRoots(this.projects(), this.moneyByProject()).map(
      summary => families.get(summary.root.id) ?? summary
    );
  });

  /** One sub-project's rolled-up line. */
  protected familyOf(projectId: string): FamilySummary<Project> | undefined {
    return this.families().get(projectId);
  }

  /** How many items are still to be bought for a project and everything under it. */
  protected itemsNeeded(projectId: string): number {
    const family = this.families().get(projectId);
    const ids = family ? [family.root.id, ...family.descendants.map(p => p.id)] : [projectId];

    return ids.reduce(
      (total, id) =>
        total + this.budgetService.itemsFor(id).filter(item => item.status !== 'have').length,
      0
    );
  }



  protected money(amount: number): string {
    return formatMoney(amount, this.currency.home());
  }

  /** The sub-projects of a sub-project, so the view can show two levels. */
  protected grandChildrenOf(projectId: string): Project[] {
    return this.projectsService.subProjectsOf(projectId);
  }

  // UI state
  showCreateProject = false;
  
  // Form data
  newProject: Partial<Project> = {};
  
  // Filter and sort options
  filterStatus: string = 'all';
  filterType: string = 'all';
  filterPriority: string = 'all';
  sortBy: 'title' | 'dueDate' | 'priority' | 'progress' = 'title';
  sortDirection: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    // Nothing to seed. This used to call createSampleData() whenever the list
    // was empty, which wrote a whole project and three tasks into the account —
    // on a new user's first visit, and again every time someone cleared theirs.
    // The nine duplicate rows in user_projects are what it left behind.
  }

  // Project management
  createProject(): void {
    if (!this.newProject.title?.trim()) return;
    
    const project = this.projectsService.createProject({
      ...this.newProject,
      // parseDateOnly, not new Date(string): a bare `yyyy-mm-dd` parses as UTC
      // midnight, which is the previous day west of Greenwich.
      dueDate: parseDateOnly(this.newProject.dueDate as unknown as string),
      startDate: parseDateOnly(this.newProject.startDate as unknown as string)
    });
    
    this.resetCreateProjectForm();
    // Straight into the project that was just created, on its own page.
    this.router.navigate(['/projects', project.id]);
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

  // Utility methods
  protected readonly typeOptions = PROJECT_TYPE_ORDER.map(type => ({
    type,
    meta: PROJECT_TYPES[type]
  }));

  /** A project's type badge — colour, icon and label in one lookup. */
  protected typeMeta(project: Project) {
    return projectTypeMeta(project.type);
  }

  /** The project this one sits inside, when it has one. */
  protected parentOf(project: Project): Project | undefined {
    return project.parentId ? this.projectsService.getProject(project.parentId) : undefined;
  }

  protected subProjectCount(projectId: string): number {
    return this.projectsService.subProjectsOf(projectId).length;
  }

  getFilteredProjects(): Project[] {
    let filtered = this.projects();

    if (this.filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === this.filterStatus);
    }

    if (this.filterType !== 'all') {
      filtered = filtered.filter(p => (p.type ?? 'personal') === this.filterType);
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

  getAbsoluteDaysOverdue(project: Project): number {
    if (!project.dueDate) return 0;
    return Math.abs(this.getDaysUntilDue(project.dueDate));
  }

}
