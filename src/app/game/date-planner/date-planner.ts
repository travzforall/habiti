import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TournamentService } from '../tournament';
import { DatePlan, Girl } from '../models';

@Component({
  selector: 'app-date-planner',
  imports: [CommonModule, FormsModule],
  templateUrl: './date-planner.html',
  styleUrl: './date-planner.scss'
})
export class DatePlannerComponent implements OnInit {
  datePlans: DatePlan[] = [];
  girls: Girl[] = [];
  showDatePlanForm = false;
  
  newDatePlan = {
    girlId: '',
    title: '',
    description: '',
    location: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    duration: 120,
    budget: 100,
    activities: [] as string[],
    outfit: '',
    topics: [] as string[],
    goals: [] as string[],
    backupPlan: ''
  };

  constructor(public tournamentService: TournamentService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.datePlans = this.tournamentService.getDatePlans();
    this.girls = this.tournamentService.getGirls();
  }

  addDatePlan() {
    if (!this.newDatePlan.girlId || !this.newDatePlan.title) return;

    const datePlan: DatePlan = {
      id: Date.now().toString(),
      girlId: this.newDatePlan.girlId,
      title: this.newDatePlan.title,
      description: this.newDatePlan.description,
      location: this.newDatePlan.location,
      date: new Date(this.newDatePlan.date),
      time: this.newDatePlan.time,
      duration: this.newDatePlan.duration,
      budget: this.newDatePlan.budget,
      activities: this.newDatePlan.activities,
      outfit: this.newDatePlan.outfit,
      topics: this.newDatePlan.topics,
      goals: this.newDatePlan.goals,
      backupPlan: this.newDatePlan.backupPlan,
      status: 'planned'
    };

    this.tournamentService.addDatePlan(datePlan);
    this.resetDatePlanForm();
    this.loadData();
  }

  resetDatePlanForm() {
    this.showDatePlanForm = false;
    this.newDatePlan = {
      girlId: '',
      title: '',
      description: '',
      location: '',
      date: new Date().toISOString().split('T')[0],
      time: '19:00',
      duration: 120,
      budget: 100,
      activities: [],
      outfit: '',
      topics: [],
      goals: [],
      backupPlan: ''
    };
  }

  getUpcomingDates(): DatePlan[] {
    return this.tournamentService.getUpcomingDates();
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString();
  }

  completeDatePlan(planId: string) {
    const rating = prompt('Rate the date (1-5 stars):');
    const notes = prompt('Any notes about the date:');
    
    if (rating) {
      this.tournamentService.updateDatePlan(planId, {
        status: 'completed',
        rating: parseInt(rating),
        notes: notes || undefined
      });
      this.loadData();
    }
  }
}