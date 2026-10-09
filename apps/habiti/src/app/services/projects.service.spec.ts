import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { ProjectsService } from './projects.service';
import { TasksService } from './tasks.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';


/**
 * Milestones: the part of a project that has a shape in time.
 *
 * Their order is the order of the timeline's rows, and what they are made of is
 * stored on the tasks — so both of those have to survive an edit.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { userProjects: 630, userTasks: 631, projectMilestones: 638 };
  created: { table: number; data: Record<string, unknown> }[] = [];
  updated: { table: number; id: number; data: Record<string, unknown> }[] = [];
  deleted: { table: number; id: number }[] = [];
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  getRow = jasmine.createSpy('getRow').and.returnValue(of(null));
  createRow = jasmine
    .createSpy('createRow')
    .and.callFake((table: number, data: Record<string, unknown>) => {
      this.created.push({ table, data });
      return of(null);
    });
  updateRow = jasmine
    .createSpy('updateRow')
    .and.callFake((table: number, id: number, data: Record<string, unknown>) => {
      this.updated.push({ table, id, data });
      return of(null);
    });
  deleteRow = jasmine.createSpy('deleteRow').and.callFake((table: number, id: number) => {
    this.deleted.push({ table, id });
    return of(undefined);
  });
}

class MockStorage {
  values = new Map<string, string>();
  readRaw = (key: string) => this.values.get(key) ?? null;
  writeRaw = (key: string, value: string) => void this.values.set(key, value);
}

function build() {
  localStorage.clear();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestUserId(),
      ProjectsService,
      TasksService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  const projects = TestBed.inject(ProjectsService);
  const tasks = TestBed.inject(TasksService);
  const baserow = TestBed.inject(BaserowService) as unknown as MockBaserow;
  const project = projects.createProject({ title: 'Launch', type: 'business' });
  return { projects, tasks, project, baserow };
}

describe('ProjectsService milestones', () => {
  it('takes its colour and icon from the project type', () => {
    const { projects } = build();
    const work = projects.createProject({ title: 'Day job', type: 'work' });

    expect(work.color).toBe('#3b82f6');
    expect(work.icon).toBe('💼');
  });

  it('creates a milestone with a shape in time', () => {
    const { projects, project } = build();
    const milestone = projects.createMilestone(project.id, {
      title: 'MVP Release',
      startDate: new Date(2026, 6, 1),
      targetDate: new Date(2026, 8, 4),
      colour: '#0ea5e9'
    });

    expect(milestone.startDate).toEqual(new Date(2026, 6, 1));
    expect(milestone.colour).toBe('#0ea5e9');
    expect(milestone.sortOrder).toBe(1);
  });

  it('numbers each new milestone after the last', () => {
    const { projects, project } = build();
    projects.createMilestone(project.id, { title: 'One' });
    const second = projects.createMilestone(project.id, { title: 'Two' });

    expect(second.sortOrder).toBe(2);
  });

  describe('editing', () => {
    it('changes everything a milestone has, not just its dates', () => {
      const { projects, project } = build();
      const milestone = projects.createMilestone(project.id, { title: 'Draft name' });

      projects.updateMilestone(project.id, milestone.id, {
        title: 'MVP Release',
        description: 'Everything a first user needs',
        startDate: new Date(2026, 6, 1),
        targetDate: new Date(2026, 8, 4),
        colour: '#8b5cf6'
      });

      const updated = projects.getProject(project.id)!.milestones[0];
      expect(updated.title).toBe('MVP Release');
      expect(updated.description).toBe('Everything a first user needs');
      expect(updated.colour).toBe('#8b5cf6');
      expect(updated.targetDate).toEqual(new Date(2026, 8, 4));
    });

    it('stamps completedAt when it is ticked, and clears it when it is not', () => {
      const { projects, project } = build();
      const milestone = projects.createMilestone(project.id, { title: 'Ship' });

      projects.updateMilestone(project.id, milestone.id, { completed: true });
      expect(projects.getProject(project.id)!.milestones[0].completedAt).toBeInstanceOf(Date);

      projects.updateMilestone(project.id, milestone.id, { completed: false });
      expect(projects.getProject(project.id)!.milestones[0].completedAt).toBeUndefined();
    });
  });

  describe('order', () => {
    function ordered(projects: ProjectsService, projectId: string): string[] {
      return [...projects.getProject(projectId)!.milestones]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(milestone => milestone.title);
    }

    it('moves a milestone up', () => {
      const { projects, project } = build();
      projects.createMilestone(project.id, { title: 'First' });
      const second = projects.createMilestone(project.id, { title: 'Second' });

      projects.moveMilestone(project.id, second.id, -1);
      expect(ordered(projects, project.id)).toEqual(['Second', 'First']);
    });

    it('moves one down', () => {
      const { projects, project } = build();
      const first = projects.createMilestone(project.id, { title: 'First' });
      projects.createMilestone(project.id, { title: 'Second' });

      projects.moveMilestone(project.id, first.id, 1);
      expect(ordered(projects, project.id)).toEqual(['Second', 'First']);
    });

    it('does nothing at the ends', () => {
      const { projects, project } = build();
      const only = projects.createMilestone(project.id, { title: 'Only' });

      projects.moveMilestone(project.id, only.id, -1);
      projects.moveMilestone(project.id, only.id, 1);
      expect(ordered(projects, project.id)).toEqual(['Only']);
    });
  });

  describe('deleting', () => {
    it('releases its tasks rather than deleting them', () => {
      const { projects, tasks, project } = build();
      const milestone = projects.createMilestone(project.id, { title: 'Build' });
      const task = tasks.createTask({
        title: 'Write the thing',
        projectId: project.id,
        milestoneId: milestone.id
      });

      projects.deleteMilestone(project.id, milestone.id);

      // The task survives; it simply belongs to no milestone now.
      const survivor = tasks.getTask(task.id);
      expect(survivor).toBeDefined();
      expect(survivor!.milestoneId).toBeUndefined();
      expect(projects.getProject(project.id)!.milestones.length).toBe(0);
    });
  });

  it('assigns a task to a milestone and takes it out again', () => {
    const { projects, tasks, project } = build();
    const milestone = projects.createMilestone(project.id, { title: 'Build' });
    const task = tasks.createTask({ title: 'x', projectId: project.id });

    projects.assignTaskToMilestone(task.id, milestone.id);
    expect(tasks.getTask(task.id)!.milestoneId).toBe(milestone.id);

    projects.assignTaskToMilestone(task.id, undefined);
    expect(tasks.getTask(task.id)!.milestoneId).toBeUndefined();
  });
});

describe('ProjectsService milestone dependencies', () => {
  it('names what a milestone is waiting on, while it is unfinished', () => {
    const { projects, project } = build();
    const design = projects.createMilestone(project.id, { title: 'Design' });
    const build2 = projects.createMilestone(project.id, { title: 'Build' });

    expect(projects.addMilestoneDependency(project.id, build2.id, design.id)).toBe(true);
    expect(projects.milestoneBlockers(project.id, build2.id).map(m => m.title)).toEqual(['Design']);

    projects.updateMilestone(project.id, design.id, { completed: true });
    expect(projects.milestoneBlockers(project.id, build2.id)).toEqual([]);
  });

  it('reports the reverse', () => {
    const { projects, project } = build();
    const design = projects.createMilestone(project.id, { title: 'Design' });
    const build2 = projects.createMilestone(project.id, { title: 'Build' });
    projects.addMilestoneDependency(project.id, build2.id, design.id);

    expect(projects.milestonesBlockedBy(project.id, design.id).map(m => m.title)).toEqual(['Build']);
  });

  it('refuses a loop', () => {
    const { projects, project } = build();
    const a = projects.createMilestone(project.id, { title: 'A' });
    const b = projects.createMilestone(project.id, { title: 'B' });

    expect(projects.addMilestoneDependency(project.id, b.id, a.id)).toBe(true);
    expect(projects.addMilestoneDependency(project.id, a.id, b.id)).toBe(false);
  });

  it('removes one', () => {
    const { projects, project } = build();
    const a = projects.createMilestone(project.id, { title: 'A' });
    const b = projects.createMilestone(project.id, { title: 'B' });
    projects.addMilestoneDependency(project.id, b.id, a.id);

    projects.removeMilestoneDependency(project.id, b.id, a.id);
    expect(projects.milestoneBlockers(project.id, b.id)).toEqual([]);
  });

  it('keeps the other new fields', () => {
    const { projects, project } = build();
    const milestone = projects.createMilestone(project.id, { title: 'Ship' });

    projects.updateMilestone(project.id, milestone.id, {
      owner: 'Travon',
      status: 'at_risk',
      definitionOfDone: 'Signed off by two people'
    });

    const updated = projects.getProject(project.id)!.milestones[0];
    expect(updated.owner).toBe('Travon');
    expect(updated.status).toBe('at_risk');
    expect(updated.definitionOfDone).toBe('Signed off by two people');
  });
});

describe('ProjectsService reading milestones back from the cache', () => {
  /**
   * Everything in localStorage is a string. A field that is not turned back
   * into a Date on the way in is a landmine: it survives the round trip
   * looking fine and then breaks whatever calls getTime() on it — which is
   * the timeline, on every render.
   */
  it('gives back Dates, not the strings they were stored as', () => {
    const first = build();
    const milestone = first.projects.createMilestone(first.project.id, {
      title: 'MVP',
      startDate: new Date(2026, 6, 1),
      targetDate: new Date(2026, 8, 4)
    });
    first.projects.updateMilestone(first.project.id, milestone.id, { completed: true });

    // What the storage mock holds is exactly what a reload would read.
    const stored = TestBed.inject(UserStorage) as unknown as MockStorage;
    const raw = new Map(stored.values);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        ProjectsService,
        TasksService,
        SyncBus,
        { provide: AuthService, useClass: MockAuth },
        { provide: BaserowService, useClass: MockBaserow },
        {
          provide: UserStorage,
          useFactory: () => {
            const storage = new MockStorage();
            storage.values = raw;
            return storage;
          }
        }
      ]
    });

    const reloaded = TestBed.inject(ProjectsService).getProject(first.project.id)!.milestones[0];
    expect(reloaded.targetDate instanceof Date).toBe(true);
    expect(reloaded.startDate instanceof Date).toBe(true);
    expect(reloaded.completedAt instanceof Date).toBe(true);
    expect(reloaded.startDate!.getTime()).toBe(new Date(2026, 6, 1).getTime());
  });
});

