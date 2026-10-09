import { provideTestUserId } from '@habiti/storage/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AdminComponent } from './admin';
import { HABIT_TEMPLATE_PACKS, PACK_GROUPS } from '../../config/habit-template-packs';
import { ALL_LIBRARY_HABITS } from '../../config/habit-library';

interface HealthCheck {
  label: string;
  ok: boolean;
  detail: string;
}

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;

  function health(): HealthCheck[] {
    return (component as unknown as { health: () => HealthCheck[] }).health();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [provideTestUserId(), provideHttpClient(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('catalogue health', () => {
    /**
     * The panel exists to make a content mistake visible without reading CI.
     * If it reports green on a catalogue the specs would reject, it is worse
     * than useless — so this asserts it agrees with the real content.
     */
    it('passes every check against the shipped catalogues', () => {
      const failing = health().filter(c => !c.ok);
      expect(failing.map(c => `${c.label}: ${c.detail}`)).toEqual([]);
    });

    it('reports overall health as green', () => {
      expect((component as unknown as { healthy: () => boolean }).healthy()).toBe(true);
      expect((component as unknown as { failing: () => number }).failing()).toBe(0);
    });

    it('actually inspects the catalogues rather than hardcoding pass', () => {
      // Every check should cite a real number, so a check that silently stopped
      // looking at anything is visible.
      for (const check of health()) {
        expect(check.detail.trim()).withContext(check.label).not.toBe('');
      }
      expect(health().length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('counts', () => {
    it('matches the real catalogues', () => {
      const counts = (component as unknown as { counts: Record<string, number> }).counts;

      expect(counts['habits']).toBe(ALL_LIBRARY_HABITS.length);
      expect(counts['packs']).toBe(HABIT_TEMPLATE_PACKS.length);
      expect(counts['groups']).toBe(PACK_GROUPS.length);
      expect(counts['activeSkills']).toBeLessThanOrEqual(counts['skills']);
    });
  });

  describe('inspectors', () => {
    it('opens one at a time and toggles closed', () => {
      const c = component as unknown as {
        toggle: (i: string) => void;
        openInspector: () => string | null;
      };

      expect(c.openInspector()).toBeNull();

      c.toggle('packs');
      expect(c.openInspector()).toBe('packs');

      c.toggle('groups');
      expect(c.openInspector()).toBe('groups');

      c.toggle('groups');
      expect(c.openInspector()).toBeNull();
    });
  });

  describe('rendering', () => {
    it('states plainly that this is not a security boundary', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Internal tool');
      expect(text.toLowerCase()).toContain('token');
    });

    it('links to the challenge editor', () => {
      const link = (fixture.nativeElement as HTMLElement).querySelector(
        'a[href="/admin/challenges"]'
      );
      expect(link).toBeTruthy();
    });

    it('separates editable data from code-managed content', () => {
      const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').toLowerCase();
      expect(text).toContain('live data');
      expect(text).toContain('stored in baserow');
      expect(text).toContain('read-only');
    });

    it('flags any Baserow surface with no table id', () => {
      const unconfigured = (
        component as unknown as { unconfigured: () => string[] }
      ).unconfigured();

      // Not an assertion about which are unset — just that the page would say so.
      if (unconfigured.length) {
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('local-only');
      } else {
        expect(unconfigured).toEqual([]);
      }
    });
  });
});
