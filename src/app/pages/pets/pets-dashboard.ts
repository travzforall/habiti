import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AlertService } from '../../services/alert.service';

interface PetSummary {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'other';
  breed?: string;
  photoUrl?: string;
  hasDevice: boolean;
  deviceBattery?: number;
  lastLocation?: { lat: number; lng: number };
  todaySteps?: number;
  todayActiveMinutes?: number;
}

@Component({
  selector: 'app-pets-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-base-200 p-4 pb-24">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold">My Pets</h1>
          <p class="text-base-content/60">Track and manage your furry friends</p>
        </div>
        <button routerLink="/pets/add" class="btn btn-primary gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Add Pet
        </button>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="text-3xl">{{ getPetEmoji('dog') }}</div>
              <div>
                <p class="text-2xl font-bold">{{ pets().length }}</p>
                <p class="text-xs text-base-content/60">Total Pets</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-success/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ connectedDevices() }}</p>
                <p class="text-xs text-base-content/60">Connected</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ totalStepsToday() | number }}</p>
                <p class="text-xs text-base-content/60">Steps Today</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-warning/20">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-2xl font-bold">{{ totalActiveMinutes() }}</p>
                <p class="text-xs text-base-content/60">Active Min</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pet Alerts -->
      @if (petAlerts().length > 0) {
        <div class="alert alert-warning mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{{ petAlerts().length }} alert(s) require attention</span>
          <button class="btn btn-sm">View</button>
        </div>
      }

      <!-- Pets Grid -->
      @if (pets().length === 0) {
        <div class="card bg-base-100 shadow">
          <div class="card-body text-center py-12">
            <div class="text-6xl mb-4">🐾</div>
            <h3 class="font-semibold text-lg mb-2">No Pets Added Yet</h3>
            <p class="text-base-content/60 mb-4">Add your first pet to start tracking their health and location</p>
            <button routerLink="/pets/add" class="btn btn-primary">
              Add Your First Pet
            </button>
          </div>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (pet of pets(); track pet.id) {
            <a [routerLink]="['/pets', pet.id]" class="card bg-base-100 shadow hover:shadow-lg transition-shadow cursor-pointer">
              <div class="card-body">
                <div class="flex items-start gap-4">
                  <!-- Pet Avatar -->
                  <div class="avatar">
                    <div class="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center">
                      @if (pet.photoUrl) {
                        <img [src]="pet.photoUrl" [alt]="pet.name" class="rounded-full">
                      } @else {
                        <span class="text-3xl">{{ getPetEmoji(pet.species) }}</span>
                      }
                    </div>
                  </div>

                  <!-- Pet Info -->
                  <div class="flex-1">
                    <h3 class="font-bold text-lg">{{ pet.name }}</h3>
                    <p class="text-sm text-base-content/60">
                      {{ pet.breed || (pet.species | titlecase) }}
                    </p>

                    <!-- Device Status -->
                    @if (pet.hasDevice) {
                      <div class="flex items-center gap-2 mt-2">
                        <div class="badge badge-sm"
                             [class.badge-success]="pet.deviceBattery && pet.deviceBattery > 20"
                             [class.badge-warning]="pet.deviceBattery && pet.deviceBattery <= 20">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                          </svg>
                          {{ pet.deviceBattery }}%
                        </div>
                        @if (pet.lastLocation) {
                          <div class="badge badge-sm badge-ghost">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            Located
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="mt-2">
                        <span class="badge badge-sm badge-ghost">No device</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Activity Stats -->
                @if (pet.hasDevice && (pet.todaySteps || pet.todayActiveMinutes)) {
                  <div class="divider my-2"></div>
                  <div class="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p class="text-lg font-bold">{{ pet.todaySteps || 0 | number }}</p>
                      <p class="text-xs text-base-content/60">Steps</p>
                    </div>
                    <div>
                      <p class="text-lg font-bold">{{ pet.todayActiveMinutes || 0 }}</p>
                      <p class="text-xs text-base-content/60">Active min</p>
                    </div>
                  </div>
                }
              </div>
            </a>
          }
        </div>
      }

      <!-- Quick Actions -->
      <div class="fixed bottom-20 right-4 flex flex-col gap-2">
        <button routerLink="/pets/training" class="btn btn-circle btn-secondary shadow-lg" title="Training">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
      </div>
    </div>
  `
})
export class PetsDashboardComponent implements OnInit {
  private readonly alertService = inject(AlertService);

  // Sample data - in production this would come from PetService
  readonly pets = signal<PetSummary[]>([
    {
      id: '1',
      name: 'Max',
      species: 'dog',
      breed: 'Golden Retriever',
      hasDevice: true,
      deviceBattery: 85,
      lastLocation: { lat: 40.7128, lng: -74.006 },
      todaySteps: 4523,
      todayActiveMinutes: 45,
    },
    {
      id: '2',
      name: 'Luna',
      species: 'cat',
      breed: 'Persian',
      hasDevice: true,
      deviceBattery: 12,
      todaySteps: 1200,
      todayActiveMinutes: 15,
    },
    {
      id: '3',
      name: 'Tweety',
      species: 'bird',
      hasDevice: false,
    },
  ]);

  readonly connectedDevices = computed(() =>
    this.pets().filter(p => p.hasDevice).length
  );

  readonly totalStepsToday = computed(() =>
    this.pets().reduce((sum, p) => sum + (p.todaySteps || 0), 0)
  );

  readonly totalActiveMinutes = computed(() =>
    this.pets().reduce((sum, p) => sum + (p.todayActiveMinutes || 0), 0)
  );

  readonly petAlerts = computed(() =>
    this.alertService.getFilteredAlerts({ sources: ['pet'], acknowledged: false })
  );

  ngOnInit(): void {}

  getPetEmoji(species: string): string {
    const emojis: Record<string, string> = {
      dog: '🐕',
      cat: '🐈',
      bird: '🐦',
      rabbit: '🐰',
      hamster: '🐹',
      fish: '🐠',
      reptile: '🦎',
      other: '🐾',
    };
    return emojis[species] || emojis['other'];
  }
}
