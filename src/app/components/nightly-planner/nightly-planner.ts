import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitsService, NightlyPlan } from '../../services/habits';

@Component({
  selector: 'app-nightly-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nightly-planner-minimal.html',
  styleUrl: './nightly-planner.scss'
})
export class NightlyPlannerComponent {
  private habitsService = inject(HabitsService);
  
  isOpen = signal(false);
  currentStep = signal(1);
  totalSteps = 5;
  
  plan = signal<NightlyPlan | null>(null);
  
  // Access to habits for the form
  protected readonly habits = this.habitsService.habits;
  
  // Temporary form data
  newAccomplishment = signal('');
  newChallenge = signal('');
  newGratitude = signal('');
  newPriority = signal('');
  newRoutineItem = signal('');

  ngOnInit() {
    // Check if today's plan already exists
    const existingPlan = this.habitsService.getNightlyPlan();
    if (existingPlan) {
      this.plan.set(existingPlan);
    } else {
      this.plan.set(this.habitsService.createNightlyPlan());
    }
  }

  openPlanner() {
    this.isOpen.set(true);
    this.currentStep.set(1);
  }

  closePlanner() {
    this.isOpen.set(false);
  }

  nextStep() {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(step => step + 1);
    }
  }

  previousStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  goToStep(step: number) {
    this.currentStep.set(step);
  }

  // Daily Reflection Methods
  addAccomplishment() {
    const accomplishment = this.newAccomplishment().trim();
    if (accomplishment && this.plan()) {
      const currentPlan = this.plan()!;
      currentPlan.dailyReflection.accomplishments.push(accomplishment);
      this.plan.set({ ...currentPlan });
      this.newAccomplishment.set('');
    }
  }

  removeAccomplishment(index: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.accomplishments.splice(index, 1);
      this.plan.set({ ...currentPlan });
    }
  }

  addChallenge() {
    const challenge = this.newChallenge().trim();
    if (challenge && this.plan()) {
      const currentPlan = this.plan()!;
      currentPlan.dailyReflection.challenges.push(challenge);
      this.plan.set({ ...currentPlan });
      this.newChallenge.set('');
    }
  }

  removeChallenge(index: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.challenges.splice(index, 1);
      this.plan.set({ ...currentPlan });
    }
  }

  addGratitude() {
    const gratitude = this.newGratitude().trim();
    if (gratitude && this.plan()) {
      const currentPlan = this.plan()!;
      currentPlan.dailyReflection.gratitude.push(gratitude);
      this.plan.set({ ...currentPlan });
      this.newGratitude.set('');
    }
  }

  removeGratitude(index: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.gratitude.splice(index, 1);
      this.plan.set({ ...currentPlan });
    }
  }

  updateEnergyLevel(level: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.energyLevel = level;
      this.plan.set({ ...currentPlan });
    }
  }

  updateMood(mood: 'great' | 'good' | 'okay' | 'challenging' | 'difficult') {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.mood = mood;
      this.plan.set({ ...currentPlan });
    }
  }

  updateLessonsLearned(lessons: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.dailyReflection.lessonsLearned = lessons;
      this.plan.set({ ...currentPlan });
    }
  }

  // Tomorrow's Plan Methods
  addPriority() {
    const priority = this.newPriority().trim();
    if (priority && this.plan()) {
      const currentPlan = this.plan()!;
      currentPlan.tomorrowsPlan.topPriorities.push(priority);
      this.plan.set({ ...currentPlan });
      this.newPriority.set('');
    }
  }

  removePriority(index: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.tomorrowsPlan.topPriorities.splice(index, 1);
      this.plan.set({ ...currentPlan });
    }
  }

  updateFocusArea(focus: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.tomorrowsPlan.focusArea = focus;
      this.plan.set({ ...currentPlan });
    }
  }

  updateEnergyPlan(energy: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.tomorrowsPlan.energyPlan = energy;
      this.plan.set({ ...currentPlan });
    }
  }

  // Sleep Plan Methods
  addRoutineItem() {
    const item = this.newRoutineItem().trim();
    if (item && this.plan()) {
      const currentPlan = this.plan()!;
      currentPlan.sleepPlan.routine.push(item);
      this.plan.set({ ...currentPlan });
      this.newRoutineItem.set('');
    }
  }

  removeRoutineItem(index: number) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.sleepPlan.routine.splice(index, 1);
      this.plan.set({ ...currentPlan });
    }
  }

  updateBedtime(time: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.sleepPlan.bedtime = time;
      this.plan.set({ ...currentPlan });
    }
  }

  updateWakeTime(time: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.sleepPlan.wakeTime = time;
      this.plan.set({ ...currentPlan });
    }
  }

  updateEnvironment(environment: string) {
    const currentPlan = this.plan();
    if (currentPlan) {
      currentPlan.sleepPlan.environment = environment;
      this.plan.set({ ...currentPlan });
    }
  }

  // Utility Methods
  getTodaysHabitSummary() {
    return this.habitsService.getTodaysHabitSummary();
  }

  getPlanningStreak() {
    return this.habitsService.getNightlyPlanStreak();
  }

  getEnergyLevelText(level: number): string {
    if (level >= 9) return 'Excellent';
    if (level >= 7) return 'Good';
    if (level >= 5) return 'Okay';
    if (level >= 3) return 'Low';
    return 'Very Low';
  }

  getMoodEmoji(mood: string): string {
    switch (mood) {
      case 'great': return '🌟';
      case 'good': return '😊';
      case 'okay': return '😐';
      case 'challenging': return '😬';
      case 'difficult': return '😰';
      default: return '😐';
    }
  }

  canProceedToNextStep(): boolean {
    const currentPlan = this.plan();
    if (!currentPlan) return false;

    switch (this.currentStep()) {
      case 1: // Daily reflection
        return currentPlan.dailyReflection.accomplishments.length > 0 || 
               currentPlan.dailyReflection.challenges.length > 0;
      case 2: // Gratitude & mood
        return currentPlan.dailyReflection.gratitude.length > 0;
      case 3: // Tomorrow's priorities
        return currentPlan.tomorrowsPlan.topPriorities.length > 0;
      case 4: // Sleep planning
        return currentPlan.sleepPlan.bedtime !== '';
      default:
        return true;
    }
  }

  savePlan() {
    const currentPlan = this.plan();
    if (currentPlan) {
      this.habitsService.saveNightlyPlan(currentPlan);
      this.closePlanner();
    }
  }

  getStepTitle(step: number): string {
    switch (step) {
      case 1: return 'Daily Reflection';
      case 2: return 'Gratitude & Mood';
      case 3: return 'Tomorrow\'s Plan';
      case 4: return 'Sleep Planning';
      case 5: return 'Review & Save';
      default: return '';
    }
  }

  // Helper methods for safe template access
  getCurrentPlan(): NightlyPlan {
    return this.plan() || this.habitsService.createNightlyPlan();
  }

  getAccomplishments(): string[] {
    return this.getCurrentPlan().dailyReflection.accomplishments;
  }

  getChallenges(): string[] {
    return this.getCurrentPlan().dailyReflection.challenges;
  }

  getGratitudeEntries(): string[] {
    return this.getCurrentPlan().dailyReflection.gratitude;
  }

  getEnergyLevel(): number {
    return this.getCurrentPlan().dailyReflection.energyLevel;
  }

  getMood(): string {
    return this.getCurrentPlan().dailyReflection.mood;
  }

  getLessonsLearned(): string {
    return this.getCurrentPlan().dailyReflection.lessonsLearned;
  }

  getTopPriorities(): string[] {
    return this.getCurrentPlan().tomorrowsPlan.topPriorities;
  }

  getFocusArea(): string {
    return this.getCurrentPlan().tomorrowsPlan.focusArea;
  }

  getEnergyPlan(): string {
    return this.getCurrentPlan().tomorrowsPlan.energyPlan;
  }

  getBedtime(): string {
    return this.getCurrentPlan().sleepPlan.bedtime;
  }

  getWakeTime(): string {
    return this.getCurrentPlan().sleepPlan.wakeTime;
  }

  getRoutineItems(): string[] {
    return this.getCurrentPlan().sleepPlan.routine;
  }

  getEnvironment(): string {
    return this.getCurrentPlan().sleepPlan.environment;
  }

  // Habit tracking methods for the form
  isHabitCompletedToday(habitId: string): boolean {
    return this.habitsService.isHabitCompletedOnDate(habitId, new Date());
  }

  toggleHabitToday(habitId: string): void {
    this.habitsService.toggleHabitForDate(habitId, new Date());
  }
}