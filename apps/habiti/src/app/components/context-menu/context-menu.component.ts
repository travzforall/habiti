import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

/**
 * A right-click menu.
 *
 * Generic on purpose — it takes items and a point and emits an id — so the map
 * is not the only thing that can ever have one. Nothing in here knows what a
 * node is.
 *
 * ── THE PARTS THAT ARE EASY TO LEAVE OUT ──────────────────────────────────
 *
 *   - It FLIPS near an edge. A menu opened at the bottom-right of the window
 *     otherwise renders half off-screen, which is where the delete item usually
 *     ends up.
 *   - It is KEYBOARD OPERABLE: arrows move, Enter chooses, Escape closes, Right
 *     opens a submenu and Left closes it. A context menu reachable only by mouse
 *     is a feature half the users cannot use — and on Windows and Linux the
 *     Menu key opens exactly this.
 *   - Focus goes into it on open and back to whatever had it on close.
 *   - It closes on scroll and on window resize, because a menu pinned to a
 *     point in the page stops pointing at anything once either happens.
 */

export interface ContextMenuItem {
  id: string;
  label: string;
  /** Shown right-aligned. Display only — the shortcut itself is bound elsewhere. */
  shortcut?: string;
  icon?: string;
  disabled?: boolean;
  /** Renders in red. Used for delete, and nothing else so far. */
  danger?: boolean;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
  children?: ContextMenuItem[];
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  template: `
    @if (open()) {
      <!-- Catches the click that dismisses the menu, including a right-click. -->
      <div
        class="fixed inset-0 z-[80]"
        (pointerdown)="closed.emit()"
        (contextmenu)="$event.preventDefault(); closed.emit()"
      ></div>

      <div
        #menu
        role="menu"
        tabindex="-1"
        [attr.aria-label]="label()"
        (keydown)="onKeydown($event)"
        class="fixed z-[81] min-w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        [style.left.px]="position().left"
        [style.top.px]="position().top"
      >
        @for (item of items(); track item.id) {
          @if (item.separatorBefore) {
            <div class="my-1 h-px bg-slate-200 dark:bg-slate-700" role="separator"></div>
          }

          <button
            type="button"
            role="menuitem"
            [disabled]="item.disabled"
            [attr.aria-haspopup]="item.children?.length ? 'menu' : null"
            [attr.aria-expanded]="item.children?.length ? openSubmenu() === item.id : null"
            (click)="choose(item)"
            (mouseenter)="hover(item)"
            (focus)="hover(item)"
            class="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-40"
            [class.text-red-600]="item.danger"
            [class.text-slate-700]="!item.danger"
            [class.dark:text-slate-200]="!item.danger"
            [class.bg-slate-100]="active() === item.id && !item.disabled"
            [class.dark:bg-slate-700]="active() === item.id && !item.disabled"
          >
            <span class="w-4 text-center text-xs opacity-70" aria-hidden="true">{{ item.icon }}</span>
            <span class="flex-1 truncate">{{ item.label }}</span>
            @if (item.shortcut) {
              <span class="text-xs text-slate-400">{{ item.shortcut }}</span>
            }
            @if (item.children?.length) {
              <span class="text-xs text-slate-400" aria-hidden="true">▸</span>
            }
          </button>

          <!--
            Submenus render INLINE, indented, rather than as a floating panel.
            A flyout has to solve hover intent, edge flipping of its own, and
            touch — and this menu has at most two levels. Indenting is honest
            and works with a finger.
          -->
          @if (item.children?.length && openSubmenu() === item.id) {
            <div role="menu" [attr.aria-label]="item.label" class="bg-slate-50 py-1 dark:bg-slate-900/40">
              @for (child of item.children ?? []; track child.id) {
                <button
                  type="button"
                  role="menuitem"
                  [disabled]="child.disabled"
                  (click)="choose(child)"
                  (mouseenter)="active.set(child.id)"
                  (focus)="active.set(child.id)"
                  class="flex w-full items-center gap-3 py-1.5 pl-10 pr-3 text-left text-sm text-slate-700 transition-colors disabled:opacity-40 dark:text-slate-200"
                  [class.bg-slate-100]="active() === child.id && !child.disabled"
                  [class.dark:bg-slate-700]="active() === child.id && !child.disabled"
                >
                  <span class="flex-1 truncate">{{ child.label }}</span>
                  @if (child.shortcut) {
                    <span class="text-xs text-slate-400">{{ child.shortcut }}</span>
                  }
                </button>
              }
            </div>
          }
        }
      </div>
    }
  `
})
export class ContextMenuComponent {
  readonly open = input(false);
  readonly items = input<ContextMenuItem[]>([]);
  /** Where the click happened, in viewport coordinates. */
  readonly x = input(0);
  readonly y = input(0);
  readonly label = input('Context menu');

