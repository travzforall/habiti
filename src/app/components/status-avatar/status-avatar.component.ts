import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarDisplayMode, StatusService } from '../../services/status.service';
import {
  STATUS_COLOR,
  STATUS_EMOJI,
  STATUS_LABEL,
  UserStatus,
  statusToRiveIndex
} from '../../utils/status-derivation.util';

export type StatusAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<StatusAvatarSize, number> = { sm: 40, md: 64, lg: 128 };

/** Approximate popover box, used to decide whether it opens downward or upward. */
const PICKER_WIDTH = 224;
const PICKER_HEIGHT = 400;

/** Path to the authored Rive artboard. Absent until the art lands — see the fallback ladder. */
const RIVE_SRC = 'rive/status-avatar.riv';
/** Rive's WASM is copied here by the `assets` entry in angular.json. */
const RIVE_WASM_BASE = 'rive/';
const STATE_MACHINE = 'StatusMachine';

/**
 * The user's avatar, animated according to their current status.
 *
 * Rendering degrades in three rungs, each of which must work on its own:
 *   1. Rive artboard driven by a state machine (the intended experience)
 *   2. Photo + animated status ring + emoji badge (CSS only) — used when the
 *      runtime or the .riv asset fails to load, or when the user prefers
 *      reduced motion
 *   3. Initial-letter circle + ring — used when there is no photo
 *
 * It must never render an empty box, so the fallback markup is always in the
 * DOM and Rive paints over it once (and only once) it is actually ready.
 */
