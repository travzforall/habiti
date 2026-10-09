import {
  Component,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map as mapOperator } from 'rxjs/operators';
import { MindMapService } from '../../services/mind-map.service';
import { TasksService } from '../../services/tasks.service';
import { ProjectsService } from '../../services/projects.service';
import { ToastService } from '../../services/toast.service';
import {
  MindMapNode,
  MindMapNodeKind,
  PERSONAL_BOARD,
  childrenOf,
  depthOf,
  detachSubtree,
  rootOf,
  subtreeOf
} from '../../models/mind-map.models';
import { MindMapCanvasComponent } from '../../components/mind-map-canvas/mind-map-canvas.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import {
  ContextMenuComponent,
  ContextMenuItem
} from '../../components/context-menu/context-menu.component';
import { TASK_STATUS_META, taskProgress } from '../../config/task-progress';
import { exportMarkdown, exportSvg } from '../../config/mind-map-export';

/**
 * The editor.
 *
 * Keyboard-first, because that is how a mind map is actually written: Tab for a
 * child, Enter for a sibling, type to rename. Everything the mouse can do here,
 * the keyboard can do faster, and the outline view exists for the times a
 * canvas is the wrong tool entirely (a phone, a screen reader).
 *
 * Text editing floats a real <input> over the node rather than using
 * <foreignObject>, which Safari has historically rendered badly, and which
 * would put HTML inside the SVG that gets exported.
 */
