import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { MindMapNode } from '../../models/mind-map.models';
import {
  LaidOutNode,
  NODE_LINE_HEIGHT,
  NODE_PADDING_X,
  NODE_PADDING_Y,
  edgePath,
  layoutMap,
  measureNode
} from '../../config/mind-map-layout';
import { TASK_STATUS_META } from '../../config/task-progress';
import { Task } from '../../models/project.model';

/**
 * The map itself: SVG, pannable, zoomable, keyboard-driven.
 *
 * ── WHY SVG AND NOT CANVAS ────────────────────────────────────────────────
 *
 * The other chart in this app is a 2D canvas, and for a chart that is right.
 * For this it is not: every node needs hit-testing, focus, a title for screen
 * readers, and theme colours that follow the stylesheet. All four are free in
 * SVG and all four are hand-rolled work in canvas. The cost is DOM nodes, which
 * is why a big map collapses branches rather than drawing thirty thousand
 * elements.
 *
 * ── WHY THE TEXT IS MEASURED IN A CANVAS ANYWAY ───────────────────────────
 *
 * Layout needs each node's width BEFORE anything is drawn. Measuring by putting
 * elements in the document and reading offsetWidth is one forced reflow per
 * node. One offscreen 2D context and `measureText`, memoised by string, is a
 * few microseconds and no layout thrash.
 */
@Component({
  selector: 'app-mind-map-canvas',
  standalone: true,
  template: `
    <div
      #host
      class="relative h-full w-full touch-none overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/40"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="endPointer($event)"
      (pointercancel)="endPointer($event)"
      (wheel)="onWheel($event)"
      (contextmenu)="onContextMenu($event)"
    >
      <svg
        class="h-full w-full select-none"
        [attr.viewBox]="viewBox()"
        role="img"
        [attr.aria-label]="'Mind map with ' + laidOut().nodes.length + ' visible topics'"
      >
        <!-- Edges first, so a node always sits on top of its own connector. -->
        <g fill="none" stroke-linecap="round">
          @for (edge of laidOut().edges; track edge.id) {
            <path
              [attr.d]="path(edge)"
              [attr.stroke-width]="edge.depth === 1 ? 3 : 2"
              class="stroke-slate-300 dark:stroke-slate-600"
            />
          }
        </g>

        @for (box of laidOut().nodes; track box.node.id) {
          <g
            [attr.transform]="'translate(' + box.x + ',' + box.y + ')'"
            (pointerdown)="onNodePointerDown($event, box)"
            (dblclick)="editRequested.emit(box.node.id)"
            class="cursor-pointer"
          >
            @if (box.node.id !== editingId()) {
              <rect
                [attr.width]="box.width"
                [attr.height]="box.height"
                rx="10"
                [attr.fill]="fill(box)"
                [attr.stroke]="stroke(box)"
                [attr.stroke-width]="box.node.id === selectedId() ? 2.5 : 1.5"
              />

              @for (line of linesFor(box); track $index) {
                <text
                  [attr.x]="padX"
                  [attr.y]="padY + lineHeight * ($index + 0.78)"
                  [attr.fill]="textColour(box)"
                  [attr.font-weight]="box.depth === 0 ? 700 : box.node.kind === 'task' ? 500 : 400"
                  [attr.font-size]="box.depth === 0 ? 15 : 13"
                  font-family="system-ui, -apple-system, sans-serif"
                >{{ line }}</text>
              }
            }

            <!--
              A task node wears its status as a stripe down the leading edge.

              INSET, and that is the whole of the fix: the box has rx=10 and a
              stroke that straddles its outline, so a stripe at x=0 running the
              full height pokes out through the rounded corner and past the
              border — a grey sliver hanging off the left of every to-do node.
              Keeping it inside the straight part of the edge (x=3, and clear of
              both corner arcs vertically) means it cannot escape, with no clip
              path per node to pay for.

              Only drawn when the task is actually there. A task-kind node whose
              row has gone is not a to-do, and a grey bar saying otherwise is
              worse than nothing.
            -->
            @if (taskFor(box.node); as task) {
              <rect
                [attr.x]="box.side === 'right' ? 3 : box.width - 7"
                y="8"
                width="4"
                [attr.height]="box.height - 16"
                [attr.fill]="statusColour(box.node)"
                rx="2"
              />
              @if (progressOf(box.node); as percent) {
                <rect
                  x="10"
                  [attr.y]="box.height - 6"
                  [attr.width]="((box.width - 20) * percent) / 100"
                  height="3"
                  rx="1.5"
                  fill="#3b82f6"
                  opacity="0.75"
                />
              }
            }

            <!-- Collapsed: a count, and something to click to open it. -->
            @if (box.hiddenCount > 0) {
              <g
                [attr.transform]="
                  'translate(' + (box.side === 'right' ? box.width + 8 : -20) + ',' + (box.height / 2 - 9) + ')'
                "
                (pointerdown)="toggleRequested.emit(box.node.id); $event.stopPropagation()"
              >
                <rect width="20" height="18" rx="9" class="fill-slate-200 dark:fill-slate-600" />
                <text
                  x="10"
                  y="13"
                  text-anchor="middle"
                  font-size="11"
                  font-family="system-ui, sans-serif"
                  class="fill-slate-600 dark:fill-slate-200"
                >{{ box.hiddenCount }}</text>
              </g>
            }

            @if (box.node.note) {
              <text
                [attr.x]="box.width - 8"
                y="14"
                text-anchor="end"
                font-size="10"
                opacity="0.5"
              >📝</text>
            }
          </g>
        }
      </svg>

      <!-- Zoom controls. Deliberately not a floating toolbar: two buttons. -->
      <div class="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          (click)="zoomBy(1.2)"
          aria-label="Zoom in"
          class="h-8 w-8 rounded-lg bg-white text-lg shadow dark:bg-slate-700 dark:text-slate-100"
        >
          +
        </button>
        <button
          type="button"
          (click)="zoomBy(1 / 1.2)"
          aria-label="Zoom out"
          class="h-8 w-8 rounded-lg bg-white text-lg shadow dark:bg-slate-700 dark:text-slate-100"
        >
          −
        </button>
        <button
          type="button"
          (click)="fit()"
          aria-label="Fit the whole map"
          class="h-8 w-8 rounded-lg bg-white text-xs shadow dark:bg-slate-700 dark:text-slate-100"
        >
          ⤢
        </button>
      </div>
    </div>
  `
})
export class MindMapCanvasComponent {
  readonly nodes = input.required<MindMapNode[]>();
  readonly selectedId = input<string | null>(null);
  /**
   * The node whose rename box is open.
   *
   * Its own rect and text are not drawn while that is true: the floating input
   * sits exactly on top, and a node's stroke straddles its outline — so the
   * selection ring showed around the input, with the SVG's radius (which scales
   * with zoom) against the input's fixed one. Two rounded rectangles, slightly
   * different curves, one lumpy outline.
   */
  readonly editingId = input<string | null>(null);
  /** Tasks referenced by task-nodes, so a node can show status without a lookup service. */
  readonly tasks = input<Task[]>([]);

