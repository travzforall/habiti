import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService } from '../tournament';
import { MaleProfile, NonNegotiable, Trait } from '../models';

@Component({
  selector: 'app-male-profile',
  imports: [CommonModule],
  templateUrl: './male-profile.html',
  styleUrl: './male-profile.scss'
})
export class MaleProfileComponent implements OnInit {
  maleProfile: MaleProfile | null = null;

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.maleProfile = this.tournamentService.getMaleProfile();
  }

  toggleMaleTrait(traitId: string) {
    const trait = this.maleProfile?.traits.find(t => t.id === traitId);
    if (trait) {
      this.tournamentService.updateMaleTrait(traitId, !trait.active);
      this.loadData();
    }
  }

  toggleNonNegotiable(nnId: string) {
    const nn = this.maleProfile?.nonNegotiables.find(n => n.id === nnId);
    if (nn) {
      this.tournamentService.updateNonNegotiable(nnId, !nn.met);
      this.loadData();
    }
  }

  getNonNegotiablesMet(): number {
    return this.maleProfile?.nonNegotiables.filter(nn => nn.met).length || 0;
  }

  getNonNegotiablesTotal(): number {
    return this.maleProfile?.nonNegotiables.length || 0;
  }

  getPriorityIcon(priority: string): string {
    const icons = { critical: '🚨', high: '⚠️', medium: '⚡', low: '📝' };
    return icons[priority as keyof typeof icons] || '📝';
  }

  getCategoryIcon(category: string): string {
    const icons = {
      physical: '💪', mental: '🧠', emotional: '❤️', social: '👥', financial: '💰',
      values: '⭐', lifestyle: '🏡', personality: '😊', goals: '🎯'
    };
    return icons[category as keyof typeof icons] || '📋';
  }
}