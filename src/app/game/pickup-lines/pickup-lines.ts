import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../tournament';
import { PickupLine, Girl } from '../models';

@Component({
  selector: 'app-pickup-lines',
  imports: [CommonModule, FormsModule],
  templateUrl: './pickup-lines.html',
  styleUrl: './pickup-lines.scss'
})
export class PickupLinesComponent implements OnInit {
  pickupLines: PickupLine[] = [];
  girls: Girl[] = [];
  showPickupLineForm = false;
  
  newPickupLine = {
    text: '',
    category: 'funny',
    girlId: '',
    context: '',
    notes: ''
  };

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.pickupLines = this.tournamentService.getPickupLines();
    this.girls = this.tournamentService.getGirls();
  }

  addPickupLine() {
    if (!this.newPickupLine.text) return;

    const pickupLine: PickupLine = {
      id: Date.now().toString(),
      text: this.newPickupLine.text,
      category: this.newPickupLine.category as 'funny' | 'cute' | 'clever' | 'bold' | 'casual' | 'romantic' | 'cheesy' | 'nerdy',
      girlId: this.newPickupLine.girlId || undefined,
      context: this.newPickupLine.context,
      notes: this.newPickupLine.notes,
      dateCreated: new Date(),
      timesUsed: 0
    };

    this.tournamentService.addPickupLine(pickupLine);
    this.resetPickupLineForm();
    this.loadData();
  }

  resetPickupLineForm() {
    this.showPickupLineForm = false;
    this.newPickupLine = {
      text: '',
      category: 'funny',
      girlId: '',
      context: '',
      notes: ''
    };
  }

  ratePickupLine(lineId: string) {
    const rating = prompt('Rate this pickup line (1-5 stars):');
    const feedback = prompt('Any feedback or notes:');
    
    if (rating) {
      this.tournamentService.updatePickupLine(lineId, {
        rating: parseInt(rating),
        feedback: feedback || undefined,
        timesUsed: (this.pickupLines.find(p => p.id === lineId)?.timesUsed || 0) + 1
      });
      this.loadData();
    }
  }

  getCategoryIcon(category: string): string {
    const icons = {
      funny: '😂',
      cute: '🥰',
      clever: '🧠',
      bold: '🔥',
      casual: '😊'
    };
    return icons[category as keyof typeof icons] || '💬';
  }

  getCategoryColor(category: string): string {
    const colors = {
      funny: 'badge-warning',
      cute: 'badge-secondary',
      clever: 'badge-info',
      bold: 'badge-error',
      casual: 'badge-success'
    };
    return colors[category as keyof typeof colors] || 'badge-neutral';
  }

  getTopPickupLines(): PickupLine[] {
    return this.pickupLines
      .filter(line => line.rating && line.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5);
  }
}