  readonly selected = output<string>();
  readonly editRequested = output<string>();
  readonly toggleRequested = output<string>();
  readonly reparentRequested = output<{ nodeId: string; parentId: string }>();
  /** `nodeId` is null when the click landed on empty canvas. */
  readonly contextMenuRequested = output<{ x: number; y: number; nodeId: string | null }>();

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');

  protected readonly padX = NODE_PADDING_X;
  protected readonly padY = NODE_PADDING_Y;
  protected readonly lineHeight = NODE_LINE_HEIGHT;

  /** Pan and zoom, as a viewBox rather than a transform, so hit-testing is free. */
  private readonly camera = signal({ x: -400, y: -300, width: 1200, height: 800 });
  private readonly viewportSize = signal({ width: 1200, height: 800 });

  /** Long press is the touch equivalent of a right click. */
  private longPress: ReturnType<typeof setTimeout> | null = null;

  private drag: {
    kind: 'pan' | 'node';
    startX: number;
    startY: number;
    nodeId?: string;
    moved: boolean;
  } | null = null;

  /** Memoised text widths — the same label is measured once per session. */
  private readonly widths = new Map<string, number>();
  private context?: CanvasRenderingContext2D | null;
  private readonly wrapped = new Map<string, string[]>();

  protected readonly laidOut = computed(() =>
    layoutMap(this.nodes(), node => {
      const measured = measureNode(node.text || 'Untitled', text => this.measure(text, node), {
        hasBadge: node.kind === 'task',
        hasIcon: !!node.icon
      });
      this.wrapped.set(node.id + '|' + node.text, measured.lines);
      return measured.size;
    })
  );

