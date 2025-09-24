import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../tournament';
import { Girl, Interaction, GameStats } from '../models';

@Component({
  selector: 'app-tournament',
  imports: [CommonModule, FormsModule],
  templateUrl: './tournament.html',
  styleUrl: './tournament.scss'
})
export class TournamentComponent implements OnInit {
  girls: Girl[] = [];
  interactions: Interaction[] = [];
  gameStats: GameStats | null = null;
  
  // New interaction form
  showInteractionForm = false;
  newInteraction = {
    girlId: '',
    type: 'conversation' as 'conversation' | 'date' | 'message' | 'call' | 'gift' | 'activity',
    description: '',
    duration: 30,
    quality: 'good' as 'great' | 'good' | 'okay' | 'poor',
    location: '',
    notes: '',
    mood: 'happy' as 'happy' | 'romantic' | 'fun' | 'serious' | 'awkward'
  };

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.girls = this.tournamentService.getGirls();
    this.interactions = this.tournamentService.getInteractions();
    this.gameStats = this.tournamentService.getGameStats();
  }

  getTopGirls() {
    return this.tournamentService.getTopGirls(3);
  }

  selectGirl(girl: Girl) {
    // Emit event to parent or navigate to profile
    // For now, we'll just log
    console.log('Selected girl:', girl.name);
  }

  addInteraction() {
    if (!this.newInteraction.girlId || !this.newInteraction.description) return;

    const interaction: Interaction = {
      id: Date.now().toString(),
      girlId: this.newInteraction.girlId,
      date: new Date(),
      type: this.newInteraction.type,
      description: this.newInteraction.description,
      duration: this.newInteraction.duration,
      quality: this.newInteraction.quality,
      points: this.calculateInteractionPoints(),
      location: this.newInteraction.location,
      notes: this.newInteraction.notes,
      mood: this.newInteraction.mood
    };

    this.tournamentService.addInteraction(interaction);
    this.resetInteractionForm();
    this.loadData();
  }

  calculateInteractionPoints(): number {
    const typePoints = {
      conversation: 5,
      date: 15,
      message: 3,
      call: 7,
      gift: 10,
      activity: 12
    };
    const qualityMultiplier = {
      great: 2,
      good: 1.5,
      okay: 1,
      poor: 0.5
    };
    
    return Math.round(typePoints[this.newInteraction.type] * qualityMultiplier[this.newInteraction.quality]);
  }

  resetInteractionForm() {
    this.showInteractionForm = false;
    this.newInteraction = {
      girlId: '',
      type: 'conversation',
      description: '',
      duration: 30,
      quality: 'good',
      location: '',
      notes: '',
      mood: 'happy'
    };
  }

  getMoodEmoji(mood: string): string {
    const moods: { [key: string]: string } = {
      happy: '😊',
      neutral: '😐',
      upset: '😔',
      excited: '🤩'
    };
    return moods[mood] || '😐';
  }

  getDaysSinceLastInteraction(date: Date | null): string {
    if (!date) return 'Never';
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  getInteractionTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      conversation: '💬',
      date: '❤️',
      message: '📱',
      call: '📞',
      gift: '🎁',
      activity: '🎯'
    };
    return icons[type] || '📝';
  }

  getQualityBadgeClass(quality: string): string {
    const classes: { [key: string]: string } = {
      great: 'badge-success',
      good: 'badge-primary',
      okay: 'badge-warning',
      poor: 'badge-error'
    };
    return classes[quality] || 'badge-ghost';
  }
}