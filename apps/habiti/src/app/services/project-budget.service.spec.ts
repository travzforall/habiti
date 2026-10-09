import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { ProjectBudgetService } from './project-budget.service';
import { AuthService } from './auth.service';
import { BaserowService } from './baserow.service';

/**
 * The item list, the expense list, and the numbers that come out of them.
 *
 * The arithmetic itself is covered by config/budget-math.spec.ts; what is
 * tested here is that the service feeds it the right things and that money
 * survives being written down.
 */

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { projectItems: 639, projectExpenses: 640, projectTools: 642 };
  created: { table: number; data: Record<string, unknown> }[] = [];
  deleted: { table: number; id: number }[] = [];
  listAllRows = jasmine.createSpy('listAllRows').and.returnValue(of([]));
  createRow = jasmine.createSpy('createRow').and.callFake((table: number, data: Record<string, unknown>) => {
    this.created.push({ table, data });
    return of(null);
  });
  updateRow = jasmine.createSpy('updateRow').and.returnValue(of(null));
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
      ProjectBudgetService,
      SyncBus,
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  const budget = TestBed.inject(ProjectBudgetService);
  const baserow = TestBed.inject(BaserowService) as unknown as MockBaserow;
  return { budget, baserow };
}

describe('the item list', () => {
  it('adds an item and keeps it with its project', () => {
    const { budget } = build();
    budget.addItem('20', { title: '10 bags Quikrete', quantity: 10, unitCost: 6.5, unit: 'bags' });
    budget.addItem('21', { title: 'Fence panels' });

    expect(budget.itemsFor('20').map(item => item.title)).toEqual(['10 bags Quikrete']);
    expect(budget.itemsFor('21').length).toBe(1);
  });

  it('writes it to the item table', () => {
    const { budget, baserow } = build();
    budget.addItem('20', { title: 'Vinyl', quantity: 12, unitCost: 19.99 });

    const written = baserow.created.find(row => row.table === 639);
    expect(written?.data['title']).toBe('Vinyl');
    expect(written?.data['unit_cost']).toBe(19.99);
  });

  it('defaults a quantity to one, because most things are just one thing', () => {
    const { budget } = build();
    const item = budget.addItem('20', { title: 'Bathroom vent' });
    expect(item.quantity).toBe(1);
  });

  it('numbers each new item after the last', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'First' });
    const second = budget.addItem('20', { title: 'Second' });
    expect(second.sortOrder).toBe(2);
  });
});

describe('the money', () => {
  it('separates what is spent from what is only promised', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'Quikrete', quantity: 10, unitCost: 6.5 });
    budget.addExpense('20', { title: 'Vinyl', amount: 240 });

    const summary = budget.summaryFor('20', 400);
    expect(summary.spent).toBe(240);
    expect(summary.committed).toBe(65);
    expect(summary.projected).toBe(305);
    expect(summary.remaining).toBe(95);
    expect(summary.over).toBe(false);
  });

  it('counts only this project', () => {
    const { budget } = build();
    budget.addExpense('20', { title: 'Here', amount: 100 });
    budget.addExpense('21', { title: 'Elsewhere', amount: 500 });

    expect(budget.summaryFor('20').spent).toBe(100);
  });
});

describe('buying an item', () => {
  it('records the spend and marks it as in hand, in one go', () => {
    const { budget } = build();
    const item = budget.addItem('20', { title: 'Quikrete', quantity: 10, unitCost: 6.5 });

    const expense = budget.buyItem(item.id);

    expect(expense?.amount).toBe(65);
    expect(expense?.itemId).toBe(item.id);
    expect(budget.itemsFor('20')[0].status).toBe('have');
    // Committed drops to nothing; spent picks it up. The total does not move.
    expect(budget.summaryFor('20').committed).toBe(0);
    expect(budget.summaryFor('20').spent).toBe(65);
  });

  it('takes what was actually paid when that is not what was expected', () => {
    const { budget } = build();
    const item = budget.addItem('20', { title: 'Quikrete', quantity: 10, unitCost: 6.5 });

    const expense = budget.buyItem(item.id, 71.4);
    expect(expense?.amount).toBe(71.4);
    expect(budget.summaryFor('20').spent).toBe(71.4);
  });

  it('does nothing for an item that is not there', () => {
    const { budget } = build();
    expect(budget.buyItem('nope')).toBeUndefined();
  });
});