  protected readonly viewBox = computed(() => {
    const camera = this.camera();
    return `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;
  });

  constructor() {
    // Frame the map the first time it has something in it.
    let framed = false;
    effect(() => {
      const laid = this.laidOut();
      if (framed || laid.nodes.length === 0) return;
      framed = true;
      queueMicrotask(() => this.fit());
    });
  }

  // --- measuring -----------------------------------------------------------

  private measure(text: string, node: MindMapNode): number {
    const font = `${node.parentId ? (node.kind === 'task' ? '500 13px' : '400 13px') : '700 15px'} system-ui, -apple-system, sans-serif`;
    const key = font + '|' + text;
    const cached = this.widths.get(key);
    if (cached !== undefined) return cached;

    if (this.context === undefined) {
      this.context = document.createElement('canvas').getContext('2d');
    }
    if (!this.context) {
      // No 2D context (a very old browser, or a headless one): approximate
      // rather than collapse every node to nothing.
      const approximate = text.length * 7;
      this.widths.set(key, approximate);
      return approximate;
    }

    this.context.font = font;
    const width = this.context.measureText(text).width;
    this.widths.set(key, width);
    return width;
  }

  protected linesFor(box: LaidOutNode): string[] {
    return this.wrapped.get(box.node.id + '|' + box.node.text) ?? [box.node.text || 'Untitled'];
  }

  // --- appearance ----------------------------------------------------------

  protected fill(box: LaidOutNode): string {
    if (box.depth === 0) return box.node.colour || '#16a34a';
    if (box.node.colour) return box.node.colour;
    return box.node.kind === 'note' ? '#fefce8' : '#ffffff';
  }

  protected stroke(box: LaidOutNode): string {
    if (box.node.id === this.selectedId()) return '#3b82f6';
    if (box.depth === 0) return box.node.colour || '#16a34a';
    return '#cbd5e1';
  }

  protected textColour(box: LaidOutNode): string {
    return box.depth === 0 || box.node.colour ? '#ffffff' : '#1e293b';
  }

  /** The task behind a node, or undefined — including for a link that has gone stale. */
  protected taskFor(node: MindMapNode): Task | undefined {
    return node.taskId ? this.tasks().find(task => task.id === node.taskId) : undefined;
  }

  protected statusColour(node: MindMapNode): string {
    const task = this.taskFor(node);
    if (!task) return '#94a3b8';
    const status = task.status ?? (task.completed ? 'done' : 'todo');
    return { todo: '#94a3b8', in_progress: '#3b82f6', blocked: '#f59e0b', done: '#22c55e' }[status];
  }

  protected progressOf(node: MindMapNode): number {
    const task = this.taskFor(node);
    if (!task) return 0;
    return task.completed ? 100 : (task.progressPct ?? (task.status === 'in_progress' ? 10 : 0));
  }

  protected path = edgePath;
  protected readonly statusMeta = TASK_STATUS_META;

  // --- pan, zoom, drag -----------------------------------------------------

  protected onPointerDown(event: PointerEvent): void {
    if (this.drag) return;
    this.drag = { kind: 'pan', startX: event.clientX, startY: event.clientY, moved: false };
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.armLongPress(event, null);
  }

  /**
   * The right-click menu, and its touch equivalent.
   *
   * `preventDefault` only inside the canvas: the browser's own menu is the
   * right one everywhere else on the page, and taking it away globally is the
   * kind of thing that makes an app feel like it is fighting the machine.
   */
  protected onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenuRequested.emit({
      x: event.clientX,
      y: event.clientY,
      nodeId: this.nodeUnder(event.clientX, event.clientY)
    });
  }

  private armLongPress(event: PointerEvent, nodeId: string | null): void {
    if (event.pointerType !== 'touch') return;
    this.cancelLongPress();
    this.longPress = setTimeout(() => {
      // Only if the finger has not started dragging: a long press that moved is
      // a pan, not a menu.
      if (this.drag?.moved) return;
      this.contextMenuRequested.emit({
        x: event.clientX,
        y: event.clientY,
        nodeId: nodeId ?? this.nodeUnder(event.clientX, event.clientY)
      });
      this.drag = null;
    }, 500);
  }

  private cancelLongPress(): void {
    if (this.longPress) clearTimeout(this.longPress);
    this.longPress = null;
  }

  protected onNodePointerDown(event: PointerEvent, box: LaidOutNode): void {
    event.stopPropagation();
    this.selected.emit(box.node.id);
    this.armLongPress(event, box.node.id);
    // A right-click selects but must not start a drag; the menu handles it.
    if (event.button === 2) return;
    this.drag = {
      kind: 'node',
      startX: event.clientX,
      startY: event.clientY,
      nodeId: box.node.id,
      moved: false
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.drag) return;

    const dx = event.clientX - this.drag.startX;
    const dy = event.clientY - this.drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.drag.moved = true;
      this.cancelLongPress();
    }

    if (this.drag.kind !== 'pan') return;

    const camera = this.camera();
    const size = this.hostSize();
    // Move the camera the other way, by the same distance in map units.
    const scale = camera.width / Math.max(size.width, 1);
    this.camera.set({ ...camera, x: camera.x - dx * scale, y: camera.y - dy * scale });
    this.drag.startX = event.clientX;
    this.drag.startY = event.clientY;
  }

  protected endPointer(event: PointerEvent): void {
    this.cancelLongPress();
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.kind !== 'node' || !drag.moved || !drag.nodeId) return;

    // Dropped on another node: reparent. The service refuses cycles, so the
    // worst a bad drop can do is nothing.
    const target = this.nodeUnder(event.clientX, event.clientY);
    if (target && target !== drag.nodeId) {
      this.reparentRequested.emit({ nodeId: drag.nodeId, parentId: target });
    }
  }

  private nodeUnder(clientX: number, clientY: number): string | null {
    const point = this.toMapPoint(clientX, clientY);
    // Last match wins: later boxes are drawn on top.
    let found: string | null = null;
    for (const box of this.laidOut().nodes) {
      if (
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
      ) {
        found = box.node.id;
      }
    }
    return found;
  }

  private toMapPoint(clientX: number, clientY: number): { x: number; y: number } {
    const element = this.host()?.nativeElement;
    const camera = this.camera();
    if (!element) return { x: clientX, y: clientY };

    const rect = element.getBoundingClientRect();
    return {
      x: camera.x + ((clientX - rect.left) / rect.width) * camera.width,
      y: camera.y + ((clientY - rect.top) / rect.height) * camera.height
    };
  }

  protected onWheel(event: WheelEvent): void {
    // Plain wheel scrolls the page; ⌘/ctrl + wheel is the zoom gesture every
    // canvas uses, and trackpad pinch arrives as exactly that.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX, event.clientY);
  }

  zoomBy(factor: number, clientX?: number, clientY?: number): void {
    const camera = this.camera();
    const anchor =
      clientX !== undefined && clientY !== undefined
        ? this.toMapPoint(clientX, clientY)
        : { x: camera.x + camera.width / 2, y: camera.y + camera.height / 2 };

    const width = clamp(camera.width / factor, 200, 12000);
    const height = width * (camera.height / camera.width);

    // Keep whatever is under the pointer under the pointer.
    this.camera.set({
      x: anchor.x - ((anchor.x - camera.x) * width) / camera.width,
      y: anchor.y - ((anchor.y - camera.y) * height) / camera.height,
      width,
      height
    });
  }

  /** Frames the whole map with a margin. Also the "I am lost" button. */
  fit(): void {
    const bounds = this.laidOut().bounds;
    const size = this.hostSize();
    const aspect = size.height / Math.max(size.width, 1);

    if (bounds.width === 0) {
      this.camera.set({ x: -400, y: -300 * aspect, width: 800, height: 800 * aspect });
      return;
    }

    const margin = 80;
    const width = Math.max(bounds.width + margin * 2, (bounds.height + margin * 2) / aspect);
    this.camera.set({
      x: bounds.x + bounds.width / 2 - width / 2,
      y: bounds.y + bounds.height / 2 - (width * aspect) / 2,
      width,
      height: width * aspect
    });
  }

  /** Brings a node into view without changing the zoom — used after Tab. */
  reveal(nodeId: string): void {
    const box = this.laidOut().nodes.find(item => item.node.id === nodeId);
    if (!box) return;

    const camera = this.camera();
    const inside =
      box.x >= camera.x &&
      box.x + box.width <= camera.x + camera.width &&
      box.y >= camera.y &&
      box.y + box.height <= camera.y + camera.height;
    if (inside) return;

    this.camera.set({
      ...camera,
      x: box.x + box.width / 2 - camera.width / 2,
      y: box.y + box.height / 2 - camera.height / 2
    });
  }

  /** Where a node is on screen, so the editor can float an input over it. */
  /**
   * Where a node is on screen, so the editor can float an input over it.
   *
   * Returns the corner RADIUS and the font size as well as the box. The node's
   * `rx` is in map units, so at 2× zoom its corners are 20 px while a Tailwind
   * `rounded-lg` input stays at 8 — which is exactly the mismatch that made the
   * outline look doubled. The caller applies both, and the input becomes the
   * node rather than a rectangle sitting on one.
   */
  screenRect(
    nodeId: string
  ): { left: number; top: number; width: number; height: number; radius: number; fontSize: number } | null {
    const box = this.laidOut().nodes.find(item => item.node.id === nodeId);
    const element = this.host()?.nativeElement;
    if (!box || !element) return null;

    const camera = this.camera();
    const rect = element.getBoundingClientRect();
    const scaleX = rect.width / camera.width;
    const scaleY = rect.height / camera.height;

    return {
      left: (box.x - camera.x) * scaleX,
      top: (box.y - camera.y) * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY,
      // 10 is the rect's rx; the stroke sits inside the input's own border.
      radius: 10 * scaleX,
      fontSize: (box.depth === 0 ? 15 : 13) * scaleX
    };
  }

  private hostSize(): { width: number; height: number } {
    const element = this.host()?.nativeElement;
    if (!element) return this.viewportSize();
    const rect = element.getBoundingClientRect();
    const size = { width: rect.width || 1200, height: rect.height || 800 };
    this.viewportSize.set(size);
    return size;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