describe('ProjectsService milestones on the server', () => {
  const rowsFor = (baserow: MockBaserow, table: number) =>
    baserow.created.filter(row => row.table === table);

  it('writes a new milestone to its own table, not into the project row', () => {
    const { projects, project, baserow } = build();
    baserow.created.length = 0;

    projects.createMilestone(project.id, {
      title: 'MVP',
      targetDate: new Date(2026, 8, 4),
      startDate: new Date(2026, 6, 1)
    });

    const written = rowsFor(baserow, 638);
    expect(written.length).toBe(1);
    expect(written[0].data['title']).toBe('MVP');
    expect(written[0].data['project_id']).toBe(project.id);
    expect(written[0].data['target_date']).toBe('2026-09-04');
  });

  it('writes an edit', () => {
    const { projects, project, baserow } = build();
    // A numeric id stands in for a milestone that already has a row.
    projects.createMilestone(project.id, { title: 'MVP' });
    const milestone = projects.getProject(project.id)!.milestones[0];
    baserow.updated.length = 0;

    projects.updateMilestone(project.id, milestone.id, { owner: 'Travon', status: 'at_risk' });

    // Local ids are not numbers, so this is still a create until the row lands.
    const wrote = [...baserow.created, ...baserow.updated].filter(row => row.table === 638);
    expect(wrote.some(row => row.data['owner'] === 'Travon')).toBe(true);
    expect(wrote.some(row => row.data['status'] === 'at_risk')).toBe(true);
  });

  it('writes both ends of a reorder', () => {
    const { projects, project, baserow } = build();
    const first = projects.createMilestone(project.id, { title: 'First' });
    projects.createMilestone(project.id, { title: 'Second' });
    baserow.created.length = 0;

    projects.moveMilestone(project.id, first.id, 1);

    const titles = rowsFor(baserow, 638).map(row => row.data['title']);
    expect(titles).toContain('First');
    expect(titles).toContain('Second');
  });

  it('says nothing to the server about a milestone it never sent', () => {
    // A local id has no row to delete, and Number('abc') is NaN — deleting row
    // NaN would be a request for someone else's data.
    const { projects, project, baserow } = build();
    const milestone = projects.createMilestone(project.id, { title: 'Doomed' });
    baserow.deleted.length = 0;

    projects.deleteMilestone(project.id, milestone.id);
    expect(baserow.deleted.filter(row => row.table === 638)).toEqual([]);
  });

  it('keeps milestones made before the table existed, and uploads them', () => {
    // The ambiguous case: the milestones table returns nothing while the cache
    // holds some. That must not be read as "this account has no milestones"
    // when the only copy is local.
    localStorage.clear();
    TestBed.resetTestingModule();

    const storage = new MockStorage();
    storage.values.set(
      'habiti_projects',
      JSON.stringify([
        {
          id: '99',
          title: 'Launch',
          status: 'active',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: [],
          goals: [],
          tags: [],
          milestones: [
            {
              id: 'local-abc',
              projectId: '99',
              title: 'Made offline',
              targetDate: new Date(2026, 8, 4).toISOString(),
              completed: false,
              sortOrder: 1,
              progress: 0,
              tasks: []
            }
          ]
        }
      ])
    );

    const baserow = new MockBaserow();
    // The project exists on the server; the milestones table is empty.
    baserow.listAllRows = jasmine.createSpy('listAllRows').and.callFake((table: number) =>
      of(table === 630 ? [{ id: 99, title: 'Launch', user_id: '6' }] : [])
    );

    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        ProjectsService,
        TasksService,
        SyncBus,
        { provide: AuthService, useClass: MockAuth },
        { provide: BaserowService, useValue: baserow },
        { provide: UserStorage, useValue: storage }
      ]
    });

    const projects = TestBed.inject(ProjectsService);
    projects.reload(); // what a sign-in does: read the cache, then the server

    expect(projects.getProject('99')?.milestones.length).toBe(1);
    expect(baserow.created.some(row => row.table === 638 && row.data['title'] === 'Made offline')).toBe(
      true
    );
  });
});

