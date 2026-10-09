import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { ToolkitComponent } from './toolkit';
import { ToolkitService } from '../../services/toolkit.service';

describe('ToolkitComponent', () => {
  let component: ToolkitComponent;
  let fixture: ComponentFixture<ToolkitComponent>;
  let toolkit: ToolkitService;

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ToolkitComponent],
      providers: [provideTestUserId(), provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ToolkitComponent);
    component = fixture.componentInstance;
    toolkit = TestBed.inject(ToolkitService);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('invites you to start when the kit is empty', () => {
    expect(text()).toContain('Nothing in your kit yet');
  });

  describe('adding', () => {
    it('shows a new item and counts it', () => {
      toolkit.add({ title: 'Cordless drill', kind: 'tool', unitCost: 89.99 });
      fixture.detectChanges();

      expect(text()).toContain('Cordless drill');
      expect(component['summary']().total).toBe(1);
    });

    it('survives a reload, because the cache is the record', () => {
      // The table id is 0 in tests, so this is the local-only path — which is
      // the path most users are on until db:setup runs.
      toolkit.add({ title: 'Label maker' });

      const second = TestBed.inject(ToolkitService);
      second.reload();

      expect(second.live().some(i => i.title === 'Label maker')).toBe(true);
    });
  });

  describe('the shopping list', () => {
    beforeEach(() => {
      toolkit.add({ title: 'Have this', status: 'have', unitCost: 100 });
      toolkit.add({ title: 'Need this', status: 'need', unitCost: 40 });
      toolkit.add({ title: 'Broken one', status: 'broken', unitCost: 25 });
      fixture.detectChanges();
    });

    it('counts what is missing or broken', () => {
      expect(component['summary']().wanted).toBe(2);
      expect(component['summary']().wantedValue).toBe(65);
    });

    it('filters down to just those', () => {
      component['setStatus']('wanted');
      fixture.detectChanges();

      const titles = component['visible']().map(i => i.title);
      expect(titles).toContain('Need this');
      expect(titles).toContain('Broken one');
      expect(titles).not.toContain('Have this');
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      toolkit.add({ title: 'Drill', kind: 'tool' });
      toolkit.add({ title: 'Primer', kind: 'material' });
      fixture.detectChanges();
    });

    it('narrows by kind', () => {
      component['setKind']('material');
      fixture.detectChanges();

      expect(component['visible']().map(i => i.title)).toEqual(['Primer']);
    });

    it('searches across supplier and location, not just the title', () => {
      toolkit.add({ title: 'Sander', supplier: 'Screwfix', location: 'Van' });
      fixture.detectChanges();

      component['query'].set('screwfix');
      fixture.detectChanges();
      expect(component['visible']().map(i => i.title)).toEqual(['Sander']);

      component['query'].set('van');
      fixture.detectChanges();
      expect(component['visible']().map(i => i.title)).toEqual(['Sander']);
    });

    it('groups the list by kind rather than showing one flat wall', () => {
      const kinds = component['grouped']().map(g => g.kind);
      expect(kinds).toContain('tool');
      expect(kinds).toContain('material');
    });
  });

  describe('archiving', () => {
    it('hides an item without destroying the record', () => {
      const item = toolkit.add({ title: 'Old drill' });
      component['archive'](item);
      fixture.detectChanges();

      expect(toolkit.live().length).toBe(0);
      expect(toolkit.archived().length).toBe(1);
      // A sold drill is still the answer to "what did I have when I priced
      // that job", so the row survives.
      expect(toolkit.find(item.id)).toBeDefined();
    });

    it('restores from the archive', () => {
      const item = toolkit.add({ title: 'Old drill' });
      component['archive'](item);
      component['restore']({ ...item, archived: true });
      fixture.detectChanges();

      expect(toolkit.live().length).toBe(1);
    });

    it('remove really removes', () => {
      const item = toolkit.add({ title: 'Typo' });
      component['remove'](item);

      expect(toolkit.find(item.id)).toBeUndefined();
    });
  });

  describe('status flip', () => {
    it('toggles between have and need, the flip people actually make', () => {
      const item = toolkit.add({ title: 'Drill', status: 'have' });

      component['cycleStatus'](item);
      expect(toolkit.find(item.id)?.status).toBe('need');

      component['cycleStatus']({ ...item, status: 'need' });
      expect(toolkit.find(item.id)?.status).toBe('have');
    });
  });

  describe('editing', () => {
    it('loads an item into the form and saves changes back', () => {
      const item = toolkit.add({ title: 'Drill', location: 'Garage' });

      component['startEdit'](item);
      expect(component['draft']().title).toBe('Drill');
      expect(component['draft']().location).toBe('Garage');

      component['patchDraft']({ location: 'Van' });
      component['save']();

      expect(toolkit.find(item.id)?.location).toBe('Van');
      expect(toolkit.live().length).withContext('should update, not duplicate').toBe(1);
    });

    it('refuses a blank title', () => {
      component['startAdd']();
      component['patchDraft']({ title: '   ' });
      component['save']();

      expect(toolkit.live().length).toBe(0);
    });
  });

  describe('habit links', () => {
    it('finds the kit behind a habit', () => {
      toolkit.add({ title: 'Barbell', linkedHabitIds: ['back-squat', 'deadlift'] });
      toolkit.add({ title: 'Notebook', linkedHabitIds: ['journal'] });

      expect(toolkit.forHabit('deadlift').map(i => i.title)).toEqual(['Barbell']);
      expect(toolkit.forHabit('nothing-uses-this')).toEqual([]);
    });
  });
});
