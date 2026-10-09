import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { ProjectsComponent } from './projects';
import { ProjectsService } from '../../services/projects.service';
import { ProjectBudgetService } from '../../services/project-budget.service';
import { CurrencyService } from '../../services/currency.service';
import { Project } from '../../models/project.model';

/**
 * The two views of this page, and the reason the second exists.
 *
 * A List/Board toggle once shipped here with only one branch written, so
 * choosing Board emptied the screen. Both branches of this one are asserted.
 */

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Downstairs A',
    description: '',
    type: 'home',
    status: 'active',
    priority: 'medium',
    createdAt: new Date(2026, 7, 1),
    updatedAt: new Date(2026, 7, 1),
    tasks: [],
    milestones: [],
    goals: [],
    progress: 0,
    archived: false,
    ...overrides
  };
}

const projects = signal<Project[]>([]);

class MockProjects {
  projects = projects;
  activeProjects = projects;
  getProject = (id: string) => projects().find(p => p.id === id);
  subProjectsOf = (id: string) => projects().filter(p => p.parentId === id);
  createProject = jasmine.createSpy('createProject');
  deleteProject = jasmine.createSpy('deleteProject');
}

/**
 * Set BEFORE build(), never after.
 *
 * The page memoises its money in a computed, so mutating the mock afterwards
 * may or may not be seen depending on whether that computed has already run —
 * which is a test that passes or fails by luck. Module-level state, configured
 * up front, removes the race.
 */
const money = new Map<string, { spent: number; committed: number }>();
const items = new Map<string, { status: string }[]>();

class MockBudget {
  summaryFor = (projectId: string) => {
    const found = money.get(projectId) ?? { spent: 0, committed: 0 };
    return {
      ...found,
      projected: found.spent + found.committed,
      over: false,
      unconverted: [] as string[]
    };
  };

  itemsFor = (projectId: string) => items.get(projectId) ?? [];
  toolsFor = () => [];
  toolsForTask = () => [];
}

class MockCurrency {
  home = signal('GBP');
  table = () => ({ home: 'GBP', rates: {} });
}

function build(rows: Project[]) {
  projects.set(rows);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ProjectsComponent],
    providers: [
      provideTestUserId(),
      provideRouter([]),
      provideHttpClient(),
      { provide: ProjectsService, useClass: MockProjects },
      { provide: ProjectBudgetService, useClass: MockBudget },
      { provide: CurrencyService, useClass: MockCurrency }
    ]
  });

  const fixture = TestBed.createComponent(ProjectsComponent);
  fixture.detectChanges();
  return fixture;
}

const family = [
  project({ id: 'root', title: 'Downstairs A' }),
  project({
    id: 'floors',
    title: 'Floors',
    parentId: 'root',
    tasks: [{ completed: true }, { completed: false }] as Project['tasks']
  }),
  project({ id: 'stairs', title: 'Stairs', parentId: 'root' })
];

beforeEach(() => {
  // Preferences live in localStorage, so one test's choice is the next one's
  // starting state unless it is cleared.
  localStorage.clear();
  money.clear();
  items.clear();
});

/**
 * Writes a preference the way the page will read it.
 *
 * Through UserStorage rather than localStorage directly: the key is namespaced
 * per account, and a hand-written `habiti_pref_x::test-user` guess lands
 * somewhere nothing reads — leaving the test passing or failing on whatever the
 * previous one happened to store.
 */
function seedPreference(name: string, value: string): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideTestUserId()] });
  TestBed.inject(UserStorage).writeRaw(`habiti_pref_${name}`, value);
}

describe('the projects page', () => {

  it('shows every project as a card by default', () => {
    const fixture = build(family);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Downstairs A');
    expect(text).toContain('Floors');
    expect(text).toContain('Stairs');
  });

  it('groups by root when the other view is chosen, and both branches render', () => {
    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      view: { set: (value: 'cards' | 'roots') => void };
    };

    component.view.set('roots');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Downstairs A');
    expect(text).toContain('2 sub-projects');
  });

  it('counts tasks from the sub-projects, not from the root’s empty list', () => {
    // The whole point: the root's own list is empty once its tasks have been
    // promoted, and a card reading 0% would be a lie about a family of work.
    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      view: { set: (value: 'cards' | 'roots') => void };
      roots: () => { taskCount: number; doneCount: number; progress: number }[];
    };

    component.view.set('roots');
    fixture.detectChanges();

    const [summary] = component.roots();
    expect(summary.taskCount).toBe(2);
    expect(summary.doneCount).toBe(1);
    expect(summary.progress).toBe(50);
  });

  it('lists one card per root, never a sub-project as a root', () => {
    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      roots: () => { root: Project }[];
    };

    expect(component.roots().map(summary => summary.root.title)).toEqual(['Downstairs A']);
  });
});

describe('remembering the view', () => {
  it('opens on the view that was left last time', () => {
    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      setView: (value: 'cards' | 'roots') => void;
    };

    component.setView('roots');

    // A fresh mount is what a reload is.
    const reopened = build(family);
    const view = (reopened.componentInstance as unknown as { view: () => string }).view();
    expect(view).toBe('roots');
  });

  it('falls back to cards when the stored value is not a view any more', () => {
    // A preference a later version removed must not leave a blank page.
    seedPreference('projectsView', 'kanban');

    const fixture = build(family);
    const view = (fixture.componentInstance as unknown as { view: () => string }).view();
    expect(view).toBe('cards');
  });
});

describe('what a sub-project row says', () => {
  it('rolls a sub-project up with its own children', () => {
    // "Break wall" holds a sub-project with the actual work in it; the row
    // must not read 0/0 while something under it is half done.
    const deep = [
      project({ id: 'root', title: 'Downstairs A' }),
      project({ id: 'wall', title: 'Break wall', parentId: 'root' }),
      project({
        id: 'permits',
        title: 'Permits',
        parentId: 'wall',
        tasks: [{ completed: true }, { completed: false }] as Project['tasks']
      })
    ];

    const fixture = build(deep);
    const component = fixture.componentInstance as unknown as {
      familyOf: (id: string) => { taskCount: number; doneCount: number; projectCount: number };
    };

    const line = component.familyOf('wall');
    expect(line.taskCount).toBe(2);
    expect(line.doneCount).toBe(1);
    expect(line.projectCount).toBe(2);
  });

  it('counts what is still to be bought, across the family', () => {
    items.set('floors', [{ status: 'needed' }, { status: 'ordered' }, { status: 'have' }]);

    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      itemsNeeded: (id: string) => number;
    };

    // 'have' is not "to buy" — it is already in the shed.
    expect(component.itemsNeeded('floors')).toBe(2);
  });

  it('shows the money on the row once there is any', () => {
    money.set('floors', { spent: 40, committed: 65 });

    const fixture = build(family);
    const component = fixture.componentInstance as unknown as {
      setView: (value: 'cards' | 'roots') => void;
      familyOf: (id: string) => { projected: number };
    };
    component.setView('roots');
    fixture.detectChanges();

    expect(component.familyOf('floors').projected).toBe(105);
  });
});