describe('deleting', () => {
  it('keeps the spending when the item goes', () => {
    // Money that left the account is a fact; deleting the shopping-list line
    // it hung off does not unspend it.
    const { budget } = build();
    const item = budget.addItem('20', { title: 'Quikrete', unitCost: 65 });
    budget.buyItem(item.id);

    budget.deleteItem(item.id);

    expect(budget.itemsFor('20')).toEqual([]);
    expect(budget.summaryFor('20').spent).toBe(65);
    expect(budget.expensesFor('20')[0].itemId).toBeUndefined();
  });

  it('asks the server to delete only a row that exists there', () => {
    const { budget, baserow } = build();
    const item = budget.addItem('20', { title: 'Local only' });
    budget.deleteItem(item.id);

    // A local id is not a number; deleting row NaN would be someone else's data.
    expect(baserow.deleted).toEqual([]);
  });
});

describe('the item plan', () => {
  it('stages items by milestone with a running total', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'Levelling compound', unitCost: 65, milestoneId: 'm1' });
    budget.addItem('20', { title: 'Vinyl', unitCost: 240, milestoneId: 'm2' });
    budget.addItem('20', { title: 'Spare screws', unitCost: 5 });

    const plan = budget.planFor('20', ['m1', 'm2']);

    expect(plan.map(group => group.key)).toEqual(['m1', 'm2', undefined]);
    expect(plan.map(group => group.runningTotal)).toEqual([65, 305, 310]);
  });
});

describe('surviving a reload', () => {
  it('reads back what it wrote, with dates as dates', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'Vinyl', plannedFor: new Date(2026, 8, 4) });
    budget.addExpense('20', { title: 'Deposit', amount: 50, spentAt: new Date(2026, 7, 1) });

    const storage = TestBed.inject(UserStorage) as unknown as MockStorage;
    const kept = new Map(storage.values);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestUserId(),
        ProjectBudgetService,
        SyncBus,
        { provide: AuthService, useClass: MockAuth },
        { provide: BaserowService, useClass: MockBaserow },
        {
          provide: UserStorage,
          useFactory: () => {
            const storage = new MockStorage();
            storage.values = kept;
            return storage;
          }
        }
      ]
    });

    const reloaded = TestBed.inject(ProjectBudgetService);
    expect(reloaded.itemsFor('20')[0].plannedFor instanceof Date).toBe(true);
    expect(reloaded.expensesFor('20')[0].spentAt instanceof Date).toBe(true);
    expect(reloaded.summaryFor('20').spent).toBe(50);
  });
});

describe('a task’s own money', () => {
  it('is its share of the project’s, not a second pot', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'Vinyl', unitCost: 240, taskId: 't-floors' });
    budget.addExpense('20', { title: 'Levelling compound', amount: 65, taskId: 't-floors' });
    budget.addExpense('20', { title: 'Skip hire', amount: 180 });

    const task = budget.summaryForTask('t-floors', 400);
    expect(task.spent).toBe(65);
    expect(task.committed).toBe(240);
    expect(task.projected).toBe(305);

    // The same money, once, in the project total — plus the spend that belongs
    // to no task.
    const project = budget.summaryFor('20');
    expect(project.spent).toBe(245);
    expect(project.committed).toBe(240);
  });

  it('says when a task is over its own budget while the project is fine', () => {
    const { budget } = build();
    budget.addExpense('20', { title: 'Overrun', amount: 150, taskId: 't1' });

    expect(budget.summaryForTask('t1', 100).over).toBe(true);
    expect(budget.summaryFor('20', 5000).over).toBe(false);
  });

  it('rolls every task with money up for the project', () => {
    const { budget } = build();
    budget.addItem('20', { title: 'Vinyl', unitCost: 240, taskId: 't-floors' });
    budget.addExpense('20', { title: 'Vent', amount: 60, taskId: 't-vent' });

    const rows = budget.rollUpFor(
      '20',
      new Map([
        ['t-floors', 300],
        ['t-vent', undefined],
        ['t-quiet', undefined]
      ])
    );

    expect(rows.map(row => row.taskId).sort()).toEqual(['t-floors', 't-vent']);
    expect(rows.find(row => row.taskId === 't-floors')?.remaining).toBe(60);
  });

  it('reports over-allocation before any money moves', () => {
    const { budget } = build();
    const result = budget.allocationFor(
      new Map([
        ['a', 900],
        ['b', 800],
        ['c', 700]
      ]),
      2000
    );

    expect(result.allocated).toBe(2400);
    expect(result.overAllocated).toBe(true);
  });
});