describe('sub-projects', () => {
  it('creates one inside another', () => {
    const { projects, project } = build();
    const child = projects.createProject({ title: 'Floors', parentId: project.id });

    expect(child.parentId).toBe(project.id);
    expect(projects.subProjectsOf(project.id).map(p => p.title)).toEqual(['Floors']);
    expect(projects.depthOf(child.id)).toBe(2);
  });

  it('gives the breadcrumb, furthest first when reversed by the page', () => {
    const { projects, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    const deep = projects.createProject({ title: 'Floors', parentId: middle.id });

    expect(projects.ancestorsOf(deep.id).map(p => p.title)).toEqual(['Downstairs', 'Launch']);
  });

  it('stops at three levels', () => {
    const { projects, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    const deep = projects.createProject({ title: 'Floors', parentId: middle.id });

    expect(projects.canTakeSubProject(deep.id)).toBe(false);

    // A fourth is refused, and the project is still created — at the top level,
    // where it can be seen and moved, rather than lost.
    const fourth = projects.createProject({ title: 'Too deep', parentId: deep.id });
    expect(fourth.parentId).toBeUndefined();
  });

  it('refuses a move that would loop, and says why', () => {
    const { projects, project } = build();
    const child = projects.createProject({ title: 'Floors', parentId: project.id });

    const check = projects.setParent(project.id, child.id);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('cycle');

    // Nothing moved.
    expect(projects.getProject(project.id)?.parentId).toBeUndefined();
  });

  it('refuses a move that would make a fourth level', () => {
    const { projects, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: middle.id });
    const other = projects.createProject({ title: 'Outside', parentId: project.id });

    // 'middle' carries a child, so moving it under another level-2 project
    // would put that child at level 4.
    const check = projects.setParent(middle.id, other.id);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('too-deep');
  });

  it('moves one back to the top', () => {
    const { projects, project } = build();
    const child = projects.createProject({ title: 'Floors', parentId: project.id });

    expect(projects.setParent(child.id, undefined).ok).toBe(true);
    expect(projects.getProject(child.id)?.parentId).toBeUndefined();
  });

  it('lifts sub-projects instead of deleting them with their parent', () => {
    // Removing a heading is not a decision to destroy everything under it.
    const { projects, project } = build();
    const child = projects.createProject({ title: 'Floors', parentId: project.id });

    projects.deleteProject(project.id);

    const survivor = projects.getProject(child.id);
    expect(survivor).toBeDefined();
    expect(survivor?.parentId).toBeUndefined();
  });

  it('reads as a tree, parents before children', () => {
    const { projects, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: middle.id });

    expect(projects.tree().map(row => `${row.depth}:${row.project.title}`)).toEqual([
      '1:Launch',
      '2:Downstairs',
      '3:Floors'
    ]);
  });

  it('covers the whole family for a roll-up', () => {
    const { projects, project } = build();
    const middle = projects.createProject({ title: 'Downstairs', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: middle.id });

    expect(projects.familyOf(project.id).length).toBe(3);
  });
});



