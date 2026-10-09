import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { TaskPromotionService } from './task-promotion.service';
import { ProjectsService } from './projects.service';
import { TasksService } from './tasks.service';
import { ProjectBudgetService } from './project-budget.service';
import { AttachmentsService } from './attachments.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';

/**
 * A task that turns out to be a job.
 *
 * What matters here is that NOTHING is lost on the way: the promotion is a
 * delete with extra steps if the money or the files stay pointing at a task
 * that no longer exists.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { userProjects: 630, userTasks: 631, projectItems: 639, projectExpenses: 640 };
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  getRow = jasmine.createSpy('getRow').and.returnValue(of(null));
  createRow = jasmine.createSpy('createRow').and.returnValue(of(null));
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
}

class MockStorage {
  values = new Map<string, string>();
  readRaw = (key: string) => this.values.get(key) ?? null;
  writeRaw = (key: string, value: string) => void this.values.set(key, value);
}

class MockAttachments {
  moved: { id: string; parentId: string }[] = [];
  files: { id: string }[] = [{ id: 'a1' }];
  forParent = () => this.files;
  reassign = (id: string, _type: 'task' | 'project', parentId: string) =>
    void this.moved.push({ id, parentId });
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      TaskPromotionService,
      ProjectsService,
      TasksService,
      ProjectBudgetService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage },
      { provide: AttachmentsService, useClass: MockAttachments }
    ]
  });

  const projects = TestBed.inject(ProjectsService);
  return {
    promotion: TestBed.inject(TaskPromotionService),
    projects,
    tasks: TestBed.inject(TasksService),
    budget: TestBed.inject(ProjectBudgetService),
    attachments: TestBed.inject(AttachmentsService) as unknown as MockAttachments,
    project: projects.createProject({ title: 'Downstairs A', type: 'home' })
  };
}

describe('promoting a task', () => {
  it('carries the title, description and budget across', () => {
    const { promotion, tasks, project } = build();
    const task = tasks.createTask({
      title: 'Floors',
      description: 'Level, then vinyl',
      projectId: project.id,
      budget: 900,
      priority: 'high'
    });

    const result = promotion.promote(task.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.title).toBe('Floors');
    expect(result.project.description).toBe('Level, then vinyl');
    expect(result.project.budget).toBe(900);
    expect(result.project.parentId).toBe(project.id);
  });

  it('removes the task, because it is a project now', () => {
    const { promotion, tasks, project } = build();
    const task = tasks.createTask({ title: 'Floors', projectId: project.id });

    promotion.promote(task.id);
    expect(tasks.getTask(task.id)).toBeUndefined();
  });

  it('moves the money, so none of it falls out of the roll-up', () => {
    const { promotion, tasks, budget, project } = build();
    const task = tasks.createTask({ title: 'Floors', projectId: project.id });
    budget.addItem(project.id, { title: '10 bags Quikrete', unitCost: 65, taskId: task.id });
    budget.addExpense(project.id, { title: 'Deposit', amount: 40, taskId: task.id });

    const result = promotion.promote(task.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const moved = budget.itemsFor(result.project.id);
    expect(moved.map(item => item.title)).toEqual(['10 bags Quikrete']);
    expect(moved[0].taskId).toBeUndefined();
    expect(budget.summaryFor(result.project.id).spent).toBe(40);
    expect(budget.summaryFor(result.project.id).committed).toBe(65);
  });

  it('moves the files', () => {
    const { promotion, tasks, attachments, project } = build();
    const task = tasks.createTask({ title: 'Floors', projectId: project.id });

    const result = promotion.promote(task.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(attachments.moved).toEqual([{ id: 'a1', parentId: result.project.id }]);
  });

  it('refuses at the deepest level, and leaves the task alone', () => {
    const { promotion, projects, tasks, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    const deep = projects.createProject({ title: 'Floors', parentId: middle.id });
    const task = tasks.createTask({ title: 'Self level', projectId: deep.id });

    const result = promotion.promote(task.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too-deep');
    expect(tasks.getTask(task.id)).toBeDefined();
    expect(promotion.canPromote(task.id)).toBe(false);
  });

  it('refuses a standalone task, and says what to do instead', () => {
    const { promotion, tasks } = build();
    const task = tasks.createTask({ title: 'Call the plumber' });

    const result = promotion.promote(task.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Move it to one first');
    expect(tasks.getTask(task.id)).toBeDefined();
  });
});
