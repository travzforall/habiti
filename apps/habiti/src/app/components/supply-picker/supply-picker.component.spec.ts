import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideTestUserId } from '@habiti/storage/testing';
import { UserStorage } from '@habiti/storage';
import { SyncBus } from '@habiti/sync';
import { SupplyPickerComponent } from './supply-picker.component';
import { ProjectBudgetService } from '../../services/project-budget.service';
import { SuppliesService } from '../../services/supplies.service';
import { AuthService } from '../../services/auth.service';
import { BaserowService } from '../../services/baserow.service';

/**
 * The queue is the point: choosing is fast and lossy, and NOTHING is written
 * until it is committed. These tests hold that line.
 */

class MockBudget {
  items: Record<string, unknown>[] = [];
  tools: Record<string, unknown>[] = [];
  addItem = (projectId: string, data: Record<string, unknown>) => {
    this.items.push({ projectId, ...data });
    return data;
  };
  addTool = (projectId: string, data: Record<string, unknown>) => {
    this.tools.push({ projectId, ...data });
    return data;
  };
}

class MockAuth {
  currentUserValue: { id: number } | null = { id: 6 };
}

class MockBaserow {
  tables = { userSupplies: 0 };
  listAllRows = () => of([]);
  createRow = () => of(null);
  updateRow = () => of(null);
  deleteRow = () => of(undefined);
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
    imports: [SupplyPickerComponent],
    providers: [
      provideTestUserId(),
      provideRouter([]),
      SuppliesService,
      SyncBus,
      { provide: ProjectBudgetService, useClass: MockBudget },
      { provide: AuthService, useClass: MockAuth },
      { provide: BaserowService, useClass: MockBaserow },
      { provide: UserStorage, useClass: MockStorage }
    ]
  });

  const fixture = TestBed.createComponent(SupplyPickerComponent);
  fixture.componentRef.setInput('projectId', '20');
  fixture.detectChanges();

  return {
    fixture,
    picker: fixture.componentInstance as unknown as {
      query: string;
      results: () => { id: string; title: string }[];
      showHidden: { set: (value: boolean) => void };
      queueEntry: (entry: unknown) => void;
      queue: () => { key: string; title: string; unitCost: number | null }[];
      importLink: () => void;
      link: string;
      linkError: () => string | null;
      setQuantity: (key: string, value: number) => void;
      setCost: (key: string, value: number) => void;
      setStatus: (key: string, value: string) => void;
      setSize: (key: string, value: string) => void;
      remove: (key: string) => void;
      commit: () => void;
      missingPrices: () => number;
    },
    budget: TestBed.inject(ProjectBudgetService) as unknown as MockBudget
  };
}

describe('picking supplies', () => {
  it('finds things by what people type', () => {
    const { picker } = build();
    picker.query = 'miter saw';

    expect(picker.results()[0].id).toBe('mitre-saw');
  });

  it('queues without writing anything', () => {
    const { picker, budget } = build();
    picker.query = 'mitre saw';
    picker.queueEntry(picker.results()[0]);

    expect(picker.queue().length).toBe(1);
    expect(budget.tools).toEqual([]);
    expect(budget.items).toEqual([]);
  });

  it('writes the whole queue at once when it is committed', () => {
    const { picker, budget } = build();
    picker.query = 'plywood';
    picker.queueEntry(picker.results()[0]);
    picker.query = 'mitre saw';
    picker.queueEntry(picker.results()[0]);

    picker.commit();

    expect(budget.items.length).toBe(1);
    expect(budget.tools.length).toBe(1);
    expect(picker.queue()).toEqual([]);
  });

  it('sends a material to the item list and a tool to the tool list', () => {
    const { picker, budget } = build();
    picker.query = 'concrete mix';
    picker.queueEntry(picker.results()[0]);
    picker.commit();

    expect(budget.items[0]['title']).toContain('Concrete');
    expect(budget.tools).toEqual([]);
  });

  it('puts the chosen size in the name, where it is read', () => {
    const { picker, budget } = build();
    picker.query = 'plywood';
    picker.queueEntry(picker.results()[0]);

    const line = picker.queue()[0];
    picker.setSize(line.key, '1/2 in (12mm)');
    picker.commit();

    expect(budget.items[0]['title']).toBe('Plywood sheet (1/2 in (12mm))');
  });

  it('keeps a quantity and a price', () => {
    const { picker, budget } = build();
    picker.query = 'concrete mix';
    picker.queueEntry(picker.results()[0]);

    const line = picker.queue()[0];
    picker.setQuantity(line.key, 10);
    picker.setCost(line.key, 6.5);
    picker.commit();

    expect(budget.items[0]['quantity']).toBe(10);
    expect(budget.items[0]['unitCost']).toBe(6.5);
  });

  it('sends a hire rate and its days, not a purchase price', () => {
    const { picker, budget } = build();
    // Not a common entry, so it starts out of the way: this is the toggle a
    // person uses when they want the whole list.
    picker.showHidden.set(true);
    picker.query = 'floor sander';
    picker.queueEntry(picker.results()[0]);

    const line = picker.queue()[0];
    picker.setStatus(line.key, 'hire');
    picker.setCost(line.key, 45);
    picker.commit();

    expect(budget.tools[0]['hireRate']).toBe(45);
    expect(budget.tools[0]['purchaseCost']).toBeUndefined();
  });

  it('takes something out of the queue again', () => {
    const { picker } = build();
    picker.query = 'mitre saw';
    picker.queueEntry(picker.results()[0]);
    picker.remove(picker.queue()[0].key);

    expect(picker.queue()).toEqual([]);
  });
});