describe('tools a job needs', () => {
  it('lists what still has to be got hold of', () => {
    const { budget } = build();
    budget.addTool('20', { title: 'SDS drill', status: 'own' });
    budget.addTool('20', { title: 'Floor sander', status: 'hire', hireRate: 45, hireDays: 2 });
    budget.addTool('20', { title: 'Levelling trowel', status: 'buy', purchaseCost: 22 });

    expect(budget.toolsToGet('20').map(tool => tool.title)).toEqual([
      'Floor sander',
      'Levelling trowel'
    ]);
  });

  it('adds hired and bought tools to the budget, and nothing else', () => {
    const { budget } = build();
    budget.addTool('20', { title: 'Sander', status: 'hire', hireRate: 45, hireDays: 2 });
    budget.addTool('20', { title: 'Trowel', status: 'buy', purchaseCost: 22 });
    budget.addTool('20', { title: 'Dad’s ladder', status: 'borrow' });
    budget.addTool('20', { title: 'My drill', status: 'own' });

    // 90 + 22, and not a penny for the ladder or the drill.
    expect(budget.summaryFor('20').committed).toBe(112);
  });

  it('keeps counting a hire that has arrived, because the hire is still owed', () => {
    const { budget } = build();
    const tool = budget.addTool('20', { title: 'Sander', status: 'hire', hireRate: 45, hireDays: 2 });

    budget.updateTool(tool.id, { inHand: true });
    expect(budget.summaryFor('20').committed).toBe(90);
    expect(budget.toolsToGet('20')).toEqual([]);
  });

  it('stops counting a bought tool once it is here', () => {
    // By then it should be an expense; counting both would double it.
    const { budget } = build();
    const tool = budget.addTool('20', { title: 'Trowel', status: 'buy', purchaseCost: 22 });

    budget.updateTool(tool.id, { inHand: true });
    expect(budget.summaryFor('20').committed).toBe(0);
  });

  it('defaults to buy, because guessing "own" hides it from the list and the budget', () => {
    const { budget } = build();
    expect(budget.addTool('20', { title: 'Something' }).status).toBe('buy');
  });

  it('shows a task’s own tools in its own summary', () => {
    const { budget } = build();
    budget.addTool('20', { title: 'Sander', status: 'hire', hireRate: 45, taskId: 't-floors' });
    budget.addTool('20', { title: 'Elsewhere', status: 'buy', purchaseCost: 500 });

    expect(budget.toolsForTask('t-floors').map(tool => tool.title)).toEqual(['Sander']);
    expect(budget.summaryForTask('t-floors').committed).toBe(45);
  });

  it('lists what has to go back, soonest first', () => {
    const { budget } = build();
    budget.addTool('20', { title: 'Late', status: 'borrow', returnBy: new Date(2026, 8, 20) });
    budget.addTool('20', { title: 'Soon', status: 'hire', returnBy: new Date(2026, 8, 4) });
    budget.addTool('20', { title: 'Mine', status: 'own' });

    expect(budget.toolsToReturn('20').map(tool => tool.title)).toEqual(['Soon', 'Late']);
  });

  it('writes a tool to its own table', () => {
    const { budget, baserow } = build();
    budget.addTool('20', { title: 'Sander', status: 'hire', hireRate: 45, hireDays: 2 });

    const written = baserow.created.find(row => row.table === 642);
    expect(written?.data['title']).toBe('Sander');
    expect(written?.data['hire_rate']).toBe(45);
    expect(written?.data['status']).toBe('hire');
  });
});
