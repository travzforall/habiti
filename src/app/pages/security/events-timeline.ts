import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CameraService } from '../../services/camera.service';
import { CameraEvent, CameraEventType } from '../../models/security.models';

@Component({
  selector: 'app-events-timeline',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
          <a routerLink="/security" class="btn btn-ghost btn-sm btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 class="text-2xl font-bold">Events Timeline</h1>
            <p class="text-base-content/60">{{ filteredEvents().length }} events</p>
          </div>
        </div>
        <div class="flex gap-2">
          @if (unacknowledgedCount() > 0) {
            <button (click)="acknowledgeAll()" class="btn btn-ghost btn-sm">
              Mark All Read ({{ unacknowledgedCount() }})
            </button>
          }
        </div>
      </div>

      <!-- Filters -->
      <div class="card bg-base-100 shadow mb-6">
        <div class="card-body p-4">
          <div class="flex flex-wrap gap-4">
            <!-- Camera Filter -->
            <div class="form-control w-full sm:w-auto">
              <label class="label py-1">
                <span class="label-text">Camera</span>
              </label>
              <select [(ngModel)]="filterCamera" (ngModelChange)="applyFilters()" class="select select-bordered select-sm">
                <option value="">All Cameras</option>
                @for (camera of cameras(); track camera.id) {
                  <option [value]="camera.id">{{ camera.name }}</option>
                }
              </select>
            </div>

            <!-- Event Type Filter -->
            <div class="form-control w-full sm:w-auto">
              <label class="label py-1">
                <span class="label-text">Event Type</span>
              </label>
              <select [(ngModel)]="filterType" (ngModelChange)="applyFilters()" class="select select-bordered select-sm">
                <option value="">All Types</option>
                @for (type of eventTypes; track type) {
                  <option [value]="type">{{ type | titlecase }}</option>
                }
              </select>
            </div>

            <!-- Date Filter -->
            <div class="form-control w-full sm:w-auto">
              <label class="label py-1">
                <span class="label-text">Date Range</span>
              </label>
              <select [(ngModel)]="filterDateRange" (ngModelChange)="applyFilters()" class="select select-bordered select-sm">
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <!-- Status Filter -->
            <div class="form-control w-full sm:w-auto">
              <label class="label py-1">
                <span class="label-text">Status</span>
              </label>
              <select [(ngModel)]="filterAcknowledged" (ngModelChange)="applyFilters()" class="select select-bordered select-sm">
                <option value="">All</option>
                <option value="unread">Unread Only</option>
                <option value="read">Read Only</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Events List -->
      @if (filteredEvents().length === 0) {
        <div class="card bg-base-100 shadow">
          <div class="card-body text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h3 class="font-semibold text-lg mb-2">No Events Found</h3>
            <p class="text-base-content/60">
              @if (hasFilters()) {
                No events match your current filters. Try adjusting them.
              } @else {
                No events have been recorded yet.
              }
            </p>
            @if (hasFilters()) {
              <button (click)="clearFilters()" class="btn btn-ghost btn-sm mt-4">
                Clear Filters
              </button>
            }
          </div>
        </div>
      } @else {
        <div class="space-y-4">
          <!-- Group by date -->
          @for (group of groupedEvents(); track group.date) {
            <div>
              <h3 class="text-sm font-bold text-base-content/60 mb-2 px-2">{{ group.label }}</h3>
              <div class="card bg-base-100 shadow">
                <div class="divide-y divide-base-200">
                  @for (event of group.events; track event.id) {
                    <div class="p-4 hover:bg-base-200 transition-colors"
                         [class.opacity-60]="event.acknowledged">
                      <div class="flex items-start gap-4">
                        <!-- Event Icon -->
                        <div class="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                             [class.bg-warning/20]="event.type === 'person'"
                             [class.bg-info/20]="event.type === 'vehicle'"
                             [class.bg-success/20]="event.type === 'pet'"
                             [class.bg-base-200]="event.type === 'motion' || event.type === 'sound'">
                          @switch (event.type) {
                            @case ('person') {
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            }
                            @case ('vehicle') {
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1" />
                              </svg>
                            }
                            @case ('pet') {
                              <span class="text-2xl">🐾</span>
                            }
                            @case ('sound') {
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              </svg>
                            }
                            @default {
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            }
                          }
                        </div>

                        <!-- Event Details -->
                        <div class="flex-1 min-w-0">
                          <div class="flex items-start justify-between gap-2">
                            <div>
                              <h4 class="font-semibold">{{ event.type | titlecase }} Detected</h4>
                              <p class="text-sm text-base-content/60">
                                {{ getCameraName(event.cameraId) }}
                              </p>
                            </div>
                            <div class="text-right flex-shrink-0">
                              <p class="text-sm font-medium">{{ formatTime(event.timestamp) }}</p>
                              @if (!event.acknowledged) {
                                <span class="badge badge-xs badge-primary">New</span>
                              }
                            </div>
                          </div>

                          <!-- Event thumbnail if available -->
                          @if (event.thumbnailUrl) {
                            <div class="mt-2">
                              <img [src]="event.thumbnailUrl"
                                   alt="Event thumbnail"
                                   class="rounded-lg max-h-32 object-cover" />
                            </div>
                          }

                          <!-- Actions -->
                          <div class="flex items-center gap-2 mt-2">
                            @if (event.clipUrl) {
                              <button class="btn btn-ghost btn-xs">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Play Clip
                              </button>
                            }
                            <a [routerLink]="['/security/cameras', event.cameraId]" class="btn btn-ghost btn-xs">
                              View Camera
                            </a>
                            @if (!event.acknowledged) {
                              <button (click)="acknowledgeEvent(event.id)" class="btn btn-ghost btn-xs">
                                Dismiss
                              </button>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Load More -->
        @if (canLoadMore()) {
          <div class="text-center mt-6">
            <button (click)="loadMore()" class="btn btn-outline">
              Load More Events
            </button>
          </div>
        }
      }
    </div>
  `
})
export class EventsTimelineComponent implements OnInit {
  private readonly cameraService = inject(CameraService);
  private readonly route = inject(ActivatedRoute);

  readonly cameras = this.cameraService.cameras;
  readonly allEvents = this.cameraService.events;

  readonly eventTypes: CameraEventType[] = ['motion', 'person', 'vehicle', 'pet', 'sound'];

  // Filters
  filterCamera = '';
  filterType = '';
  filterDateRange = 'all';
  filterAcknowledged = '';

  readonly displayLimit = signal(50);

  readonly filteredEvents = computed(() => {
    let events = this.allEvents();

    // Filter by camera
    if (this.filterCamera) {
      events = events.filter(e => e.cameraId === this.filterCamera);
    }

    // Filter by type
    if (this.filterType) {
      events = events.filter(e => e.type === this.filterType);
    }

    // Filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (this.filterDateRange) {
      case 'today':
        events = events.filter(e => new Date(e.timestamp) >= today);
        break;
      case 'yesterday':
        events = events.filter(e => {
          const d = new Date(e.timestamp);
          return d >= yesterday && d < today;
        });
        break;
      case 'week':
        events = events.filter(e => new Date(e.timestamp) >= weekAgo);
        break;
      case 'month':
        events = events.filter(e => new Date(e.timestamp) >= monthAgo);
        break;
    }

    // Filter by acknowledgment status
    if (this.filterAcknowledged === 'unread') {
      events = events.filter(e => !e.acknowledged);
    } else if (this.filterAcknowledged === 'read') {
      events = events.filter(e => e.acknowledged);
    }

    return events.slice(0, this.displayLimit());
  });

  readonly unacknowledgedCount = computed(() =>
    this.filteredEvents().filter(e => !e.acknowledged).length
  );

  readonly groupedEvents = computed(() => {
    const groups: { date: string; label: string; events: CameraEvent[] }[] = [];
    const events = this.filteredEvents();

    if (events.length === 0) return groups;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    events.forEach(event => {
      const eventDate = new Date(event.timestamp);
      const dateKey = eventDate.toDateString();

      let label: string;
      if (eventDate >= today) {
        label = 'Today';
      } else if (eventDate >= yesterday) {
        label = 'Yesterday';
      } else {
        label = eventDate.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      }

      const existingGroup = groups.find(g => g.date === dateKey);
      if (existingGroup) {
        existingGroup.events.push(event);
      } else {
        groups.push({ date: dateKey, label, events: [event] });
      }
    });

    return groups;
  });

  ngOnInit(): void {
    // Check for camera filter from route params
    this.route.queryParams.subscribe(params => {
      if (params['camera']) {
        this.filterCamera = params['camera'];
      }
    });
  }

  applyFilters(): void {
    this.displayLimit.set(50);
  }

  hasFilters(): boolean {
    return !!(this.filterCamera || this.filterType || this.filterDateRange !== 'all' || this.filterAcknowledged);
  }

  clearFilters(): void {
    this.filterCamera = '';
    this.filterType = '';
    this.filterDateRange = 'all';
    this.filterAcknowledged = '';
    this.displayLimit.set(50);
  }

  canLoadMore(): boolean {
    return this.filteredEvents().length === this.displayLimit();
  }

  loadMore(): void {
    this.displayLimit.update(limit => limit + 50);
  }

  acknowledgeEvent(eventId: string): void {
    this.cameraService.acknowledgeEvent(eventId);
  }

  acknowledgeAll(): void {
    this.filteredEvents()
      .filter(e => !e.acknowledged)
      .forEach(e => this.cameraService.acknowledgeEvent(e.id));
  }

  getCameraName(cameraId: string): string {
    const camera = this.cameras().find(c => c.id === cameraId);
    return camera?.name || 'Unknown Camera';
  }

  formatTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
