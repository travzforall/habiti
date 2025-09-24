import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../tournament';
import { Girl } from '../models';

@Component({
  selector: 'app-profiles',
  imports: [CommonModule, FormsModule],
  templateUrl: './profiles.html',
  styleUrl: './profiles.scss'
})
export class ProfilesComponent implements OnInit {
  girls: Girl[] = [];
  selectedGirl: Girl | null = null;
  showAddGirlForm = false;
  viewMode: 'grid' | 'list' = 'grid';
  
  newGirl = {
    name: '',
    avatar: '👩',
    age: 25,
    location: '',
    profession: '',
    hobbies: [] as string[],
    lookingFor: [] as string[],
    dealBreakers: [] as string[]
  };

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.girls = this.tournamentService.getGirls();
  }

  addGirl() {
    if (!this.newGirl.name.trim()) return;

    const girl: Girl = {
      id: Date.now().toString(),
      name: this.newGirl.name,
      avatar: this.newGirl.avatar,
      age: this.newGirl.age,
      location: this.newGirl.location,
      profession: this.newGirl.profession,
      hobbies: this.newGirl.hobbies,
      lookingFor: this.newGirl.lookingFor,
      dealBreakers: this.newGirl.dealBreakers,
      totalPoints: 0,
      interactions: []
    };

    this.tournamentService.addGirl(girl);
    this.resetAddGirlForm();
    this.loadData();
  }

  resetAddGirlForm() {
    this.showAddGirlForm = false;
    this.newGirl = {
      name: '',
      avatar: '👩',
      age: 25,
      location: '',
      profession: '',
      hobbies: [],
      lookingFor: [],
      dealBreakers: []
    };
  }

  selectGirl(girl: Girl) {
    this.selectedGirl = girl;
  }

  closeProfile() {
    this.selectedGirl = null;
  }

  getInteractionCount(girlId: string): number {
    const girl = this.girls.find(g => g.id === girlId);
    return girl?.interactions?.length || 0;
  }

  getLastInteractionDate(girlId: string): Date | null {
    const girl = this.girls.find(g => g.id === girlId);
    if (!girl?.interactions?.length) return null;
    
    const lastInteraction = girl.interactions[girl.interactions.length - 1];
    return lastInteraction.date;
  }

  addHobby(hobby: string) {
    if (hobby.trim() && !this.newGirl.hobbies.includes(hobby.trim())) {
      this.newGirl.hobbies.push(hobby.trim());
    }
  }

  removeHobby(index: number) {
    this.newGirl.hobbies.splice(index, 1);
  }

  addLookingFor(item: string) {
    if (item.trim() && !this.newGirl.lookingFor.includes(item.trim())) {
      this.newGirl.lookingFor.push(item.trim());
    }
  }

  removeLookingFor(index: number) {
    this.newGirl.lookingFor.splice(index, 1);
  }

  addDealBreaker(item: string) {
    if (item.trim() && !this.newGirl.dealBreakers.includes(item.trim())) {
      this.newGirl.dealBreakers.push(item.trim());
    }
  }

  removeDealBreaker(index: number) {
    this.newGirl.dealBreakers.splice(index, 1);
  }

  getAvatarOptions(): string[] {
    return ['👩', '👩‍🦰', '👩‍🦱', '👩‍🦳', '👱‍♀️', '👩‍🦲', '🧑‍🦰', '🧑‍🦱', '🧑‍🦳', '👱', '🧑‍🦲'];
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  getStatusColor(girl: Girl): string {
    const daysSinceLastInteraction = this.getDaysSinceLastInteraction(girl.id);
    
    if (daysSinceLastInteraction === null) return 'badge-neutral';
    if (daysSinceLastInteraction <= 3) return 'badge-success';
    if (daysSinceLastInteraction <= 7) return 'badge-warning';
    return 'badge-error';
  }

  getStatusText(girl: Girl): string {
    const daysSinceLastInteraction = this.getDaysSinceLastInteraction(girl.id);
    
    if (daysSinceLastInteraction === null) return 'No contact';
    if (daysSinceLastInteraction === 0) return 'Today';
    if (daysSinceLastInteraction === 1) return 'Yesterday';
    if (daysSinceLastInteraction <= 7) return `${daysSinceLastInteraction} days ago`;
    return `${daysSinceLastInteraction} days ago`;
  }

  private getDaysSinceLastInteraction(girlId: string): number | null {
    const lastDate = this.getLastInteractionDate(girlId);
    if (!lastDate) return null;
    
    const today = new Date();
    const diffTime = today.getTime() - new Date(lastDate).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  isLookingForArray(lookingFor: any): boolean {
    return Array.isArray(lookingFor);
  }

  getLookingForArray(lookingFor: any): string[] {
    return Array.isArray(lookingFor) ? lookingFor : [];
  }
}