describe('the link importer', () => {
  it('queues a line from a shop address', () => {
    const { picker } = build();
    picker.link = 'https://www.homedepot.com/p/DEWALT-12-in-Sliding-Compound-Miter-Saw/205183234';
    picker.importLink();

    const [line] = picker.queue();
    expect(line.title.toLowerCase()).toContain('miter saw');
    expect(picker.linkError()).toBeNull();
  });

  it('says a price is still needed, because no address carries one', () => {
    const { picker } = build();
    picker.link = 'https://www.screwfix.com/p/erbauer-mitre-saw/1234x';
    picker.importLink();

    expect(picker.missingPrices()).toBe(1);
  });

  it('stops counting it as missing once a price is typed', () => {
    const { picker } = build();
    picker.link = 'https://www.screwfix.com/p/erbauer-mitre-saw/1234x';
    picker.importLink();
    picker.setCost(picker.queue()[0].key, 199);

    expect(picker.missingPrices()).toBe(0);
  });

  it('complains rather than queueing nonsense', () => {
    const { picker } = build();
    picker.link = 'a mitre saw please';
    picker.importLink();

    expect(picker.queue()).toEqual([]);
    expect(picker.linkError()).toContain('web address');
  });

  it('keeps the link and the SKU on what it creates', () => {
    const { picker, budget } = build();
    picker.link = 'https://www.homedepot.com/p/Some-Saw/205183234';
    picker.importLink();
    picker.commit();

    expect(String(budget.tools[0]['note'])).toContain('205183234');
    expect(String(budget.tools[0]['note'])).toContain('homedepot.com');
  });
});

describe('the account’s own list', () => {
  it('opens on the common things, not on all of them', () => {
    // Narrowed to one word, because the list is capped at 60 rows and an
    // unfiltered comparison would hit the cap both times and prove nothing.
    const { picker } = build();
    picker.query = 'saw';
    const common = picker.results().length;

    picker.showHidden.set(true);
    const everything = picker.results().length;

    expect(common).toBeGreaterThan(0);
    expect(everything).toBeGreaterThan(common);
  });

  it('offers something hidden once "show all" is on', () => {
    const { picker } = build();
    picker.query = 'core drill';
    expect(picker.results()).toEqual([]);

    picker.showHidden.set(true);
    expect(picker.results().map(e => e.title)).toContain('Core drill');
  });

  it('starts a queued line at the price this account remembers', () => {
    const { picker } = build();
    const supplies = TestBed.inject(SuppliesService);
    const plywood = supplies.library().find(entry => entry.id === 'plywood')!;
    supplies.update(plywood, { defaultCost: 42 });

    picker.query = 'plywood';
    picker.queueEntry(picker.results()[0]);

    expect(picker.queue()[0].unitCost).toBe(42);
  });
});
