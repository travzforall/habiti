import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AlertService } from '../../services/alert.service';
import { LocationService } from '../../services/location.service';

interface EmergencyDeviceSummary {
  id: string;
  name: string;
  type: 'bracelet' | 'pendant' | 'watch';
  batteryLevel: number;
  status: 'active' | 'offline' | 'low_battery';
  lastSeen: Date;
  fallDetectionEnabled: boolean;
}

interface EmergencyContactSummary {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
}

@Component({
  selector: 'app-emergency-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <!-- Emergency SOS Button - Always Visible -->
      <div class="card bg-error text-error-content shadow-xl mb-6">
        <div class="card-body items-center text-center py-8">
          <button (click)="triggerSOS()"
                  [disabled]="sosTriggered()"
                  class="btn btn-circle btn-lg w-32 h-32 bg-white text-error hover:bg-error-content hover:text-error border-4 border-white shadow-lg transition-all duration-300"
                  [class.animate-pulse]="sosTriggered()">
            @if (sosTriggered()) {
              <span class="text-2xl font-bold">SOS SENT</span>
            } @else {
              <span class="text-3xl font-bold">SOS</span>
            }
          </button>
          <p class="mt-4 font-semibold">
            @if (sosTriggered()) {
              Help is on the way. Stay calm.
            } @else {
              Press and hold for emergency assistance
            }
          </p>
          @if (sosTriggered()) {
            <button (click)="cancelSOS()" class="btn btn-ghost btn-sm mt-2">
              Cancel (False Alarm)
            </button>
          }
        </div>
      </div>

      <!-- Status Overview -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg"
                   [class.bg-success/20]="allDevicesOk()"
                   [class.bg-warning/20]="!allDevicesOk()">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6"
                     [class.text-success]="allDevicesOk()"
                     [class.text-warning]="!allDevicesOk()"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-medium">
                  @if (allDevicesOk()) {
                    All Systems OK
                  } @else {
                    Attention Needed
                  }
                </p>
                <p class="text-xs text-base-content/60">System Status</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ devices().length }}</p>
                <p class="text-xs text-base-content/60">Devices</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-secondary/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ contacts().length }}</p>
                <p class="text-xs text-base-content/60">Contacts</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-info/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-medium">
                  @if (locationService.hasLocation()) {
                    Located
                  } @else {
                    Unknown
                  }
                </p>
                <p class="text-xs text-base-content/60">Location</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Devices Section -->
      <div class="card bg-base-100 shadow mb-6">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">My Devices</h2>
            <button routerLink="/emergency/devices/add" class="btn btn-ghost btn-sm">
              Add Device
            </button>
          </div>

          @if (devices().length === 0) {
            <div class="text-center py-8">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p class="text-base-content/60 mb-4">No emergency devices paired</p>
              <button routerLink="/emergency/devices/add" class="btn btn-primary btn-sm">
                Pair Device
              </button>
            </div>
          } @else {
            <div class="space-y-3">
              @for (device of devices(); track device.id) {
                <div class="flex items-center gap-4 p-3 rounded-lg bg-base-200">
                  <div class="text-2xl">
                    {{ getDeviceEmoji(device.type) }}
                  </div>
                  <div class="flex-1">
                    <p class="font-medium">{{ device.name }}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="badge badge-sm"
                            [class.badge-success]="device.status === 'active'"
                            [class.badge-warning]="device.status === 'low_battery'"
                            [class.badge-error]="device.status === 'offline'">
                        {{ device.status }}
                      </span>
                      @if (device.fallDetectionEnabled) {
                        <span class="badge badge-sm badge-ghost">Fall Detection</span>
                      }
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"
                           [class.text-success]="device.batteryLevel > 50"
                           [class.text-warning]="device.batteryLevel <= 50 && device.batteryLevel > 20"
                           [class.text-error]="device.batteryLevel <= 20"
                           fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span class="font-medium">{{ device.batteryLevel }}%</span>
                    </div>
                    <p class="text-xs text-base-content/60">Battery</p>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Emergency Contacts Section -->
      <div class="card bg-base-100 shadow mb-6">
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h2 class="card-title">Emergency Contacts</h2>
            <button routerLink="/emergency/contacts" class="btn btn-ghost btn-sm">
              Manage
            </button>
          </div>

          @if (contacts().length === 0) {
            <div class="alert alert-warning">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Add emergency contacts who will be notified in case of an emergency</span>
              <button routerLink="/emergency/contacts/add" class="btn btn-sm">Add Contact</button>
            </div>
          } @else {
            <div class="space-y-2">
              @for (contact of contacts(); track contact.id) {
                <div class="flex items-center gap-3 p-2">
                  <div class="avatar placeholder">
                    <div class="bg-neutral-focus text-neutral-content rounded-full w-10">
                      <span>{{ contact.name.charAt(0) }}</span>
                    </div>
                  </div>
                  <div class="flex-1">
                    <p class="font-medium">{{ contact.name }}</p>
                    <p class="text-sm text-base-content/60">{{ contact.relationship }}</p>
                  </div>
                  <div class="badge badge-outline">{{ contact.priority === 1 ? 'Primary' : 'Secondary' }}</div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-2 gap-4">
        <button routerLink="/emergency/history" class="btn btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </button>
        <button routerLink="/emergency/settings" class="btn btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      </div>
    </div>
  `
})
export class EmergencyDashboardComponent implements OnInit {
  private readonly alertService = inject(AlertService);
  readonly locationService = inject(LocationService);

  readonly sosTriggered = signal(false);

  // Sample data - in production this would come from EmergencyService
  readonly devices = signal<EmergencyDeviceSummary[]>([
    {
      id: '1',
      name: 'My Bracelet',
      type: 'bracelet',
      batteryLevel: 78,
      status: 'active',
      lastSeen: new Date(),
      fallDetectionEnabled: true,
    },
  ]);

  readonly contacts = signal<EmergencyContactSummary[]>([
    { id: '1', name: 'John Doe', phone: '+1 555-123-4567', relationship: 'Spouse', priority: 1 },
    { id: '2', name: 'Jane Doe', phone: '+1 555-987-6543', relationship: 'Child', priority: 2 },
  ]);

  readonly allDevicesOk = computed(() =>
    this.devices().every(d => d.status === 'active' && d.batteryLevel > 20)
  );

  ngOnInit(): void {
    // Request location permission on init
    this.locationService.requestPermission();
  }

  triggerSOS(): void {
    this.sosTriggered.set(true);
    // In production, this would trigger the emergency service
    console.log('SOS TRIGGERED');

    // Add alert
    this.alertService.addAlert({
      source: 'emergency',
      type: 'sos_triggered',
      priority: 'critical',
      title: 'SOS Alert Triggered',
      message: 'Emergency assistance requested',
      data: {
        location: this.locationService.currentPosition() || undefined,
      },
    });
  }

  cancelSOS(): void {
    this.sosTriggered.set(false);
    // In production, this would cancel the emergency
    console.log('SOS CANCELLED');
  }

  getDeviceEmoji(type: string): string {
    const emojis: Record<string, string> = {
      bracelet: '⌚',
      pendant: '📿',
      watch: '⌚',
    };
    return emojis[type] || '📱';
  }
}
