import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { provideTestUserId } from '@habiti/storage/testing';
import { SyncBus } from '@habiti/sync';
import { TaskDetailComponent } from './task-detail';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { ChecklistService } from '../../services/checklist.service';
import { AttachmentsService } from '../../services/attachments.service';
import { ToastService } from '../../services/toast.service';
import { Task } from '../../models/project.model';

/**
 * What has to work on a task page, and one thing that is easy to get wrong:
 * opening /tasks/482 in a fresh tab, where the store is empty and the answer
 * is "still loading", not "no such task".
 */

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '482',
    projectId: 'standalone',
    title: 'Call the insurance company',
    completed: false,
    status: 'todo',
    priority: 'urgent',
    createdAt: new Date(2026, 7, 1),
    ...overrides
  };
}

class MockTasks {
  store = signal<Task[]>([]);
  tasks = this.store;
  loadOneResult: Task | null = null;
  loadOne = jasmine.createSpy('loadOne').and.callFake(() => of(this.loadOneResult));
  getTask = (id: string) => this.store().find(t => t.id === id);
  tasksForProject = () => [];
  toggleTask = jasmine.createSpy('toggleTask');
  setStatus = jasmine.createSpy('setStatus');
  blockersFor = () => [];
  blockedBy = () => [];
  addDependency = jasmine.createSpy('addDependency').and.returnValue(true);
  removeDependency = jasmine.createSpy('removeDependency');
  deleteTask = jasmine.createSpy('deleteTask');
  moveToProject = jasmine.createSpy('moveToProject');
  logHours = jasmine.createSpy('logHours');
}

class MockProjects {
  projects = signal<any[]>([]);
  getProject = () => undefined;
  updateProjectProgress = jasmine.createSpy('updateProjectProgress');
  loadOne = () => of(null);
}

class MockChecklist {
  items = signal<any[]>([]);
  forTask = () => [];
  loadForTask = jasmine.createSpy('loadForTask');
  add = () => null;
  toggle = jasmine.createSpy('toggle');
  remove = jasmine.createSpy('remove');
}

class MockAttachments {
  forParent = () => [];
  loadForParent = jasmine.createSpy('loadForParent');
  usedBytes = signal(0);
  quotaBytes = signal(1000);
  hasSeenNotice = () => true;
  markNoticeSeen = () => undefined;
  wouldExceedQuota = () => false;
}

async function renderAt(path: string): Promise<{ el: HTMLElement; tasks: MockTasks }> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      provideHttpClient(),
      provideRouter([{ path: 'tasks/:id', component: TaskDetailComponent }]),
      SyncBus,
      ToastService,
      { provide: TasksService, useClass: MockTasks },
      { provide: ProjectsService, useClass: MockProjects },
      { provide: ChecklistService, useClass: MockChecklist },
      { provide: AttachmentsService, useClass: MockAttachments }
    ]
  });

  const tasks = TestBed.inject(TasksService) as unknown as MockTasks;
  return { tasks, el: await RouterTestingHarness.create(path).then(h => h.routeNativeElement!) };
}

describe('TaskDetailComponent', () => {
  it('shows the task when it is already in the store', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        provideHttpClient(),
        provideRouter([{ path: 'tasks/:id', component: TaskDetailComponent }]),
        SyncBus,
        ToastService,
        { provide: TasksService, useClass: MockTasks },
        { provide: ProjectsService, useClass: MockProjects },
        { provide: ChecklistService, useClass: MockChecklist },
        { provide: AttachmentsService, useClass: MockAttachments }
      ]
    });

    const tasks = TestBed.inject(TasksService) as unknown as MockTasks;
    tasks.store.set([task()]);

    const harness = await RouterTestingHarness.create('/tasks/482');
    const el = harness.routeNativeElement!;

    expect(el.textContent).toContain('Call the insurance company');
    expect(tasks.loadOne).not.toHaveBeenCalled();
  });

  it('fetches the row when the cache is cold and then renders it', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        provideHttpClient(),
        provideRouter([{ path: 'tasks/:id', component: TaskDetailComponent }]),
        SyncBus,
        ToastService,
        { provide: TasksService, useClass: MockTasks },
        { provide: ProjectsService, useClass: MockProjects },
        { provide: ChecklistService, useClass: MockChecklist },
        { provide: AttachmentsService, useClass: MockAttachments }
      ]
    });

    // Cold cache: the store is empty and the row only arrives via loadOne,
    // which is exactly what opening /tasks/482 in a fresh tab looks like.
    const tasks = TestBed.inject(TasksService) as unknown as MockTasks;
    tasks.loadOneResult = task();
    tasks.loadOne.and.callFake((id: string) => {
      tasks.store.set([task({ id })]);
      return of(tasks.loadOneResult);
    });

    const harness = await RouterTestingHarness.create('/tasks/482');
    harness.detectChanges();

    expect(tasks.loadOne).toHaveBeenCalledWith('482');
    expect(harness.routeNativeElement!.textContent).toContain('Call the insurance company');
  });

  it('says so plainly when the row really is not there', async () => {
    const { el } = await renderAt('/tasks/999');
    expect(el.textContent).toContain('no longer exists');
  });

  it('links to the edit page, so the pencil in the list has somewhere to go', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        provideHttpClient(),
        provideRouter([{ path: 'tasks/:id', component: TaskDetailComponent }]),
        SyncBus,
        ToastService,
        { provide: TasksService, useClass: MockTasks },
        { provide: ProjectsService, useClass: MockProjects },
        { provide: ChecklistService, useClass: MockChecklist },
        { provide: AttachmentsService, useClass: MockAttachments }
      ]
    });

    (TestBed.inject(TasksService) as unknown as MockTasks).store.set([task()]);

    const harness = await RouterTestingHarness.create('/tasks/482');
    const links = Array.from(harness.routeNativeElement!.querySelectorAll('a'));

    expect(links.some(a => a.getAttribute('href') === '/tasks/482/edit'))
      .withContext('the Edit action must be a real link, not a click handler')
      .toBe(true);
  });
});
