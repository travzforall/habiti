import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { ProjectPlansService } from './project-plans.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { projectPlans: 641 };
  created: { table: number; data: Record<string, unknown> }[] = [];
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.callFake((table: number, data: Record<string, unknown>) => {
    this.created.push({ table, data });
    return of(null);
  });
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
  deleteRow = jasmine.createSpy('deleteRow').and.returnValue(of(undefined));
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
      ProjectPlansService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  return {
    plans: TestBed.inject(ProjectPlansService),
    baserow: TestBed.inject(BaserowService) as unknown as MockBaserow
  };
}

describe('plans on a project', () => {
  it('names them A, B, C when nobody says otherwise', () => {
    const { plans } = build();
    expect(plans.addPlan('20', {}).title).toBe('Plan A');
    expect(plans.addPlan('20', {}).title).toBe('Plan B');
  });

  it('keeps each project’s plans to itself', () => {
    const { plans } = build();
    plans.addPlan('20', { title: 'Here' });
    plans.addPlan('21', { title: 'Elsewhere' });

    expect(plans.plansFor('20').map(plan => plan.title)).toEqual(['Here']);
  });

  it('writes a plan to its table', () => {
    const { plans, baserow } = build();
    plans.addPlan('20', { title: 'Plan A', cost: 1800, risk: 'low' });

    const written = baserow.created.find(row => row.table === 641);
    expect(written?.data['title']).toBe('Plan A');
    expect(written?.data['cost']).toBe(1800);
    expect(written?.data['risk']).toBe('low');
  });

  it('sends an unset level as null, because a select rejects an empty string', () => {
    const { plans, baserow } = build();
    plans.addPlan('20', { title: 'Plan A' });

    expect(baserow.created[0].data['risk']).toBeNull();
    expect(baserow.created[0].data['effort']).toBeNull();
  });
});

describe('ranking', () => {
  it('puts the best-looking plan first', () => {
    const { plans } = build();
    plans.addPlan('20', { title: 'Dear and risky', cost: 9000, risk: 'high', rating: 2 });
    plans.addPlan('20', { title: 'Cheap and safe', cost: 1200, risk: 'low', rating: 5 });

    expect(plans.rankedFor('20')[0].plan.title).toBe('Cheap and safe');
  });

  it('pins the chosen plan to the top, whatever it scored', () => {
    const { plans } = build();
    plans.addPlan('20', { title: 'Best on paper', cost: 100, rating: 5, risk: 'low' });
    const picked = plans.addPlan('20', { title: 'The one we picked', cost: 9000, rating: 1 });

    plans.choosePlan('20', picked.id);

    const ranked = plans.rankedFor('20');
    expect(ranked[0].plan.title).toBe('The one we picked');
    expect(ranked[0].chosen).toBe(true);
  });
});

describe('deciding', () => {
  it('moves the previous choice back to considering, not to rejected', () => {
    // Changing your mind about which to do is not the same as ruling the old
    // one out. Only the person can say that.
    const { plans } = build();
    const first = plans.addPlan('20', { title: 'A' });
    const second = plans.addPlan('20', { title: 'B' });

    plans.choosePlan('20', first.id);
    plans.choosePlan('20', second.id);

    const byTitle = new Map(plans.plansFor('20').map(plan => [plan.title, plan]));
    expect(byTitle.get('A')?.status).toBe('considering');
    expect(byTitle.get('B')?.status).toBe('chosen');
  });

  it('stamps the day a plan is decided, and clears it if it is reopened', () => {
    const { plans } = build();
    const plan = plans.addPlan('20', { title: 'A' });

    plans.updatePlan(plan.id, { status: 'rejected' });
    expect(plans.plansFor('20')[0].decidedAt instanceof Date).toBe(true);

    plans.updatePlan(plan.id, { status: 'considering' });
    expect(plans.plansFor('20')[0].decidedAt).toBeUndefined();
  });

  it('keeps a rejected plan rather than deleting it', () => {
    const { plans } = build();
    const plan = plans.addPlan('20', { title: 'No' });
    plans.updatePlan(plan.id, { status: 'rejected' });

    expect(plans.plansFor('20').length).toBe(1);
    expect(plans.rankedFor('20')[0].plan.status).toBe('rejected');
  });
});