@Component({
  selector: 'app-status-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="status-avatar-root relative inline-block">
      <div
        #avatarEl
        class="status-avatar relative flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden"
        [class.cursor-pointer]="interactive()"
        [style.width.px]="pixels()"
        [style.height.px]="pixels()"
        [style.box-shadow]="'0 0 0 3px ' + color() + ', 0 0 18px -2px ' + color()"
        [attr.data-status]="effectiveStatus()"
        [attr.aria-label]="ariaLabel()"
        [attr.role]="interactive() ? 'button' : 'img'"
        [attr.tabindex]="interactive() ? 0 : null"
        [title]="tooltip()"
        (click)="onAvatarClick($event)"
        (keydown.enter)="onAvatarClick($event)"
        (keydown.space)="onAvatarClick($event)"
      >
        @if (useRive()) {
          <!-- Rung 1: the character fills the whole circle. -->
          <canvas
            #riveCanvas
            [width]="pixels() * 2"
            [height]="pixels() * 2"
            [style.width.px]="pixels()"
            [style.height.px]="pixels()"
          ></canvas>
        } @else if (showPhoto()) {
          <!--
            Photo mode: the profile picture owns the circle and the ring carries
            the status on its own. Nothing is overlaid on the photo.
          -->
          @if (photoUrl() && !photoFailed()) {
            <img
              [src]="photoUrl()"
              [alt]="name()"
              class="absolute inset-0 w-full h-full object-cover"
              (error)="onPhotoError()"
            />
          } @else {
            <span class="absolute inset-0" [style.background]="faceGradient()"></span>
            <span
              class="relative font-bold text-white"
              [style.font-size.px]="pixels() * 0.4"
              >{{ initial() }}</span
            >
          }
        } @else {
          <!--
            Character mode (rungs 2 and 3). The status expression fills the
            circle exactly as the Rive character will — it stands in for that
            character. No photo, so no watermark or busy detail behind it.
          -->
          <span class="absolute inset-0" [style.background]="faceGradient()"></span>
          <span class="status-face relative leading-none" [style.font-size.px]="facePx()">{{
            emoji()
          }}</span>
        }
      </div>

      @if (showPicker()) {
        <!--
          Fixed to the viewport, not absolute to the avatar: the dashboard user
          card and the glass container above it both create clipping/stacking
          contexts that would cut the popover off. Coordinates come from the
          avatar's bounding rect, flipped above the avatar when there is not
          enough room below.
        -->
        <div
          class="status-picker fixed z-[100] w-56 rounded-xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 p-2"
          [style.top.px]="pickerPos().top"
          [style.left.px]="pickerPos().left"
          [class.status-picker--flipped]="pickerPos().flipped"
          (click)="$event.stopPropagation()"
        >
          <div
            class="px-2 pt-1 pb-2 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500"
          >
            Set your status
          </div>

          @for (option of pickerOptions; track option) {
            <button
              type="button"
              class="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              [class.bg-slate-100]="effectiveStatus() === option && isManual()"
              (click)="choose(option)"
            >
              <span class="text-lg leading-none">{{ emojiFor(option) }}</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{
                labelFor(option)
              }}</span>
            </button>
          }

          <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>

          <button
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            [class.bg-slate-100]="!isManual()"
            (click)="chooseAuto()"
          >
            <span class="text-lg leading-none">✨</span>
            <span class="flex-1">
              <span class="block text-sm font-medium text-slate-700 dark:text-slate-200"
                >Automatic</span
              >
              <span class="block text-[11px] text-slate-500 dark:text-slate-400"
                >From your habits and streak</span
              >
            </span>
          </button>

          <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>

          <div class="px-2 pt-1 pb-2">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
              Show as
            </div>
            <div
              class="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900"
              role="radiogroup"
            >
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="!showPhoto()"
                class="px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                [class]="
                  !showPhoto()
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                "
                (click)="setDisplayMode('character')"
              >
                Character
              </button>
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="showPhoto()"
                class="px-2 py-1.5 rounded-md text-xs font-medium transition-colors"
                [class]="
                  showPhoto()
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                "
                (click)="setDisplayMode('photo')"
              >
                Photo
              </button>
            </div>
          </div>

          <div
            class="px-2 pt-2 pb-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700"
          >
            {{ tooltip() }}
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .status-avatar {
        transition: box-shadow 0.4s ease;
      }
      .status-avatar:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 3px;
      }

      /* The photo sits behind the status face, dimmed so the face reads first. */
      .status-photo {
        opacity: 0.35;
        filter: saturate(0.7);
      }
      .status-face {
        /* Sits above the photo and the gradient, and drives the animation. */
        z-index: 1;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      /* Each status animates the face itself - this is the stand-in for the
         Rive character, so it should read as a character, not a badge. */
      .status-avatar[data-status='thriving'] .status-face {
        animation: sa-dance 0.7s ease-in-out infinite;
      }
      .status-avatar[data-status='celebrating'] .status-face {
        animation: sa-dance 0.42s ease-in-out infinite;
      }
      .status-avatar[data-status='sleeping'] .status-face {
        animation: sa-snooze 4s ease-in-out infinite;
      }
      .status-avatar[data-status='focused'] .status-face {
        animation: sa-lock-in 2.6s ease-in-out infinite;
      }
      .status-avatar[data-status='struggling'] .status-face {
        animation: sa-slump 3s ease-in-out infinite;
      }
      .status-avatar[data-status='atRisk'] .status-face {
        animation: sa-shake 2s ease-in-out infinite;
      }
      .status-avatar[data-status='onTrack'] .status-face,
      .status-avatar[data-status='idle'] .status-face {
        animation: sa-idle-bob 3.4s ease-in-out infinite;
      }

      /* The ring echoes the face's energy. */
      .status-avatar[data-status='thriving'],
      .status-avatar[data-status='celebrating'] {
        animation: sa-ring-pulse 0.9s ease-in-out infinite;
      }
      .status-avatar[data-status='sleeping'] {
        animation: sa-ring-breathe 4s ease-in-out infinite;
      }
      .status-avatar[data-status='atRisk'] {
        animation: sa-ring-alert 1.8s ease-in-out infinite;
      }

      @keyframes sa-dance {
        0%,
        100% {
          transform: translateY(0) rotate(-9deg) scale(1);
        }
        25% {
          transform: translateY(-9%) rotate(6deg) scale(1.06);
        }
        50% {
          transform: translateY(0) rotate(9deg) scale(1);
        }
        75% {
          transform: translateY(-6%) rotate(-6deg) scale(1.04);
        }
      }
      @keyframes sa-snooze {
        0%,
        100% {
          transform: translateY(0) rotate(-6deg) scale(1);
          opacity: 0.85;
        }
        50% {
          transform: translateY(4%) rotate(-9deg) scale(0.95);
          opacity: 1;
        }
      }
      @keyframes sa-lock-in {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.08);
        }
      }
      @keyframes sa-slump {
        0%,
        100% {
          transform: translateY(0) rotate(0deg);
        }
        50% {
          transform: translateY(6%) rotate(-4deg);
        }
      }
      @keyframes sa-shake {
        0%,
        88%,
        100% {
          transform: translateX(0) rotate(0deg);
        }
        91% {
          transform: translateX(-7%) rotate(-5deg);
        }
        94% {
          transform: translateX(7%) rotate(5deg);
        }
        97% {
          transform: translateX(-4%) rotate(-3deg);
        }
      }
      @keyframes sa-idle-bob {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-5%);
        }
      }

      @keyframes sa-ring-pulse {
        0%,
        100% {
          filter: brightness(1);
        }
        50% {
          filter: brightness(1.25);
        }
      }
      @keyframes sa-ring-breathe {
        0%,
        100% {
          opacity: 0.7;
        }
        50% {
          opacity: 1;
        }
      }
      @keyframes sa-ring-alert {
        0%,
        80%,
        100% {
          opacity: 1;
        }
        90% {
          opacity: 0.55;
        }
      }

      .status-picker {
        animation: sa-picker-in 0.16s ease-out;
        transform-origin: top left;
        /* Never taller than the viewport; scrolls internally on short screens. */
        max-height: calc(100vh - 24px);
        overflow-y: auto;
      }
      .status-picker--flipped {
        transform-origin: bottom left;
      }
      @keyframes sa-picker-in {
        from {
          transform: scale(0.94) translateY(-4px);
          opacity: 0;
        }
        to {
          transform: scale(1) translateY(0);
          opacity: 1;
        }
      }

      /* Mirrors dashboard.scss: motion is opt-out for anyone who asks. */
      @media (prefers-reduced-motion: reduce) {
        .status-avatar,
        .status-avatar .status-face,
        .status-picker {
          animation: none !important;
        }
      }
    `
  ]
})
export class StatusAvatarComponent {
  private statusService = inject(StatusService);
  private destroyRef = inject(DestroyRef);

  readonly size = input<StatusAvatarSize>('lg');
  readonly photoUrl = input<string | undefined>(undefined);
  readonly name = input<string>('');
  /** Override the status — used to show a friend's status rather than your own. */
  readonly status = input<UserStatus | undefined>(undefined);
  /** Optional reason text; falls back to the service's own explanation. */
  readonly reason = input<string | undefined>(undefined);
  /** Clicking opens the status picker. Off for read-only uses (a friend's avatar). */
  readonly interactive = input(false);
  /** Force a display mode; otherwise the user's own preference applies. */
  readonly displayMode = input<AvatarDisplayMode | undefined>(undefined);

  private riveCanvas = viewChild<ElementRef<HTMLCanvasElement>>('riveCanvas');
  private avatarEl = viewChild<ElementRef<HTMLElement>>('avatarEl');

  private readonly riveReady = signal(false);
  private readonly riveFailed = signal(false);
  /** Rung 3: a broken photo URL falls through to the initial-letter circle. */
  protected readonly photoFailed = signal(false);
  private riveInstance: any = null;
  private statusInput: any = null;
  private intensityInput: any = null;
  private celebrateTrigger: any = null;

  readonly effectiveStatus = computed<UserStatus>(
    () => this.status() ?? this.statusService.snapshot().status
  );
  readonly pixels = computed(() => SIZE_PX[this.size()]);
  readonly color = computed(() => STATUS_COLOR[this.effectiveStatus()]);
  readonly emoji = computed(() => STATUS_EMOJI[this.effectiveStatus()]);
  readonly initial = computed(() => (this.name() || '').charAt(0).toUpperCase() || '?');

  /** The status face fills most of the circle — it stands in for the Rive character. */
  readonly facePx = computed(() => Math.round(this.pixels() * 0.58));

  readonly effectiveDisplayMode = computed<AvatarDisplayMode>(
    () => this.displayMode() ?? this.statusService.displayMode()
  );
  protected readonly showPhoto = computed(() => this.effectiveDisplayMode() === 'photo');

  /** Status-tinted backdrop so the circle reads as the status even at a glance. */
  readonly faceGradient = computed(() => {
    const c = this.color();
    return `radial-gradient(circle at 50% 35%, ${c}40 0%, ${c}80 55%, ${c}b0 100%)`;
  });

  protected readonly pickerOptions: readonly UserStatus[] = [
    'thriving',
    'focused',
    'onTrack',
    'struggling',
    'sleeping',
    'celebrating'
  ];

  protected readonly showPicker = signal(false);
  protected readonly isManual = computed(() => this.statusService.manualOverride() !== null);
  protected readonly pickerPos = signal<{ top: number; left: number; flipped: boolean }>({
    top: 0,
    left: 0,
    flipped: false
  });

  /** Rive only paints once it has actually loaded; until then the fallback holds the space. */
  readonly useRive = computed(() => this.riveReady() && !this.riveFailed());

  readonly tooltip = computed(() => {
    const label = STATUS_LABEL[this.effectiveStatus()];
    const why = this.reason() ?? (this.status() ? '' : this.statusService.snapshot().reason);
    return why ? `${label} — ${why}` : label;
  });

  readonly ariaLabel = computed(() => {
    const who = this.name() || 'User';
    return `${who}, status: ${STATUS_LABEL[this.effectiveStatus()]}`;
  });

  constructor() {
    // Rung 1: try to upgrade to Rive. Never blocks the fallback from rendering.
    effect(() => {
      if (this.prefersReducedMotion() || this.riveReady() || this.riveFailed()) return;
      void this.initRive();
    });

    // Push status changes into the state machine once it's live.
    effect(() => {
      const status = this.effectiveStatus();
      const snapshot = this.statusService.snapshot();
      if (!this.useRive()) return;
      if (this.statusInput) this.statusInput.value = statusToRiveIndex(status);
      if (this.intensityInput) this.intensityInput.value = snapshot.intensity;
      if (status === 'celebrating' && this.celebrateTrigger) this.celebrateTrigger.fire();
    });

    this.destroyRef.onDestroy(() => this.riveInstance?.cleanup?.());
  }

  onPhotoError(): void {
    this.photoFailed.set(true);
  }

  protected onAvatarClick(event: Event): void {
    if (!this.interactive()) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.showPicker()) {
      this.showPicker.set(false);
      return;
    }
    this.positionPicker();
    this.showPicker.set(true);
  }

  /** Anchors the viewport-fixed picker to the avatar, keeping it fully on screen. */
  private positionPicker(): void {
    const el = this.avatarEl()?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const gap = 8;
    const margin = 8;
    const flipped = rect.bottom + PICKER_HEIGHT + gap > window.innerHeight;

    const top = flipped ? rect.top - PICKER_HEIGHT - gap : rect.bottom + gap;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - PICKER_WIDTH - margin)
    );

    this.pickerPos.set({ top: Math.max(margin, top), left, flipped });
  }

  protected choose(status: UserStatus): void {
    this.statusService.setStatus(status);
    this.showPicker.set(false);
  }

  protected chooseAuto(): void {
    this.statusService.clearStatus();
    this.showPicker.set(false);
  }

  /** Leaves the picker open so the switch can be seen taking effect. */
  protected setDisplayMode(mode: AvatarDisplayMode): void {
    this.statusService.setDisplayMode(mode);
  }

  protected emojiFor(status: UserStatus): string {
    return STATUS_EMOJI[status];
  }

  protected labelFor(status: UserStatus): string {
    return STATUS_LABEL[status];
  }

  /** Close the picker when the click lands anywhere else. */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.showPicker()) this.showPicker.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.showPicker()) this.showPicker.set(false);
  }

  // A viewport-fixed popover would drift away from its anchor otherwise.
  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.showPicker()) this.positionPicker();
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    );
  }

  private async initRive(): Promise<void> {
    const canvasRef = this.riveCanvas();

    // The canvas only exists once useRive() is true, which needs riveReady().
    // So load the runtime and the asset first, then flip the flag and attach on
    // the next tick.
    try {
      const rive = await import('@rive-app/canvas');

      // Serve the WASM from our own origin. Without this Rive fetches it from a
      // public CDN at runtime, which would make the avatar depend on a third
      // party and break behind a strict CSP or offline.
      rive.RuntimeLoader.setWasmUrl(`${RIVE_WASM_BASE}rive.wasm`);

      // Fail fast if the artboard isn't deployed yet, rather than letting Rive
      // stall on a 404 and leave a blank canvas.
      const head = await fetch(RIVE_SRC, { method: 'HEAD' });
      if (!head.ok) throw new Error(`Rive asset not found: ${RIVE_SRC}`);

      this.riveReady.set(true);

      // Wait a tick for the canvas to enter the DOM.
      await new Promise(resolve => setTimeout(resolve, 0));
      const canvas = canvasRef?.nativeElement ?? this.riveCanvas()?.nativeElement;
      if (!canvas) throw new Error('Rive canvas not available');

      this.riveInstance = new rive.Rive({
        src: RIVE_SRC,
        canvas,
        autoplay: true,
        stateMachines: STATE_MACHINE,
        onLoad: () => {
          const inputs = this.riveInstance.stateMachineInputs(STATE_MACHINE) ?? [];
          this.statusInput = inputs.find((i: any) => i.name === 'status');
          this.intensityInput = inputs.find((i: any) => i.name === 'intensity');
          this.celebrateTrigger = inputs.find((i: any) => i.name === 'celebrate');

          const snapshot = this.statusService.snapshot();
          if (this.statusInput) this.statusInput.value = statusToRiveIndex(this.effectiveStatus());
          if (this.intensityInput) this.intensityInput.value = snapshot.intensity;
          this.riveInstance.resizeDrawingSurfaceToCanvas();
        },
        onLoadError: () => {
          this.riveFailed.set(true);
          this.riveReady.set(false);
        }
      });
    } catch {
      // Rungs 2 and 3 take over. This is an expected path until the art ships.
      this.riveFailed.set(true);
      this.riveReady.set(false);
    }
  }
}
