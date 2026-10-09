import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { CalendarComponent, DaySummary } from './calendar';
import { HabitsService } from '../../services/habits';

/**
 * The month grid is a summary, so what matters is that the summary is right:
 * the counts, the tint level, the streak, and that future days stay blank
 * rather than reading as 0% failures.
 */
describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;

  /**
   * Completions keyed `habitId|yyyy-m-d`, held in a SIGNAL.
   *
   * `monthDays` is a computed, so a plain Set would never invalidate it and
   * every assertion would read stale data. The real HabitsService reads the
   * `habitEntries` signal here, so this mirrors production rather than working
   * around the component.
   */
  let completions: ReturnType<typeof signal<Set<string>>>;
  let habitsStub: {
    habits: ReturnType<typeof signal<{ id: string; name: string; type: string }[]>>;
    isHabitCompletedOnDate: jasmine.Spy;
    toggleHabitForDate: jasmine.Spy;
  };

  const key = (id: string, d: Date) => `${id}|${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  function complete(id: string, daysAgo: number): void {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    completions.update(s => new Set(s).add(key(id, d)));
  }

  function uncomplete(id: string, daysAgo: number): void {
    completions.update(s => {
      const next = new Set(s);
      next.delete(key(id, offset(daysAgo)));
      return next;
    });
  }

  function days(): DaySummary[] {
    return (component as unknown as { monthDays: () => DaySummary[] }).monthDays();
  }

  function dayFor(daysAgo: number): DaySummary {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return days().find(
      x =>
        x.date.getFullYear() === d.getFullYear() &&
        x.date.getMonth() === d.getMonth() &&
        x.date.getDate() === d.getDate()
    )!;
  }

  beforeEach(async () => {
    completions = signal(new Set<string>());
    habitsStub = {
      habits: signal([
        { id: 'a', name: 'Read', type: 'good' },
        { id: 'b', name: 'Run', type: 'good' }
      ]),
      isHabitCompletedOnDate: jasmine
        .createSpy('isHabitCompletedOnDate')
        .and.callFake((id: string, d: Date) => completions().has(key(id, d))),
      toggleHabitForDate: jasmine.createSpy('toggleHabitForDate')
    };

    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        provideTestUserId(),
        provideHttpClient(),
        provideRouter([]),
        { provide: HabitsService, useValue: habitsStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a whole number of weeks', () => {
    expect(days().length % 7).toBe(0);
    expect(days().length).toBeGreaterThanOrEqual(28);
  });

  it('counts completions per day', () => {
    complete('a', 1);
    fixture.detectChanges();

    const yesterday = dayFor(1);
    expect(yesterday.completed).toBe(1);
    expect(yesterday.total).toBe(2);
    expect(yesterday.percent).toBe(50);
    expect(yesterday.isPerfect).toBe(false);
  });

  it('marks a day perfect only when every habit is done', () => {
    complete('a', 1);
    complete('b', 1);
    fixture.detectChanges();

    expect(dayFor(1).isPerfect).toBe(true);
    expect(dayFor(1).percent).toBe(100);
    expect(dayFor(1).level).toBe(4);
  });

  describe('future days', () => {
    it('are blank rather than 0% failures', () => {
      // A month view that paints every upcoming day as a miss is just wrong.
      const tomorrow = days().find(d => d.isFuture);
      expect(tomorrow).toBeDefined();
      expect(tomorrow!.completed).toBe(0);
      expect(tomorrow!.percent).toBe(0);
      expect(tomorrow!.level).toBe(0);
      expect(tomorrow!.isPerfect).toBe(false);
    });

    it('cannot be opened', () => {
      const future = days().find(d => d.isFuture)!;
      component['openDay'](future);
      expect(component['selectedDay']()).toBeNull();
    });
  });

  describe('tint levels', () => {
    it('is 0 when nothing was done', () => {
      expect(dayFor(1).level).toBe(0);
    });

    it('climbs with completion', () => {
      habitsStub.habits.set([
        { id: 'a', name: 'A', type: 'good' },
        { id: 'b', name: 'B', type: 'good' },
        { id: 'c', name: 'C', type: 'good' }
      ]);
      complete('a', 1);
      fixture.detectChanges();
      expect(dayFor(1).level).toBe(1); // 33%

      complete('b', 1);
      fixture.detectChanges();
      expect(dayFor(1).level).toBe(3); // 67%

      complete('c', 1);
      fixture.detectChanges();
      expect(dayFor(1).level).toBe(4); // 100%
    });
  });

  describe('streaks', () => {
    it('counts consecutive perfect days', () => {
      for (const ago of [1, 2, 3]) {
        complete('a', ago);
        complete('b', ago);
      }
      fixture.detectChanges();

      expect(dayFor(3).streak).toBe(1);
      expect(dayFor(2).streak).toBe(2);
      expect(dayFor(1).streak).toBe(3);
    });

    it('resets on an imperfect day', () => {
      for (const ago of [1, 2, 3]) {
        complete('a', ago);
        complete('b', ago);
      }
      uncomplete('b', 2);
      fixture.detectChanges();

      expect(dayFor(2).streak).toBe(0);
      expect(dayFor(1).streak).toBe(1);
    });

    it('is zero everywhere when there are no habits', () => {
      habitsStub.habits.set([]);
      fixture.detectChanges();
      expect(days().every(d => d.streak === 0)).toBe(true);
    });
  });

  describe('filtering', () => {
    it('narrows the denominator to the filtered habits', () => {
      habitsStub.habits.set([
        { id: 'a', name: 'Read', type: 'good' },
        { id: 'b', name: 'Skip sugar', type: 'bad' }
      ]);
      complete('a', 1);
      fixture.detectChanges();

      expect(dayFor(1).percent).toBe(50);

      component['setFilter']('good');
      fixture.detectChanges();

      // Only the good habit counts now, and it was done.
      expect(dayFor(1).total).toBe(1);
      expect(dayFor(1).percent).toBe(100);
      expect(dayFor(1).isPerfect).toBe(true);
    });
  });

  describe('month stats', () => {
    it('averages only elapsed days, so early in a month is not diluted', () => {
      complete('a', 0);
      complete('b', 0);
      fixture.detectChanges();

      const stats = component['monthStats']();
      expect(stats.elapsed).toBe(new Date().getDate());
      expect(stats.perfect).toBe(1);
      expect(stats.tracked).toBe(1);
    });
  });

  describe('navigation', () => {
    it('moves between months and back to today', () => {
      const start = component['currentDate']().getMonth();

      component['nextMonth']();
      expect(component['monthDays']().some(d => d.isToday && d.isCurrentMonth)).toBe(false);

      component['goToToday']();
      expect(component['currentDate']().getMonth()).toBe(start);
      expect(component['monthDays']().some(d => d.isToday && d.isCurrentMonth)).toBe(true);
    });
  });

  describe('markAll', () => {
    it('only toggles habits that need changing', () => {
      complete('a', 1);
      fixture.detectChanges();

      component['markAll'](offset(1), true);

      // 'a' was already done; only 'b' should be toggled.
      expect(habitsStub.toggleHabitForDate).toHaveBeenCalledTimes(1);
      expect(habitsStub.toggleHabitForDate).toHaveBeenCalledWith('b', jasmine.any(Date));
    });
  });

  /**
   * The tint IS the summary — if these class bindings break, the grid silently
   * becomes 42 identical white boxes and every other test still passes.
   */
  describe('rendered tint', () => {
    function cellFor(daysAgo: number): HTMLElement {
      const target = dayFor(daysAgo);
      const cells = Array.from(
        fixture.nativeElement.querySelectorAll('[data-tour="calendar-grid"] button')
      ) as HTMLElement[];
      const index = days().findIndex(d => d.key === target.key);
      return cells[index];
    }

    it('paints a perfect day with the full-strength class', () => {
      complete('a', 1);
      complete('b', 1);
      fixture.detectChanges();

      expect(cellFor(1).className).toContain('bg-emerald-500');
    });

    it('paints a partial day with a lighter class', () => {
      complete('a', 1);
      fixture.detectChanges();

      const cls = cellFor(1).className;
      expect(cls).toContain('bg-emerald-200');
      expect(cls).not.toContain('bg-emerald-500');
    });

    it('leaves an untouched day unpainted', () => {
      const cls = cellFor(1).className;
      expect(cls).not.toContain('bg-emerald-');
    });

    it('shows the fraction only for days that have happened', () => {
      complete('a', 1);
      fixture.detectChanges();

      expect(cellFor(1).textContent).toContain('1/2');

      const futureIndex = days().findIndex(d => d.isFuture);
      const cells = Array.from(
        fixture.nativeElement.querySelectorAll('[data-tour="calendar-grid"] button')
      ) as HTMLElement[];
      expect(cells[futureIndex].textContent).not.toContain('/');
    });

    it('disables future cells', () => {
      const futureIndex = days().findIndex(d => d.isFuture);
      const cells = Array.from(
        fixture.nativeElement.querySelectorAll('[data-tour="calendar-grid"] button')
      ) as HTMLButtonElement[];
      expect(cells[futureIndex].disabled).toBe(true);
    });

    it('renders one cell per day and nothing per habit', () => {
      // The whole point: 14 habits must not become 14 rows in every cell.
      const cells = fixture.nativeElement.querySelectorAll('[data-tour="calendar-grid"] button');
      expect(cells.length).toBe(days().length);
      expect(cellFor(1).querySelectorAll('input, label').length).toBe(0);
    });
  });

  describe('accessibility', () => {
    it('describes each day for screen readers', () => {
      complete('a', 1);
      fixture.detectChanges();

      expect(component['dayLabel'](dayFor(1))).toContain('1 of 2 habits completed');
      expect(component['dayLabel'](days().find(d => d.isFuture)!)).toContain('upcoming');
    });
  });

  function offset(daysAgo: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
  }
});
