import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HabitsService } from '../../services/habits';

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './templates.html',
  styleUrl: './templates.scss'
})
export class TemplatesComponent {
  private habitsService = inject(HabitsService);
  
  protected readonly habits = this.habitsService.habits;
  protected readonly gameState = this.habitsService.gameState;
}
