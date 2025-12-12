import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';
import { HabitImporterService } from '../../services/habit-importer.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private habitsService = inject(HabitsService);
  private importerService = inject(HabitImporterService);

  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected importMessage = signal<string>('');
  protected importSuccess = signal<boolean>(false);
  protected isImporting = signal<boolean>(false);

  async onImportCSV(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isImporting.set(true);
    this.importMessage.set('');

    try {
      const count = await this.importerService.importFromFile(file);
      this.importSuccess.set(true);
      this.importMessage.set(`✅ Successfully imported ${count} habits!`);
    } catch (error) {
      this.importSuccess.set(false);
      this.importMessage.set('❌ Failed to import habits. Please check your CSV file format.');
      console.error('Import error:', error);
    } finally {
      this.isImporting.set(false);
      // Reset file input
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
    }
  }

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }
}
