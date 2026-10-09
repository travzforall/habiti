import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToolkitService } from '../../services/toolkit.service';
import {
  TOOLKIT_KINDS,
  TOOLKIT_KIND_META,
  TOOLKIT_STATUSES,
  TOOLKIT_STATUS_META,
  ToolkitItem,
  ToolkitKind,
  ToolkitStatus,
  iconFor
} from '../../models/toolkit.models';

type KindFilter = ToolkitKind | 'all';
type StatusFilter = ToolkitStatus | 'all' | 'wanted';

/**
 * The form's working copy.
 *
 * Named rather than inferred because the template patches it field by field —
 * Angular expressions support object literals but NOT spread, so
 * `draft.set({ ...draft(), title: $event })` does not parse and every binding
 * goes through `patchDraft()` instead.
 */
type Draft = ReturnType<typeof emptyDraft>;

/** The blank form, and what "reset" means after a save. */
function emptyDraft() {
  return {
    title: '',
    kind: 'tool' as ToolkitKind,
    status: 'have' as ToolkitStatus,
    icon: '',
    quantity: null as number | null,
    unit: '',
    unitCost: null as number | null,
    supplier: '',
    url: '',
    location: '',
    purchasedOn: '',
    renewsOn: '',
    note: ''
  };
}

/**
 * The user's standing kit.
 *
 * Deliberately separate from a project's item list: this is what you own,
 * that is what a job needs. Adding from here to a project COPIES, so editing
 * your kit later never rewrites a finished job's numbers.
 */
@Component({
  selector: 'app-toolkit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './toolkit.html',
  styleUrl: './toolkit.scss'
})
export class ToolkitComponent {
  private toolkit = inject(ToolkitService);

  protected readonly kinds = TOOLKIT_KINDS;
  protected readonly kindMeta = TOOLKIT_KIND_META;
  protected readonly statuses = TOOLKIT_STATUSES;
  protected readonly statusMeta = TOOLKIT_STATUS_META;

  protected readonly summary = this.toolkit.summary;
  protected readonly wanted = this.toolkit.wanted;

  protected readonly query = signal('');
  protected readonly kindFilter = signal<KindFilter>('all');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly showArchived = signal(false);

  protected readonly adding = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal(emptyDraft());

  protected readonly visible = computed<ToolkitItem[]>(() => {
    const base = this.showArchived() ? this.toolkit.archived() : this.toolkit.search(this.query());

    const kind = this.kindFilter();
    const status = this.statusFilter();

    return base.filter(item => {
      if (kind !== 'all' && item.kind !== kind) return false;
      if (status === 'all') return true;
      // 'wanted' is the shopping list — two statuses, one filter, because
      // "what do I need to sort out" is one question.
      if (status === 'wanted') return TOOLKIT_STATUS_META[item.status].wanted;
      return item.status === status;
    });
  });

  /** Grouped for display; a flat list of forty things is unreadable. */
  protected readonly grouped = computed(() =>
    TOOLKIT_KINDS.map(kind => ({
      kind,
      meta: TOOLKIT_KIND_META[kind],
      items: this.visible().filter(item => item.kind === kind)
    })).filter(group => group.items.length > 0)
  );

  protected readonly isEmpty = computed(() => this.toolkit.live().length === 0);

  /** The template's only way to write to the draft — see the note on `Draft`. */
  protected patchDraft(patch: Partial<Draft>): void {
    this.draft.update(current => ({ ...current, ...patch }));
  }

  protected icon(item: ToolkitItem): string {
    return iconFor(item);
  }

  protected lineValue(item: ToolkitItem): number {
    if (!TOOLKIT_KIND_META[item.kind].costed) return 0;
    return (item.unitCost ?? 0) * (item.quantity ?? 1);
  }

  // --- Filters --------------------------------------------------------------

  protected setKind(kind: KindFilter): void {
    this.kindFilter.set(kind);
  }

  protected setStatus(status: StatusFilter): void {
    this.statusFilter.set(status);
  }

  protected countOfKind(kind: ToolkitKind): number {
    return this.toolkit.byKind(kind).length;
  }

  // --- Add / edit -----------------------------------------------------------

  protected startAdd(): void {
    this.draft.set(emptyDraft());
    this.editingId.set(null);
    this.adding.set(true);
  }

  protected startEdit(item: ToolkitItem): void {
    this.draft.set({
      title: item.title,
      kind: item.kind,
      status: item.status,
      icon: item.icon ?? '',
      quantity: item.quantity ?? null,
      unit: item.unit ?? '',
      unitCost: item.unitCost ?? null,
      supplier: item.supplier ?? '',
      url: item.url ?? '',
      location: item.location ?? '',
      purchasedOn: toInputDate(item.purchasedOn),
      renewsOn: toInputDate(item.renewsOn),
      note: item.note ?? ''
    });
    this.editingId.set(item.id);
    this.adding.set(true);
  }

  protected cancel(): void {
    this.adding.set(false);
    this.editingId.set(null);
  }

  protected save(): void {
    const d = this.draft();
    const title = d.title.trim();
    if (!title) return;

    const patch: Partial<ToolkitItem> & { title: string } = {
      title,
      kind: d.kind,
      status: d.status,
      icon: d.icon.trim() || undefined,
      quantity: d.quantity ?? undefined,
      unit: d.unit.trim() || undefined,
      unitCost: d.unitCost ?? undefined,
      supplier: d.supplier.trim() || undefined,
      url: d.url.trim() || undefined,
      location: d.location.trim() || undefined,
      purchasedOn: fromInputDate(d.purchasedOn),
      renewsOn: fromInputDate(d.renewsOn),
      note: d.note.trim() || undefined
    };

    const editing = this.editingId();
    if (editing) {
      this.toolkit.update(editing, patch);
    } else {
      this.toolkit.add(patch);
    }

    this.adding.set(false);
    this.editingId.set(null);
  }

  // --- Row actions ----------------------------------------------------------

  protected cycleStatus(item: ToolkitItem): void {
    // Have ⇄ Need is the flip people actually make; the rest are set in the
    // form. A full cycle through five states makes the common case slower.
    this.toolkit.setStatus(item.id, item.status === 'have' ? 'need' : 'have');
  }

  protected archive(item: ToolkitItem): void {
    this.toolkit.archive(item.id);
  }

  protected restore(item: ToolkitItem): void {
    this.toolkit.restore(item.id);
  }

  protected remove(item: ToolkitItem): void {
    this.toolkit.remove(item.id);
  }
}

function toInputDate(date: Date | undefined): string {
  if (!date) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromInputDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  // Constructed locally, not via `new Date(string)`, which parses a date-only
  // string as UTC and lands on the previous day west of Greenwich.
  return new Date(year, month - 1, day);
}