  readonly chose = output<string>();
  readonly closed = output<void>();

  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected readonly active = signal<string | null>(null);
  protected readonly openSubmenu = signal<string | null>(null);
  private readonly measured = signal({ width: 224, height: 0 });
  private previouslyFocused: HTMLElement | null = null;

  /** Flipped so the menu always fits, with an 8 px margin off the edge. */
  protected readonly position = computed(() => {
    const { width, height } = this.measured();
    const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;

    const left = this.x() + width + 8 > viewportWidth ? Math.max(8, this.x() - width) : this.x();
    const top =
      height > 0 && this.y() + height + 8 > viewportHeight
        ? Math.max(8, viewportHeight - height - 8)
        : this.y();

    return { left, top };
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.openSubmenu.set(null);
        this.active.set(null);
        this.previouslyFocused?.focus();
        this.previouslyFocused = null;
        return;
      }

      this.previouslyFocused = document.activeElement as HTMLElement | null;
      queueMicrotask(() => {
        const element = this.menu()?.nativeElement;
        if (!element) return;
        // Measure after paint so the flip uses the real height, not a guess.
        const rect = element.getBoundingClientRect();
        this.measured.set({ width: rect.width, height: rect.height });
        element.focus();
      });
    });
  }

  /** A menu anchored to a point stops meaning anything once the page moves. */
  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onViewportChange(): void {
    if (this.open()) this.closed.emit();
  }

  protected hover(item: ContextMenuItem): void {
    if (item.disabled) return;
    this.active.set(item.id);
    // Moving onto a plain item closes any submenu that was open.
    this.openSubmenu.set(item.children?.length ? item.id : null);
  }

  protected choose(item: ContextMenuItem): void {
    if (item.disabled) return;
    if (item.children?.length) {
      this.openSubmenu.set(this.openSubmenu() === item.id ? null : item.id);
      return;
    }
    this.chose.emit(item.id);
    this.closed.emit();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const flat = this.navigable();
    const index = flat.findIndex(item => item.id === this.active());

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closed.emit();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.active.set(flat[(index + 1) % flat.length]?.id ?? null);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(flat[(index - 1 + flat.length) % flat.length]?.id ?? null);
        break;
      case 'ArrowRight': {
        const item = flat[index];
        if (item?.children?.length) {
          event.preventDefault();
          this.openSubmenu.set(item.id);
          this.active.set(item.children[0].id);
        }
        break;
      }
      case 'ArrowLeft':
        if (this.openSubmenu()) {
          event.preventDefault();
          this.active.set(this.openSubmenu());
          this.openSubmenu.set(null);
        }
        break;
      case 'Enter':
      case ' ': {
        const item = flat[index];
        if (item) {
          event.preventDefault();
          this.choose(item);
        }
        break;
      }
    }
  }

  /** Top-level items, plus the children of whichever submenu is open. */
  private navigable(): ContextMenuItem[] {
    const flat: ContextMenuItem[] = [];
    for (const item of this.items()) {
      if (item.disabled) continue;
      flat.push(item);
      if (this.openSubmenu() === item.id) {
        flat.push(...(item.children ?? []).filter(child => !child.disabled));
      }
    }
    return flat;
  }
}
