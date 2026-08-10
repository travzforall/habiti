import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const THEME_KEY = 'habiti-theme';

describe('ThemeService', () => {
  function make(): ThemeService {
    TestBed.configureTestingModule({ providers: [ThemeService] });
    return TestBed.inject(ThemeService);
  }

  function attr(): string | null {
    return document.documentElement.getAttribute('data-theme');
  }

  /** matchMedia is read-only in the browser, so stub it per test. */
  function stubPrefersDark(dark: boolean): void {
    spyOn(window, 'matchMedia').and.returnValue({
      matches: dark,
      media: '(prefers-color-scheme: dark)'
    } as MediaQueryList);
  }

  beforeEach(() => {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to auto when nothing is stored', () => {
    expect(make().theme()).toBe('auto');
  });

  it('reads the stored choice at construction', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    expect(make().theme()).toBe('dark');
  });

  it('ignores a garbage stored value', () => {
    localStorage.setItem(THEME_KEY, 'neon');
    expect(make().theme()).toBe('auto');
  });

  describe('set', () => {
    it('persists AND applies — the bug that made toggleTheme not stick', () => {
      const service = make();
      service.set('dark');

      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
      expect(attr()).toBe('dark');
      expect(service.theme()).toBe('dark');
    });

    it('resolves auto against prefers-color-scheme', () => {
      stubPrefersDark(true);
      const service = make();
      service.set('auto');

      // The stored choice stays 'auto'; only the applied attribute resolves.
      expect(localStorage.getItem(THEME_KEY)).toBe('auto');
      expect(attr()).toBe('dark');
      expect(service.theme()).toBe('auto');
    });

    it('resolves auto to light when the OS prefers light', () => {
      stubPrefersDark(false);
      make().set('auto');
      expect(attr()).toBe('light');
    });
  });

  describe('applyStored', () => {
    it('applies without needing a set() first', () => {
      localStorage.setItem(THEME_KEY, 'dark');
      make().applyStored();
      expect(attr()).toBe('dark');
    });
  });

  describe('cycle', () => {
    it('goes light → dark → auto → light', () => {
      stubPrefersDark(false);
      const service = make();
      service.set('light');

      expect(service.cycle()).toBe('dark');
      expect(service.cycle()).toBe('auto');
      expect(service.cycle()).toBe('light');
    });
  });

  describe('preview', () => {
    it('applies without persisting, for the wizard', () => {
      const service = make();
      service.set('light');
      service.preview('dark');

      expect(attr()).toBe('dark');
      expect(localStorage.getItem(THEME_KEY)).toBe('light');
      expect(service.theme()).toBe('light');
    });

    it('revertPreview puts the stored choice back', () => {
      const service = make();
      service.set('light');
      service.preview('dark');
      service.revertPreview();

      expect(attr()).toBe('light');
    });
  });
});