@Component({
  selector: 'app-map-editor',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MindMapCanvasComponent,
    ConfirmDialogComponent,
    ContextMenuComponent
  ],
  templateUrl: './map-editor.html'
})
export class MapEditorComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private maps = inject(MindMapService);
  private tasksService = inject(TasksService);
  private projectsService = inject(ProjectsService);
  private toast = inject(ToastService);

  private readonly canvas = viewChild(MindMapCanvasComponent);

  protected readonly statusMeta = TASK_STATUS_META;
  protected readonly PERSONAL_BOARD = PERSONAL_BOARD;

  private readonly mapId = toSignal(
    this.route.paramMap.pipe(mapOperator(params => params.get('id') ?? '')),
    { initialValue: '' }
  );

  protected readonly fetchState = signal<'idle' | 'loading' | 'missing'>('idle');
  protected readonly selectedId = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingText = signal('');
  protected readonly view = signal<'map' | 'outline'>('map');
  protected readonly showInspector = signal(true);
  protected readonly pendingDeleteNode = signal<MindMapNode | null>(null);
  protected readonly showTaskPicker = signal(false);

  /** Where the right-click menu is, and what it was aimed at. */
  protected readonly menu = signal<{ open: boolean; x: number; y: number; nodeId: string | null }>({
    open: false,
    x: 0,
    y: 0,
    nodeId: null
  });

  protected readonly map = computed(() => this.maps.getMap(this.mapId()));
  protected readonly nodes = computed(() => this.maps.nodesForMap(this.mapId()));
  protected readonly selected = computed(() =>
    this.nodes().find(node => node.id === this.selectedId())
  );

  protected readonly canUndo = this.maps.canUndo;
  protected readonly canRedo = this.maps.canRedo;

  /** Only the tasks this map points at — the canvas needs no more than that. */
  protected readonly linkedTasks = computed(() => {
    const ids = new Set(this.nodes().map(node => node.taskId).filter(Boolean));
    return this.tasksService.tasks().filter(task => ids.has(task.id));
  });

  protected readonly selectedTask = computed(() => {
    const taskId = this.selected()?.taskId;
    return taskId ? this.tasksService.getTask(taskId) : undefined;
  });

  protected readonly project = computed(() => {
    const board = this.map()?.board;
    return board && board !== PERSONAL_BOARD ? this.projectsService.getProject(board) : undefined;
  });

  /** The outline: every node in reading order, with its depth. */
  protected readonly outline = computed(() => {
    const nodes = this.nodes();
    const root = rootOf(nodes);
    if (!root) return [];

    const rows: { node: MindMapNode; depth: number }[] = [];
    const walk = (node: MindMapNode) => {
      rows.push({ node, depth: depthOf(nodes, node) });
      for (const child of childrenOf(nodes, node.id)) walk(child);
    };
    walk(root);
    return rows;
  });

  protected readonly openTasks = computed(() =>
    this.tasksService.tasks().filter(task => !task.completed).slice(0, 50)
  );

  constructor() {
    const id = this.mapId();
    this.maps.clearHistory();

    if (id && !this.map()) {
      this.fetchState.set('loading');
      this.maps.loadMap(id).subscribe({
        next: found => this.fetchState.set(found ? 'idle' : 'missing'),
        error: () => this.fetchState.set('missing')
      });
    } else if (id) {
      this.maps.loadMap(id).subscribe({ error: () => undefined });
    }

    // Select the root once there is one, so the keyboard has somewhere to start.
    effect(() => {
      if (this.selectedId()) return;
      const root = rootOf(this.nodes());
      if (root) this.selectedId.set(root.id);
    });
  }

  // --- the right-click menu ------------------------------------------------

  /**
   * What the menu offers depends on what was clicked.
   *
   * On a node: everything about that node. On empty canvas: the few things that
   * are about the map as a whole. A menu that shows the same twelve greyed-out
   * items either way teaches people to ignore it.
   */
  protected readonly menuItems = computed<ContextMenuItem[]>(() => {
    const nodeId = this.menu().nodeId;
    const node = nodeId ? this.nodes().find(item => item.id === nodeId) : undefined;
    const clipboard = this.maps.clipboardLabel();

    if (!node) {
      return [
        { id: 'add-branch', label: 'Add branch', icon: '＋', shortcut: 'Tab' },
        {
          id: 'paste',
          label: clipboard ? `Paste “${truncate(clipboard)}”` : 'Paste',
          icon: '📋',
          shortcut: '⌘V',
          disabled: !this.maps.canPaste()
        },
        { id: 'fit', label: 'Fit to screen', icon: '⤢', separatorBefore: true },
        {
          id: 'export',
          label: 'Export map as',
          icon: '↗',
          children: [
            { id: 'export-map-md', label: 'Markdown (.md)' },
            { id: 'export-map-svg', label: 'Picture (.svg)' }
          ]
        }
      ];
    }

    const isRoot = !node.parentId;
    const hasChildren = childrenOf(this.nodes(), node.id).length > 0;
    const linked = !!node.taskId;

    return [
      { id: 'add-child', label: 'Add child', icon: '＋', shortcut: 'Tab' },
      { id: 'add-sibling', label: 'Add sibling', icon: '＋', shortcut: '↵', disabled: isRoot },
      { id: 'rename', label: 'Rename', icon: '✎', shortcut: 'F2' },

      { id: 'cut', label: 'Cut branch', icon: '✂', shortcut: '⌘X', separatorBefore: true, disabled: isRoot },
      { id: 'copy', label: 'Copy branch', icon: '⧉', shortcut: '⌘C' },
      {
        id: 'paste',
        label: clipboard ? `Paste “${truncate(clipboard)}”` : 'Paste',
        icon: '📋',
        shortcut: '⌘V',
        disabled: !this.maps.canPaste()
      },
      {
        id: 'delete',
        label: hasChildren ? 'Delete branch' : 'Delete',
        icon: '🗑',
        shortcut: '⌫',
        danger: true,
        disabled: isRoot
      },

      {
        id: 'collapse',
        label: node.collapsed ? 'Expand' : 'Collapse',
        icon: node.collapsed ? '▸' : '▾',
        shortcut: 'Space',
        separatorBefore: true,
        disabled: !hasChildren
      },
      { id: 'move-up', label: 'Move up', icon: '↑', disabled: isRoot },
      { id: 'move-down', label: 'Move down', icon: '↓', disabled: isRoot },

      linked
        ? { id: 'open-task', label: 'Open the task', icon: '☑', separatorBefore: true }
        : { id: 'make-task', label: 'Make it a task', icon: '☑', separatorBefore: true },
      ...(linked
        ? [
            { id: 'toggle-task', label: 'Tick it off', icon: '✓' },
            { id: 'unlink-task', label: 'Unlink (the task stays)', icon: '⊘' }
          ]
        : []),
      { id: 'promote', label: 'Turn this branch into tasks', icon: '⇢' },

      {
        id: 'colour',
        label: 'Colour',
        icon: '🎨',
        separatorBefore: true,
        children: [
          { id: 'colour-', label: 'None' },
          { id: 'colour-#3b82f6', label: 'Blue' },
          { id: 'colour-#16a34a', label: 'Green' },
          { id: 'colour-#f59e0b', label: 'Amber' },
          { id: 'colour-#ef4444', label: 'Red' },
          { id: 'colour-#8b5cf6', label: 'Violet' }
        ]
      },
      {
        id: 'export-branch',
        label: 'Export branch as',
        icon: '↗',
        children: [
          { id: 'export-branch-md', label: 'Markdown (.md)' },
          { id: 'export-branch-svg', label: 'Picture (.svg)' }
        ]
      }
    ];
  });

  protected openMenu(event: { x: number; y: number; nodeId: string | null }): void {
    // Right-clicking a node selects it first, so every action below can just
    // use the selection — and so it is obvious what the menu applies to.
    if (event.nodeId) this.selectedId.set(event.nodeId);
    this.menu.set({ open: true, x: event.x, y: event.y, nodeId: event.nodeId });
  }

  protected closeMenu(): void {
    this.menu.update(menu => ({ ...menu, open: false }));
  }

  protected onMenuChoice(id: string): void {
    const nodeId = this.menuAnchor();

    if (id.startsWith('colour-')) {
      this.setColour(id.slice('colour-'.length));
      return;
    }

    switch (id) {
      case 'add-branch': {
        const root = rootOf(this.nodes());
        if (root) {
          this.selectedId.set(root.id);
          this.addChild();
        }
        break;
      }
      case 'add-child':
        this.addChild();
        break;
      case 'add-sibling':
        this.addSibling();
        break;
      case 'rename':
        if (nodeId) this.startEdit(nodeId);
        break;
      case 'cut':
        if (nodeId && this.maps.cutBranch(nodeId)) {
          this.toast.success('Branch cut', 'Right-click where it should go and paste.');
        }
        break;
      case 'copy':
        if (nodeId && this.maps.copyBranch(nodeId)) {
          this.toast.success('Branch copied');
        }
        break;
      case 'paste': {
        const target = nodeId ?? rootOf(this.nodes())?.id;
        const pasted = target ? this.maps.pasteInto(target) : null;
        if (pasted) this.select(pasted.id);
        break;
      }
      case 'delete':
        this.requestDelete();
        break;
      case 'collapse':
        if (nodeId) this.maps.toggleCollapse(nodeId);
        break;
      case 'move-up':
        if (nodeId) this.maps.reorder(nodeId, -1);
        break;
      case 'move-down':
        if (nodeId) this.maps.reorder(nodeId, 1);
        break;
      case 'make-task':
        this.convertToTask();
        break;
      case 'open-task': {
        const task = this.selectedTask();
        if (task) this.router.navigate(['/tasks', task.id]);
        break;
      }
      case 'toggle-task':
        this.toggleTask();
        break;
      case 'unlink-task':
        this.unlinkTask();
        break;
      case 'promote':
        this.promoteBranch();
        break;
      case 'fit':
        this.canvas()?.fit();
        break;
      case 'export-map-md':
        this.downloadMarkdown();
        break;
      case 'export-map-svg':
        this.downloadSvg();
        break;
      case 'export-branch-md':
      case 'export-branch-svg':
        if (nodeId) this.exportBranch(nodeId, id.endsWith('svg') ? 'svg' : 'md');
        break;
    }
  }

  /** A branch, exported as if it were a map of its own. */
  private exportBranch(nodeId: string, format: 'md' | 'svg'): void {
    const branch = detachSubtree(this.nodes(), nodeId);
    const name = slug(branch[0]?.text ?? 'branch');

    if (format === 'svg') download(`${name}.svg`, exportSvg(branch), 'image/svg+xml');
    else download(`${name}.md`, exportMarkdown(branch), 'text/markdown');
  }

  // --- keyboard ------------------------------------------------------------

  /**
   * The shortcuts, on the document.
   *
   * Ignored while a field has focus — otherwise Tab inside the rename box would
   * make a child instead of moving on, and Delete would eat the node someone is
   * in the middle of naming.
   */
  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable === true;

    if (typing) {
      if (event.key === 'Escape') this.cancelEdit();
      if (event.key === 'Enter' && this.editingId()) {
        event.preventDefault();
        this.commitEdit(true);
      }
      return;
    }

    const selectedId = this.selectedId();
    const meta = event.metaKey || event.ctrlKey;

    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if (!selectedId) return;

    // ⌘X/⌘C/⌘V move a BRANCH, not text — there is no text selection on a map.
    if (meta) {
      const key = event.key.toLowerCase();
      if (key === 'x' || key === 'c' || key === 'v') {
        event.preventDefault();
        this.onMenuChoice(key === 'x' ? 'cut' : key === 'c' ? 'copy' : 'paste');
        return;
      }
    }

    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        this.addChild();
        break;
      case 'Enter':
        event.preventDefault();
        this.addSibling();
        break;
      case 'F2':
        event.preventDefault();
        this.startEdit(selectedId);
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.requestDelete();
        break;
      case ' ':
        event.preventDefault();
        this.maps.toggleCollapse(selectedId);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.selectParent();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.selectFirstChild();
        break;
      default:
        // Typing a printable character starts a rename, replacing the label —
        // the behaviour every mind map tool has.
        if (event.key.length === 1 && !meta) {
          this.startEdit(selectedId, event.key);
          event.preventDefault();
        }
    }
  }

  // --- editing -------------------------------------------------------------

  protected addChild(): void {
    const selectedId = this.selectedId();
    if (!selectedId) return;
    const child = this.maps.addChild(selectedId);
    if (!child) return;
    this.selectedId.set(child.id);
    this.startEdit(child.id);
  }

  protected addSibling(): void {
    const selectedId = this.selectedId();
    if (!selectedId) return;
    const sibling = this.maps.addSibling(selectedId);
    if (!sibling) return;
    this.selectedId.set(sibling.id);
    this.startEdit(sibling.id);
  }

  protected startEdit(nodeId: string, initial?: string): void {
    const node = this.maps.getNode(nodeId);
    if (!node) return;
    this.editingId.set(nodeId);
    this.editingText.set(initial ?? node.text);
    queueMicrotask(() => {
      const input = document.getElementById('node-editor') as HTMLInputElement | null;
      input?.focus();
      if (!initial) input?.select();
    });
  }

  /** `andContinue` is Enter: save, then open a sibling, which is how a list gets typed. */
  protected commitEdit(andContinue = false): void {
    const nodeId = this.editingId();
    if (!nodeId) return;

    this.maps.updateNode(nodeId, { text: this.editingText().trim() || 'Untitled' });
    this.editingId.set(null);

    if (andContinue) this.addSibling();
  }

  protected cancelEdit(): void {
    const nodeId = this.editingId();
    this.editingId.set(null);
    // A node created by Tab and then abandoned should not linger as "Untitled".
    const node = nodeId ? this.maps.getNode(nodeId) : undefined;
    if (node && !node.text.trim() && node.parentId) this.maps.deleteNode(node.id);
  }

  protected requestDelete(): void {
    const node = this.selected();
    if (!node?.parentId) return;
    const children = subtreeOf(this.nodes(), node.id).length - 1;
    if (children === 0) {
      this.deleteConfirmed();
      return;
    }
    this.pendingDeleteNode.set(node);
  }

  protected deleteConfirmed(): void {
    const node = this.pendingDeleteNode() ?? this.selected();
    this.pendingDeleteNode.set(null);
    if (!node?.parentId) return;

    const parentId = node.parentId;
    this.maps.deleteNode(node.id);
    this.selectedId.set(parentId);
  }

  protected undo(): void {
    this.maps.undo(this.mapId());
  }

  protected redo(): void {
    this.maps.redo(this.mapId());
  }

  protected onReparent(event: { nodeId: string; parentId: string }): void {
    if (!this.maps.reparent(event.nodeId, event.parentId)) {
      this.toast.info('That would put a branch inside itself');
    }
  }

  // --- selection -----------------------------------------------------------

  private moveSelection(direction: -1 | 1): void {
    const node = this.selected();
    if (!node?.parentId) return;

    const siblings = childrenOf(this.nodes(), node.parentId);
    const index = siblings.findIndex(sibling => sibling.id === node.id);
    const next = siblings[index + direction];
    if (next) this.select(next.id);
  }

  private selectParent(): void {
    const parentId = this.selected()?.parentId;
    if (parentId) this.select(parentId);
  }

  private selectFirstChild(): void {
    const node = this.selected();
    if (!node) return;
    const [first] = childrenOf(this.nodes(), node.id);
    if (first) this.select(first.id);
  }

  protected select(nodeId: string): void {
    this.selectedId.set(nodeId);
    this.canvas()?.reveal(nodeId);
  }

  /** Keyboard actions act on the selection; the menu sets it when it opens. */
  private menuAnchor(): string | null {
    return this.menu().nodeId ?? this.selectedId();
  }

  // --- the inspector: kind, note, colour, task -----------------------------

  /** Renames from the inspector, where there is no floating editor involved. */
  protected renameSelected(text: string): void {
    const node = this.selected();
    const trimmed = text.trim();
    if (!node || !trimmed || trimmed === node.text) return;
    this.maps.updateNode(node.id, { text: trimmed });
  }

  protected setKind(kind: MindMapNodeKind): void {
    const node = this.selected();
    if (node) this.maps.updateNode(node.id, { kind });
  }

  protected setNote(note: string): void {
    const node = this.selected();
    if (node) this.maps.updateNode(node.id, { note });
  }

  protected setColour(colour: string): void {
    const node = this.selected();
    if (node) this.maps.updateNode(node.id, { colour: colour || undefined });
  }

  /**
   * Turns this node into a real task.
   *
   * The task lands in the map's project when the map has one, and standalone
   * when it does not — the same rule the rest of the app uses.
   */
  protected convertToTask(): void {
    const node = this.selected();
    const map = this.map();
    if (!node || !map || node.taskId) return;

    const task = this.tasksService.createTask({
      title: node.text || 'Untitled',
      description: node.note,
      projectId: map.board === PERSONAL_BOARD ? 'standalone' : map.board
    });

    this.maps.updateNode(node.id, { kind: 'task', taskId: task.id });
    this.toast.success('Task created', map.board === PERSONAL_BOARD ? undefined : 'In this project');
  }

  protected linkTask(taskId: string): void {
    const node = this.selected();
    if (!node) return;
    this.maps.updateNode(node.id, { kind: 'task', taskId });
    this.showTaskPicker.set(false);
  }

  protected unlinkTask(): void {
    const node = this.selected();
    if (!node) return;
    // The task itself is untouched — it exists outside this map.
    this.maps.updateNode(node.id, { kind: 'idea', taskId: undefined });
  }

  protected toggleTask(): void {
    const task = this.selectedTask();
    if (!task) return;
    this.tasksService.toggleTask(task.id);
    if (task.projectId && task.projectId !== 'standalone') {
      this.projectsService.updateProjectProgress(task.projectId);
    }
  }

  /**
   * Every node in this branch becomes a task, in order.
   *
   * This is the point of the whole feature: an hour of thinking turns into a
   * list you can actually work through, without retyping any of it.
   */
  protected promoteBranch(): void {
    const node = this.selected();
    const map = this.map();
    if (!node || !map) return;

    const branch = subtreeOf(this.nodes(), node.id).filter(item => !item.taskId);
    if (branch.length === 0) {
      this.toast.info('Everything here is already a task');
      return;
    }

    const projectId = map.board === PERSONAL_BOARD ? 'standalone' : map.board;
    for (const item of branch) {
      const task = this.tasksService.createTask({
        title: item.text || 'Untitled',
        description: item.note,
        projectId
      });
      this.maps.updateNode(item.id, { kind: 'task', taskId: task.id });
    }

    if (projectId !== 'standalone') this.projectsService.updateProjectProgress(projectId);
    this.toast.success(
      `${branch.length} task${branch.length === 1 ? '' : 's'} created`,
      projectId === 'standalone' ? 'On your task list' : 'In this project'
    );
  }

  protected progressOf(nodeId: string): number {
    const node = this.nodes().find(item => item.id === nodeId);
    const task = node?.taskId ? this.tasksService.getTask(node.taskId) : undefined;
    return task ? taskProgress(task) : 0;
  }

  // --- map level -----------------------------------------------------------

  protected rename(title: string): void {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.maps.updateMap(this.mapId(), { title: trimmed });
  }

  protected downloadSvg(): void {
    const map = this.map();
    if (!map) return;
    download(`${slug(map.title)}.svg`, exportSvg(this.nodes()), 'image/svg+xml');
  }

  protected downloadMarkdown(): void {
    const map = this.map();
    if (!map) return;
    download(`${slug(map.title)}.md`, exportMarkdown(this.nodes()), 'text/markdown');
  }

  /** Where to float the rename box, including the node's own radius and type size. */
  protected editorBox(): ReturnType<MindMapCanvasComponent['screenRect']> {
    const editingId = this.editingId();
    return editingId ? (this.canvas()?.screenRect(editingId) ?? null) : null;
  }

  /**
   * Saves on the way out, whichever way that is.
   *
   * The debounce is 800 ms, and navigating away is exactly the moment someone
   * has just typed something. Route changes destroy this component, so this is
   * the one place that catches every exit — the back button, a breadcrumb, a
   * link in the inspector.
   */
  ngOnDestroy(): void {
    this.maps.flush();
  }

  protected leave(): void {
    this.router.navigate(['/maps']);
  }
}

/** Keeps a pasted branch's name from stretching the menu across the screen. */
function truncate(text: string, max = 24): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mind-map';
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