describe('ordering sub-projects by hand', () => {
  function family(projects: ProjectsService, parentId: string) {
    return projects.subProjectsOf(parentId).map(project => project.title);
  }

  it('reads alphabetically until someone drags one', () => {
    const { projects, project } = build();
    projects.createProject({ title: 'Stairs', parentId: project.id });
    projects.createProject({ title: 'Bed', parentId: project.id });

    expect(family(projects, project.id)).toEqual(['Bed', 'Stairs']);
  });

  it('moves one down the list and keeps it there', () => {
    const { projects, project } = build();
    projects.createProject({ title: 'Bed', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: project.id });
    projects.createProject({ title: 'Stairs', parentId: project.id });

    projects.reorderSubProjects(project.id, 0, 2);
    expect(family(projects, project.id)).toEqual(['Floors', 'Stairs', 'Bed']);
  });

  it('moves one up', () => {
    const { projects, project } = build();
    projects.createProject({ title: 'Bed', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: project.id });
    projects.createProject({ title: 'Stairs', parentId: project.id });

    projects.reorderSubProjects(project.id, 2, 0);
    expect(family(projects, project.id)).toEqual(['Stairs', 'Bed', 'Floors']);
  });

  it('numbers the whole group so the order cannot drift', () => {
    const { projects, project } = build();
    projects.createProject({ title: 'Bed', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: project.id });

    projects.reorderSubProjects(project.id, 1, 0);

    const orders = projects.subProjectsOf(project.id).map(p => p.sortOrder);
    expect(orders).toEqual([1, 2]);
  });

  it('puts a project made afterwards at the end, not in the middle', () => {
    // A new project appearing inside an order someone arranged reads as the
    // list rearranging itself.
    const { projects, project } = build();
    projects.createProject({ title: 'Zebra', parentId: project.id });
    projects.createProject({ title: 'Alpha', parentId: project.id });

    // Alphabetical to begin with, so this drags Zebra above Alpha.
    projects.reorderSubProjects(project.id, 1, 0);
    expect(family(projects, project.id)).toEqual(['Zebra', 'Alpha']);

    // Beta would sort second alphabetically, and must not jump into the middle
    // of an order that was arranged by hand.
    projects.createProject({ title: 'Beta', parentId: project.id });
    expect(family(projects, project.id)).toEqual(['Zebra', 'Alpha', 'Beta']);
  });

  it('does nothing when a row is dropped where it already was', () => {
    const { projects, project, baserow } = build();
    projects.createProject({ title: 'Bed', parentId: project.id });
    projects.createProject({ title: 'Floors', parentId: project.id });
    baserow.updated.length = 0;

    projects.reorderSubProjects(project.id, 0, 0);
    expect(baserow.updated.filter(row => row.table === 630)).toEqual([]);
  });
});
