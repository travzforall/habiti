import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideTestUserId } from '@habiti/storage/testing';
import { SyncBus } from '@habiti/sync';
import { TasksComponent } from './tasks';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { Task } from '../../models/project.model';

/**
 * The list page, and the two links the whole request hinges on: the row title
 * goes to the task, the pencil goes to its edit page. Both must be real
 * anchors — a (click) handler cannot be cmd-clicked or opened in a new tab.
 */

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: '5',
    projectId: 'standalone',
    title: 'Book the skip',
    completed: false,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date(2026, 7, 1),
    ...overrides
  };
}

class MockTasks {
  store = signal<Task[]>([task()]);
  tasks = this.store;
  standaloneTasks = this.store;
  todaysTasks = signal<Task[]>([]);
  overdueTasks = signal<Task[]>([]);
  upcomingTasks = signal<Task[]>([]);
  getTaskStats = () => ({
    total: 1,
    completed: 0,
    pending: 1,
    overdue: 0,
    upcoming: 0,
    completionRate: 0
  });
  createTask = jasmine.createSpy('createTask');
  toggleTask = jasmine.createSpy('toggleTask');
  setStatus = jasmine.createSpy('setStatus');
  deleteTask = jasmine.createSpy('deleteTask');
  tasksForProject = () => [];
}

class MockProjects {
  projects = signal<any[]>([]);
  getProject = () => undefined;
  updateProjectProgress = jasmine.createSpy('updateProjectProgress');
}

function build() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TasksComponent],
    providers: [
      provideTestUserId(),
      provideHttpClient(),
      provideRouter([]),
      SyncBus,
      { provide: TasksService, useClass: MockTasks },
      { provide: ProjectsService, useClass: MockProjects }
    ]
  });

  const fixture = TestBed.createComponent(TasksComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('TasksComponent', () => {
  it('renders the tasks', () => {
    const { el } = build();
    expect(el.textContent).toContain('Book the skip');
  });

  it('links the title to the task page', () => {
    const { el } = build();
    const links = Array.from(el.querySelectorAll('a'));
    expect(links.some(a => a.getAttribute('href') === '/tasks/5')).toBe(true);
  });

  it('points the pencil at the edit page', () => {
    const { el } = build();
    const links = Array.from(el.querySelectorAll('a'));
    expect(links.some(a => a.getAttribute('href') === '/tasks/5/edit'))
      .withContext('the pencil must be a link, not a prompt()')
      .toBe(true);
  });

  it('seeds nothing on load', () => {
    const { fixture } = build();
    const tasks = TestBed.inject(TasksService) as unknown as MockTasks;
    fixture.detectChanges();
    expect(tasks.createTask).not.toHaveBeenCalled();
  });
});
