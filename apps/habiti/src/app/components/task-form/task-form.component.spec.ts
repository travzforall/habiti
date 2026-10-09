import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { TaskFormComponent, TaskFormValue } from './task-form.component';
import { Milestone, Project, Task } from '../../models/project.model';

/**
 * What the form hands back — the milestone especially, which is the one field
 * that depends on another field's value to exist at all.
 */

function milestone(id: string, title: string): Milestone {
  return {
    id,
    projectId: 'p1',
    title,
    targetDate: new Date(2026, 8, 1),
    completed: false,
    sortOrder: 1,
    tasks: [],
    progress: 0
  };
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Launch',
    type: 'business',
    status: 'active',
    priority: 'high',
    createdAt: new Date(),
    updatedAt: new Date(),
    tasks: [],
    milestones: [milestone('m1', 'MVP Release'), milestone('m2', 'Public beta')],
    goals: [],
    progress: 0,
    ...overrides
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'First sub-task',
    completed: false,
    status: 'todo',
    priority: 'medium',
    createdAt: new Date(),
    ...overrides
  };
}

@Component({
  standalone: true,
  imports: [TaskFormComponent],
  template: `
    <app-task-form
      [task]="task()"
      [projects]="projects()"
      [defaultProjectId]="defaultProjectId()"
      [defaultMilestoneId]="defaultMilestoneId()"
      (saved)="saved.set($event)"
    ></app-task-form>
  `
})
class Host {
  readonly task = signal<Task | undefined>(undefined);
  readonly projects = signal<Project[]>([project()]);
  readonly defaultProjectId = signal('p1');
  readonly defaultMilestoneId = signal('');
  readonly saved = signal<TaskFormValue | null>(null);
}

function build() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance };
}

/**
 * NgModel writes the model into the DOM in a MICROTASK, so one detectChanges
 * shows the previous value. Every test here settles before it looks.
 */
async function settle(fixture: ReturnType<typeof build>['fixture']): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function submit(fixture: ReturnType<typeof build>['fixture']): void {
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
}

function milestoneSelect(fixture: ReturnType<typeof build>['fixture']): HTMLSelectElement | null {
  return fixture.nativeElement.querySelector('select[name="milestoneId"]');
}

describe('TaskFormComponent milestones', () => {
  it('offers the chosen project"s milestones', () => {
    const { fixture } = build();
    const select = milestoneSelect(fixture)!;

    expect(select).toBeTruthy();
    expect(Array.from(select.options).map(option => option.text.trim())).toEqual([
      'Not in a milestone',
      'MVP Release',
      'Public beta'
    ]);
  });

  it('offers nothing at all when the project has no milestones', () => {
    const { fixture, host } = build();
    host.projects.set([project({ milestones: [] })]);
    fixture.detectChanges();

    expect(milestoneSelect(fixture)).toBeNull();
  });

  it('shows the milestone the task is already in', async () => {
    const { fixture, host } = build();
    host.task.set(task({ milestoneId: 'm2' }));
    await settle(fixture);

    expect(milestoneSelect(fixture)!.value).toBe('m2');
  });

  it('emits the milestone that is selected — the whole point', async () => {
    const { fixture, host } = build();
    host.task.set(task({ milestoneId: 'm1' }));
    await settle(fixture);

    submit(fixture);
    expect(host.saved()?.milestoneId).toBe('m1');
  });

  it('emits a milestone chosen by hand', async () => {
    const { fixture, host } = build();
    host.task.set(task());
    await settle(fixture);

    const select = milestoneSelect(fixture)!;
    select.value = 'm2';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    submit(fixture);
    expect(host.saved()?.milestoneId).toBe('m2');
  });

  it('emits undefined when it is taken out of one', async () => {
    const { fixture, host } = build();
    host.task.set(task({ milestoneId: 'm1' }));
    await settle(fixture);

    const select = milestoneSelect(fixture)!;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    submit(fixture);
    expect(host.saved()?.milestoneId).toBeUndefined();
  });

  it('starts on the milestone it was opened from', async () => {
    const { fixture, host } = build();
    host.defaultMilestoneId.set('m2');
    await settle(fixture);

    expect(milestoneSelect(fixture)!.value).toBe('m2');
  });

  it('drops a milestone that does not belong to the newly chosen project', async () => {
    const { fixture, host } = build();
    host.projects.set([project(), project({ id: 'p2', title: 'Other', milestones: [] })]);
    host.task.set(task({ milestoneId: 'm1' }));
    await settle(fixture);

    const projectSelect = fixture.nativeElement.querySelector(
      'select[name="projectId"]'
    ) as HTMLSelectElement;
    projectSelect.value = 'p2';
    projectSelect.dispatchEvent(new Event('change'));
    await settle(fixture);

    submit(fixture);
    expect(host.saved()?.projectId).toBe('p2');
    expect(host.saved()?.milestoneId).toBeUndefined();
  });
});
