import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AlertService } from '../../services/alert.service';
import { WebSocketService } from '../../services/websocket.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface QueuedIncident {
  id: string;
  userId: string;
  userName: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  timestamp: Date;
  waitTime: number;
  location?: { lat: number; lng: number; address?: string };
  subscriptionTier: string;
}

interface OperatorStats {
  activeOperators: number;
  availableOperators: number;
  activeIncidents: number;
  pendingIncidents: number;
  averageResponseTime: number;
  todayResolved: number;
}

@Component({
  selector: 'app-monitoring-center',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-base-300 p-4">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">Monitoring Center</h1>
          <p class="text-base-content/60">24/7 Professional Response Dashboard</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="badge badge-lg"
               [class.badge-success]="wsService.isConnected()"
               [class.badge-error]="!wsService.isConnected()">
            {{ wsService.isConnected() ? 'Connected' : 'Disconnected' }}
          </div>
          <div class="badge badge-lg badge-primary">
            Operator: John Smith
          </div>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold text-error">{{ stats().activeIncidents }}</p>
            <p class="text-xs text-base-content/60">Active</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold text-warning">{{ stats().pendingIncidents }}</p>
            <p class="text-xs text-base-content/60">Pending</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold text-success">{{ stats().availableOperators }}</p>
            <p class="text-xs text-base-content/60">Available</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold">{{ stats().activeOperators }}</p>
            <p class="text-xs text-base-content/60">On Duty</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold">{{ stats().averageResponseTime }}s</p>
            <p class="text-xs text-base-content/60">Avg Response</p>
          </div>
        </div>
        <div class="card bg-base-100 shadow">
          <div class="card-body p-3 text-center">
            <p class="text-3xl font-bold text-success">{{ stats().todayResolved }}</p>
            <p class="text-xs text-base-content/60">Resolved Today</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Incident Queue -->
        <div class="lg:col-span-2">
          <div class="card bg-base-100 shadow h-full">
            <div class="card-body">
              <div class="flex justify-between items-center mb-4">
                <h2 class="card-title">Incident Queue</h2>
                <div class="flex gap-2">
                  <select class="select select-sm select-bordered">
                    <option>All Priorities</option>
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                  </select>
                  <select class="select select-sm select-bordered">
                    <option>All Types</option>
                    <option>SOS</option>
                    <option>Fall Detection</option>
                    <option>Camera Alert</option>
                  </select>
                </div>
              </div>

              @if (incidents().length === 0) {
                <div class="text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-success mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="font-semibold text-lg">No Active Incidents</h3>
                  <p class="text-base-content/60">All clear! No incidents requiring attention.</p>
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Subscriber</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Wait Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (incident of incidents(); track incident.id) {
                        <tr class="hover cursor-pointer"
                            [class.bg-error/10]="incident.priority === 'critical'"
                            [class.bg-warning/10]="incident.priority === 'high'">
                          <td>
                            <span class="badge"
                                  [class.badge-error]="incident.priority === 'critical'"
                                  [class.badge-warning]="incident.priority === 'high'"
                                  [class.badge-info]="incident.priority === 'medium'"
                                  [class.badge-ghost]="incident.priority === 'low'">
                              {{ incident.priority | uppercase }}
                            </span>
                          </td>
                          <td>
                            <div class="font-medium">{{ incident.userName }}</div>
                            <div class="text-xs text-base-content/60">{{ incident.subscriptionTier }}</div>
                          </td>
                          <td>{{ incident.type }}</td>
                          <td>
                            <span class="badge badge-outline badge-sm">{{ incident.status }}</span>
                          </td>
                          <td>
                            <span [class.text-error]="incident.waitTime > 60">
                              {{ formatWaitTime(incident.waitTime) }}
                            </span>
                          </td>
                          <td>
                            <button (click)="respondToIncident(incident)" class="btn btn-primary btn-xs">
                              Respond
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Right Sidebar -->
        <div class="space-y-6">
          <!-- Active Incident Detail -->
          @if (selectedIncident()) {
            <div class="card bg-base-100 shadow">
              <div class="card-body">
                <h3 class="card-title text-error">Active Response</h3>
                <div class="space-y-3">
                  <div>
                    <p class="text-sm text-base-content/60">Subscriber</p>
                    <p class="font-medium">{{ selectedIncident()!.userName }}</p>
                  </div>
                  <div>
                    <p class="text-sm text-base-content/60">Type</p>
                    <p class="font-medium">{{ selectedIncident()!.type }}</p>
                  </div>
                  @if (selectedIncident()!.location?.address) {
                    <div>
                      <p class="text-sm text-base-content/60">Location</p>
                      <p class="font-medium">{{ selectedIncident()!.location?.address }}</p>
                    </div>
                  }
                  <div class="divider my-2"></div>
                  <div class="grid grid-cols-2 gap-2">
                    <button class="btn btn-success btn-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call User
                    </button>
                    <button class="btn btn-warning btn-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Contacts
                    </button>
                    <button class="btn btn-error btn-sm col-span-2">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Dispatch 911
                    </button>
                  </div>
                  <button (click)="resolveIncident()" class="btn btn-outline btn-success btn-sm w-full mt-2">
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Quick Stats -->
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h3 class="card-title">My Shift</h3>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-base-content/60">Incidents Handled</span>
                  <span class="font-medium">12</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/60">Avg Response</span>
                  <span class="font-medium">18s</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-base-content/60">Shift Ends</span>
                  <span class="font-medium">4h 23m</span>
                </div>
              </div>
              <div class="mt-4">
                <button class="btn btn-outline btn-sm w-full">Take Break</button>
              </div>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="card bg-base-100 shadow">
            <div class="card-body">
              <h3 class="card-title">Recent Activity</h3>
              <div class="space-y-2 text-sm">
                <div class="flex gap-2">
                  <span class="text-success">✓</span>
                  <span>Resolved SOS - J. Smith</span>
                  <span class="text-base-content/50 ml-auto">2m</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-info">📞</span>
                  <span>Called contact for M. Lee</span>
                  <span class="text-base-content/50 ml-auto">8m</span>
                </div>
                <div class="flex gap-2">
                  <span class="text-warning">⚠</span>
                  <span>Fall alert - A. Johnson</span>
                  <span class="text-base-content/50 ml-auto">15m</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MonitoringCenterComponent implements OnInit, OnDestroy {
  private readonly alertService = inject(AlertService);
  readonly wsService = inject(WebSocketService);
  private readonly destroy$ = new Subject<void>();

  readonly selectedIncident = signal<QueuedIncident | null>(null);

  // Sample data - in production this would come from MonitoringService
  readonly incidents = signal<QueuedIncident[]>([
    {
      id: '1',
      userId: 'u1',
      userName: 'Mary Johnson',
      type: 'SOS Alert',
      priority: 'critical',
      status: 'pending',
      timestamp: new Date(),
      waitTime: 45,
      location: { lat: 40.7128, lng: -74.006, address: '123 Main St, New York, NY' },
      subscriptionTier: 'Premium',
    },
    {
      id: '2',
      userId: 'u2',
      userName: 'Robert Smith',
      type: 'Fall Detected',
      priority: 'high',
      status: 'pending',
      timestamp: new Date(Date.now() - 120000),
      waitTime: 120,
      location: { lat: 40.7589, lng: -73.9851, address: '456 Oak Ave, New York, NY' },
      subscriptionTier: 'Basic',
    },
    {
      id: '3',
      userId: 'u3',
      userName: 'Linda Davis',
      type: 'Camera Motion',
      priority: 'medium',
      status: 'pending',
      timestamp: new Date(Date.now() - 300000),
      waitTime: 300,
      subscriptionTier: 'Premium',
    },
  ]);

  readonly stats = signal<OperatorStats>({
    activeOperators: 8,
    availableOperators: 3,
    activeIncidents: 5,
    pendingIncidents: 3,
    averageResponseTime: 22,
    todayResolved: 47,
  });

  ngOnInit(): void {
    // Connect to WebSocket for real-time updates
    this.wsService.connect();

    // Subscribe to incident updates
    this.wsService.onMessage('incident_update')
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => {
        console.log('Incident update:', msg);
        // Update incidents list
      });

    this.wsService.onMessage('queue_update')
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => {
        console.log('Queue update:', msg);
        // Update queue stats
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  respondToIncident(incident: QueuedIncident): void {
    this.selectedIncident.set(incident);
    // In production, this would claim the incident
    this.incidents.update(incidents =>
      incidents.map(i =>
        i.id === incident.id ? { ...i, status: 'responding' } : i
      )
    );
  }

  resolveIncident(): void {
    const incident = this.selectedIncident();
    if (!incident) return;

    this.incidents.update(incidents =>
      incidents.filter(i => i.id !== incident.id)
    );
    this.selectedIncident.set(null);
  }

  formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
